'use strict';

/**
 * electron/server.cjs
 * ─────────────────────────────────────────────────────────────────
 * خادم الشبكة المحلية المدمج (Embedded Local LAN HTTP Server)
 * يتيح لأي جهاز آخر (كمبيوتر آخر، لابتوب، جهاز لوحي، هاتف) على نفس
 * شبكة الـ Wi-Fi / LAN الاتصال بقاعدة بيانات SQLite المحلية مباشرة.
 * ─────────────────────────────────────────────────────────────────
 */

const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const url = require('url');

let serverInstance = null;
let currentPort = 4989;
let localIp = '127.0.0.1';

/** جلب عنوان الـ IP المحلي للجهاز على شبكة الـ Wi-Fi / الإيثرنت */
function detectLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
};

/** قراءة نص الطلب (JSON Body) */
function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

/** إرسال استجابة JSON مع ترويسات CORS */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
  });
  res.end(JSON.stringify(data));
}

/** تقديم الملفات الثابتة (Static SPA Assets) */
function serveStaticFile(req, res, pathname, distPath) {
  let filePath = path.join(distPath, pathname === '/' ? 'index.html' : pathname);

  // حماية من مسارات خارج dist
  if (!filePath.startsWith(distPath)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // إذا لم يكن الملف موجوداً، نرسل index.html ليدعم الـ SPA Routing
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(distPath, 'index.html');
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('تطبيق المستودع غير مجمع في dist');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': mime,
    'Access-Control-Allow-Origin': '*',
  });
  fs.createReadStream(filePath).pipe(res);
}

/**
 * بدء تشغيل خادم الشبكة المحلية
 * @param {Function} getDbModule دالة استدعاء database.cjs
 * @param {number} preferredPort المنفذ المفضل (الافتراضي 4989)
 */
