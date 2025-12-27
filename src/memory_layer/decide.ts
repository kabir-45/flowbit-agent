import { AuditEntry } from '../type';

export function decide(
  normalizedFields: Record<string, any>,
  corrections: string[],
  usedMemoryConfidences: number[],
  invoiceConfidence: number,
  auditTrail: AuditEntry[]
): { requiresReview: boolean; reasoning: string; confidenceScore: number } {

  // Critical structural fields
  const missingCritical =
    !normalizedFields.invoiceNumber ||
    !normalizedFields.invoiceDate;

  // Aggregate confidence
  const memoryConfidence =
    usedMemoryConfidences.length > 0
      ? usedMemoryConfidences.reduce((a, b) => a + b, 0) /
        usedMemoryConfidences.length
      : 0;

  const confidenceScore =
    invoiceConfidence * (memoryConfidence || 1);

  let requiresReview = true;
  let reasoning = '';

  // Decision Rules
  if (missingCritical) {
    requiresReview = true;
    reasoning = 'Critical invoice identifiers missing after memory application.';
  } else if (
    memoryConfidence >= 0.8 &&
    invoiceConfidence >= 0.8
  ) {
    requiresReview = false;
    reasoning = 'Auto-approved based on validated high-confidence memory.';
  } else if (corrections.length > 0) {
    requiresReview = true;
    reasoning =
      `Corrections suggested but confidence insufficient ` +
      `(memory ${memoryConfidence.toFixed(2)}, extraction ${invoiceConfidence.toFixed(2)}).`;
  } else {
    requiresReview = true;
    reasoning =
      'No applicable memory found; invoice requires human review.';
  }

  auditTrail.push({
    step: 'decide',
    timestamp: new Date().toISOString(),
    details: `Decision=${requiresReview ? 'REVIEW' : 'APPROVE'}, ` +
             `confidenceScore=${confidenceScore.toFixed(2)}`
  });

  return { requiresReview, reasoning, confidenceScore };
}
