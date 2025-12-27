import { initDB } from './db';
import { MemoryEngine } from './engine';
import { Invoice } from './type';

// INIT
initDB();
const engine = new MemoryEngine();

// INVOICE C-002 (NO MEMORY)
const invoice1: Invoice = {
  invoiceId: "INV-C-002",
  vendor: "Freight & Co",
  confidence: 0.73,
  rawText: "Invoice: FC-1002\nPO: PO-C-900\nService: Seefracht\n...",
  fields: {
    invoiceNumber: "FC-1002",
    invoiceDate: "10.03.2024",
    currency: "EUR",
    poNumber: "PO-C-900",
    netTotal: 1000.0,
    taxRate: 0.19,
    taxTotal: 190.0,
    grossTotal: 1190.0,
    lineItems: [
      {
        sku: null,
        description: "Seefracht / Shipping",
        qty: 1,
        unitPrice: 1000.0
      }
    ]
  }
};

console.log("\n=== DEMO: FIRST RUN (NO MEMORY) ===");
const result1 = engine.processInvoice(invoice1);
console.log(JSON.stringify(result1, null, 2));

// HUMAN FEEDBACK → LEARNING
console.log("\n=== HUMAN APPROVES & CORRECTS SKU ===\n");

engine.learnFromHuman(
  invoice1,
  true // approved
);

// INVOICE C-003 (AFTER LEARNING)
const invoice2: Invoice = {
  invoiceId: "INV-C-003",
  vendor: "Freight & Co",
  confidence: 0.75,
  rawText: "Invoice: FC-1003\nService: Shipping\n...",
  fields: {
    invoiceNumber: "FC-1003",
    invoiceDate: "18.03.2024",
    currency: "EUR",
    netTotal: 800.0,
    taxRate: 0.19,
    taxTotal: 152.0,
    grossTotal: 952.0,
    lineItems: [
      {
        sku: null,
        description: "Shipping",
        qty: 1,
        unitPrice: 800.0
      }
    ]
  }
};

console.log("\n=== SECOND RUN (AFTER LEARNING) ===");
const result2 = engine.processInvoice(invoice2);
console.log(JSON.stringify(result2, null, 2));

console.log("\n=== DEMO COMPLETE ===");
