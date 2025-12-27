// core types

export interface LineItem{
    sku?: string | null;
    description?: string | null;
    qty:number;
    unitPrice: number;
    [key: string]: any;
}

export interface InvoiceFields{
      invoiceNumber: string;
      invoiceDate: string;
      serviceDate?: string | null;
      currency?: string | null;
      poNumber?: string | null;
      netTotal?: number;
      taxRate?: number;
      taxTotal?: number;
      grossTotal?: number;
      lineItems?: LineItem[];
      [key: string]: any;
}

export interface Invoice{
    invoiceId: string;
    vendor: string;
    fields: InvoiceFields;
    confidence: number;
    rawText: string;
}

// memory types

export type MemoryType =
    | 'VENDOR' | 'CORRECTION' | 'RESOLUTION';

export interface Memory{
    id: number;
    vendor: string;
    type: MemoryType;

    key: string;
    value: Record<string, any>;

    confidence: number;
    reinforcementCount: number;
    decayCount: number;
    lastUsedAt?: string;
    createdAt: string;

}

// audit

export type AuditStep =
    | 'recall' | 'apply' | 'decide' | 'learn';

export interface AuditEntry{
    step: AuditStep;
    timestamp: string;
    details: string;
}

// result processing

export interface Result{
  normalizedInvoice: Record<string, any>;
  proposedCorrections: string[];
  requiresHumanReview: boolean;
  reasoning: string;
  confidenceScore: number;
  memoryUpdates: string[];
  auditTrail: AuditEntry[];
}
