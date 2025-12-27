import { Invoice, Memory, AuditEntry } from '../type';

export function applyMemories(
  invoice: Invoice,
  memories: Memory[],
  auditTrail: AuditEntry[]
): {
  normalized: Record<string, any>;
  corrections: string[];
  usedMemoryIds: number[];
} {
  const normalized = JSON.parse(JSON.stringify(invoice.fields));
  const corrections: string[] = [];
  const usedMemoryIds = new Set<number>();

  for (const mem of memories) {
    switch (mem.type) {


        // VENDOR MEMORIES

      case 'VENDOR': {

        // FIELD MAPPING
        if (
          mem.value?.action === 'FIELD_MAPPING' &&
          mem.confidence >= 0.7
        ) {
          const { targetField, pattern } = mem.value;

          if (!normalized[targetField]) {
            const regex = new RegExp(
              `${pattern}[:\\s]*?(\\d{2}[.\\-]\\d{2}[.\\-]\\d{4}|\\d{4}-\\d{2}-\\d{2})`,
              'i'
            );

            const match = invoice.rawText.match(regex);
            if (match) {
              normalized[targetField] = match[1];
              corrections.push(`Mapped '${pattern}' → '${targetField}'`);
              usedMemoryIds.add(mem.id);

              auditTrail.push({
                step: 'apply',
                timestamp: new Date().toISOString(),
                details: `Vendor memory applied (${pattern} → ${targetField})`
              });
            }
          }
        }

        // SKU MAPPING
        if (
          mem.value?.action === 'SKU_MAPPING' &&
          mem.confidence >= 0.7
        ) {
          const patterns: string[] = mem.value.patterns ?? [];
          const mappedSku: string = mem.value.mappedSku;
          const lineItems = normalized.lineItems ?? [];

          for (const item of lineItems) {
            if (
              !item.sku &&
              typeof item.description === 'string' &&
              patterns.some(p =>
                item.description.toLowerCase().includes(p.toLowerCase())
              )
            ) {
              item.sku = mappedSku;
              corrections.push(
                `Mapped description '${item.description}' → SKU ${mappedSku}`
              );
              usedMemoryIds.add(mem.id);

              auditTrail.push({
                step: 'apply',
                timestamp: new Date().toISOString(),
                details: `Vendor memory applied (description → SKU ${mappedSku})`
              });
            }
          }
        }

        // CURRENCY RECOVERY
        if (
          mem.value?.action === 'CURRENCY_RECOVERY' &&
          mem.confidence >= 0.7 &&
          !normalized.currency
        ) {
          const match = invoice.rawText.match(/\b(EUR|USD|GBP)\b/i);
          if (match) {
            normalized.currency = match[1].toUpperCase();
            corrections.push(`Recovered currency ${normalized.currency} from rawText`);
            usedMemoryIds.add(mem.id);

            auditTrail.push({
              step: 'apply',
              timestamp: new Date().toISOString(),
              details: `Vendor memory applied (currency → ${normalized.currency})`
            });
          }
        }

        break;
      }

        // CORRECTION MEMORIES

        case 'CORRECTION': {
          if (
            mem.value?.action === 'VAT_INCLUDED' &&
            mem.confidence >= 0.7 &&
            normalized.grossTotal !== undefined &&
            normalized.taxRate !== undefined
          ) {
            const net = normalized.netTotal;
            const tax = normalized.taxTotal;
            const gross = normalized.grossTotal;

            const numericallyConsistent =
              net !== undefined &&
              tax !== undefined &&
              Math.abs(net + tax - gross) < 0.02;

            // MODE 1: VAT VALIDATION (no correction needed)
            if (numericallyConsistent) {
              usedMemoryIds.add(mem.id);

              auditTrail.push({
                step: 'apply',
                timestamp: new Date().toISOString(),
                details: 'VAT-included rule validated (numeric consistency)'
              });
            }

            // MODE 2: VAT CORRECTION
            else if (net === undefined) {
              const inferredNet = gross / (1 + normalized.taxRate);
              const inferredTax = gross - inferredNet;

              normalized.netTotal = Number(inferredNet.toFixed(2));
              normalized.taxTotal = Number(inferredTax.toFixed(2));

              corrections.push('Recalculated net/tax using VAT-included rule');
              usedMemoryIds.add(mem.id);

              auditTrail.push({
                step: 'apply',
                timestamp: new Date().toISOString(),
                details: 'VAT-included rule applied (correction)'
              });
            }
          }

          break;
        }

    }
  }

  return {
    normalized,
    corrections,
    usedMemoryIds: Array.from(usedMemoryIds)
  };
}
