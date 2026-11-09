/**
 * dbService.ts
 * ─────────────────────────────────────────────────────────────────
 * واجهة TypeScript للتواصل مع قاعدة البيانات المحلية (better-sqlite3)
 * تدعم وضعين تلقائياً:
 *   1. الوضع المباشر (IPC): عند تشغيل التطبيق في Electron على الجهاز الرئيسي.
 *   2. وضع الشبكة المحلية (LAN HTTP): عند فتح التطبيق من جهاز ثانٍ (هاتف/كمبيوتر)
 *      على نفس شبكة الـ Wi-Fi عبر المنفذ 4989.
 *
 * كل مستخدم له بياناته المنفصلة (products, sales, settings).
 * يتم تحديد المستخدم الحالي عبر currentUserId.
 * ─────────────────────────────────────────────────────────────────
 */

import type { SimpleProduct, SaleRecord, Expense } from '../types';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export interface DbUser {
  id: string;
  username: string;
  role: 'admin' | 'manager' | 'staff' | 'viewer' | 'cashier';
  displayName: string;
  pinCode?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  role?: 'admin' | 'manager' | 'staff' | 'viewer' | 'cashier';
  displayName?: string;
  pinCode?: string;
}

export interface UpdateUserInput {
  displayName?: string;
  role?: string;
  isActive?: boolean;
}

export interface DashboardStats {
  productsCount: number;
  lowStockCount: number;
  totalInventoryValue: number;
  today: { revenue: number; profit: number; count: number };
  thisMonth: { revenue: number; profit: number; count: number };
}

interface IpcResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  imported?: number;
}

// ─────────────────────────────────────────────────────────────────
// State — المستخدم الحالي (يُحفظ في الذاكرة + sessionStorage)
// ─────────────────────────────────────────────────────────────────

const SESSION_KEY = 'wms_current_user';
const SERVER_URL_KEY = 'wms_sqlite_server_url';

let _currentUser: DbUser | null = null;

function loadUserFromSession(): DbUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveUserToSession(user: DbUser | null) {
  if (user) sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
  else sessionStorage.removeItem(SESSION_KEY);
}

// ─────────────────────────────────────────────────────────────────
// كشف بيئة التشغيل وعنوان السيرفر
// ─────────────────────────────────────────────────────────────────

const hasIpc = typeof window !== 'undefined' && !!(window as any).electronAPI?.db;
const ipc = () => (window as any).electronAPI.db;

function getEffectiveServerUrl(): string {
  if (typeof window === 'undefined') return '';
  const stored = localStorage.getItem(SERVER_URL_KEY);
  if (stored) return stored.replace(/\/$/, '');

  // إذا تم فتح التطبيق عبر متصفح من منفذ السيرفر (مثلاً 4989)
  if (window.location.port === '4989') {
    return window.location.origin;
  }
  return 'http://localhost:4989';
}

/**
 * هل نحن في وضع Electron أو LAN؟
 *   true  → Electron IPC  |  متصفح على port 4989  |  رابط LAN محفوظ (جهاز ثانٍ)
 *   false → Vite dev (5173) أو أي بيئة ويب غير LAN → استخدم localStorage القديم
 *
 * ملاحظة: لا نُفعّل وضع LAN إذا كان المتصفح على منفذ التطوير (5173/3000/3001)
 * لأن الخادم المدمج لا يعمل خارج Electron.
 */
function detectSqliteAvailability(): boolean {
  if (typeof window === 'undefined') return false;
  // Electron مع IPC — الحالة الأساسية
  if (hasIpc) return true;
  // صفحة تعمل مباشرة على منفذ الخادم المدمج (4989)
  if (window.location.port === '4989') return true;
  // منفذ التطوير Vite (5173, 3000, 3001) — لا نُفعّل SQLite هنا
  const devPorts = ['5173', '3000', '3001', '4173', '8080'];
  if (devPorts.includes(window.location.port)) return false;
  // المستخدم حفظ عنوان خادم محلي يدوياً (ربط جهازين عبر الشبكة)
  const customServer = localStorage.getItem(SERVER_URL_KEY);
  if (customServer && customServer.trim()) return true;
  return false;
}

/** مساعد: استخراج البيانات من IPC أو رمي خطأ */
async function unwrap<T>(promise: Promise<IpcResult<T>>): Promise<T> {
  const res = await promise;
  if (!res.success) throw new Error(res.error || 'DB error');
  return res.data as T;
}

/** مساعد: طلبات HTTP عند الاتصال من جهاز ثانٍ عبر الشبكة */
async function httpFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getEffectiveServerUrl();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const user = _currentUser || loadUserFromSession();
  if (user && !headers['x-user-id']) {
    headers['x-user-id'] = user.id;
  }

  const res = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  const json = await res.json();
  if (!json.success && json.error) {
    throw new Error(json.error);
  }
  return (json.data !== undefined ? json.data : json) as T;
}

