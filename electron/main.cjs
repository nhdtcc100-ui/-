const { app, BrowserWindow, shell, ipcMain, dialog, Notification } = require('electron');
const path = require('path');
const fs = require('fs');

// قاعدة البيانات المحلية (better-sqlite3)
let dbModule = null;
function getDbModule() {
  if (!dbModule) dbModule = require('./database.cjs');
  return dbModule;
}

// خادم الشبكة المحلية المدمج لمشاركة قاعدة البيانات بين جهازين أو أكثر
const { startServer, stopServer, getServerInfo } = require('./server.cjs');

const isDev = process.env.NODE_ENV === 'development';
let mainWindow = null;

// Single instance lock (prevent opening multiple app instances)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 650,
    title: 'نظام إدارة المخازن والمبيعات',
    icon: path.join(__dirname, '..', 'public', 'icon.ico'),
    frame: true, // Standard native Windows frame (no overlap with top nav)
    autoHideMenuBar: true, // Hide default Electron menu bar for clean look
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: !isDev,
    },
    backgroundColor: '#EEF2F7',
    show: false, // Smooth launch without white flash
  });

  // Window State change notifications
  mainWindow.on('maximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximize-change', true);
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximize-change', false);
    }
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Smooth appearance
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  // Open external links safely in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// -------------------------------------------------------------
// IPC Event Handlers
// -------------------------------------------------------------

// Window controls
ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:maximize', () => {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('window:isMaximized', () => {
  return mainWindow ? mainWindow.isMaximized() : false;
});

// Printer APIs
ipcMain.handle('printer:list', async () => {
  if (!mainWindow) return [];
  try {
    return await mainWindow.webContents.getPrintersAsync();
  } catch (err) {
    console.error('Failed to get printers:', err);
    return [];
  }
});

ipcMain.handle('printer:printDirect', async (_event, options = {}) => {
  if (!mainWindow) return { success: false, error: 'No active window' };
  return new Promise((resolve) => {
    mainWindow.webContents.print(
      {
        silent: options.silent || false,
        printBackground: true,
        deviceName: options.deviceName || '',
        margins: { marginType: 'none' },
        ...options,
      },
      (success, errorType) => {
        resolve({ success, error: errorType });
      }
    );
  });
});

ipcMain.handle('printer:printReceipt', async (_event, { htmlContent, options = {} }) => {
  try {
    const printWindow = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    return new Promise((resolve) => {
      printWindow.webContents.print(
        {
          silent: options.silent ?? false,
          printBackground: true,
          deviceName: options.deviceName || '',
          margins: { marginType: 'none' },
          pageSize: options.pageSize || 'A4',
          ...options,
        },
        (success, errorType) => {
          printWindow.close();
          resolve({ success, error: errorType });
        }
      );
    });
  } catch (err) {
    console.error('Receipt print error:', err);
    return { success: false, error: err.message };
  }
});

