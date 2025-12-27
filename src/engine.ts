import db from './db';
import { Invoice, Result, AuditEntry, HumanFeedback } from './type';
import { recallMemories } from './memory_layer/recall';
import { applyMemories } from './memory_layer/apply';
import { decide } from './memory_layer/decide';
import { learn } from './memory_layer/learn';

export class MemoryEngine {

  private auditTrail: AuditEntry[] = [];
  private lastUsedMemoryIds: number[] = [];

  private log(step: AuditEntry['step'], details: string) {
    this.auditTrail.push({
      step,
      timestamp: new Date().toISOString(),
      details
    });
  }

  /* ===============================
     MAIN PIPELINE
     =============================== */
  public processInvoice(invoice: Invoice): Result {
    this.auditTrail = [];
    this.lastUsedMemoryIds = [];

    this.log('recall', `Processing invoice ${invoice.invoiceId} (${invoice.vendor})`);

    /* ---------- DUPLICATE CHECK ---------- */
    const duplicate = db.prepare(`
      SELECT 1
      FROM invoice_history
      WHERE vendor = ?
        AND invoiceNumber = ?
        AND ABS(julianday(invoiceDate) - julianday(?)) <= 5
      LIMIT 1
    `).get(
      invoice.vendor,
      invoice.fields.invoiceNumber,
      invoice.fields.invoiceDate
    );

    if (duplicate) {
      this.log('decide', 'Duplicate invoice detected');

      db.prepare(`
        INSERT OR IGNORE INTO invoice_history
          (invoiceId, vendor, invoiceNumber, invoiceDate, resolution)
        VALUES (?, ?, ?, ?, 'duplicate')
      `).run(
        invoice.invoiceId,
        invoice.vendor,
        invoice.fields.invoiceNumber,
        invoice.fields.invoiceDate
      );

      return {
        normalizedInvoice: invoice.fields,
        proposedCorrections: [],
        requiresHumanReview: true,
        reasoning: 'Duplicate invoice detected (same vendor, number, close date)',
        confidenceScore: 0,
        memoryUpdates: ['Duplicate invoice — learning suppressed'],
        auditTrail: this.auditTrail
      };
    }

    /* ---------- RECALL ---------- */
    const memories = recallMemories(invoice.vendor, this.auditTrail);

    /* ---------- APPLY ---------- */
    const { normalized, corrections, usedMemoryIds } =
      applyMemories(invoice, memories, this.auditTrail);

    this.lastUsedMemoryIds = usedMemoryIds;

    const usedMemoryConfidences = memories
      .filter(m => usedMemoryIds.includes(m.id))
      .map(m => m.confidence);

    /* ---------- DECIDE ---------- */
    const decision = decide(
      normalized,
      corrections,
      usedMemoryConfidences,
      invoice.confidence,
      this.auditTrail
    );

    return this.buildResult(
      normalized,
      corrections,
      decision.requiresReview,
      decision.reasoning,
      decision.confidenceScore,
      []
    );
  }

