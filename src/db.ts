import Database from 'better-sqlite3';

import path from 'path';

const db = new Database(
  path.join(process.cwd(), 'memory.sqlite')
);

export function initDB() {

  db.exec(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vendor TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('VENDOR', 'CORRECTION', 'RESOLUTION')),

      memoryKey TEXT NOT NULL,
      value TEXT NOT NULL,            -- Stores JSON.stringify(data)

      confidence REAL DEFAULT 0.5,
      reinforcementCount INTEGER DEFAULT 0,
      decayCount INTEGER DEFAULT 0,
      lastUsedAt TEXT,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,

      UNIQUE(vendor, type, memoryKey) -- Ensures we don't learn the same rule twice
    );

    -- Indexes ensures lookups remain fast (milliseconds) even with 100k+ rules
    CREATE INDEX IF NOT EXISTS idx_memories_vendor
      ON memories(vendor);
  `);

db.exec(`
  CREATE TABLE IF NOT EXISTS invoice_history (
    invoiceId TEXT PRIMARY KEY,
    vendor TEXT NOT NULL,
    invoiceNumber TEXT NOT NULL,
    invoiceDate TEXT NOT NULL,
    processedAt TEXT DEFAULT CURRENT_TIMESTAMP,
    resolution TEXT CHECK (resolution IN ('approved', 'rejected', 'duplicate'))
  );
`);

}

export default db;