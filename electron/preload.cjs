const { contextBridge, ipcRenderer } = require('electron');

// Expose safe, structured APIs to the Renderer Process (React)
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,

  // Window Controls
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximizeChange: (callback) => {
      const listener = (_event, isMax) => callback(isMax);
      ipcRenderer.on('window:maximize-change', listener);
      return () => ipcRenderer.removeListener('window:maximize-change', listener);
    }
  },

  // Printing & POS Thermal Invoices
  printer: {
    getPrinters: () => ipcRenderer.invoke('printer:list'),
    printReceipt: (htmlContent, options = {}) => 
      ipcRenderer.invoke('printer:printReceipt', { htmlContent, options }),
    printDirect: (options = {}) => 
      ipcRenderer.invoke('printer:printDirect', options)
  },

  // Local File System (Export / Save)
  fs: {
    saveFile: (options) => ipcRenderer.invoke('fs:saveFile', options),
    openPath: (filePath) => ipcRenderer.invoke('fs:openPath', filePath)
  },

  // Native Notifications
  notifications: {
    show: (title, body, type = 'info') => 
      ipcRenderer.send('notify:show', { title, body, type })
  },

  // App Metadata
  app: {
    getVersion: () => ipcRenderer.invoke('app:version'),
    openExternal: (url) => ipcRenderer.send('app:openExternal', url)
  },

  // ─────────────────────────────────────────────────────────
  // قاعدة البيانات المحلية (better-sqlite3)
  // ─────────────────────────────────────────────────────────
  db: {
    // المصادقة وإدارة المستخدمين
    auth: {
      login:    (username, password) => ipcRenderer.invoke('db:auth:login', username, password),
      register: (userData)           => ipcRenderer.invoke('db:auth:register', userData),
    },
    users: {
      getAll:         ()                  => ipcRenderer.invoke('db:users:getAll'),
      create:         (userData)          => ipcRenderer.invoke('db:users:create', userData),
      update:         (id, updates)       => ipcRenderer.invoke('db:users:update', id, updates),
      changePassword: (id, newPassword)   => ipcRenderer.invoke('db:users:changePassword', id, newPassword),
      delete:         (id)                => ipcRenderer.invoke('db:users:delete', id),
    },

    // المنتجات (كل عملية تتطلب userId)
    products: {
      getAll:       (userId)              => ipcRenderer.invoke('db:products:getAll', userId),
      getById:      (userId, id)          => ipcRenderer.invoke('db:products:getById', userId, id),
      getByBarcode: (userId, barcode)     => ipcRenderer.invoke('db:products:getByBarcode', userId, barcode),
      upsert:       (userId, product)     => ipcRenderer.invoke('db:products:upsert', userId, product),
      delete:       (userId, id)          => ipcRenderer.invoke('db:products:delete', userId, id),
      updateStock:  (userId, id, stock)   => ipcRenderer.invoke('db:products:updateStock', userId, id, stock),
      bulkUpsert:   (userId, products)    => ipcRenderer.invoke('db:products:bulkUpsert', userId, products),
    },

    // المبيعات (كل عملية تتطلب userId)
    sales: {
      getAll:     (userId)          => ipcRenderer.invoke('db:sales:getAll', userId),
      getById:    (userId, id)      => ipcRenderer.invoke('db:sales:getById', userId, id),
      upsert:     (userId, sale)    => ipcRenderer.invoke('db:sales:upsert', userId, sale),
      delete:     (userId, id)      => ipcRenderer.invoke('db:sales:delete', userId, id),
      bulkUpsert: (userId, list)    => ipcRenderer.invoke('db:sales:bulkUpsert', userId, list),
    },

    // المصاريف النثرية (كل عملية تتطلب userId)
    expenses: {
      getAll:     (userId)          => ipcRenderer.invoke('db:expenses:getAll', userId),
      getById:    (userId, id)      => ipcRenderer.invoke('db:expenses:getById', userId, id),
      upsert:     (userId, expense) => ipcRenderer.invoke('db:expenses:upsert', userId, expense),
      delete:     (userId, id)      => ipcRenderer.invoke('db:expenses:delete', userId, id),
      bulkUpsert: (userId, list)    => ipcRenderer.invoke('db:expenses:bulkUpsert', userId, list),
    },

    // الإعدادات (كل عملية تتطلب userId)
    settings: {
      get:    (userId, key)         => ipcRenderer.invoke('db:settings:get', userId, key),
      set:    (userId, key, value)  => ipcRenderer.invoke('db:settings:set', userId, key, value),
      getAll: (userId)              => ipcRenderer.invoke('db:settings:getAll', userId),
    },

    // إحصائيات الداشبورد (تتطلب userId)
    stats: {
      dashboard: (userId) => ipcRenderer.invoke('db:stats:dashboard', userId),
    },
  },

  // ─────────────────────────────────────────────────────────
  // خادم الشبكة المحلية (LAN Server)
  // ─────────────────────────────────────────────────────────
  server: {
    getInfo: () => ipcRenderer.invoke('server:getInfo'),
  },
});

