'use strict';

const path = require('path');
const crypto = require('crypto');
const { app } = require('electron');

// ─────────────────────────────────────────────────────────────────────────────
// فتح / إنشاء قاعدة البيانات
// ─────────────────────────────────────────────────────────────────────────────
let db = null;

function getDb() {
  if (db) return db;
  const Database = require('better-sqlite3');
  const userData = (app && typeof app.getPath === 'function')
    ? app.getPath('userData')
    : path.join(__dirname, '..');
  const dbPath = path.join(userData, 'warehouse.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema();
  return db;
}

// ─────────────────────────────────────────────────────────────────────────────
// الـ Schema — كل مستخدم له بياناته المنفصلة عبر user_id
// ─────────────────────────────────────────────────────────────────────────────
function initSchema() {
  db.exec(`
    -- ══════════════════════════════════════════════════════
    -- جدول المستخدمين
    -- ══════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS users (
      id           TEXT PRIMARY KEY,
      username     TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role         TEXT NOT NULL DEFAULT 'staff',
      -- أدوار مقترحة: admin | manager | staff | viewer
      display_name TEXT DEFAULT '',
      is_active    INTEGER NOT NULL DEFAULT 1,
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- ══════════════════════════════════════════════════════
    -- جدول المنتجات — مرتبط بالمستخدم
    -- ══════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS products (
      id                 TEXT NOT NULL,
      user_id            TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name               TEXT NOT NULL,
      barcode            TEXT DEFAULT '',
      category           TEXT DEFAULT '',
      cost_price         REAL NOT NULL DEFAULT 0,
      sell_price         REAL NOT NULL DEFAULT 0,
      stock              REAL NOT NULL DEFAULT 0,
      min_stock          REAL NOT NULL DEFAULT 0,
      notes              TEXT DEFAULT '',
      has_package_unit   INTEGER NOT NULL DEFAULT 0,
      package_unit_name  TEXT DEFAULT '',
      units_per_package  REAL DEFAULT 1,
      package_sell_price REAL DEFAULT 0,
      created_at         TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (id, user_id)
    );

    -- ══════════════════════════════════════════════════════
    -- جدول الفواتير — مرتبط بالمستخدم
    -- ══════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS sales (
      id               TEXT NOT NULL,
      user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      invoice_number   TEXT NOT NULL,
      total_amount     REAL NOT NULL DEFAULT 0,
      total_profit     REAL NOT NULL DEFAULT 0,
      paid_amount      REAL DEFAULT 0,
      remaining_amount REAL DEFAULT 0,
      payment_status   TEXT DEFAULT 'paid',
      customer_name    TEXT DEFAULT '',
      customer_phone   TEXT DEFAULT '',
      notes            TEXT DEFAULT '',
      due_date         TEXT DEFAULT '',
      created_at       TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (id, user_id),
      UNIQUE (invoice_number, user_id)
    );

    -- ══════════════════════════════════════════════════════
    -- جدول بنود الفاتورة
    -- ══════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS sale_items (
      id                INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id           TEXT NOT NULL,
      user_id           TEXT NOT NULL,
      product_id        TEXT NOT NULL,
      product_name      TEXT NOT NULL,
      barcode           TEXT DEFAULT '',
      quantity          REAL NOT NULL DEFAULT 0,
      unit_type         TEXT DEFAULT 'piece',
      unit_name         TEXT DEFAULT '',
      units_per_package REAL DEFAULT 1,
      pieces_count      REAL DEFAULT 0,
      sell_price        REAL NOT NULL DEFAULT 0,
      cost_price        REAL NOT NULL DEFAULT 0,
      subtotal          REAL NOT NULL DEFAULT 0,
      profit            REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (sale_id, user_id) REFERENCES sales(id, user_id) ON DELETE CASCADE
    );

    -- ══════════════════════════════════════════════════════
    -- جدول سجل دفع الديون
    -- ══════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS debt_payments (
      id      TEXT NOT NULL,
      sale_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      amount  REAL NOT NULL DEFAULT 0,
      date    TEXT NOT NULL DEFAULT (datetime('now')),
      notes   TEXT DEFAULT '',
      PRIMARY KEY (id, user_id),
      FOREIGN KEY (sale_id, user_id) REFERENCES sales(id, user_id) ON DELETE CASCADE
    );

    -- ══════════════════════════════════════════════════════
    -- ══════════════════════════════════════════════════════
    -- جدول الإعدادات — لكل مستخدم إعداداته
    -- ══════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS settings (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      key     TEXT NOT NULL,
      value   TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (user_id, key)
    );

    -- ══════════════════════════════════════════════════════
    -- جدول المصاريف النثرية — مرتبط بالمستخدم
    -- ══════════════════════════════════════════════════════
    CREATE TABLE IF NOT EXISTS expenses (
      id         TEXT NOT NULL,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title      TEXT NOT NULL,
      amount     REAL NOT NULL DEFAULT 0,
      category   TEXT NOT NULL DEFAULT 'أخرى',
      date       TEXT NOT NULL,
      notes      TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (id, user_id)
    );

    -- ══════════════════════════════════════════════════════
    -- الفهارس
    -- ══════════════════════════════════════════════════════
    CREATE INDEX IF NOT EXISTS idx_products_user       ON products(user_id);
    CREATE INDEX IF NOT EXISTS idx_products_barcode    ON products(user_id, barcode);
    CREATE INDEX IF NOT EXISTS idx_products_name       ON products(user_id, name);
    CREATE INDEX IF NOT EXISTS idx_sales_user          ON sales(user_id);
    CREATE INDEX IF NOT EXISTS idx_sales_invoice       ON sales(user_id, invoice_number);
    CREATE INDEX IF NOT EXISTS idx_sales_created_at    ON sales(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_sale_items_sale     ON sale_items(sale_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_sale_items_product  ON sale_items(user_id, product_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_user       ON expenses(user_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_date       ON expenses(user_id, date);
  `);

  // إنشاء حساب admin افتراضي إن لم يكن موجوداً
  ensureDefaultAdmin();
}

// ─────────────────────────────────────────────────────────────────────────────
// المساعدات
// ─────────────────────────────────────────────────────────────────────────────

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'wms_salt_2024').digest('hex');
}

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
}