// File System - Save Dialog & Exporting
ipcMain.handle('fs:saveFile', async (_event, { defaultName, content, filters = [] }) => {
  if (!mainWindow) return { success: false, error: 'No window' };
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'حفظ الملف في جهازك',
      defaultPath: path.join(app.getPath('downloads'), defaultName || 'export.xlsx'),
      filters: filters.length > 0 ? filters : [
        { name: 'Excel Files', extensions: ['xlsx', 'xls'] },
        { name: 'PDF Documents', extensions: ['pdf'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (canceled || !filePath) return { success: false, canceled: true };

    // Support both base64 / binary buffer and utf-8 string
    if (typeof content === 'string' && content.startsWith('data:')) {
      const base64Data = content.split(';base64,').pop();
      await fs.promises.writeFile(filePath, base64Data, { encoding: 'base64' });
    } else if (typeof content === 'string') {
      await fs.promises.writeFile(filePath, content, 'utf-8');
    } else {
      await fs.promises.writeFile(filePath, Buffer.from(content));
    }

    return { success: true, filePath };
  } catch (err) {
    console.error('Save file error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('fs:openPath', async (_event, filePath) => {
  try {
    await shell.openPath(filePath);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Native OS Notifications
ipcMain.on('notify:show', (_event, { title, body, type }) => {
  if (Notification.isSupported()) {
    const iconPath = path.join(__dirname, '..', 'public', 'icon.png');
    const notification = new Notification({
      title: title || 'نظام إدارة المخازن',
      body: body || '',
      icon: fs.existsSync(iconPath) ? iconPath : undefined,
    });
    notification.show();
  }
});

// App information & external links
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.on('app:openExternal', (_event, url) => {
  if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
    shell.openExternal(url);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DATABASE IPC HANDLERS  (better-sqlite3 ↔ Renderer)
// جميع عمليات المنتجات والمبيعات تتطلب userId
// ─────────────────────────────────────────────────────────────────────────────

// ── Auth / Users ──
ipcMain.handle('db:auth:login', (_e, username, password) => {
  try { return { success: true, data: getDbModule().login(username, password) }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:auth:register', (_e, userData) => {
  try { return getDbModule().createUser(userData); }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:users:getAll', () => {
  try { return { success: true, data: getDbModule().getAllUsers() }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:users:create', (_e, userData) => {
  try { return getDbModule().createUser(userData); }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:users:update', (_e, id, updates) => {
  try { return getDbModule().updateUser(id, updates); }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:users:changePassword', (_e, id, newPassword) => {
  try { return getDbModule().changePassword(id, newPassword); }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:users:delete', (_e, id) => {
  try { return getDbModule().deleteUser(id); }
  catch (e) { return { success: false, error: e.message }; }
});

// ── Products (userId مطلوب) ──
ipcMain.handle('db:products:getAll', (_e, userId) => {
  try { return { success: true, data: getDbModule().getAllProducts(userId) }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:products:getById', (_e, userId, id) => {
  try { return { success: true, data: getDbModule().getProductById(userId, id) }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:products:getByBarcode', (_e, userId, barcode) => {
  try { return { success: true, data: getDbModule().getProductByBarcode(userId, barcode) }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:products:upsert', (_e, userId, product) => {
  try { return { success: true, data: getDbModule().upsertProduct(userId, product) }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:products:delete', (_e, userId, id) => {
  try { return getDbModule().deleteProduct(userId, id); }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:products:updateStock', (_e, userId, id, newStock) => {
  try { return { success: true, data: getDbModule().updateProductStock(userId, id, newStock) }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:products:bulkUpsert', (_e, userId, products) => {
  try { return getDbModule().bulkUpsertProducts(userId, products); }
  catch (e) { return { success: false, error: e.message }; }
});

// ── Sales (userId مطلوب) ──
ipcMain.handle('db:sales:getAll', (_e, userId) => {
  try { return { success: true, data: getDbModule().getAllSales(userId) }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:sales:getById', (_e, userId, id) => {
  try { return { success: true, data: getDbModule().getSaleById(userId, id) }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:sales:upsert', (_e, userId, sale) => {
  try { return { success: true, data: getDbModule().upsertSale(userId, sale) }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:sales:delete', (_e, userId, id) => {
  try { return getDbModule().deleteSale(userId, id); }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:sales:bulkUpsert', (_e, userId, sales) => {
  try { return getDbModule().bulkUpsertSales(userId, sales); }
  catch (e) { return { success: false, error: e.message }; }
});

// ── Expenses (userId مطلوب) ──
ipcMain.handle('db:expenses:getAll', (_e, userId) => {
  try { return { success: true, data: getDbModule().getAllExpenses(userId) }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:expenses:getById', (_e, userId, id) => {
  try { return { success: true, data: getDbModule().getExpenseById(userId, id) }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:expenses:upsert', (_e, userId, expense) => {
  try { return { success: true, data: getDbModule().upsertExpense(userId, expense) }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:expenses:delete', (_e, userId, id) => {
  try { return getDbModule().deleteExpense(userId, id); }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:expenses:bulkUpsert', (_e, userId, list) => {
  try { return getDbModule().bulkUpsertExpenses(userId, list); }
  catch (e) { return { success: false, error: e.message }; }
});

// ── Settings (userId مطلوب) ──
ipcMain.handle('db:settings:get', (_e, userId, key) => {
  try { return { success: true, data: getDbModule().getSetting(userId, key) }; }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:settings:set', (_e, userId, key, value) => {
  try { return getDbModule().setSetting(userId, key, value); }
  catch (e) { return { success: false, error: e.message }; }
});

ipcMain.handle('db:settings:getAll', (_e, userId) => {
  try { return { success: true, data: getDbModule().getAllSettings(userId) }; }
  catch (e) { return { success: false, error: e.message }; }
});

// ── Stats (userId مطلوب) ──
ipcMain.handle('db:stats:dashboard', (_e, userId) => {
  try { return { success: true, data: getDbModule().getDashboardStats(userId) }; }
  catch (e) { return { success: false, error: e.message }; }
});

// ── LAN Server Info ──
ipcMain.handle('server:getInfo', () => getServerInfo());

// App Lifecycle
app.whenReady().then(() => {
  // تشغيل خادم الشبكة المحلية لمشاركة SQLite بين جهازين أو أكثر
  startServer(getDbModule, 4989);

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopServer();
    app.quit();
  }
});

app.on('before-quit', () => {
  stopServer();
});
