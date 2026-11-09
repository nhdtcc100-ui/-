import type { SimpleProduct, SaleRecord, SaleItem, AppSettings, DebtPayment, Expense } from '../types';
import { supabaseService } from './supabaseService';
import { isSupabaseConfigured } from './supabaseClient';

const STORAGE_KEYS = {
  PRODUCTS: 'wms_products_data',
  SALES: 'wms_sales_data',
  SETTINGS: 'wms_app_settings',
  DEVICE_ID: 'wms_device_id',
  EXPENSES: 'wms_expenses_data',
  CACHE_VERSION: 'wms_cache_version',
};

// ╔══════════════════════════════════════════════════════════════
// ║  VERSION GUARD — حماية ضد بيانات localStorage القديمة            ║
// ║  غيّر APP_VERSION مع كل نشر جديد على Netlify               ║
// ╚══════════════════════════════════════════════════════════════
const APP_VERSION = '2.0.1'; // ← غيّر هذا عند كل نشر جديد

function clearStaleLocalStorage(): void {
  const stored = localStorage.getItem(STORAGE_KEYS.CACHE_VERSION);
  if (stored !== APP_VERSION) {
    console.info(
      `[VERSION GUARD] تم اكتشاف إصدار قديم (${stored ?? 'غير معروف'}) → جاري حذف localStorage المحلي لتجنّب التلوث`,
    );
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.SALES);
    localStorage.removeItem(STORAGE_KEYS.EXPENSES);
    localStorage.removeItem(STORAGE_KEYS.SETTINGS);
    // احتفظ بـ DEVICE_ID حتى لا تتكرر معرّفات الجهاز
    localStorage.setItem(STORAGE_KEYS.CACHE_VERSION, APP_VERSION);
  }
}

const DEFAULT_SETTINGS: AppSettings = {
  storeName: 'مخزن ميثم',
  currency: 'د.ع',
  adminUsername: 'المدير',
  adminPassword: 'admin123',
  googleSheetUrl: '',
  appsScriptUrl: '',
};

// ── Device-unique ID to prevent ID collisions across devices ──
function getDeviceId(): string {
  let id = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  if (!id) {
    id = 'dev-' + Math.random().toString(36).substring(2, 8);
    localStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
  }
  return id;
}

// ── Generate globally unique ID ──
function genUID(prefix: string): string {
  const devId = getDeviceId().replace('dev-', '');
  return `${prefix}-${devId}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

// ── توليد رقم فاتورة فريد ومميز دائماً ──
function genInvoiceNumber(prefix = 'INV'): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0') + String(now.getSeconds()).padStart(2, '0');
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${y}${m}${d}-${time}-${rand}`;
}

class StoreService {
  private productListeners: (() => void)[] = [];
  private salesListeners: (() => void)[] = [];
  private expensesListeners: (() => void)[] = [];
  private syncListeners: ((status: { syncing: boolean; lastSynced?: string; error?: string }) => void)[] = [];
  private bc: BroadcastChannel | null = null;
  private isMutating = false;
  private mutationTimeout: any = null;

  /**
   * ―― CLOUD READY FLAG ――
   * false  = التطبيق لم يوفّق initFromCloud بعد — لا تكتب شيئاً لـ Supabase
   * true   = تم جلب بيانات السحابة بنجاح — العمليات الصريحة فقط تكتب للسحابة
   *
   * هذا يضمن أن النسخ القديمة على Netlify لن تلوّث Supabase أبداً
   */
  private cloudReady = false;

  /** هل يسمح هذا الجلسة بالكتابة لـ Supabase? */
  private canWriteCloud(): boolean {
    if (!this.cloudReady) {
      console.warn('[CLOUD GUARD] تم حجب كتابة Supabase — لم يكتمل initFromCloud بعد.');
      return false;
    }
    return isSupabaseConfigured() && !!supabaseService.getUserId();
  }