function ensureDefaultAdmin() {
  const exists = db.prepare("SELECT id FROM users WHERE username = 'admin'").get();
  if (!exists) {
    db.prepare(`
      INSERT INTO users (id, username, password_hash, role, display_name)
      VALUES (?, 'admin', ?, 'admin', 'مدير النظام')
    `).run(generateId(), hashPassword('admin123'));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// تحويل الصفوف
// ─────────────────────────────────────────────────────────────────────────────

function rowToProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    barcode: row.barcode || '',
    category: row.category || '',
    costPrice: row.cost_price,
    sellPrice: row.sell_price,
    stock: row.stock,
    minStock: row.min_stock,
    notes: row.notes || '',
    hasPackageUnit: row.has_package_unit === 1,
    packageUnitName: row.package_unit_name || '',
    unitsPerPackage: row.units_per_package || 1,
    packageSellPrice: row.package_sell_price || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToSale(saleRow, itemRows) {
  if (!saleRow) return null;
  return {
    id: saleRow.id,
    invoiceNumber: saleRow.invoice_number,
    totalAmount: saleRow.total_amount,
    totalProfit: saleRow.total_profit,
    paidAmount: saleRow.paid_amount,
    remainingAmount: saleRow.remaining_amount,
    paymentStatus: saleRow.payment_status,
    customerName: saleRow.customer_name || '',
    customerPhone: saleRow.customer_phone || '',
    notes: saleRow.notes || '',
    dueDate: saleRow.due_date || '',
    createdAt: saleRow.created_at,
    updatedAt: saleRow.updated_at,
    items: (itemRows || []).map((it) => ({
      productId: it.product_id,
      productName: it.product_name,
      barcode: it.barcode || '',
      quantity: it.quantity,
      unitType: it.unit_type,
      unitName: it.unit_name || '',
      unitsPerPackage: it.units_per_package || 1,
      piecesCount: it.pieces_count || 0,
      sellPrice: it.sell_price,
      costPrice: it.cost_price,
      subtotal: it.subtotal,
      profit: it.profit,
    })),
  };
}

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    displayName: row.display_name || '',
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ── USERS API ──
// ─────────────────────────────────────────────────────────────────────────────

/** تسجيل الدخول — يُعيد بيانات المستخدم أو null */
function login(username, password) {
  const trimmed = (username || '').trim();
  const hash = hashPassword(password);
  const row = getDb().prepare(`
    SELECT * FROM users
    WHERE (
      LOWER(username) = LOWER(?)
      OR LOWER(display_name) = LOWER(?)
      OR (? IN ('admin', 'المدير', 'مدير النظام') AND role = 'admin')
    )
    AND password_hash = ?
    AND is_active = 1
  `).get(trimmed, trimmed, trimmed, hash);
  return rowToUser(row);
}

/** جلب جميع المستخدمين (للمدير) */
function getAllUsers() {
  return getDb().prepare('SELECT * FROM users ORDER BY created_at').all().map(rowToUser);
}

/** إنشاء مستخدم جديد */
function createUser({ username, password, role = 'staff', displayName = '' }) {
  const database = getDb();
  const cleanUsername = (username || '').trim();
  if (!cleanUsername) return { success: false, error: 'اسم المستخدم مطلوب' };
  if (!password || password.length < 3) return { success: false, error: 'كلمة المرور يجب أن تكون 3 أحرف على الأقل' };

  const existing = database.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(cleanUsername);
  if (existing) return { success: false, error: 'اسم المستخدم موجود مسبقاً' };

  const cleanRole = ['admin', 'staff', 'cashier'].includes(role) ? role : 'staff';
  const cleanDisplayName = (displayName || cleanUsername).trim();

  const id = generateId();
  database.prepare(`
    INSERT INTO users (id, username, password_hash, role, display_name)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, cleanUsername, hashPassword(password), cleanRole, cleanDisplayName);

  return { success: true, data: rowToUser(database.prepare('SELECT * FROM users WHERE id = ?').get(id)) };
}

/** تعديل مستخدم */
function updateUser(id, { displayName, role, isActive }) {
  const database = getDb();
  const now = new Date().toISOString();
  database.prepare(`
    UPDATE users SET
      display_name = COALESCE(?, display_name),
      role         = COALESCE(?, role),
      is_active    = COALESCE(?, is_active),
      updated_at   = ?
    WHERE id = ?
  `).run(displayName, role, isActive != null ? (isActive ? 1 : 0) : null, now, id);
  return { success: true, data: rowToUser(database.prepare('SELECT * FROM users WHERE id = ?').get(id)) };
}

/** تغيير كلمة المرور */
function changePassword(id, newPassword) {
  getDb().prepare(
    'UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?'
  ).run(hashPassword(newPassword), new Date().toISOString(), id);
  return { success: true };
}

/** حذف مستخدم (CASCADE يحذف بياناته) */
function deleteUser(id) {
  const row = getDb().prepare("SELECT username FROM users WHERE id = ?").get(id);
  if (row && row.username === 'admin') return { success: false, error: 'لا يمكن حذف المدير الرئيسي' };
  getDb().prepare('DELETE FROM users WHERE id = ?').run(id);
  return { success: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// ── PRODUCTS API (مرتبطة بالمستخدم) ──
// ─────────────────────────────────────────────────────────────────────────────

function getAllProducts(userId) {
  return getDb()
    .prepare('SELECT * FROM products WHERE user_id = ? ORDER BY name')
    .all(userId)
    .map(rowToProduct);
}

function getProductById(userId, id) {
  return rowToProduct(
    getDb().prepare('SELECT * FROM products WHERE id = ? AND user_id = ?').get(id, userId)
  );
}

function getProductByBarcode(userId, barcode) {
  return rowToProduct(
    getDb().prepare('SELECT * FROM products WHERE barcode = ? AND user_id = ?').get(barcode, userId)
  );
}

function upsertProduct(userId, p) {
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO products
      (id, user_id, name, barcode, category, cost_price, sell_price, stock, min_stock,
       notes, has_package_unit, package_unit_name, units_per_package, package_sell_price,
       created_at, updated_at)
    VALUES
      (@id, @userId, @name, @barcode, @category, @costPrice, @sellPrice, @stock, @minStock,
       @notes, @hasPackageUnit, @packageUnitName, @unitsPerPackage, @packageSellPrice,
       @createdAt, @updatedAt)
    ON CONFLICT(id, user_id) DO UPDATE SET
      name               = excluded.name,
      barcode            = excluded.barcode,
      category           = excluded.category,
      cost_price         = excluded.cost_price,
      sell_price         = excluded.sell_price,
      stock              = excluded.stock,
      min_stock          = excluded.min_stock,
      notes              = excluded.notes,
      has_package_unit   = excluded.has_package_unit,
      package_unit_name  = excluded.package_unit_name,
      units_per_package  = excluded.units_per_package,
      package_sell_price = excluded.package_sell_price,
      updated_at         = excluded.updated_at
  `).run({
    id: p.id,
    userId,
    name: p.name,
    barcode: p.barcode || '',
    category: p.category || '',
    costPrice: Number(p.costPrice) || 0,
    sellPrice: Number(p.sellPrice) || 0,
    stock: Number(p.stock) || 0,
    minStock: Number(p.minStock) || 0,
    notes: p.notes || '',
    hasPackageUnit: p.hasPackageUnit ? 1 : 0,
    packageUnitName: p.packageUnitName || '',
    unitsPerPackage: Number(p.unitsPerPackage) || 1,
    packageSellPrice: Number(p.packageSellPrice) || 0,
    createdAt: p.createdAt || now,
    updatedAt: now,
  });
  return getProductById(userId, p.id);
}

function deleteProduct(userId, id) {
  getDb().prepare('DELETE FROM products WHERE id = ? AND user_id = ?').run(id, userId);
  return { success: true };
}

function updateProductStock(userId, id, newStock) {
  getDb().prepare(
    'UPDATE products SET stock = ?, updated_at = ? WHERE id = ? AND user_id = ?'
  ).run(Number(newStock), new Date().toISOString(), id, userId);
  return getProductById(userId, id);
}

function bulkUpsertProducts(userId, products) {
  getDb().transaction((list) => {
    for (const p of list) upsertProduct(userId, p);
  })(products);
  return { imported: products.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// ── SALES API (مرتبطة بالمستخدم) ──
// ─────────────────────────────────────────────────────────────────────────────

function getAllSales(userId) {
  const database = getDb();
  const sales = database.prepare('SELECT * FROM sales WHERE user_id = ? ORDER BY created_at DESC').all(userId);
  const getItems = database.prepare('SELECT * FROM sale_items WHERE sale_id = ? AND user_id = ?');
  return sales.map((s) => rowToSale(s, getItems.all(s.id, userId)));
}

function getSaleById(userId, id) {
  const database = getDb();
  const sale = database.prepare('SELECT * FROM sales WHERE id = ? AND user_id = ?').get(id, userId);
  if (!sale) return null;
  return rowToSale(sale, database.prepare('SELECT * FROM sale_items WHERE sale_id = ? AND user_id = ?').all(id, userId));
}

function upsertSale(userId, sale) {
  const database = getDb();
  const now = new Date().toISOString();

  database.transaction((s) => {
    const isNew = !database.prepare('SELECT id FROM sales WHERE id = ? AND user_id = ?').get(s.id, userId);

    // رأس الفاتورة
    database.prepare(`
      INSERT INTO sales
        (id, user_id, invoice_number, total_amount, total_profit, paid_amount,
         remaining_amount, payment_status, customer_name, customer_phone,
         notes, due_date, created_at, updated_at)
      VALUES
        (@id, @userId, @invoiceNumber, @totalAmount, @totalProfit, @paidAmount,
         @remainingAmount, @paymentStatus, @customerName, @customerPhone,
         @notes, @dueDate, @createdAt, @updatedAt)
      ON CONFLICT(id, user_id) DO UPDATE SET
        total_amount     = excluded.total_amount,
        total_profit     = excluded.total_profit,
        paid_amount      = excluded.paid_amount,
        remaining_amount = excluded.remaining_amount,
        payment_status   = excluded.payment_status,
        customer_name    = excluded.customer_name,
        customer_phone   = excluded.customer_phone,
        notes            = excluded.notes,
        due_date         = excluded.due_date,
        updated_at       = excluded.updated_at
    `).run({
      id: s.id,
      userId,
      invoiceNumber: s.invoiceNumber,
      totalAmount: Number(s.totalAmount) || 0,
      totalProfit: Number(s.totalProfit) || 0,
      paidAmount: Number(s.paidAmount) || 0,
      remainingAmount: Number(s.remainingAmount) || 0,
      paymentStatus: s.paymentStatus || 'paid',
      customerName: s.customerName || '',
      customerPhone: s.customerPhone || '',
      notes: s.notes || '',
      dueDate: s.dueDate || '',
      createdAt: s.createdAt || now,
      updatedAt: now,
    });

    // بنود الفاتورة
    database.prepare('DELETE FROM sale_items WHERE sale_id = ? AND user_id = ?').run(s.id, userId);

    const insertItem = database.prepare(`
      INSERT INTO sale_items
        (sale_id, user_id, product_id, product_name, barcode, quantity, unit_type,
         unit_name, units_per_package, pieces_count, sell_price, cost_price, subtotal, profit)
      VALUES
        (@saleId, @userId, @productId, @productName, @barcode, @quantity, @unitType,
         @unitName, @unitsPerPackage, @piecesCount, @sellPrice, @costPrice, @subtotal, @profit)
    `);

    for (const item of (s.items || [])) {
      insertItem.run({
        saleId: s.id,
        userId,
        productId: item.productId,
        productName: item.productName,
        barcode: item.barcode || '',
        quantity: Number(item.quantity) || 0,
        unitType: item.unitType || 'piece',
        unitName: item.unitName || '',
        unitsPerPackage: Number(item.unitsPerPackage) || 1,
        piecesCount: Number(item.piecesCount) || 0,
        sellPrice: Number(item.sellPrice) || 0,
        costPrice: Number(item.costPrice) || 0,
        subtotal: Number(item.subtotal) || 0,
        profit: Number(item.profit) || 0,
      });

      // خصم المخزون فقط عند الإنشاء الجديد
      if (isNew) {
        const deducted = Number(item.piecesCount) || Number(item.quantity);
        database.prepare(
          'UPDATE products SET stock = MAX(0, stock - ?), updated_at = ? WHERE id = ? AND user_id = ?'
        ).run(deducted, now, item.productId, userId);
      }
    }

    // سجل الدفعات
    if (s.paymentHistory && s.paymentHistory.length > 0) {
      const insertPay = database.prepare(`
        INSERT OR IGNORE INTO debt_payments (id, sale_id, user_id, amount, date, notes)
        VALUES (@id, @saleId, @userId, @amount, @date, @notes)
      `);
      for (const pay of s.paymentHistory) {
        insertPay.run({
          id: pay.id,
          saleId: s.id,
          userId,
          amount: Number(pay.amount) || 0,
          date: pay.date || now,
          notes: pay.notes || '',
        });
      }
    }
  })(sale);

  return getSaleById(userId, sale.id);
}

function deleteSale(userId, id) {
  getDb().prepare('DELETE FROM sales WHERE id = ? AND user_id = ?').run(id, userId);
  return { success: true };
}

function bulkUpsertSales(userId, sales) {
  const database = getDb();
  database.transaction((list) => {
    const now = new Date().toISOString();
    const insertSale = database.prepare(`
      INSERT OR IGNORE INTO sales
        (id, user_id, invoice_number, total_amount, total_profit, paid_amount,
         remaining_amount, payment_status, customer_name, customer_phone,
         notes, due_date, created_at, updated_at)
      VALUES
        (@id, @userId, @invoiceNumber, @totalAmount, @totalProfit, @paidAmount,
         @remainingAmount, @paymentStatus, @customerName, @customerPhone,
         @notes, @dueDate, @createdAt, @updatedAt)
    `);
    const insertItem = database.prepare(`
      INSERT OR IGNORE INTO sale_items
        (sale_id, user_id, product_id, product_name, barcode, quantity, unit_type,
         unit_name, units_per_package, pieces_count, sell_price, cost_price, subtotal, profit)
      VALUES
        (@saleId, @userId, @productId, @productName, @barcode, @quantity, @unitType,
         @unitName, @unitsPerPackage, @piecesCount, @sellPrice, @costPrice, @subtotal, @profit)
    `);

    for (const s of list) {
      insertSale.run({
        id: s.id, userId,
        invoiceNumber: s.invoiceNumber || s.id,
        totalAmount: Number(s.totalAmount) || 0,
        totalProfit: Number(s.totalProfit) || 0,
        paidAmount: Number(s.paidAmount) || 0,
        remainingAmount: Number(s.remainingAmount) || 0,
        paymentStatus: s.paymentStatus || 'paid',
        customerName: s.customerName || '',
        customerPhone: s.customerPhone || '',
        notes: s.notes || '',
        dueDate: s.dueDate || '',
        createdAt: s.createdAt || now,
        updatedAt: s.updatedAt || now,
      });
      for (const item of (s.items || [])) {
        insertItem.run({
          saleId: s.id, userId,
          productId: item.productId || '',
          productName: item.productName || '',
          barcode: item.barcode || '',
          quantity: Number(item.quantity) || 0,
          unitType: item.unitType || 'piece',
          unitName: item.unitName || '',
          unitsPerPackage: Number(item.unitsPerPackage) || 1,
          piecesCount: Number(item.piecesCount) || 0,
          sellPrice: Number(item.sellPrice) || 0,
          costPrice: Number(item.costPrice) || 0,
          subtotal: Number(item.subtotal) || 0,
          profit: Number(item.profit) || 0,
        });
      }
    }
  })(sales);
  return { imported: sales.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// ── SETTINGS API (مرتبطة بالمستخدم) ──
// ─────────────────────────────────────────────────────────────────────────────

function getSetting(userId, key) {
  const row = getDb().prepare('SELECT value FROM settings WHERE user_id = ? AND key = ?').get(userId, key);
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return row.value; }
}

function setSetting(userId, key, value) {
  const strVal = typeof value === 'string' ? value : JSON.stringify(value);
  getDb().prepare(`
    INSERT INTO settings (user_id, key, value) VALUES (?, ?, ?)
    ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value
  `).run(userId, key, strVal);
  return { success: true };
}

function getAllSettings(userId) {
  const rows = getDb().prepare('SELECT key, value FROM settings WHERE user_id = ?').all(userId);
  const result = {};
  for (const row of rows) {
    try { result[row.key] = JSON.parse(row.value); } catch { result[row.key] = row.value; }
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// ── EXPENSES API (المصاريف النثرية - مرتبطة بالمستخدم) ──
// ─────────────────────────────────────────────────────────────────────────────

function getAllExpenses(userId) {
  const database = getDb();
  const rows = database.prepare(
    'SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC, created_at DESC'
  ).all(userId);
  return rows.map(r => ({
    id: r.id,
    title: r.title,
    amount: r.amount,
    category: r.category,
    date: r.date,
    notes: r.notes || '',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

function getExpenseById(userId, id) {
  const database = getDb();
  const r = database.prepare('SELECT * FROM expenses WHERE user_id = ? AND id = ?').get(userId, id);
  if (!r) return null;
  return {
    id: r.id,
    title: r.title,
    amount: r.amount,
    category: r.category,
    date: r.date,
    notes: r.notes || '',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function upsertExpense(userId, exp) {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO expenses (id, user_id, title, amount, category, date, notes, created_at, updated_at)
    VALUES (@id, @user_id, @title, @amount, @category, @date, @notes, @created_at, @updated_at)
    ON CONFLICT(id, user_id) DO UPDATE SET
      title      = excluded.title,
      amount     = excluded.amount,
      category   = excluded.category,
      date       = excluded.date,
      notes      = excluded.notes,
      updated_at = excluded.updated_at
  `);

  const now = new Date().toISOString();
  const expId = exp.id || 'exp-' + Date.now();
  stmt.run({
    id: expId,
    user_id: userId,
    title: exp.title || '',
    amount: Number(exp.amount) || 0,
    category: exp.category || 'أخرى',
    date: exp.date || now.slice(0, 10),
    notes: exp.notes || '',
    created_at: exp.createdAt || exp.created_at || now,
    updated_at: exp.updatedAt || exp.updated_at || now,
  });

  return getExpenseById(userId, expId);
}

function deleteExpense(userId, id) {
  const database = getDb();
  database.prepare('DELETE FROM expenses WHERE user_id = ? AND id = ?').run(userId, id);
  return { success: true };
}

function bulkUpsertExpenses(userId, expensesList) {
  const database = getDb();
  const tx = database.transaction((items) => {
    for (const exp of items) {
      upsertExpense(userId, exp);
    }
  });
  tx(expensesList);
  return { imported: expensesList.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// ── DASHBOARD STATS (مرتبطة بالمستخدم) ──
// ─────────────────────────────────────────────────────────────────────────────

function getDashboardStats(userId) {
  const database = getDb();
  const productsCount = database.prepare(
    'SELECT COUNT(*) as c FROM products WHERE user_id = ?'
  ).get(userId).c;

  const lowStockCount = database.prepare(
    'SELECT COUNT(*) as c FROM products WHERE user_id = ? AND stock <= min_stock AND min_stock > 0'
  ).get(userId).c;

  const totalInventoryValue = database.prepare(
    'SELECT COALESCE(SUM(stock * cost_price), 0) as v FROM products WHERE user_id = ?'
  ).get(userId).v;

  const today = new Date().toISOString().slice(0, 10);
  const todayStats = database.prepare(`
    SELECT COALESCE(SUM(total_amount),0) as revenue,
           COALESCE(SUM(total_profit),0) as profit,
           COUNT(*) as count
    FROM sales WHERE user_id = ? AND date(created_at) = ?
  `).get(userId, today);

  const monthStart = new Date().toISOString().slice(0, 7) + '-01';
  const monthStats = database.prepare(`
    SELECT COALESCE(SUM(total_amount),0) as revenue,
           COALESCE(SUM(total_profit),0) as profit,
           COUNT(*) as count
    FROM sales WHERE user_id = ? AND created_at >= ?
  `).get(userId, monthStart);

  const todayExpenses = database.prepare(
    'SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE user_id = ? AND date = ?'
  ).get(userId, today).total;

  const monthExpenses = database.prepare(
    'SELECT COALESCE(SUM(amount),0) as total FROM expenses WHERE user_id = ? AND date >= ?'
  ).get(userId, monthStart).total;

  return {
    productsCount,
    lowStockCount,
    totalInventoryValue,
    today: { ...todayStats, expenses: todayExpenses, netProfit: todayStats.profit - todayExpenses },
    thisMonth: { ...monthStats, expenses: monthExpenses, netProfit: monthStats.profit - monthExpenses },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  getDb,
  // Auth
  login,
  getAllUsers,
  createUser,
  updateUser,
  changePassword,
  deleteUser,
  // Products
  getAllProducts,
  getProductById,
  getProductByBarcode,
  upsertProduct,
  deleteProduct,
  updateProductStock,
  bulkUpsertProducts,
  // Sales
  getAllSales,
  getSaleById,
  upsertSale,
  deleteSale,
  bulkUpsertSales,
  // Expenses
  getAllExpenses,
  getExpenseById,
  upsertExpense,
  deleteExpense,
  bulkUpsertExpenses,
  // Settings
  getSetting,
  setSetting,
  getAllSettings,
  // Stats
  getDashboardStats,
};
