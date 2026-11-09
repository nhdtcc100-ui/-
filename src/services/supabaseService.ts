import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { SimpleProduct, SaleRecord, SaleItem, AppSettings, DebtPayment, Expense } from '../types';

export interface SupabaseUserProfile {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'manager' | 'staff' | 'cashier';
  pinCode?: string;
  createdAt: string;
}

// دالة مساعدة لتحويل اسم المستخدم (عربي أو إنجليزي) إلى بريد إلكتروني قياسي صالح بنسبة 100% لسوبابيس
function formatAuthEmail(usernameOrEmail: string): string {
  const clean = usernameOrEmail.trim().toLowerCase();
  if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(clean)) {
    return clean;
  }
  let hex = '';
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i).toString(16);
    hex += (code.length < 2 ? '0' : '') + code;
  }
  return `wms_${hex}@gmail.com`;
}

class SupabaseService {
  private activeUserId: string | null = null;
  private realtimeChannel: any = null;

  // ─────────────────────────────────────────────────────────────────
  // 1. إدارة المستخدمين والمصادقة (Authentication)
  // ─────────────────────────────────────────────────────────────────

  async initAuth(): Promise<SupabaseUserProfile | null> {
    if (!isSupabaseConfigured()) return null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        this.activeUserId = null;
        return null;
      }
      this.activeUserId = session.user.id;
      const profile = await this.getProfile(session.user.id);
      return profile || {
        id: session.user.id,
        username: session.user.user_metadata?.username || session.user.email || 'المستخدم',
        displayName: session.user.user_metadata?.displayName || 'المستخدم',
        role: session.user.user_metadata?.role || 'admin',
        createdAt: session.user.created_at,
      };
    } catch (err) {
      console.error('[SupabaseService] initAuth error:', err);
      return null;
    }
  }

  async getProfile(userId: string): Promise<SupabaseUserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      return {
        id: data.id,
        username: data.username,
        displayName: data.display_name || data.username,
        role: data.role || 'admin',
        pinCode: data.pin_code || '123456',
        createdAt: data.created_at,
      };
    } catch {
      return null;
    }
  }

  async login(usernameOrEmail: string, password: string): Promise<{ success: boolean; user?: SupabaseUserProfile; message?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, message: 'يرجى إدخال مفاتيح Supabase أولاً من الإعدادات' };
    }

    try {
      const email = formatAuthEmail(usernameOrEmail);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
      }

      if (data.user) {
        this.activeUserId = data.user.id;
        const profile = await this.getProfile(data.user.id);
        return {
          success: true,
          user: profile || {
            id: data.user.id,
            username: usernameOrEmail,
            displayName: data.user.user_metadata?.displayName || usernameOrEmail,
            role: data.user.user_metadata?.role || 'admin',
            createdAt: data.user.created_at,
          },
        };
      }
      return { success: false, message: 'فشل تسجيل الدخول' };
    } catch (err: any) {
      return { success: false, message: err.message || 'خطأ في الاتصال بخادم Supabase' };
    }
  }

  async register(params: {
    username: string;
    password: string;
    displayName?: string;
    role?: 'admin' | 'staff' | 'cashier';
    pinCode?: string;
  }): Promise<{ success: boolean; user?: SupabaseUserProfile; message?: string }> {
    if (!isSupabaseConfigured()) {
      return { success: false, message: 'يرجى إدخال مفاتيح Supabase أولاً من الإعدادات' };
    }

    try {
      const cleanUsername = params.username.trim();
      const email = formatAuthEmail(cleanUsername);
      const displayName = (params.displayName || cleanUsername).trim();
      const role = params.role || 'admin';
      const pinCode = params.pinCode || '123456';

      const { data, error } = await supabase.auth.signUp({
        email,
        password: params.password,
        options: {
          data: {
            username: cleanUsername,
            displayName,
            role,
            pinCode,
          },
        },
      });

      if (error) {
        if (error.message.includes('already registered') || error.message.includes('unique')) {
          return { success: false, message: 'اسم المستخدم مسجل مسبقاً، يرجى اختيار اسم آخر' };
        }
        return { success: false, message: error.message };
      }

      if (data.user) {
        this.activeUserId = data.user.id;

        // تأكيد حفظ الملف الشخصي
        const profile: SupabaseUserProfile = {
          id: data.user.id,
          username: cleanUsername,
          displayName,
          role,
          pinCode,
          createdAt: new Date().toISOString(),
        };

        // محاولة حفظ إضافية للتأكد في حال عدم عمل trigger
        try {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            username: cleanUsername,
            display_name: displayName,
            role,
            pin_code: pinCode,
          });
        } catch {
          // ignore
        }

        return { success: true, user: profile };
      }

      return { success: false, message: 'تعذر إنشاء الحساب' };
    } catch (err: any) {
      return { success: false, message: err.message || 'خطأ أثناء إنشاء الحساب' };
    }
  }

  async logout(): Promise<void> {
    this.activeUserId = null;
    this.unsubscribeRealtime();
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
  }

  async changePassword(newPassword: string): Promise<{ success: boolean; message?: string }> {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      return { success: true, message: 'تم تغيير كلمة المرور بنجاح' };
    } catch (err: any) {
      return { success: false, message: err.message || 'فشل تغيير كلمة المرور' };
    }
  }

  async updatePinCode(userId: string, pinCode: string): Promise<{ success: boolean; message?: string }> {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ pin_code: pinCode, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) throw error;
      return { success: true, message: 'تم تحديث الرمز السري بنجاح' };
    } catch (err: any) {
      return { success: false, message: err.message || 'فشل تحديث الرمز السري' };
    }
  }

  getUserId(): string | null {
    if (this.activeUserId) return this.activeUserId;
    try {
      const raw = localStorage.getItem('wms_auth_user');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.id) {
          this.activeUserId = parsed.id;
          return parsed.id;
        }
      }
    } catch {}
    return null;
  }

  async ensureUserId(): Promise<string | null> {
    if (this.activeUserId) return this.activeUserId;
    const local = this.getUserId();
    if (local) return local;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        this.activeUserId = session.user.id;
        return this.activeUserId;
      }
    } catch {}
    return null;
  }

  // ─────────────────────────────────────────────────────────────────
  // 2. إدارة المنتجات (Products CRUD)
  // ─────────────────────────────────────────────────────────────────

  async getProducts(): Promise<SimpleProduct[]> {
    if (!this.activeUserId) return [];
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', this.activeUserId)
        .order('name', { ascending: true });

      if (error) throw error;

      return (data || []).map((row: any): SimpleProduct => ({
        id: row.id,
        name: row.name,
        barcode: row.barcode || '',
        category: row.category || '',
        costPrice: Number(row.cost_price || 0),
        sellPrice: Number(row.sell_price || 0),
        stock: Number(row.stock || 0),
        minStock: Number(row.min_stock || 0),
        notes: row.notes || '',
        hasPackageUnit: Boolean(row.has_package_unit),
        packageUnitName: row.package_unit_name || '',
        unitsPerPackage: Number(row.units_per_package || 1),
        packageSellPrice: Number(row.package_sell_price || 0),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (err) {
      console.error('[SupabaseService] getProducts error:', err);
      return [];
    }
  }

  async upsertProduct(product: SimpleProduct): Promise<SimpleProduct> {
    if (!this.activeUserId) throw new Error('يجب تسجيل الدخول أولاً');

    const record = {
      id: product.id,
      user_id: this.activeUserId,
      name: product.name,
      barcode: product.barcode || '',
      category: product.category || '',
      cost_price: product.costPrice || 0,
      sell_price: product.sellPrice || 0,
      stock: product.stock || 0,
      min_stock: product.minStock || 0,
      notes: product.notes || '',
      has_package_unit: !!product.hasPackageUnit,
      package_unit_name: product.packageUnitName || '',
      units_per_package: product.unitsPerPackage || 1,
      package_sell_price: product.packageSellPrice || 0,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('products')
      .upsert(record);

    if (error) throw error;
    return product;
  }

  async bulkUpsertProducts(products: SimpleProduct[]): Promise<void> {
    const uid = await this.ensureUserId();
    if (!uid || products.length === 0) return;

    const records = products.map(p => ({
      id: p.id,
      user_id: uid,
      name: p.name,
      barcode: p.barcode || '',
      category: p.category || '',
      cost_price: Number(p.costPrice) || 0,
      sell_price: Number(p.sellPrice) || 0,
      stock: Number(p.stock) || 0,
      min_stock: Number(p.minStock) || 0,
      notes: p.notes || '',
      has_package_unit: !!p.hasPackageUnit,
      package_unit_name: p.packageUnitName || '',
      units_per_package: Number(p.unitsPerPackage) || 1,
      package_sell_price: Number(p.packageSellPrice) || 0,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('products')
      .upsert(records);

    if (error) {
      console.error('[SupabaseService] bulkUpsertProducts error:', error);
      throw error;
    }
  }

  async deleteProduct(id: string): Promise<void> {
    if (!this.activeUserId) return;
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id)
      .eq('user_id', this.activeUserId);

    if (error) throw error;
  }

  // ─────────────────────────────────────────────────────────────────
  // 3. إدارة المبيعات والفواتير (Sales CRUD)
  // ─────────────────────────────────────────────────────────────────

  async getSales(): Promise<SaleRecord[]> {
    if (!this.activeUserId) return [];
    try {
      // 1. جلب الفواتير
      const { data: salesData, error: salesErr } = await supabase
        .from('sales')
        .select('*')
        .eq('user_id', this.activeUserId)
        .order('created_at', { ascending: false });

      if (salesErr) throw salesErr;
      if (!salesData || salesData.length === 0) return [];

      // 2. جلب بنود الفواتير
      const { data: itemsData } = await supabase
        .from('sale_items')
        .select('*')
        .eq('user_id', this.activeUserId);

      // 3. جلب دفعات الديون
      const { data: debtData } = await supabase
        .from('debt_payments')
        .select('*')
        .eq('user_id', this.activeUserId);

      const itemsBySale = new Map<string, SaleItem[]>();
      (itemsData || []).forEach((it: any) => {
        const list = itemsBySale.get(it.sale_id) || [];
        list.push({
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
        });
        itemsBySale.set(it.sale_id, list);
      });

      const debtBySale = new Map<string, DebtPayment[]>();
      (debtData || []).forEach((d: any) => {
        const list = debtBySale.get(d.sale_id) || [];
        list.push({
          id: d.id,
          amount: Number(d.amount || 0),
          date: d.date,
          notes: d.notes || '',
        });
        debtBySale.set(d.sale_id, list);
      });

      return salesData.map((row: any): SaleRecord => {
        const isArchived = Boolean(row.is_archived) || (typeof row.notes === 'string' && row.notes.includes('[ARCHIVED]'));
        const cleanNotes = (row.notes || '').replace(/\[ARCHIVED\]\s*/g, '').trim();
        return {
          id: row.id,
          invoiceNumber: row.invoice_number,
          totalAmount: Number(row.total_amount || 0),
          totalProfit: Number(row.total_profit || 0),
          paidAmount: Number(row.paid_amount || 0),
          remainingAmount: Number(row.remaining_amount || 0),
          paymentStatus: row.payment_status || 'paid',
          customerName: row.customer_name || '',
          customerPhone: row.customer_phone || '',
          notes: cleanNotes,
          dueDate: row.due_date || '',
          isArchived,
          archivedAt: row.archived_at || undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          items: itemsBySale.get(row.id) || [],
          paymentHistory: debtBySale.get(row.id) || [],
        };
      });
    } catch (err) {
      console.error('[SupabaseService] getSales error:', err);
      return [];
    }
  }

  async upsertSale(sale: SaleRecord): Promise<SaleRecord> {
    const uid = await this.ensureUserId();
    if (!uid) {
      console.warn('[SupabaseService] upsertSale skipped: No active user session');
      return sale;
    }

    let rawNotes = (sale.notes || '').replace(/\[ARCHIVED\]\s*/g, '').trim();
    if (sale.isArchived) {
      rawNotes = `[ARCHIVED] ${rawNotes}`.trim();
    }

    const saleRow: any = {
      id: sale.id,
      user_id: uid,
      invoice_number: sale.invoiceNumber,
      total_amount: Number(sale.totalAmount) || 0,
      total_profit: Number(sale.totalProfit) || 0,
      paid_amount: Number(sale.paidAmount) || 0,
      remaining_amount: Number(sale.remainingAmount) || 0,
      payment_status: sale.paymentStatus || 'paid',
      customer_name: sale.customerName || '',
      customer_phone: sale.customerPhone || '',
      notes: rawNotes,
      due_date: sale.dueDate || '',
      is_archived: Boolean(sale.isArchived),
      archived_at: sale.archivedAt || null,
      created_at: sale.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // حفظ رأس الفاتورة
    const { error: saleErr } = await supabase
      .from('sales')
      .upsert(saleRow);

    if (saleErr) {
      // في حال لم يكن عمود is_archived موجوداً بعد في قاعدة بيانات العميل، نحفظ الفاتورة بدون العمود
      console.warn('[SupabaseService] Upsert with is_archived column failed, falling back:', saleErr.message);
      delete saleRow.is_archived;
      delete saleRow.archived_at;
      const { error: retryErr } = await supabase.from('sales').upsert(saleRow);
      if (retryErr) {
        console.error('[SupabaseService] Error upserting sale on fallback:', retryErr);
        throw retryErr;
      }
    }

    // حذف البنود القديمة وإعادة إدراج الجديدة
    await supabase.from('sale_items').delete().eq('sale_id', sale.id).eq('user_id', uid);

    if (sale.items && sale.items.length > 0) {
      const itemRows = sale.items.map(it => ({
        sale_id: sale.id,
        user_id: uid,
        product_id: it.productId,
        product_name: it.productName,
        barcode: it.barcode || '',
        quantity: Number(it.quantity) || 0,
        unit_type: it.unitType || 'piece',
        unit_name: it.unitName || '',
        units_per_package: Number(it.unitsPerPackage) || 1,
        pieces_count: Number(it.piecesCount) || 0,
        sell_price: Number(it.sellPrice) || 0,
        cost_price: Number(it.costPrice) || 0,
        subtotal: Number(it.subtotal) || 0,
        profit: Number(it.profit) || 0,
      }));

      const { error: itemsErr } = await supabase.from('sale_items').insert(itemRows);
      if (itemsErr) console.error('[SupabaseService] Error inserting sale items:', itemsErr);
    }

    // حفظ سجل دفعات الدين إن وجدت
    if (sale.paymentHistory && sale.paymentHistory.length > 0) {
      const debtRows = sale.paymentHistory.map(d => ({
        id: d.id,
        sale_id: sale.id,
        user_id: uid,
        amount: Number(d.amount) || 0,
        date: d.date,
        notes: d.notes || '',
      }));
      await supabase.from('debt_payments').upsert(debtRows);
    }

    return sale;
  }

  async bulkUpsertSales(sales: SaleRecord[]): Promise<void> {
    for (const s of sales) {
      await this.upsertSale(s);
    }
  }

  async deleteSale(id: string): Promise<void> {
    if (!this.activeUserId) return;
    const { error } = await supabase
      .from('sales')
      .delete()
      .eq('id', id)
      .eq('user_id', this.activeUserId);

    if (error) throw error;
  }

  async archiveSale(id: string, isArchived: boolean = true): Promise<void> {
    const uid = await this.ensureUserId();
    if (!uid) return;

    // جلب الملاحظات الحالية من قاعدة البيانات لإرفاق وسم الأرشفة
    const { data: currentSale } = await supabase
      .from('sales')
      .select('notes')
      .eq('id', id)
      .eq('user_id', uid)
      .maybeSingle();

    let rawNotes = (currentSale?.notes || '').replace(/\[ARCHIVED\]\s*/g, '').trim();
    if (isArchived) {
      rawNotes = `[ARCHIVED] ${rawNotes}`.trim();
    }

    // محاولة التحديث الأولية متضمنة عمود is_archived وملاحظات [ARCHIVED]
    const payloadWithCol: any = {
      notes: rawNotes,
      is_archived: isArchived,
      archived_at: isArchived ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('sales')
      .update(payloadWithCol)
      .eq('id', id)
      .eq('user_id', uid);

    if (error) {
      // إذا فشل لوجود نقص في عمود is_archived، نحفظ عبر notes مباشرة
      console.warn('[SupabaseService] is_archived column update failed, using notes fallback:', error.message);
      const { error: fallbackErr } = await supabase
        .from('sales')
        .update({
          notes: rawNotes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('user_id', uid);

      if (fallbackErr) {
        console.error('[SupabaseService] Fallback archive error:', fallbackErr);
        throw fallbackErr;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // 4. إعدادات المستخدم وربط كوكل شيت (User Settings & Google Sheets)
  // ─────────────────────────────────────────────────────────────────

  async getSettings(): Promise<AppSettings | null> {
    if (!this.activeUserId) return null;
    try {
      const { data, error } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', this.activeUserId)
        .single();

      if (error || !data) return null;

      return {
        storeName: data.store_name || 'مستودعي',
        currency: data.currency || 'د.ع',
        adminPassword: '',
        googleSheetUrl: data.google_sheet_url || '',
        appsScriptUrl: data.apps_script_url || '',
        lastSyncedAt: data.last_synced_at,
      };
    } catch {
      return null;
    }
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    if (!this.activeUserId) return;

    const payload: any = {
      user_id: this.activeUserId,
      updated_at: new Date().toISOString(),
    };

    if (settings.storeName !== undefined) payload.store_name = settings.storeName;
    if (settings.currency !== undefined) payload.currency = settings.currency;
    if (settings.googleSheetUrl !== undefined) payload.google_sheet_url = settings.googleSheetUrl;
    if (settings.appsScriptUrl !== undefined) payload.apps_script_url = settings.appsScriptUrl;
    if (settings.lastSyncedAt !== undefined) payload.last_synced_at = settings.lastSyncedAt;

    const { error } = await supabase
      .from('user_settings')
      .upsert(payload);

    if (error) throw error;
  }

  // ─────────────────────────────────────────────────────────────────
  // 5. المزامنة الحية الذكية (Smart Realtime — payload-driven, no full refetch)
  // ─────────────────────────────────────────────────────────────────

  /**
   * الاشتراك في تغييرات Supabase Realtime مع تمرير البيانات الفعلية للمستمع.
   *
   * بدلاً من جلب كل البيانات عند كل حدث، يستقبل المستمع:
   *   • table  : اسم الجدول المتأثر ('products' | 'sales' | 'sale_items')
   *   • event  : نوع العملية ('INSERT' | 'UPDATE' | 'DELETE')
   *   • record : البيانات الجديدة (بعد التعديل)
   *   • oldRecord: البيانات القديمة (قبل التعديل، للحذف/التحديث)
   */
  subscribeRealtime(
    onDataChange: (info: {
      table: string;
      event: 'INSERT' | 'UPDATE' | 'DELETE';
      record: Record<string, any>;
      oldRecord: Record<string, any>;
    }) => void
  ): void {
    if (!this.activeUserId || !isSupabaseConfigured()) return;
    this.unsubscribeRealtime();

    const uid = this.activeUserId;

    const handler = (table: string) => (payload: any) => {
      onDataChange({
        table,
        event: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
        record: payload.new ?? {},
        oldRecord: payload.old ?? {},
      });
    };

    this.realtimeChannel = supabase
      .channel(`wms-realtime-${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `user_id=eq.${uid}` },
        handler('products')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sales', filter: `user_id=eq.${uid}` },
        handler('sales')
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sale_items', filter: `user_id=eq.${uid}` },
        handler('sale_items')
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] ✅ الاتصال الحي مفعّل — التحديثات الآنية نشطة');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('[Realtime] ⚠️ انقطع الاتصال — سيُعاد الاتصال تلقائياً:', status);
        }
      });
  }

  unsubscribeRealtime(): void {
    if (this.realtimeChannel) {
      supabase.removeChannel(this.realtimeChannel);
      this.realtimeChannel = null;
    }
  }

  /**
   * تحويل صف products من Supabase إلى SimpleProduct (لاستخدامه في payload الـ Realtime)
   */
  mapProductRow(row: Record<string, any>): SimpleProduct {
    return {
      id: row.id,
      name: row.name,
      barcode: row.barcode || '',
      category: row.category || '',
      costPrice: Number(row.cost_price || 0),
      sellPrice: Number(row.sell_price || 0),
      stock: Number(row.stock || 0),
      minStock: Number(row.min_stock || 0),
      notes: row.notes || '',
      hasPackageUnit: Boolean(row.has_package_unit),
      packageUnitName: row.package_unit_name || '',
      unitsPerPackage: Number(row.units_per_package || 1),
      packageSellPrice: Number(row.package_sell_price || 0),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * تحويل صف sales من Supabase إلى SaleRecord جزئي (بدون بنود — تُجلب لاحقاً إن لزم)
   */
  mapSaleRow(row: Record<string, any>): Omit<SaleRecord, 'items' | 'paymentHistory'> {
    const isArchived = Boolean(row.is_archived) || (typeof row.notes === 'string' && row.notes.includes('[ARCHIVED]'));
    const cleanNotes = (row.notes || '').replace(/\[ARCHIVED\]\s*/g, '').trim();
    return {
      id: row.id,
      invoiceNumber: row.invoice_number,
      totalAmount: Number(row.total_amount || 0),
      totalProfit: Number(row.total_profit || 0),
      paidAmount: Number(row.paid_amount || 0),
      remainingAmount: Number(row.remaining_amount || 0),
      paymentStatus: row.payment_status || 'paid',
      customerName: row.customer_name || '',
      customerPhone: row.customer_phone || '',
      notes: cleanNotes,
      dueDate: row.due_date || '',
      isArchived,
      archivedAt: row.archived_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // 6. إدارة المصاريف النثرية (Expenses CRUD)
  // ─────────────────────────────────────────────────────────────────

  async getExpenses(): Promise<Expense[]> {
    const uid = this.activeUserId;
    if (!uid) return [];
    try {
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('user_id', uid)
        .order('date', { ascending: false });
      if (error) throw error;
      return (data || []).map((row: any) => ({
        id: row.id,
        title: row.title || '',
        amount: Number(row.amount || 0),
        category: row.category || 'أخرى',
        date: row.date || '',
        notes: row.notes || '',
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));
    } catch (err) {
      console.error('[SupabaseService] getExpenses error:', err);
      return [];
    }
  }

  async upsertExpense(expense: Expense): Promise<void> {
    const uid = await this.ensureUserId();
    if (!uid) return;
    const { error } = await supabase
      .from('expenses')
      .upsert({
        id: expense.id,
        user_id: uid,
        title: expense.title,
        amount: Number(expense.amount) || 0,
        category: expense.category || 'أخرى',
        date: expense.date,
        notes: expense.notes || '',
        updated_at: new Date().toISOString(),
      });
    if (error) {
      console.error('[SupabaseService] upsertExpense error:', error);
      throw error;
    }
  }

  async deleteExpense(id: string): Promise<void> {
    const uid = this.activeUserId;
    if (!uid) return;
    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id)
      .eq('user_id', uid);
    if (error) throw error;
  }
}

export const supabaseService = new SupabaseService();
export default supabaseService;
