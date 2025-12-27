import { initDB } from './db';
import { MemoryEngine } from './engine';
import { Invoice } from './type';


// 0. Fresh DB (delete memory.sqlite before running video)
initDB();
const engine = new MemoryEngine();

//   INVOICE #1 — BEFORE LEARNING

const invoice1: Invoice = {
  invoiceId: 'INV-A-001',
  vendor: 'Supplier GmbH',
  confidence: 0.78,
  rawText: 'Rechnungsnr: INV-2024-001\nLeistungsdatum: 01.01.2024',
  fields: {
    invoiceNumber: 'INV-2024-001',
    invoiceDate: '12.01.2024',
    serviceDate: null,
    currency: 'EUR',
    netTotal: 2500,
    taxRate: 0.19,
    taxTotal: 475,
    grossTotal: 2975,
    lineItems: [
      { sku: 'WIDGET-001', qty: 100, unitPrice: 25 }
    ]
  }
};

console.log('\n=== RUN 1: INV-A-001 (NO MEMORY) ===');
const result1 = engine.processInvoice(invoice1);
console.log(JSON.stringify(result1, null, 2));



 //  HUMAN CORRECTION (FROM LOGS)


console.log('\n=== HUMAN CORRECTION APPLIED ===');

engine.learnFromHuman(invoice1, {
  approved: true,
  corrections: [
    {
      field: 'serviceDate',
      from: null,
      to: '2024-01-01',
      reason: 'Leistungsdatum found in raw text'
    }
  ]
});



 //  INVOICE #2 — AFTER LEARNING


const invoice2: Invoice = {
  invoiceId: 'INV-A-002',
  vendor: 'Supplier GmbH',
  confidence: 0.82,
  rawText: 'Rechnungsnr: INV-2024-002\nLeistungsdatum: 15.01.2024',
  fields: {
    invoiceNumber: 'INV-2024-002',
    invoiceDate: '18.01.2024',
    serviceDate: null,
    currency: 'EUR',
    netTotal: 1000.0,
    taxRate: 0.19,
    taxTotal: 190.0,
    grossTotal: 1190.0,
    lineItems: [
      { sku: 'WIDGET-001', qty: 40, unitPrice: 25.0 }
    ]
  }
};

console.log('\n=== RUN 2: INV-A-002 (AFTER LEARNING) ===');
const result2 = engine.processInvoice(invoice2);
console.log(JSON.stringify(result2, null, 2));

console.log('\n=== DEMO COMPLETE ===');
