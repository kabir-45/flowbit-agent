import db from '../db';
import { Memory, AuditEntry } from '../type';

interface LearnInput {
  invoiceId: string;
  vendor: string;
  usedMemoryIds: number[];
  decisionApproved: boolean;
  isDuplicate: boolean;
  auditTrail: AuditEntry[];
}

export function learn({
  invoiceId,
  vendor,
  usedMemoryIds,
  decisionApproved,
  isDuplicate,
  auditTrail
}: LearnInput): string[] {

  const memoryUpdates: string[] = [];
  const now = new Date().toISOString();


  if (isDuplicate) {
    auditTrail.push({
      step: 'learn',
      timestamp: now,
      details: `Learning skipped: invoice ${invoiceId} marked as duplicate`
    });

    return [`Skipped learning due to duplicate invoice (${invoiceId})`];
  }

  // update used memories
  const updateStmt = db.prepare(`
    UPDATE memories
    SET
      confidence = ?,
      reinforcementCount = reinforcementCount + ?,
      decayCount = decayCount + ?,
      lastUsedAt = ?
    WHERE id = ?
  `);

  const getStmt = db.prepare(`
    SELECT confidence, reinforcementCount, decayCount
    FROM memories
    WHERE id = ?
  `);

  for (const memId of usedMemoryIds) {
    const row = getStmt.get(memId) as any;
    if (!row) continue;

    let newConfidence = row.confidence;

    if (decisionApproved) {
      newConfidence = Math.min(0.95, newConfidence + 0.1);
      updateStmt.run(
        newConfidence,
        1,      // reinforcement
        0,      // no decay
        now,
        memId
      );

      memoryUpdates.push(
        `Reinforced memory ${memId} (confidence → ${newConfidence.toFixed(2)})`
      );

    } else {
      newConfidence = Math.max(0.1, newConfidence - 0.2);
      updateStmt.run(
        newConfidence,
        0,
        1,      // decay
        now,
        memId
      );

      memoryUpdates.push(
        `Weakened memory ${memId} (confidence → ${newConfidence.toFixed(2)})`
      );
    }
  }

  // RESOLUTION MEMORY
  db.prepare(`
    INSERT OR IGNORE INTO memories (
      vendor,
      type,
      memoryKey,
      value,
      confidence,
      reinforcementCount,
      decayCount,
      createdAt
    )
    VALUES (?, 'RESOLUTION', ?, ?, 0.5, 0, 0, ?)
  `).run(
    vendor,
    `invoice_resolution_${invoiceId}`,
    JSON.stringify({
      invoiceId,
      decision: decisionApproved ? 'approved' : 'rejected'
    }),
    now
  );

  memoryUpdates.push(
    `Recorded resolution memory for invoice ${invoiceId} (${decisionApproved ? 'approved' : 'rejected'})`
  );

  auditTrail.push({
    step: 'learn',
    timestamp: now,
    details: `Learning completed: ${memoryUpdates.length} update(s)`
  });

  return memoryUpdates;
}
