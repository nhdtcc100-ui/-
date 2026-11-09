-- ==============================================================================
-- 🚀 نظام إدارة المستودع والمبيعات — سكربت إعداد قاعدة بيانات Supabase بالكامل
-- ==============================================================================
-- قم بنسخ هذا السكربت بالكامل ولصقه في:
-- Supabase Dashboard -> SQL Editor -> New Query -> Run (تشغيل)
-- ==============================================================================

-- 1. تفعيل الإضافات المطلوبة
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. جدول ملفات تعريف المستخدمين (Profiles)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'manager', 'staff', 'cashier')),
  pin_code TEXT DEFAULT '123456',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. جدول إعدادات كل مستخدم وربطه بكوكل شيت (User Settings & Google Sheets)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  store_name TEXT DEFAULT 'مستودعي',
  currency TEXT DEFAULT 'د.ع',
  google_sheet_url TEXT DEFAULT '',
  apps_script_url TEXT DEFAULT '',
  last_synced_at TIMESTAMPTZ,
  auto_sync_sheets BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. جدول المنتجات — لكل مستخدم منتجاته الخاصة ومستويات التعبئة ومزامنة كوكل شيت
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  barcode TEXT DEFAULT '',
  category TEXT DEFAULT '',
  cost_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
  sell_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
  stock NUMERIC(15, 2) NOT NULL DEFAULT 0,
  min_stock NUMERIC(15, 2) NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  has_package_unit BOOLEAN NOT NULL DEFAULT FALSE,
  package_unit_name TEXT DEFAULT '',
  units_per_package NUMERIC(15, 2) DEFAULT 1,
  package_sell_price NUMERIC(15, 2) DEFAULT 0,
  google_sheets_row_id TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. جدول فواتير المبيعات — لكل مستخدم مبيعاته وديونه الخاصة
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sales (
  id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_number TEXT NOT NULL,
  total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  total_profit NUMERIC(15, 2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  remaining_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'partial', 'unpaid')),
  customer_name TEXT DEFAULT '',
  customer_phone TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  due_date TEXT DEFAULT '',
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (id, user_id),
  UNIQUE (invoice_number, user_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. جدول بنود الفواتير (Sale Items)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sale_items (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sale_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT,
  product_name TEXT NOT NULL,
  barcode TEXT DEFAULT '',
  quantity NUMERIC(15, 2) NOT NULL DEFAULT 0,
  unit_type TEXT DEFAULT 'piece',
  unit_name TEXT DEFAULT '',
  units_per_package NUMERIC(15, 2) DEFAULT 1,
  pieces_count NUMERIC(15, 2) DEFAULT 0,
  sell_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
  cost_price NUMERIC(15, 2) NOT NULL DEFAULT 0,
  subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
  profit NUMERIC(15, 2) NOT NULL DEFAULT 0,
  FOREIGN KEY (sale_id, user_id) REFERENCES public.sales(id, user_id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. جدول دفعات سداد الديون (Debt Payments)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.debt_payments (
  id TEXT NOT NULL,
  sale_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  notes TEXT DEFAULT '',
  PRIMARY KEY (id, user_id),
  FOREIGN KEY (sale_id, user_id) REFERENCES public.sales(id, user_id) ON DELETE CASCADE
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. إنشاء الفهارس (Indexes) لسرعة استجابة فائقة
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_user ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(user_id, barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products(user_id, name);
CREATE INDEX IF NOT EXISTS idx_sales_user ON public.sales(user_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON public.sales(user_id, invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_archived ON public.sales(user_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id, user_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_user ON public.sale_items(user_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_sale ON public.debt_payments(sale_id, user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. تفعيل نظام حماية الصفوف (Row Level Security - RLS)
-- بحيث يرى ويعدل ويحذف كل مستخدم بياناته الخاصة فقط بنسبة 100%
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

-- 🛡️ سياسات Profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
CREATE POLICY "Users can view profiles" ON public.profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 🛡️ سياسات User Settings
DROP POLICY IF EXISTS "Users can view own settings" ON public.user_settings;
CREATE POLICY "Users can view own settings" ON public.user_settings
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own settings" ON public.user_settings;
CREATE POLICY "Users can insert own settings" ON public.user_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own settings" ON public.user_settings;
CREATE POLICY "Users can update own settings" ON public.user_settings
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own settings" ON public.user_settings;
CREATE POLICY "Users can delete own settings" ON public.user_settings
  FOR DELETE USING (auth.uid() = user_id);

-- 🛡️ سياسات Products
DROP POLICY IF EXISTS "Users can view own products" ON public.products;
CREATE POLICY "Users can view own products" ON public.products
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own products" ON public.products;
CREATE POLICY "Users can insert own products" ON public.products
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own products" ON public.products;
CREATE POLICY "Users can update own products" ON public.products
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own products" ON public.products;
CREATE POLICY "Users can delete own products" ON public.products
  FOR DELETE USING (auth.uid() = user_id);

-- 🛡️ سياسات Sales
DROP POLICY IF EXISTS "Users can view own sales" ON public.sales;
CREATE POLICY "Users can view own sales" ON public.sales
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sales" ON public.sales;
CREATE POLICY "Users can insert own sales" ON public.sales
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sales" ON public.sales;
CREATE POLICY "Users can update own sales" ON public.sales
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sales" ON public.sales;
CREATE POLICY "Users can delete own sales" ON public.sales
  FOR DELETE USING (auth.uid() = user_id);

-- 🛡️ سياسات Sale Items
DROP POLICY IF EXISTS "Users can view own sale_items" ON public.sale_items;
CREATE POLICY "Users can view own sale_items" ON public.sale_items
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sale_items" ON public.sale_items;
CREATE POLICY "Users can insert own sale_items" ON public.sale_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sale_items" ON public.sale_items;
CREATE POLICY "Users can update own sale_items" ON public.sale_items
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sale_items" ON public.sale_items;
CREATE POLICY "Users can delete own sale_items" ON public.sale_items
  FOR DELETE USING (auth.uid() = user_id);

-- 🛡️ سياسات Debt Payments
DROP POLICY IF EXISTS "Users can view own debt_payments" ON public.debt_payments;
CREATE POLICY "Users can view own debt_payments" ON public.debt_payments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own debt_payments" ON public.debt_payments;
CREATE POLICY "Users can insert own debt_payments" ON public.debt_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own debt_payments" ON public.debt_payments;
CREATE POLICY "Users can update own debt_payments" ON public.debt_payments
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own debt_payments" ON public.debt_payments;
CREATE POLICY "Users can delete own debt_payments" ON public.debt_payments
  FOR DELETE USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. دالة ومحفز (Trigger) لإنشاء Profile و Settings تلقائياً عند تسجيل أي مستخدم
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_display_name TEXT;
  v_role TEXT;
  v_pin_code TEXT;
BEGIN
  -- استخراج اسم المستخدم والاسم المعروض
  v_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    SPLIT_PART(NEW.email, '@', 1),
    'user_' || SUBSTRING(NEW.id::text, 1, 8)
  );
  v_display_name := COALESCE(NEW.raw_user_meta_data->>'displayName', v_username);
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'admin');
  v_pin_code := COALESCE(
    NEW.raw_user_meta_data->>'pinCode',
    NEW.raw_user_meta_data->>'pin_code',
    '123456'
  );

  -- إنشاء بروفايل المستخدم
  INSERT INTO public.profiles (id, username, display_name, role, pin_code)
  VALUES (NEW.id, v_username, v_display_name, v_role, v_pin_code)
  ON CONFLICT (id) DO UPDATE
  SET username = EXCLUDED.username,
      display_name = EXCLUDED.display_name,
      pin_code = COALESCE(EXCLUDED.pin_code, public.profiles.pin_code, '123456'),
      updated_at = NOW();

  -- إنشاء الإعدادات الافتراضية للمستخدم
  INSERT INTO public.user_settings (user_id, store_name, currency)
  VALUES (NEW.id, 'مستودع ' || v_display_name, 'د.ع')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ربط الـ Trigger مع جدول auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. دالة تحديث توقيت updated_at تلقائياً
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER trg_user_settings_updated_at BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_products_updated_at ON public.products;
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_sales_updated_at ON public.sales;
CREATE TRIGGER trg_sales_updated_at BEFORE UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. تفعيل المزامنة اللحظية (Realtime) لجميع الجداول
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_items;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.debt_payments;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_settings;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. ترقية الجداول القائمة إن وُجدت (Migrations)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_sales_archived ON public.sales(user_id, is_archived);

-- إضافة عمود الرمز السري إلى جدول profiles إن لم يكن موجوداً
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pin_code TEXT DEFAULT '123456';

-- تعيين الرمز السري 123456 للمستخدم ميثم وجميع المستخدمين الحاليين
UPDATE public.profiles 
SET pin_code = '123456' 
WHERE username ILIKE '%maytham%' 
   OR username ILIKE '%methim%' 
   OR username ILIKE '%ميثم%' 
   OR display_name ILIKE '%ميثم%'
   OR pin_code IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. جدول المصاريف النثرية (Expenses)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.expenses (
  id          TEXT PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  category    TEXT NOT NULL DEFAULT 'أخرى',
  date        TEXT NOT NULL,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own expenses" ON public.expenses;
CREATE POLICY "Users can manage their own expenses" ON public.expenses
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(date);

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

