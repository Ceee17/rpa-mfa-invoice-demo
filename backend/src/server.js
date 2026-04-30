const path = require("path");
const fs = require("fs");
const express = require("express");
const session = require("express-session");
const cors = require("cors");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const bcrypt = require("bcryptjs");

const { initDb } = require("./db");

const PORT = process.env.PORT || 4000;
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";

const db = initDb();
const app = express();
const isProd = process.env.NODE_ENV === "production";

function ensureInvoicePdfFiles() {
  const filesDir = path.join(__dirname, "..", "files");
  if (!fs.existsSync(filesDir)) {
    fs.mkdirSync(filesDir, { recursive: true });
  }

  const rows = db
    .prepare("SELECT invoice_number, invoice_file FROM purchase_orders")
    .all();

  for (const row of rows) {
    const filePath = path.join(filesDir, row.invoice_file);
    if (fs.existsSync(filePath)) {
      continue;
    }

    const text = `Invoice ${row.invoice_number}`;
    const stream = `BT /F1 12 Tf 20 100 Td (${text}) Tj ET`;
    const objects = [
      "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
      "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
      "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n",
      `4 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
      "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n"
    ];

    const header = "%PDF-1.4\n";
    let body = header;
    let offset = header.length;
    const offsets = [0];

    for (const obj of objects) {
      offsets.push(offset);
      body += obj;
      offset += obj.length;
    }

    const xrefOffset = offset;
    let xref = "xref\n0 6\n0000000000 65535 f \n";
    for (let i = 1; i <= 5; i += 1) {
      xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }

    const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    const pdf = body + xref + trailer;
    fs.writeFileSync(filePath, pdf);
  }
}

app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true
}));
app.use(express.json());
app.set("trust proxy", 1);
app.use(
  session({
    secret: "demo-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: isProd ? "none" : "lax",
      secure: isProd
    }
  })
);

ensureInvoicePdfFiles();

function getUserById(id) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  return next();
}

function requireMfa(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  if (!req.session.mfaVerified) {
    return res.status(403).json({ error: "MFA required" });
  }
  return next();
}

async function buildMfaPayload(user, secret) {
  const otpauthUrl = speakeasy.otpauthURL({
    secret,
    label: `Demo:${user.username}`,
    issuer: "RPA Demo",
    encoding: "base32"
  });

  const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

  return {
    otpauthUrl,
    qrCodeDataUrl,
    secret
  };
}

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  req.session.userId = user.id;
  req.session.mfaVerified = false;

  return res.json({
    mfaRequired: !!user.mfa_enabled,
    user: { username: user.username }
  });
});

app.post("/api/mfa/verify", requireAuth, (req, res) => {
  const { token } = req.body;
  const user = getUserById(req.session.userId);

  if (!user?.mfa_secret) {
    return res.status(400).json({ error: "MFA not configured" });
  }

  const verified = speakeasy.totp.verify({
    secret: user.mfa_secret,
    encoding: "base32",
    token,
    window: 1
  });

  if (!verified) {
    return res.status(401).json({ error: "Invalid MFA code" });
  }

  req.session.mfaVerified = true;
  return res.json({ ok: true });
});

app.get("/api/mfa/setup", requireAuth, async (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  let secret = user.mfa_secret;
  if (!secret) {
    secret = speakeasy.generateSecret({ length: 20 }).base32;
    db.prepare("UPDATE users SET mfa_secret = ? WHERE id = ?").run(secret, user.id);
  }

  const payload = await buildMfaPayload(user, secret);
  return res.json(payload);
});

app.post("/api/mfa/refresh", requireAuth, async (req, res) => {
  const user = getUserById(req.session.userId);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  const secret = speakeasy.generateSecret({ length: 20 }).base32;
  db.prepare("UPDATE users SET mfa_secret = ? WHERE id = ?").run(secret, user.id);
  req.session.mfaVerified = false;

  const payload = await buildMfaPayload(user, secret);
  return res.json(payload);
});

app.get("/api/auth/status", (req, res) => {
  if (!req.session.userId) {
    return res.json({ authenticated: false, mfaVerified: false });
  }

  const user = getUserById(req.session.userId);
  return res.json({
    authenticated: true,
    mfaVerified: !!req.session.mfaVerified,
    user: { username: user?.username || "" }
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

app.get("/api/purchase-orders", requireMfa, (req, res) => {
  const rows = db
    .prepare(
      `SELECT id, po_number, supplier, amount, currency, invoice_number, invoice_file, created_at
       FROM purchase_orders
       ORDER BY id`
    )
    .all();

  const data = rows.map((row) => ({
    id: row.id,
    poNumber: row.po_number,
    supplier: row.supplier,
    amount: row.amount,
    currency: row.currency,
    invoiceNumber: row.invoice_number,
    createdAt: row.created_at,
    invoiceLink: `/api/invoices/${row.id}`,
    fileLink: `/files/${row.invoice_file}`
  }));

  return res.json({ data });
});

app.get("/api/invoices/:id", requireMfa, (req, res) => {
  const row = db
    .prepare(
      `SELECT id, invoice_number, invoice_file, po_number, supplier, amount, currency, created_at
       FROM purchase_orders
       WHERE id = ?`
    )
    .get(req.params.id);

  if (!row) {
    return res.status(404).json({ error: "Invoice not found" });
  }

  return res.json({
    id: row.id,
    invoiceNumber: row.invoice_number,
    poNumber: row.po_number,
    supplier: row.supplier,
    amount: row.amount,
    currency: row.currency,
    createdAt: row.created_at,
    fileLink: `/files/${row.invoice_file}`
  });
});

app.use("/files", express.static(path.join(__dirname, "..", "files")));

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