  /* ===============================
     LEARN FROM HUMAN
     =============================== */
  public learnFromHuman(invoice: Invoice, feedback: HumanFeedback): string[] {
    const { approved, corrections } = feedback;

    // Do NOT learn from duplicates
    if (
      db.prepare(
        `SELECT 1 FROM invoice_history WHERE invoiceId = ? AND resolution = 'duplicate'`
      ).get(invoice.invoiceId)
    ) {
      return ['Duplicate invoice — learning skipped'];
    }

    this.auditTrail = [];
    this.log('learn', `Learning from human decision on ${invoice.invoiceId}`);

    const now = new Date().toISOString();
    const memoryUpdates: string[] = [];

    /* ---------- BOOTSTRAP: FIELD LABEL → FIELD ---------- */
    if (
      invoice.fields.serviceDate === null &&
      /leistungsdatum/i.test(invoice.rawText)
    ) {
      db.prepare(`
        INSERT OR IGNORE INTO memories (
          vendor, type, memoryKey, value,
          confidence, reinforcementCount, decayCount, createdAt
        )
        VALUES (?, 'VENDOR', ?, ?, 0.7, 1, 0, ?)
      `).run(
        invoice.vendor,
        'field_mapping_leistungsdatum',
        JSON.stringify({
          action: 'FIELD_MAPPING',
          targetField: 'serviceDate',
          pattern: 'Leistungsdatum'
        }),
        now
      );

      memoryUpdates.push('Learned field mapping: Leistungsdatum → serviceDate');
    }

    /* ---------- BOOTSTRAP: SKU FROM DESCRIPTION ---------- */
    for (const item of invoice.fields.lineItems || []) {
      if (!item.sku && typeof item.description === 'string') {
        if (/(seefracht|shipping)/i.test(item.description)) {
          db.prepare(`
            INSERT OR IGNORE INTO memories (
              vendor, type, memoryKey, value,
              confidence, reinforcementCount, decayCount, createdAt
            )
            VALUES (?, 'VENDOR', ?, ?, 0.7, 1, 0, ?)
          `).run(
            invoice.vendor,
            'sku_from_description',
            JSON.stringify({
              action: 'SKU_MAPPING',
              patterns: ['seefracht', 'shipping'],
              mappedSku: 'FREIGHT'
            }),
            now
          );

          memoryUpdates.push('Learned SKU mapping: Seefracht/Shipping → FREIGHT');
        }
      }
    }

    /* ---------- BOOTSTRAP: CURRENCY ---------- */
    if (
      invoice.fields.currency === null &&
      /\b(EUR|USD|GBP)\b/i.test(invoice.rawText)
    ) {
      const currency = invoice.rawText.match(/\b(EUR|USD|GBP)\b/i)![1].toUpperCase();

      db.prepare(`
        INSERT OR IGNORE INTO memories (
          vendor, type, memoryKey, value,
          confidence, reinforcementCount, decayCount, createdAt
        )
        VALUES (?, 'VENDOR', ?, ?, 0.7, 1, 0, ?)
      `).run(
        invoice.vendor,
        'currency_from_rawtext',
        JSON.stringify({
          action: 'CURRENCY_RECOVERY',
          currency
        }),
        now
      );

      memoryUpdates.push(`Learned currency recovery → ${currency}`);
    }

    /* ---------- BOOTSTRAP: VAT INCLUDED ---------- */
    if (/(mwst\.?\s*inkl|prices?\s+incl\.?\s+vat)/i.test(invoice.rawText)) {
      db.prepare(`
        INSERT OR IGNORE INTO memories (
          vendor, type, memoryKey, value,
          confidence, reinforcementCount, decayCount, createdAt
        )
        VALUES (?, 'CORRECTION', ?, ?, 0.7, 1, 0, ?)
      `).run(
        invoice.vendor,
        'vat_included_rule',
        JSON.stringify({
          action: 'VAT_INCLUDED',
          keywords: ['mwst', 'vat', 'inkl', 'incl']
        }),
        now
      );

      memoryUpdates.push('Learned VAT-included correction rule');
    }

    /* ---------- REINFORCEMENT / DECAY ---------- */
    const learned = learn({
      invoiceId: invoice.invoiceId,
      vendor: invoice.vendor,
      usedMemoryIds: this.lastUsedMemoryIds,
      decisionApproved: approved,
      isDuplicate: false,
      auditTrail: this.auditTrail
    });

    memoryUpdates.push(...learned);

    /* ---------- STORE HISTORY ---------- */
    db.prepare(`
      INSERT OR REPLACE INTO invoice_history
        (invoiceId, vendor, invoiceNumber, invoiceDate, resolution)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      invoice.invoiceId,
      invoice.vendor,
      invoice.fields.invoiceNumber,
      invoice.fields.invoiceDate,
      approved ? 'approved' : 'rejected'
    );

    return memoryUpdates;
  }

  /* ===============================
     RESULT BUILDER
     =============================== */
  private buildResult(
    normalized: any,
    corrections: string[],
    requiresReview: boolean,
    reasoning: string,
    confidenceScore: number,
    memoryUpdates: string[]
  ): Result {
    return {
      normalizedInvoice: normalized,
      proposedCorrections: corrections,
      requiresHumanReview: requiresReview,
      reasoning,
      confidenceScore,
      memoryUpdates,
      auditTrail: this.auditTrail
    };
  }
}