  constructor() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.bc = new BroadcastChannel('wms_sync_channel');
        this.bc.onmessage = (event) => {
          if (event.data?.type === 'SYNC_REFRESH') {
            this.notifyProductListeners();
            this.notifySalesListeners();
            this.notifyExpensesListeners();
          }
        };
      } catch {
        // BroadcastChannel unsupported
      }
    }
  }

  private broadcastSync() {
    try {
      this.bc?.postMessage({ type: 'SYNC_REFRESH' });
    } catch {
      // ignore
    }
  }

  // ── Listener Subscriptions ─────────────────────────────────

  subscribeProducts(listener: () => void): () => void {
    this.productListeners.push(listener);
    return () => {
      this.productListeners = this.productListeners.filter(l => l !== listener);
    };
  }

  notifyProductListeners() {
    this.productListeners.forEach(l => {
      try { l(); } catch { /* ignore */ }
    });
  }

  subscribeSales(listener: () => void): () => void {
    this.salesListeners.push(listener);
    return () => {
      this.salesListeners = this.salesListeners.filter(l => l !== listener);
    };
  }

  notifySalesListeners() {
    this.salesListeners.forEach(l => {
      try { l(); } catch { /* ignore */ }
    });
  }

  subscribeExpenses(listener: () => void): () => void {
    this.expensesListeners.push(listener);
    return () => {
      this.expensesListeners = this.expensesListeners.filter(l => l !== listener);
    };
  }

  notifyExpensesListeners() {
    this.expensesListeners.forEach(l => {
      try { l(); } catch { /* ignore */ }
    });
  }

  subscribeSync(listener: (status: { syncing: boolean; lastSynced?: string; error?: string }) => void): () => void {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== listener);
    };
  }

  notifySync(syncing: boolean, error?: string) {
    const s = this.getSettings();
    this.syncListeners.forEach(l => {
      try { l({ syncing, lastSynced: s.lastSyncedAt, error }); } catch { /* ignore */ }
    });
  }

  isConfigured(): boolean {
    return isSupabaseConfigured();
  }

  hasLocalData(): boolean {
    const p = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    return !!(p && JSON.parse(p).length > 0);
  }

  isSummaryRow(_item: any): boolean {
    return false;
  }

  // ── Supabase Cloud Database Sync (Multi-User & Multi-Device) ──

  async initFromCloud(): Promise<void> {
    if (this.isMutating) {
      return;
    }
    if (!isSupabaseConfigured()) return;
    const uid = supabaseService.getUserId();
    if (!uid) return;

    this.notifySync(true);
    // ―― حذف أي بيانات localStorage بائسة من نسخ قديمة قبل الجلب
    clearStaleLocalStorage();
    try {
      const prods = await supabaseService.getProducts();
      const sales = await supabaseService.getSales();
      const settings = await supabaseService.getSettings();

      // السحابة هي المصدر الحقيقي دائماً — إذا كانت فارغة فاللوكال يجب أن يكون فارغاً أيضاً
      if (prods && prods.length > 0) {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(prods));
      } else {
        localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
      }

      if (sales && sales.length > 0) {
        const localSales = this.getSales();
        const localArchiveMap = new Map<string, boolean>();
        localSales.forEach(s => {
          if (s.isArchived) localArchiveMap.set(s.id, true);
        });

        const mergedSales = sales.map(s => {
          const isArchived = s.isArchived || localArchiveMap.get(s.id) || false;
          return { ...s, isArchived };
        });

        localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(mergedSales));
      } else {
        localStorage.removeItem(STORAGE_KEYS.SALES);
      }

      if (settings) {
        const currentLocal = this.getSettings();
        const merged = { ...currentLocal, ...settings };
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(merged));
      }

      this.notifyProductListeners();
      this.notifySalesListeners();
      this.notifySync(false);

      // ―― السحابة مؤكدة وجاهزة — الآن يسمح للعمليات الصريحة بالكتابة
      this.cloudReady = true;
      console.info('[CLOUD GUARD] جاهز — العمليات الصريحة ستكتب لـ Supabase من الآن فصاعداً.');

      // تفعيل المزامنة اللحظية الذكية (تطبيق كل تغيير مباشرة بدون جلب كامل)
      supabaseService.subscribeRealtime(({ table, event, record, oldRecord }) => {
        // تجاهل الأحداث الناتجة عن هذا الجهاز نفسه (isMutating)
        if (this.isMutating) return;

        if (table === 'products') {
          this.applyRealtimeProduct(event, record, oldRecord);
        } else if (table === 'sales') {
          this.applyRealtimeSale(event, record, oldRecord);
        } else if (table === 'sale_items') {
          // تغيير في بنود الفاتورة → نحتاج تحديث الفاتورة المرتبطة بشكل كامل
          const saleId = record?.sale_id || oldRecord?.sale_id;
          if (saleId) this.fetchAndUpdateSale(saleId);
        }
      });
    } catch (err: any) {
      console.error('[StoreService] Error syncing with Supabase Cloud:', err);
      this.notifySync(false, err?.message);
    }
  }

  async initFromDatabase(): Promise<void> {
    await this.initFromCloud();
  }

  clearUserData(): void {
    this.cloudReady = false; // إعادة تعيين الحارس عند تسجيل الخروج
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    localStorage.removeItem(STORAGE_KEYS.SALES);
    localStorage.removeItem(STORAGE_KEYS.EXPENSES);
    this.notifyProductListeners();
    this.notifySalesListeners();
  }

  // ── Smart Realtime Patch Handlers (تحديث سريع بدون جلب كامل) ─────

  /**
   * تطبيق تغيير منتج واحد (INSERT/UPDATE/DELETE) مباشرة في localStorage.
   */
  private applyRealtimeProduct(
    event: 'INSERT' | 'UPDATE' | 'DELETE',
    record: Record<string, any>,
    oldRecord: Record<string, any>,
  ): void {
    const products = this.getProducts();

    if (event === 'DELETE') {
      const id = oldRecord?.id || record?.id;
      const filtered = products.filter(p => p.id !== id);
      if (filtered.length !== products.length) {
        localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(filtered));
        this.notifyProductListeners();
      }
      return;
    }

    // INSERT or UPDATE
    const updated = supabaseService.mapProductRow(record);
    const idx = products.findIndex(p => p.id === updated.id);
    if (idx !== -1) {
      products[idx] = updated;
    } else {
      products.unshift(updated);
    }
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    this.notifyProductListeners();
  }

  /**
   * تطبيق تغيير فاتورة واحدة (INSERT/UPDATE/DELETE) مباشرة في localStorage.
   * ملاحظة: التحديث يشمل حقول الرأس فقط (بدون بنود) لأن بنود sale_items تأتي
   * من حدث منفصل وتُعالَج في fetchAndUpdateSale.
   */
  private applyRealtimeSale(
    event: 'INSERT' | 'UPDATE' | 'DELETE',
    record: Record<string, any>,
    oldRecord: Record<string, any>,
  ): void {
    const sales = this.getSales();

    if (event === 'DELETE') {
      const id = oldRecord?.id || record?.id;
      const filtered = sales.filter(s => s.id !== id);
      if (filtered.length !== sales.length) {
        localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(filtered));
        this.notifySalesListeners();
      }
      return;
    }

    const idx = sales.findIndex(s => s.id === record.id);
    if (event === 'UPDATE') {
      if (idx !== -1) {
        const partial = supabaseService.mapSaleRow(record);
        sales[idx] = { ...sales[idx], ...partial };
        localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));
        this.notifySalesListeners();
      }
      // جلب الفاتورة كاملة مع بنودها لضمان تحديث أي أصناف أو كميات عدلها الجهاز الآخر
      if (record?.id) {
        this.fetchAndUpdateSale(record.id);
      }
    } else if (event === 'INSERT') {
      // فاتورة جديدة من جهاز آخر → نجلبها كاملة مع بنودها
      if (record?.id) {
        this.fetchAndUpdateSale(record.id);
      }
    }
  }

  /**
   * جلب فاتورة واحدة كاملة (مع بنودها) من Supabase وتحديثها في localStorage.
   * يُستخدَم فقط عند الإنشاء من جهاز آخر أو عند تغيير في sale_items.
   */
  private async fetchAndUpdateSale(saleId: string): Promise<void> {
    if (!isSupabaseConfigured()) return;
    try {
      const { supabase } = await import('./supabaseClient');
      const uid = supabaseService.getUserId();
      if (!uid) return;

      const { data: saleRow } = await supabase
        .from('sales')
        .select('*')
        .eq('id', saleId)
        .eq('user_id', uid)
        .single();

      if (!saleRow) return;

      const { data: itemRows } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', saleId)
        .eq('user_id', uid);

      const { data: debtRows } = await supabase
        .from('debt_payments')
        .select('*')
        .eq('sale_id', saleId)
        .eq('user_id', uid);

      const saleRecord: SaleRecord = {
        ...(supabaseService.mapSaleRow(saleRow) as SaleRecord),
        items: (itemRows || []).map((it: any) => ({
          productId: it.product_id,
          productName: it.product_name,
          barcode: it.barcode || '',
          quantity: Number(it.quantity || 0),
          unitType: it.unit_type || 'piece',
          unitName: it.unit_name || '',
          unitsPerPackage: Number(it.units_per_package || 1),
          piecesCount: Number(it.pieces_count || 0),
          sellPrice: Number(it.sell_price || 0),
          costPrice: Number(it.cost_price || 0),
          subtotal: Number(it.subtotal || 0),
          profit: Number(it.profit || 0),
        })),
        paymentHistory: (debtRows || []).map((d: any) => ({
          id: d.id,
          amount: Number(d.amount || 0),
          date: d.date,
          notes: d.notes || '',
        })),
      };

      const sales = this.getSales();
      const idx = sales.findIndex(s => s.id === saleId);
      if (idx !== -1) {
        if (sales[idx].isArchived && !saleRecord.isArchived) {
          saleRecord.isArchived = true;
        }
        sales[idx] = saleRecord;
      } else {
        sales.unshift(saleRecord);
      }
      localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));
      this.notifySalesListeners();
    } catch (err) {
      console.error('[StoreService] fetchAndUpdateSale error:', err);
    }
  }

  // ── Products Management ────────────────────────────────────


  getProducts(): SimpleProduct[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (!data) return [];
      const prods = JSON.parse(data);
      return Array.isArray(prods) ? prods : [];
    } catch {
      return [];
    }
  }

  saveProducts(products: SimpleProduct[], skipBroadcast = false): void {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    // ―― لا توجد bulkUpsert هنا — الكتابة للسحابة تتم فقط من خلال العمليات الصريحة
    if (!skipBroadcast) {
      this.broadcastSync();
    }
    this.notifyProductListeners();
  }

  addProduct(item: Omit<SimpleProduct, 'id' | 'createdAt'>): SimpleProduct {
    const products = this.getProducts();
    const now = new Date().toISOString();
    const newProduct: SimpleProduct = {
      ...item,
      id: genUID('prod'),
      createdAt: now,
      updatedAt: now,
    };
    products.unshift(newProduct);
    this.saveProducts(products);

    if (this.canWriteCloud()) {
      supabaseService.upsertProduct(newProduct).catch(err => console.error('[Supabase] addProduct error:', err));
    }

    return newProduct;
  }

  updateProduct(id: string, updates: Partial<SimpleProduct>): SimpleProduct | null {
    const products = this.getProducts();
    const index = products.findIndex(p => p.id === id);
    if (index === -1) return null;

    const now = new Date().toISOString();
    products[index] = {
      ...products[index],
      ...updates,
      updatedAt: now,
    };
    this.saveProducts(products);

    if (this.canWriteCloud()) {
      supabaseService.upsertProduct(products[index]).catch(err => console.error('[Supabase] updateProduct error:', err));
    }

    return products[index];
  }

  deleteProduct(id: string): boolean {
    const products = this.getProducts();
    const filtered = products.filter(p => p.id !== id);
    if (filtered.length === products.length) return false;

    this.saveProducts(filtered);

    if (this.canWriteCloud()) {
      supabaseService.deleteProduct(id).catch(err => console.error('[Supabase] deleteProduct error:', err));
    }

    return true;
  }

  // ── Sales & Invoicing Management (Unified for POS & Products) ─

  getSales(): SaleRecord[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SALES);
      if (!data) return [];
      const sales: SaleRecord[] = JSON.parse(data);
      if (!Array.isArray(sales)) return [];

      return sales.map(s => {
        const totalAmount = Number(s.totalAmount) || 0;
        const totalProfit = Number(s.totalProfit) || 0;
        const paidAmount = s.paidAmount !== undefined ? Number(s.paidAmount) : (s.paymentStatus === 'unpaid' ? 0 : totalAmount);
        const remainingAmount = s.remainingAmount !== undefined ? Number(s.remainingAmount) : Math.max(0, totalAmount - paidAmount);
        const paymentStatus = s.paymentStatus || (remainingAmount === 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid'));

        return {
          ...s,
          totalAmount,
          totalProfit,
          paidAmount,
          remainingAmount,
          paymentStatus,
          items: Array.isArray(s.items) ? s.items : [],
          paymentHistory: Array.isArray(s.paymentHistory) ? s.paymentHistory : [],
        };
      });
    } catch {
      return [];
    }
  }

  saveSales(sales: SaleRecord[], skipBroadcast = false): void {
    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));

    if (!skipBroadcast) {
      this.broadcastSync();
    }
    this.notifySalesListeners();
  }


  private async syncMutationToCloud(sale: SaleRecord, changedProducts: SimpleProduct[]) {
    if (!this.canWriteCloud()) return;
    this.isMutating = true;
    if (this.mutationTimeout) clearTimeout(this.mutationTimeout);
    this.mutationTimeout = setTimeout(() => {
      this.isMutating = false;
    }, 5000);

    try {
      await supabaseService.upsertSale(sale);
      if (changedProducts.length > 0) {
        await supabaseService.bulkUpsertProducts(changedProducts);
      }
    } catch (err) {
      console.error('[StoreService] Cloud sync error for sale:', err);
    }
  }

  /**
   * عملية البيع الموحدة لجميع الشاشات (نقاط البيع + البيع السريع من المنتجات):
   * 1. التحقق من توفر الكميات بالمخزن
   * 2. حساب الأسعار، التكلفة، والأرباح بدقة لكل بند
   * 3. خصم الكميات من المخزون وتحديث المنتجات
   * 4. إنشاء وتوثيق فاتورة البيع وسجل الديون برقم فاتورة فريد
   * 5. حفظ الفاتورة محلياً وسحابياً وتحديث الإحصائيات فوراً
   */
  recordSale(saleData: {
    items: {
      productId: string;
      quantity: number;
      sellPrice?: number;
      unitType?: 'piece' | 'package';
    }[];
    customerName?: string;
    customerPhone?: string;
    notes?: string;
    paidAmount?: number;
    dueDate?: string;
  }): { success: boolean; sale?: SaleRecord; error?: string } {
    if (!saleData.items || saleData.items.length === 0) {
      return { success: false, error: 'يرجى اختيار منتج واحد على الأقل للبيع' };
    }

    const products = this.getProducts();
    const saleItems: SaleItem[] = [];
    let totalAmount = 0;
    let totalProfit = 0;

    // 1. التحقق من الكميات المتوفرة
    for (const reqItem of saleData.items) {
      const product = products.find(p => p.id === reqItem.productId);
      if (!product) {
        return { success: false, error: 'أحد المنتجات المحددة غير موجود في المخزن' };
      }

      const isPackage = reqItem.unitType === 'package' && (product.unitsPerPackage || 1) > 1;
      const unitsInPkg = product.unitsPerPackage || 1;
      const piecesNeeded = isPackage ? reqItem.quantity * unitsInPkg : reqItem.quantity;
      const unitName = isPackage ? (product.packageUnitName || 'شليف') : 'قطعة';

      if (Number(product.stock) < piecesNeeded) {
        return {
          success: false,
          error: `الكمية المتوفرة من "${product.name}" هي (${product.stock} قطعة) فقط، ولا تكفي لبيع (${reqItem.quantity} ${unitName} = ${piecesNeeded} قطعة)!`,
        };
      }
    }

    // 2. معالجة بنود البيع وخصم المخزون
    const changedProducts: SimpleProduct[] = [];
    for (const reqItem of saleData.items) {
      const product = products.find(p => p.id === reqItem.productId)!;
      const isPackage = reqItem.unitType === 'package' && (product.unitsPerPackage || 1) > 1;
      const unitsInPkg = product.unitsPerPackage || 1;
      const piecesToDeduct = isPackage ? reqItem.quantity * unitsInPkg : reqItem.quantity;
      const unitName = isPackage ? (product.packageUnitName || 'شليف') : 'قطعة';

      const unitCost = isPackage ? ((Number(product.costPrice) || 0) * unitsInPkg) : (Number(product.costPrice) || 0);
      const defaultSellPrice = isPackage
        ? (Number(product.packageSellPrice) || ((Number(product.sellPrice) || 0) * unitsInPkg))
        : (Number(product.sellPrice) || 0);
      const unitSellPrice = reqItem.sellPrice ?? defaultSellPrice;

      const subtotal = unitSellPrice * reqItem.quantity;
      const profit = (unitSellPrice - unitCost) * reqItem.quantity;

      saleItems.push({
        productId: product.id,
        productName: product.name,
        barcode: product.barcode || '',
        quantity: reqItem.quantity,
        unitType: isPackage ? 'package' : 'piece',
        unitName,
        unitsPerPackage: isPackage ? unitsInPkg : 1,
        piecesCount: piecesToDeduct,
        costPrice: unitCost,
        sellPrice: unitSellPrice,
        subtotal,
        profit,
      });

      totalAmount += subtotal;
      totalProfit += profit;

      // خصم من المخزون
      product.stock = Math.max(0, (Number(product.stock) || 0) - piecesToDeduct);
      product.updatedAt = new Date().toISOString();
      changedProducts.push(product);
    }

    // 3. احتساب المبالغ المدفوعة والمتبقية كدين
    const paid = typeof saleData.paidAmount === 'number'
      ? Math.max(0, Math.min(totalAmount, saleData.paidAmount))
      : totalAmount;
    const remaining = Math.max(0, totalAmount - paid);
    const paymentStatus: 'paid' | 'partial' | 'unpaid' =
      remaining === 0 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid');

    const uid = genUID('sale');
    const invoiceNumber = genInvoiceNumber('INV');
    const now = new Date().toISOString();

    const paymentHistory: DebtPayment[] = paid > 0 ? [{
      id: 'pay-' + Date.now(),
      amount: paid,
      date: now,
      notes: 'دفعة نقدية عند البيع',
    }] : [];

    const newSale: SaleRecord = {
      id: uid,
      invoiceNumber,
      items: saleItems,
      totalAmount,
      totalProfit,
      paidAmount: paid,
      remainingAmount: remaining,
      paymentStatus,
      customerName: saleData.customerName?.trim() || (remaining > 0 ? 'عميل آجل' : 'عميل نقدي'),
      customerPhone: saleData.customerPhone?.trim() || '',
      dueDate: saleData.dueDate || '',
      paymentHistory,
      notes: saleData.notes?.trim() || '',
      createdAt: now,
      updatedAt: now,
    };

    // 4. حفظ الفاتورة والمنتجات محلياً فورياً
    const sales = this.getSales();
    sales.unshift(newSale);
    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));

    this.notifyProductListeners();
    this.notifySalesListeners();
    this.broadcastSync();

    // 5. المزامنة السحابية غير المتزامنة للمنتجات المعدلة فقط
    this.syncMutationToCloud(newSale, changedProducts);

    return { success: true, sale: newSale };
  }

  recordDebtPayment(saleId: string, amount: number, notes?: string): { success: boolean; sale?: SaleRecord; message: string } {
    if (amount <= 0) {
      return { success: false, message: 'مبلغ الدفعة يجب أن يكون أكبر من صفر' };
    }
    const sales = this.getSales();
    const index = sales.findIndex(s => s.id === saleId || s.invoiceNumber === saleId);
    if (index === -1) {
      return { success: false, message: 'الفاتورة غير موجودة!' };
    }

    const sale = sales[index];
    const currentTotal = sale.totalAmount;
    const currentPaid = sale.paidAmount ?? (sale.paymentStatus === 'unpaid' ? 0 : currentTotal);
    const currentRemaining = sale.remainingAmount ?? Math.max(0, currentTotal - currentPaid);

    if (currentRemaining <= 0) {
      return { success: false, message: 'هذه الفاتورة مسددة بالكامل بالفعل!' };
    }

    const actualPayment = Math.min(currentRemaining, amount);
    const newPaidAmount = currentPaid + actualPayment;
    const newRemainingAmount = Math.max(0, currentRemaining - actualPayment);
    const newStatus: 'paid' | 'partial' | 'unpaid' = newRemainingAmount === 0 ? 'paid' : 'partial';

    const history = Array.isArray(sale.paymentHistory) ? [...sale.paymentHistory] : [];
    history.push({
      id: 'pay-' + Date.now(),
      amount: actualPayment,
      date: new Date().toISOString(),
      notes: notes?.trim() || 'تسديد دفعة',
    });

    sales[index] = {
      ...sale,
      paidAmount: newPaidAmount,
      remainingAmount: newRemainingAmount,
      paymentStatus: newStatus,
      paymentHistory: history,
      updatedAt: new Date().toISOString(),
    };

    this.saveSales(sales);

    if (this.canWriteCloud()) {
      supabaseService.upsertSale(sales[index]).catch(err => console.error('[Supabase] recordDebtPayment error:', err));
    }

    return {
      success: true,
      sale: sales[index],
      message: newRemainingAmount === 0
        ? 'تم تسديد كامل المبلغ المتبقي وأصبحت الفاتورة خالصة الذمة بنجاح! ✓'
        : `تم تسجيل دفعة بقيمة (${actualPayment.toLocaleString()}) والمتبقي (${newRemainingAmount.toLocaleString()})`,
    };
  }

  deleteSale(saleId: string, restoreStock: boolean = true): { success: boolean; message: string } {
    this.isMutating = true;
    if (this.mutationTimeout) clearTimeout(this.mutationTimeout);
    this.mutationTimeout = setTimeout(() => {
      this.isMutating = false;
    }, 5000);

    const sales = this.getSales();
    const sale = sales.find(s => s.id === saleId || s.invoiceNumber === saleId);
    if (!sale) {
      this.isMutating = false;
      return { success: false, message: 'الفاتورة غير موجودة!' };
    }

    const products = this.getProducts();
    const changedProducts: SimpleProduct[] = [];
    const now = new Date().toISOString();

    if (restoreStock) {
      // استرجاع المخزون لجميع البنود
      for (const item of (sale.items || [])) {
        const product = products.find(p => p.id === item.productId);
        if (product) {
          const piecesToRestore = item.piecesCount != null
            ? item.piecesCount
            : (item.unitType === 'package'
              ? item.quantity * (item.unitsPerPackage || 1)
              : item.quantity);
          product.stock = (Number(product.stock) || 0) + piecesToRestore;
          product.updatedAt = now;
          if (!changedProducts.some(p => p.id === product.id)) {
            changedProducts.push(product);
          }
        }
      }
    }

    const updatedSales = sales.filter(s => s.id !== saleId && s.invoiceNumber !== saleId);

    // حفظ محلي فوري
    if (restoreStock) {
      localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
      this.notifyProductListeners();
    }
    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(updatedSales));

    this.notifySalesListeners();
    this.broadcastSync();

    // مزامنة سحابية غير متزامنة
    if (isSupabaseConfigured() && supabaseService.getUserId()) {
      supabaseService.deleteSale(sale.id || saleId).catch(err => console.error('[Supabase] deleteSale error:', err));
      if (restoreStock && changedProducts.length > 0) {
        supabaseService.bulkUpsertProducts(changedProducts).catch(err => console.error('[Supabase] restoreStock error:', err));
      }
    }

    return {
      success: true,
      message: restoreStock
        ? 'تم حذف الفاتورة واسترجاع كميات المخزون بالكامل بنجاح! ✓'
        : 'تم حذف سجل الفاتورة بنجاح بدون التأثير على المخزون! ✓',
    };
  }

  archiveSale(saleId: string, archive: boolean = true): { success: boolean; message: string } {
    this.isMutating = true;
    if (this.mutationTimeout) clearTimeout(this.mutationTimeout);
    this.mutationTimeout = setTimeout(() => {
      this.isMutating = false;
    }, 5000);

    const sales = this.getSales();
    const idx = sales.findIndex(s => s.id === saleId || s.invoiceNumber === saleId);
    if (idx === -1) {
      this.isMutating = false;
      return { success: false, message: 'الفاتورة غير موجودة!' };
    }

    const now = new Date().toISOString();
    sales[idx] = {
      ...sales[idx],
      isArchived: archive,
      archivedAt: archive ? now : undefined,
      updatedAt: now,
    };

    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));
    this.notifySalesListeners();
    this.broadcastSync();

    if (this.canWriteCloud()) {
      supabaseService.archiveSale(sales[idx].id || saleId, archive).catch(err =>
        console.error('[Supabase] archiveSale error:', err)
      );
    }

    return {
      success: true,
      message: archive
        ? 'تمت أرشفة الفاتورة بنجاح دون المساس بالمخزن! 📦'
        : 'تمت استعادة الفاتورة من الأرشيف إلى السجل النشط بنجاح! ↩',
    };
  }

  // ── Settings Management ────────────────────────────────────

  getSettings(): AppSettings {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  saveSettings(settings: AppSettings): void {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  }

  updateSettings(updates: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const updated = { ...current, ...updates };
    this.saveSettings(updated);

    if (this.canWriteCloud()) {
      supabaseService.saveSettings(updated).catch(err => console.error('[Supabase] saveSettings error:', err));
    }
    return updated;
  }

  verifyCredentials(username: string, password: string): boolean {
    const settings = this.getSettings();
    const currentUsername = (settings.adminUsername || 'المدير').trim().toLowerCase();
    const inputUsername = username.trim().toLowerCase();
    const passwordMatch = settings.adminPassword === password;
    const usernameMatch = inputUsername === currentUsername || inputUsername === 'admin' || inputUsername === 'المدير';
    return passwordMatch && usernameMatch;
  }

  changePassword(oldPass: string, newPass: string): { success: boolean; message: string } {
    const settings = this.getSettings();
    if (settings.adminPassword !== oldPass) {
      return { success: false, message: 'الرمز السري الحالي غير صحيح!' };
    }
    this.updateSettings({ adminPassword: newPass });
    return { success: true, message: 'تم تغيير الرمز السري بنجاح!' };
  }

  // ── Stubs for backward-compatibility ───────────────────────
  async syncToGoogleSheet(): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'تم حفظ البيانات سحابياً في Supabase' };
  }

  async pullFromGoogleSheet(): Promise<{ success: boolean; message: string }> {
    await this.initFromCloud();
    return { success: true, message: 'تم تحديث البيانات من Supabase' };
  }

  triggerSync(_notify = true): void {
    // handled natively
  }

  isValidExecUrl(_url: string): boolean {
    return true;
  }

  getAppsScriptCode(): string {
    return '';
  }

  /** @deprecated — Replaced by Supabase cloud sync */
  async hydrateOnStartup(): Promise<{ success: boolean; count?: number; message?: string }> {
    await this.initFromCloud().catch(() => {});
    const prods = this.getProducts();
    return { success: true, count: prods.length, message: 'تم تحميل البيانات من Supabase بنجاح' };
  }

  /**
   * تغيير اسم المستخدم أو كلمة المرور من صفحة الإعدادات
   */
  updateAdminProfile(
    newUsername: string,
    oldPassword: string,
    newPassword?: string,
  ): { success: boolean; message: string; updatedSettings?: AppSettings } {
    const settings = this.getSettings();
    if (settings.adminPassword !== oldPassword) {
      return { success: false, message: 'الرمز السري الحالي غير صحيح!' };
    }
    const updated = this.updateSettings({
      adminUsername: newUsername || settings.adminUsername,
      adminPassword: newPassword?.trim() || settings.adminPassword,
    });
    return { success: true, message: 'تم حفظ بيانات الحساب بنجاح!', updatedSettings: updated };
  }

  /**
   * تعديل فاتورة موجودة مع مصالحة المخزون والأرقام المالية الكاملة.
   *
   * الخوارزمية:
   *  1. احسب الكميات (بالقطعة) المباعة سابقاً لكل منتج  (oldPieces).
   *  2. احسب الكميات الجديدة المطلوبة                   (newPieces).
   *  3. delta = newPieces - oldPieces
   *     • delta > 0  → خصم إضافي من المخزون (مع فحص الكمية المتوفرة)
   *     • delta < 0  → إرجاع القطع للمخزون
   *     • delta = 0  → لا تغيير في المخزون
   *  4. أعد احتساب إجمالي الفاتورة، الربح، الديون، الحالة.
   *  5. احفظ محلياً ثم زامن سحابياً.
   */
  updateSale(
    saleId: string,
    data: {
      customerName?: string;
      notes?: string;
      items?: { productId: string; quantity: number; sellPrice: number; unitType: 'piece' | 'package' }[];
    },
  ): { success: boolean; message: string; sale?: SaleRecord } {
    // تفعيل قفل التعديل فوراً لمنع حلقة التكرار أو التعارض اللحظي بين الأجهزة
    this.isMutating = true;
    if (this.mutationTimeout) clearTimeout(this.mutationTimeout);
    this.mutationTimeout = setTimeout(() => {
      this.isMutating = false;
    }, 5000);

    const sales = this.getSales();
    const index = sales.findIndex(s => s.id === saleId || s.invoiceNumber === saleId);
    if (index === -1) {
      this.isMutating = false;
      return { success: false, message: 'الفاتورة غير موجودة!' };
    }

    const oldSale = sales[index];
    const now = new Date().toISOString();

    // ── إذا لم تُرسَل بنود، اكتفِ بتحديث اسم العميل / الملاحظات ──────────
    if (!data.items) {
      sales[index] = {
        ...oldSale,
        ...(data.customerName !== undefined && { customerName: data.customerName }),
        ...(data.notes !== undefined && { notes: data.notes }),
        updatedAt: now,
      };
      this.saveSales(sales);
      if (isSupabaseConfigured() && supabaseService.getUserId()) {
        supabaseService.upsertSale(sales[index]).catch(err =>
          console.error('[Supabase] updateSale (meta-only) error:', err),
        );
      }
      return { success: true, message: 'تم تحديث بيانات الفاتورة بنجاح! ✓', sale: sales[index] };
    }

    // ── 1. خريطة الكميات القديمة (بالقطع) لكل productId في الفاتورة الأصلية ──
    const oldPiecesMap = new Map<string, number>();
    for (const oldItem of (oldSale.items || [])) {
      const pieces =
        oldItem.piecesCount != null
          ? oldItem.piecesCount
          : oldItem.unitType === 'package'
            ? oldItem.quantity * (oldItem.unitsPerPackage || 1)
            : oldItem.quantity;
      oldPiecesMap.set(oldItem.productId, (oldPiecesMap.get(oldItem.productId) ?? 0) + pieces);
    }

    const products = this.getProducts();

    // ── 2. فحص توفر المخزون للزيادات قبل تطبيق أي تعديل ────────────────
    for (const reqItem of data.items) {
      const product = products.find(p => p.id === reqItem.productId);
      if (!product) {
        this.isMutating = false;
        return { success: false, message: `المنتج غير موجود في قاعدة البيانات!` };
      }
      const isPackage = reqItem.unitType === 'package' && (product.unitsPerPackage || 1) > 1;
      const unitsInPkg = product.unitsPerPackage || 1;
      const newPieces = isPackage ? reqItem.quantity * unitsInPkg : reqItem.quantity;
      const oldPieces = oldPiecesMap.get(reqItem.productId) ?? 0;
      const delta = newPieces - oldPieces;

      if (delta > 0 && Number(product.stock) < delta) {
        this.isMutating = false;
        const unitName = isPackage ? (product.packageUnitName || 'شليف') : 'قطعة';
        return {
          success: false,
          message: `المخزون المتوفر من "${product.name}" هو (${product.stock} قطعة) فقط، ولا يكفي للزيادة المطلوبة (${delta} قطعة / ${reqItem.quantity} ${unitName}).`,
        };
      }
    }

    // ── 3. بناء بنود الفاتورة الجديدة + احتساب الإجماليات ──────────────────
    const changedProductsMap = new Map<string, SimpleProduct>();
    const newPiecesMap = new Map<string, number>();
    const newSaleItems: SaleItem[] = [];
    let newTotalAmount = 0;
    let newTotalProfit = 0;

    for (const reqItem of data.items) {
      const product = products.find(p => p.id === reqItem.productId)!;
      const isPackage = reqItem.unitType === 'package' && (product.unitsPerPackage || 1) > 1;
      const unitsInPkg = product.unitsPerPackage || 1;
      const piecesCount = isPackage ? reqItem.quantity * unitsInPkg : reqItem.quantity;
      const unitName = isPackage ? (product.packageUnitName || 'شليف') : 'قطعة';

      // الحفاظ على تكلفة الشراء الأصلية للبند لضمان دقة الربح
      const oldItem = (oldSale.items || []).find(
        oi => oi.productId === reqItem.productId && oi.unitType === reqItem.unitType,
      );
      const unitCost = oldItem?.costPrice
        ?? (isPackage
          ? (Number(product.costPrice) || 0) * unitsInPkg
          : (Number(product.costPrice) || 0));

      const subtotal = reqItem.sellPrice * reqItem.quantity;
      const profit = (reqItem.sellPrice - unitCost) * reqItem.quantity;

      newSaleItems.push({
        productId: product.id,
        productName: product.name,
        barcode: product.barcode || '',
        quantity: reqItem.quantity,
        unitType: isPackage ? 'package' : 'piece',
        unitName,
        unitsPerPackage: isPackage ? unitsInPkg : 1,
        piecesCount,
        costPrice: unitCost,
        sellPrice: reqItem.sellPrice,
        subtotal,
        profit,
      });

      newTotalAmount += subtotal;
      newTotalProfit += profit;
      newPiecesMap.set(reqItem.productId, (newPiecesMap.get(reqItem.productId) ?? 0) + piecesCount);
      changedProductsMap.set(product.id, product);
    }

    // إضافة المنتجات التي تم حذفها كلياً من الفاتورة لنعيد كمياتها للمخزن
    for (const [pid] of oldPiecesMap) {
      const product = products.find(p => p.id === pid);
      if (product) changedProductsMap.set(pid, product);
    }

    // ── 4. تطبيق دلتا المخزون وحصر المنتجات المتأثرة فعلياً ──────────────
    const reallyChangedProducts: SimpleProduct[] = [];
    let returnedCount = 0;
    let addedCount = 0;

    for (const [pid, product] of changedProductsMap) {
      const oldPieces = oldPiecesMap.get(pid) ?? 0;
      const newPieces = newPiecesMap.get(pid) ?? 0;
      const delta = newPieces - oldPieces;
      if (delta !== 0) {
        // إذا delta سالبة: إرجاع للمخزن (stock - delta = stock + |delta|)
        // إذا delta موجبة: خصم من المخزون
        product.stock = Math.max(0, (Number(product.stock) || 0) - delta);
        product.updatedAt = now;
        reallyChangedProducts.push(product);

        if (delta < 0) {
          returnedCount += Math.abs(delta);
        } else {
          addedCount += delta;
        }
      }
    }

    // ── 5. تسوية الحسابات المالية والمدفوعات والمستردات ────────────────
    const diffAmount = newTotalAmount - oldSale.totalAmount;
    let newPaidAmount = Number(oldSale.paidAmount) || 0;
    const paymentHistory = Array.isArray(oldSale.paymentHistory) ? [...oldSale.paymentHistory] : [];

    const wasFullyPaid = oldSale.paymentStatus === 'paid' || (oldSale.paidAmount != null && oldSale.paidAmount >= oldSale.totalAmount);

    if (wasFullyPaid) {
      if (diffAmount < 0) {
        // إرجاع صنف / إنقاص كمية: استرداد نقدي للعميل بقيمة النقص
        newPaidAmount = newTotalAmount;
        paymentHistory.push({
          id: 'refund-' + Date.now(),
          amount: diffAmount,
          date: now,
          notes: `استرداد نقدي للعميل بعد إرجاع بضاعة بقيمة (${Math.abs(diffAmount).toLocaleString()})`,
        });
      } else if (diffAmount > 0) {
        // زيادة بضاعة على فاتورة كانت مدفوعة: يظل ما دُفع كما هو، والفرق يصبح مطلوباً
        newPaidAmount = oldSale.totalAmount;
      } else {
        newPaidAmount = newTotalAmount;
      }
    } else if (oldSale.paymentStatus === 'unpaid') {
      newPaidAmount = 0;
    } else {
      // دفع جزئي
      newPaidAmount = Math.max(0, Math.min(newTotalAmount, Number(oldSale.paidAmount) || 0));
    }

    const newRemainingAmount = Math.max(0, newTotalAmount - newPaidAmount);
    const newPaymentStatus: 'paid' | 'partial' | 'unpaid' =
      newRemainingAmount === 0 ? 'paid' : (newPaidAmount > 0 ? 'partial' : 'unpaid');

    // ── 6. حفظ التحديث محلياً وتحديث كافة النوافذ فوراً ──────────────────
    sales[index] = {
      ...oldSale,
      ...(data.customerName !== undefined && { customerName: data.customerName }),
      ...(data.notes !== undefined && { notes: data.notes }),
      items: newSaleItems,
      totalAmount: newTotalAmount,
      totalProfit: newTotalProfit,
      paidAmount: newPaidAmount,
      remainingAmount: newRemainingAmount,
      paymentStatus: newPaymentStatus,
      paymentHistory,
      updatedAt: now,
    };

    // حفظ في الذاكرة المحلية
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
    localStorage.setItem(STORAGE_KEYS.SALES, JSON.stringify(sales));

    // إطلاق الإشعارات الفورية لكل الشاشات والتبويبات
    this.notifyProductListeners();
    this.notifySalesListeners();
    this.broadcastSync();

    // ── 7. مزامنة سحابية محمية مع Supabase (المنتجات المتأثرة فقط) ───────
    this.syncMutationToCloud(sales[index], reallyChangedProducts);

    // ── 8. رسالة إشعار تفصيلية ودقيقة ─────────────────────────────────
    let message = 'تم تحديث الفاتورة والمخزون بنجاح! ✓';
    if (diffAmount < 0 && returnedCount > 0) {
      message = `تم استرجاع (${returnedCount}) قطعة للمخزن وخصم (${Math.abs(diffAmount).toLocaleString()}) من الفاتورة ✓`;
    } else if (diffAmount > 0 && addedCount > 0) {
      message = `تم سحب (${addedCount}) قطعة من المخزن وإضافة (${diffAmount.toLocaleString()}) للفاتورة ✓`;
    } else if (diffAmount !== 0) {
      message = `تم تحديث الفاتورة — الفارق (${diffAmount > 0 ? '+' : ''}${diffAmount.toLocaleString()}) ✓`;
    }

    return { success: true, message, sale: sales[index] };
  }
  // ── إدارة المصاريف النثرية ─────────────────────────────────

  getExpenses(): Expense[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      if (!data) return [];
      const expenses = JSON.parse(data);
      return Array.isArray(expenses) ? expenses : [];
    } catch {
      return [];
    }
  }

  saveExpenses(expenses: Expense[]): void {
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    this.notifyExpensesListeners();
    this.broadcastSync();
  }

  addExpense(data: Omit<Expense, 'id' | 'createdAt'>): Expense {
    const expenses = this.getExpenses();
    const now = new Date().toISOString();
    const newExpense: Expense = {
      ...data,
      id: genUID('exp'),
      createdAt: now,
      updatedAt: now,
    };
    expenses.unshift(newExpense);
    this.saveExpenses(expenses);

    if (this.canWriteCloud()) {
      supabaseService.upsertExpense(newExpense).catch(err =>
        console.error('[StoreService] addExpense cloud sync error:', err)
      );
    }
    return newExpense;
  }

  updateExpense(id: string, updates: Partial<Omit<Expense, 'id' | 'createdAt'>>): Expense | null {
    const expenses = this.getExpenses();
    const idx = expenses.findIndex(e => e.id === id);
    if (idx === -1) return null;
    const now = new Date().toISOString();
    expenses[idx] = { ...expenses[idx], ...updates, updatedAt: now };
    this.saveExpenses(expenses);

    if (this.canWriteCloud()) {
      supabaseService.upsertExpense(expenses[idx]).catch(err =>
        console.error('[StoreService] updateExpense cloud sync error:', err)
      );
    }
    return expenses[idx];
  }

  deleteExpense(id: string): boolean {
    const expenses = this.getExpenses();
    const filtered = expenses.filter(e => e.id !== id);
    if (filtered.length === expenses.length) return false;
    this.saveExpenses(filtered);

    if (this.canWriteCloud()) {
      supabaseService.deleteExpense(id).catch(err =>
        console.error('[StoreService] deleteExpense cloud sync error:', err)
      );
    }
    return true;
  }
}

export const storeService = new StoreService();
export default storeService;