function requireUser(): string {
  const user = _currentUser || loadUserFromSession();
  if (!user) throw new Error('يجب تسجيل الدخول أولاً');
  if (!_currentUser) _currentUser = user; // استعادة من الجلسة
  return user.id;
}

// ─────────────────────────────────────────────────────────────────
// dbService — الواجهة الرئيسية الموحدة
// ─────────────────────────────────────────────────────────────────

export const dbService = {
  /**
   * هل قاعدة بيانات SQLite متاحة؟
   *   true  → Electron (IPC) | متصفح على port 4989 | رابط LAN محفوظ
   *   false → Vite dev (5173) أو بيئة ويب عادية → يُستخدم localStorage القديم
   */
  isAvailable: detectSqliteAvailability(),

  /** هل يعمل بوضع IPC المحلي أم عبر خادم الشبكة */
  isLocalIpc: hasIpc,

  // ── إدارة الجلسة ──────────────────────────────────────────────

  /** تعيين المستخدم الحالي بعد تسجيل الدخول */
  setCurrentUser(user: DbUser | null) {
    _currentUser = user;
    saveUserToSession(user);
  },

  /** جلب المستخدم الحالي */
  getCurrentUser(): DbUser | null {
    if (!_currentUser) _currentUser = loadUserFromSession();
    return _currentUser;
  },

  /** تسجيل الخروج */
  logout() {
    _currentUser = null;
    saveUserToSession(null);
  },

  // ── معلومات وتهيئة خادم الشبكة ────────────────────────────────
  server: {
    getInfo: async (): Promise<{ isRunning: boolean; localIp: string; port: number; url: string }> => {
      if (hasIpc && (window as any).electronAPI?.server) {
        return (window as any).electronAPI.server.getInfo();
      }
      if (typeof window !== 'undefined') {
        const isLanPort = window.location.port === '4989';
        const hasCustom = !!localStorage.getItem(SERVER_URL_KEY);
        if (!isLanPort && !hasCustom) {
          return { isRunning: false, localIp: '', port: 4989, url: '' };
        }
      }
      try {
        const info = await httpFetch<any>('/api/info');
        return { isRunning: true, localIp: info.localIp, port: info.port, url: info.url };
      } catch {
        return { isRunning: false, localIp: '', port: 4989, url: getEffectiveServerUrl() };
      }
    },
    setServerUrl: (url: string) => {
      if (url) localStorage.setItem(SERVER_URL_KEY, url.trim().replace(/\/$/, ''));
      else localStorage.removeItem(SERVER_URL_KEY);
    },
    getServerUrl: () => getEffectiveServerUrl(),
  },

  // ── المصادقة ──────────────────────────────────────────────────
  auth: {
    /**
     * تسجيل الدخول
     * @returns DbUser أو null إذا كانت البيانات خاطئة
     */
    login: async (username: string, password: string): Promise<DbUser | null> => {
      let user: DbUser | null = null;
      if (hasIpc) {
        user = await unwrap<DbUser | null>(ipc().auth.login(username, password));
      } else {
        try {
          user = await httpFetch<DbUser>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
          });
        } catch {
          return null;
        }
      }

      if (user) {
        dbService.setCurrentUser(user);
      }
      return user;
    },

    /**
     * إنشاء حساب جديد وحفظه في SQLite وتسجيل الدخول به فوراً
     */
    register: async (input: {
      username: string;
      password: string;
      displayName?: string;
      role?: 'admin' | 'staff' | 'cashier';
    }): Promise<{ success: boolean; user?: DbUser; error?: string }> => {
      let result: { success: boolean; data?: DbUser; error?: string };
      if (hasIpc) {
        if ((ipc().auth as any)?.register) {
          result = await (ipc().auth as any).register(input);
        } else {
          result = await ipc().users.create(input);
        }
      } else {
        try {
          const res = await httpFetch<any>('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify(input),
          });
          result = { success: true, data: res.data || res };
        } catch (e: any) {
          return { success: false, error: e.message || 'فشل إنشاء الحساب' };
        }
      }

      if (result.success && result.data) {
        dbService.setCurrentUser(result.data);
        return { success: true, user: result.data };
      }
      return { success: false, error: result.error || 'فشل إنشاء الحساب' };
    },
  },

  // ── إدارة المستخدمين (للمدير فقط) ────────────────────────────
  users: {
    getAll: (): Promise<DbUser[]> =>
      hasIpc ? unwrap(ipc().users.getAll()) : httpFetch('/api/users'),

    create: (input: CreateUserInput): Promise<{ success: boolean; data?: DbUser; error?: string }> =>
      hasIpc ? ipc().users.create(input) : httpFetch('/api/users', { method: 'POST', body: JSON.stringify(input) }),

    update: (id: string, updates: UpdateUserInput): Promise<{ success: boolean; data?: DbUser; error?: string }> =>
      hasIpc ? ipc().users.update(id, updates) : httpFetch(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),

    changePassword: (id: string, newPassword: string): Promise<{ success: boolean; error?: string }> =>
      hasIpc
        ? ipc().users.changePassword(id, newPassword)
        : httpFetch(`/api/users/${id}/password`, { method: 'POST', body: JSON.stringify({ newPassword }) }),

    delete: (id: string): Promise<{ success: boolean; error?: string }> =>
      hasIpc ? ipc().users.delete(id) : httpFetch(`/api/users/${id}`, { method: 'DELETE' }),
  },

  // ── المنتجات (تستخدم userId الحالي تلقائياً) ────────────────
  products: {
    getAll: (): Promise<SimpleProduct[]> =>
      hasIpc
        ? unwrap(ipc().products.getAll(requireUser()))
        : httpFetch(`/api/products?userId=${encodeURIComponent(requireUser())}`),

    getById: (id: string): Promise<SimpleProduct | null> =>
      hasIpc
        ? unwrap(ipc().products.getById(requireUser(), id))
        : httpFetch(`/api/products/${id}?userId=${encodeURIComponent(requireUser())}`),

    getByBarcode: (barcode: string): Promise<SimpleProduct | null> =>
      hasIpc
        ? unwrap(ipc().products.getByBarcode(requireUser(), barcode))
        : httpFetch(`/api/products?barcode=${encodeURIComponent(barcode)}&userId=${encodeURIComponent(requireUser())}`),

    upsert: (product: SimpleProduct): Promise<SimpleProduct> =>
      hasIpc
        ? unwrap(ipc().products.upsert(requireUser(), product))
        : httpFetch(`/api/products?userId=${encodeURIComponent(requireUser())}`, {
          method: 'POST',
          body: JSON.stringify(product),
        }),

    delete: (id: string): Promise<void> =>
      hasIpc
        ? unwrap(ipc().products.delete(requireUser(), id))
        : httpFetch(`/api/products/${id}?userId=${encodeURIComponent(requireUser())}`, { method: 'DELETE' }),

    updateStock: async (id: string, newStock: number): Promise<SimpleProduct> => {
      if (hasIpc) {
        return unwrap(ipc().products.updateStock(requireUser(), id, newStock));
      }
      const existing = await dbService.products.getById(id);
      if (!existing) throw new Error('المنتج غير موجود');
      existing.stock = newStock;
      return dbService.products.upsert(existing);
    },

    bulkUpsert: (products: SimpleProduct[]): Promise<void> =>
      hasIpc
        ? unwrap(ipc().products.bulkUpsert(requireUser(), products))
        : httpFetch(`/api/products/bulk?userId=${encodeURIComponent(requireUser())}`, {
          method: 'POST',
          body: JSON.stringify({ products }),
        }),
  },

  // ── المبيعات (تستخدم userId الحالي تلقائياً) ────────────────
  sales: {
    getAll: (): Promise<SaleRecord[]> =>
      hasIpc
        ? unwrap(ipc().sales.getAll(requireUser()))
        : httpFetch(`/api/sales?userId=${encodeURIComponent(requireUser())}`),

    getById: (id: string): Promise<SaleRecord | null> =>
      hasIpc
        ? unwrap(ipc().sales.getById(requireUser(), id))
        : httpFetch(`/api/sales/${id}?userId=${encodeURIComponent(requireUser())}`),

    upsert: (sale: SaleRecord): Promise<SaleRecord> =>
      hasIpc
        ? unwrap(ipc().sales.upsert(requireUser(), sale))
        : httpFetch(`/api/sales?userId=${encodeURIComponent(requireUser())}`, {
          method: 'POST',
          body: JSON.stringify(sale),
        }),

    delete: (id: string): Promise<void> =>
      hasIpc
        ? unwrap(ipc().sales.delete(requireUser(), id))
        : httpFetch(`/api/sales/${id}?userId=${encodeURIComponent(requireUser())}`, { method: 'DELETE' }),

    bulkUpsert: (sales: SaleRecord[]): Promise<void> =>
      hasIpc
        ? unwrap(ipc().sales.bulkUpsert(requireUser(), sales))
        : httpFetch(`/api/sales/bulk?userId=${encodeURIComponent(requireUser())}`, {
          method: 'POST',
          body: JSON.stringify({ sales }),
        }),
  },

  // ── المصاريف النثرية (تستخدم userId الحالي تلقائياً) ───────
  expenses: {
    getAll: (): Promise<Expense[]> =>
      hasIpc
        ? unwrap(ipc().expenses.getAll(requireUser()))
        : httpFetch(`/api/expenses?userId=${encodeURIComponent(requireUser())}`),

    getById: (id: string): Promise<Expense | null> =>
      hasIpc
        ? unwrap(ipc().expenses.getById(requireUser(), id))
        : httpFetch(`/api/expenses/${id}?userId=${encodeURIComponent(requireUser())}`),

    upsert: (expense: Expense): Promise<Expense> =>
      hasIpc
        ? unwrap(ipc().expenses.upsert(requireUser(), expense))
        : httpFetch(`/api/expenses?userId=${encodeURIComponent(requireUser())}`, {
          method: 'POST',
          body: JSON.stringify(expense),
        }),

    delete: (id: string): Promise<void> =>
      hasIpc
        ? unwrap(ipc().expenses.delete(requireUser(), id))
        : httpFetch(`/api/expenses/${id}?userId=${encodeURIComponent(requireUser())}`, { method: 'DELETE' }),

    bulkUpsert: (expenses: Expense[]): Promise<void> =>
      hasIpc
        ? unwrap(ipc().expenses.bulkUpsert(requireUser(), expenses))
        : httpFetch(`/api/expenses/bulk?userId=${encodeURIComponent(requireUser())}`, {
          method: 'POST',
          body: JSON.stringify({ expenses }),
        }),
  },

  // ── الإعدادات (تستخدم userId الحالي تلقائياً) ───────────────
  settings: {
    get: (key: string): Promise<any> =>
      hasIpc
        ? unwrap(ipc().settings.get(requireUser(), key))
        : httpFetch(`/api/settings?key=${encodeURIComponent(key)}&userId=${encodeURIComponent(requireUser())}`),

    set: (key: string, value: any): Promise<void> =>
      hasIpc
        ? unwrap(ipc().settings.set(requireUser(), key, value))
        : httpFetch(`/api/settings?userId=${encodeURIComponent(requireUser())}`, {
          method: 'POST',
          body: JSON.stringify({ key, value }),
        }),

    getAll: (): Promise<Record<string, any>> =>
      hasIpc
        ? unwrap(ipc().settings.getAll(requireUser()))
        : httpFetch(`/api/settings?userId=${encodeURIComponent(requireUser())}`),

    saveAppSettings: async (settings: Record<string, any>): Promise<void> => {
      const uid = requireUser();
      for (const [key, value] of Object.entries(settings)) {
        if (hasIpc) {
          await unwrap(ipc().settings.set(uid, key, value));
        } else {
          await httpFetch(`/api/settings?userId=${encodeURIComponent(uid)}`, {
            method: 'POST',
            body: JSON.stringify({ key, value }),
          });
        }
      }
    },
  },

  // ── الإحصائيات (تستخدم userId الحالي تلقائياً) ──────────────
  stats: {
    dashboard: (): Promise<DashboardStats> =>
      hasIpc
        ? unwrap(ipc().stats.dashboard(requireUser()))
        : httpFetch(`/api/stats/dashboard?userId=${encodeURIComponent(requireUser())}`),
  },

  // ── الترحيل من localStorage القديم ───────────────────────────
  migrateFromLocalStorage: async (): Promise<{ products: number; sales: number; expenses: number }> => {
    requireUser();
    let importedProducts = 0;
    let importedSales = 0;
    let importedExpenses = 0;

    try {
      const rawProducts = localStorage.getItem('wms_products_data');
      if (rawProducts) {
        const products: SimpleProduct[] = JSON.parse(rawProducts);
        if (products.length > 0) {
          await dbService.products.bulkUpsert(products);
          importedProducts = products.length;
        }
      }
    } catch (err) {
      console.error('[dbService] ترحيل المنتجات فشل:', err);
    }

    try {
      const rawSales = localStorage.getItem('wms_sales_data');
      if (rawSales) {
        const sales: SaleRecord[] = JSON.parse(rawSales);
        if (sales.length > 0) {
          await dbService.sales.bulkUpsert(sales);
          importedSales = sales.length;
        }
      }
    } catch (err) {
      console.error('[dbService] ترحيل المبيعات فشل:', err);
    }

    try {
      const rawExpenses = localStorage.getItem('wms_expenses_data');
      if (rawExpenses) {
        const expenses: Expense[] = JSON.parse(rawExpenses);
        if (expenses.length > 0) {
          await dbService.expenses.bulkUpsert(expenses);
          importedExpenses = expenses.length;
        }
      }
    } catch (err) {
      console.error('[dbService] ترحيل المصاريف فشل:', err);
    }

    localStorage.setItem('wms_db_migrated', 'true');
    return { products: importedProducts, sales: importedSales, expenses: importedExpenses };
  },

  isMigrated: (): boolean => localStorage.getItem('wms_db_migrated') === 'true',
};

export default dbService;
