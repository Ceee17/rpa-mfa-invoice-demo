const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const DB_PATH = path.join(__dirname, "..", "data", "app.db");
const DEMO_TOTP_SECRET = "JBSWY3DPEHPK3PXP";

function initDb() {
  const db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      mfa_secret TEXT,
      mfa_enabled INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      po_number TEXT NOT NULL,
      supplier TEXT NOT NULL,
      amount REAL NOT NULL,
      currency TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      invoice_file TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_orders_po_number
      ON purchase_orders (po_number);
  `);

  seedDemoUser(db);
  seedPurchaseOrders(db);

  return db;
}

function seedDemoUser(db) {
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get("demo");
  if (existing) {
    return;
  }

  const passwordHash = bcrypt.hashSync("demo123", 10);
  db.prepare(
    "INSERT INTO users (username, password_hash, mfa_secret, mfa_enabled) VALUES (?, ?, ?, ?)"
  ).run("demo", passwordHash, DEMO_TOTP_SECRET, 1);
}

function seedPurchaseOrders(db) {
  const now = new Date();
  const rows = [
    {
      po_number: "PO-2026-1001",
      supplier: "Orion Office Supplies",
      amount: 1250.5,
      currency: "USD",
      invoice_number: "INV-1001",
      invoice_file: "invoice-1001.pdf",
      created_at: now.toISOString()
    },
    {
      po_number: "PO-2026-1002",
      supplier: "Atlas Components",
      amount: 4899.0,
      currency: "USD",
      invoice_number: "INV-1002",
      invoice_file: "invoice-1002.pdf",
      created_at: now.toISOString()
    },
    {
      po_number: "PO-2026-1003",
      supplier: "Nimbus Logistics",
      amount: 299.99,
      currency: "USD",
      invoice_number: "INV-1003",
      invoice_file: "invoice-1003.pdf",
      created_at: now.toISOString()
    },
    {
      po_number: "PO-2026-1004",
      supplier: "Helios Manufacturing",
      amount: 10250.0,
      currency: "USD",
      invoice_number: "INV-1004",
      invoice_file: "invoice-1004.pdf",
      created_at: now.toISOString()
    },
    {
      po_number: "PO-2026-1005",
      supplier: "Cobalt Services",
      amount: 845.75,
      currency: "USD",
      invoice_number: "INV-1005",
      invoice_file: "invoice-1005.pdf",
      created_at: now.toISOString()
    },
    {
      po_number: "PO-2026-1006",
      supplier: "Lumen Packaging",
      amount: 1340.2,
      currency: "USD",
      invoice_number: "INV-1006",
      invoice_file: "invoice-1006.pdf",
      created_at: now.toISOString()
    },
    {
      po_number: "PO-2026-1007",
      supplier: "Vertex Networks",
      amount: 6700.0,
      currency: "USD",
      invoice_number: "INV-1007",
      invoice_file: "invoice-1007.pdf",
      created_at: now.toISOString()
    },
    {
      po_number: "PO-2026-1008",
      supplier: "Summit Industrial",
      amount: 2125.4,
      currency: "USD",
      invoice_number: "INV-1008",
      invoice_file: "invoice-1008.pdf",
      created_at: now.toISOString()
    },
    {
      po_number: "PO-2026-1009",
      supplier: "Aurora Facilities",
      amount: 945.0,
      currency: "USD",
      invoice_number: "INV-1009",
      invoice_file: "invoice-1009.pdf",
      created_at: now.toISOString()
    },
    {
      po_number: "PO-2026-1010",
      supplier: "Keystone Freight",
      amount: 3330.75,
      currency: "USD",
      invoice_number: "INV-1010",
      invoice_file: "invoice-1010.pdf",
      created_at: now.toISOString()
    }
  ];

  const insert = db.prepare(
    `INSERT OR IGNORE INTO purchase_orders
      (po_number, supplier, amount, currency, invoice_number, invoice_file, created_at)
      VALUES (@po_number, @supplier, @amount, @currency, @invoice_number, @invoice_file, @created_at)`
  );

  const insertMany = db.transaction((items) => {
    for (const item of items) {
      insert.run(item);
    }
  });

  insertMany(rows);
}

module.exports = {
  initDb
};