function startServer(getDbModule, preferredPort = 4989) {
  if (serverInstance) return getServerInfo();

  localIp = detectLocalIp();
  currentPort = preferredPort;
  const distPath = path.join(__dirname, '..', 'dist');

  const server = http.createServer(async (req, res) => {
    // تفعيل CORS للـ Preflight Requests
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-user-id',
      });
      res.end();
      return;
    }

    const parsed = new URL(req.url, 'http://localhost');
    const pathname = parsed.pathname;
    const query = Object.fromEntries(parsed.searchParams);
    const db = getDbModule();

    // ─────────────────────────────────────────────────────────
    // API Endpoints (/api/...)
    // ─────────────────────────────────────────────────────────
    if (pathname.startsWith('/api/')) {
      try {
        // معلومات السيرفر
        if (pathname === '/api/info' && req.method === 'GET') {
          return sendJson(res, 200, {
            status: 'ok',
            serverName: os.hostname(),
            localIp,
            port: currentPort,
            url: `http://${localIp}:${currentPort}`,
          });
        }

        // 1. تسجيل الدخول
        if (pathname === '/api/auth/login' && req.method === 'POST') {
          const body = await readBody(req);
          const user = db.login(body.username, body.password);
          if (user) {
            return sendJson(res, 200, { success: true, data: user });
          }
          return sendJson(res, 401, { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
        }

        // إنشاء حساب جديد (تسجيل)
        if (pathname === '/api/auth/register' && req.method === 'POST') {
          const body = await readBody(req);
          const result = db.createUser(body);
          if (result.success) {
            return sendJson(res, 200, { success: true, data: result.data });
          }
          return sendJson(res, 400, { success: false, error: result.error || 'تعذر إنشاء الحساب' });
        }

        // استخراج معرف المستخدم الحالي من الترويسات أو الاستعلام
        const userId = req.headers['x-user-id'] || query.userId;

        // 2. إدارة المستخدمين
        if (pathname === '/api/users') {
          if (req.method === 'GET') {
            return sendJson(res, 200, { success: true, data: db.getAllUsers() });
          }
          if (req.method === 'POST') {
            const body = await readBody(req);
            const result = db.createUser(body);
            return sendJson(res, result.success ? 200 : 400, result);
          }
        }

        if (pathname.startsWith('/api/users/')) {
          const parts = pathname.split('/');
          const targetUserId = parts[3];

          if (parts[4] === 'password' && req.method === 'POST') {
            const body = await readBody(req);
            const result = db.changePassword(targetUserId, body.newPassword);
            return sendJson(res, result.success ? 200 : 400, result);
          }

          if (req.method === 'PUT') {
            const body = await readBody(req);
            const result = db.updateUser(targetUserId, body);
            return sendJson(res, result.success ? 200 : 400, result);
          }

          if (req.method === 'DELETE') {
            const result = db.deleteUser(targetUserId);
            return sendJson(res, result.success ? 200 : 400, result);
          }
        }

        // التحقق من وجود userId للعمليات المتعلقة بالبيانات
        if (!userId) {
          return sendJson(res, 400, { success: false, error: 'معرّف المستخدم (userId) مطلوب لهذه العملية' });
        }

        // 3. المنتجات
        if (pathname === '/api/products') {
          if (req.method === 'GET') {
            return sendJson(res, 200, { success: true, data: db.getAllProducts(userId) });
          }
          if (req.method === 'POST') {
            const body = await readBody(req);
            const saved = db.upsertProduct(userId, body);
            return sendJson(res, 200, { success: true, data: saved });
          }
        }

        if (pathname === '/api/products/bulk' && req.method === 'POST') {
          const body = await readBody(req);
          const list = Array.isArray(body) ? body : body.products;
          db.bulkUpsertProducts(userId, list || []);
          return sendJson(res, 200, { success: true });
        }

        if (pathname.startsWith('/api/products/') && req.method === 'DELETE') {
          const prodId = pathname.replace('/api/products/', '');
          db.deleteProduct(userId, prodId);
          return sendJson(res, 200, { success: true });
        }

        // 4. المبيعات
        if (pathname === '/api/sales') {
          if (req.method === 'GET') {
            return sendJson(res, 200, { success: true, data: db.getAllSales(userId) });
          }
          if (req.method === 'POST') {
            const body = await readBody(req);
            const saved = db.upsertSale(userId, body);
            return sendJson(res, 200, { success: true, data: saved });
          }
        }

        if (pathname === '/api/sales/bulk' && req.method === 'POST') {
          const body = await readBody(req);
          const list = Array.isArray(body) ? body : body.sales;
          db.bulkUpsertSales(userId, list || []);
          return sendJson(res, 200, { success: true });
        }

        if (pathname.startsWith('/api/sales/') && req.method === 'DELETE') {
          const saleId = pathname.replace('/api/sales/', '');
          db.deleteSale(userId, saleId);
          return sendJson(res, 200, { success: true });
        }

        // 5. المصاريف النثرية
        if (pathname === '/api/expenses') {
          if (req.method === 'GET') {
            return sendJson(res, 200, { success: true, data: db.getAllExpenses(userId) });
          }
          if (req.method === 'POST') {
            const body = await readBody(req);
            const saved = db.upsertExpense(userId, body);
            return sendJson(res, 200, { success: true, data: saved });
          }
        }

        if (pathname === '/api/expenses/bulk' && req.method === 'POST') {
          const body = await readBody(req);
          const list = Array.isArray(body) ? body : body.expenses;
          db.bulkUpsertExpenses(userId, list || []);
          return sendJson(res, 200, { success: true });
        }

        if (pathname.startsWith('/api/expenses/') && req.method === 'DELETE') {
          const expId = pathname.replace('/api/expenses/', '');
          db.deleteExpense(userId, expId);
          return sendJson(res, 200, { success: true });
        }

        // 6. الإعدادات
        if (pathname === '/api/settings') {
          if (req.method === 'GET') {
            return sendJson(res, 200, { success: true, data: db.getAllSettings(userId) });
          }
          if (req.method === 'POST') {
            const body = await readBody(req);
            db.setSetting(userId, body.key, body.value);
            return sendJson(res, 200, { success: true });
          }
        }

        // 6. لوحة التحكم
        if (pathname === '/api/stats/dashboard' && req.method === 'GET') {
          return sendJson(res, 200, { success: true, data: db.getDashboardStats(userId) });
        }

        return sendJson(res, 404, { success: false, error: 'المسار غير موجود' });
      } catch (err) {
        console.error('[LAN Server Error]', err);
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // ─────────────────────────────────────────────────────────
    // تقديم واجهة الويب لأي جهاز متصل بالشبكة (SPA Static Files)
    // ─────────────────────────────────────────────────────────
    serveStaticFile(req, res, pathname, distPath);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[LAN Server] Port ${currentPort} is busy, trying ${currentPort + 1}`);
      currentPort += 1;
      server.listen(currentPort, '0.0.0.0');
    } else {
      console.error('[LAN Server Error]', err);
    }
  });

  server.listen(currentPort, '0.0.0.0', () => {
    console.log(`[LAN Server] Running on http://${localIp}:${currentPort} and http://localhost:${currentPort}`);
  });

  serverInstance = server;
  return getServerInfo();
}

/** إيقاف السيرفر */
function stopServer() {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
}

/** معلومات السيرفر الحالي */
function getServerInfo() {
  return {
    isRunning: !!serverInstance,
    localIp,
    port: currentPort,
    url: `http://${localIp}:${currentPort}`,
  };
}

module.exports = {
  startServer,
  stopServer,
  getServerInfo,
  detectLocalIp,
};
