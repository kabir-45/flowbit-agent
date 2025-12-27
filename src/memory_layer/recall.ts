import db from '../db';
import { Memory, AuditEntry } from '../type';

const MIN_RECALL_CONFIDENCE = 0.6;

export function recallMemories(vendor: string, auditTrail: AuditEntry[]): Memory[] {
  const now = new Date();

  const rawMemories = db.prepare(`
    SELECT 
      id,
      vendor,
      type,
      memoryKey as key,
      value,
      confidence,
      reinforcementCount,
      decayCount,
      lastUsedAt,
      createdAt
    FROM memories WHERE vendor = ? AND confidence >= ? ORDER BY confidence DESC`).all(vendor, MIN_RECALL_CONFIDENCE); // changed

  const memories: Memory[] = rawMemories.map((m: any) => {
    // time based decayt
    if (m.lastUsedAt) {
      const daysUnused =
        (now.getTime() - new Date(m.lastUsedAt).getTime()) /
        (1000 * 60 * 60 * 24);

      if (daysUnused > 20) {
        m.confidence = Math.max(0.1, m.confidence * 0.9);
      }
    }

    return {
      ...m,
      value: JSON.parse(m.value)
    };
  });

  auditTrail.push({
    step: 'recall',
    timestamp: now.toISOString(),
    details: `Recalled ${memories.length} memories for vendor ${vendor} `
  });

  return memories;
}
