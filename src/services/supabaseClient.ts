import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_KEYS = {
  URL: 'wms_supabase_url',
  ANON_KEY: 'wms_supabase_anon_key',
};

// القيم الافتراضية لمشروع Supabase الخاص بالمستخدم
const DEFAULT_SUPABASE_URL = 'https://nseiurpyjyrvgmamjwug.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zZWl1cnB5anlydmdtYW1qd3VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMzI3MjUsImV4cCI6MjEwNjgwODcyNX0.1vOTKwcjXSyqnk3V7rK15ObYoyOpI0wb-GNzImSX8g4';

// قراءة الإعدادات من متغيرات البيئة أو التخزين المحلي أو الافتراضية
function getInitialConfig() {
  const envUrl = (import.meta as any).env?.VITE_SUPABASE_URL || '';
  const envKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.URL) : null;
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.ANON_KEY) : null;

  const url = (storedUrl || envUrl || DEFAULT_SUPABASE_URL).trim();
  const anonKey = (storedKey || envKey || DEFAULT_SUPABASE_ANON_KEY).trim();

  return { url, anonKey };
}

let currentConfig = getInitialConfig();

export let supabase: SupabaseClient = createClient(
  currentConfig.url,
  currentConfig.anonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
    realtime: {
      params: {
        eventsPerSecond: 20,
      },
    },
    global: {
      headers: { 'x-client': 'wms-web' },
    },
  }
);

/** هل تم ضبط مفاتيح Supabase بشكل صحيح؟ */
export function isSupabaseConfigured(): boolean {
  return !!(
    currentConfig.url &&
    currentConfig.anonKey &&
    currentConfig.url.startsWith('https://') &&
    currentConfig.url.includes('.supabase.co') &&
    currentConfig.anonKey.length > 20
  );
}

/** جلب الإعدادات الحالية */
export function getSupabaseConfig(): { url: string; anonKey: string; isConfigured: boolean } {
  return {
    url: currentConfig.url,
    anonKey: currentConfig.anonKey,
    isConfigured: isSupabaseConfigured(),
  };
}

/** حفظ وتحديث إعدادات Supabase */
export function saveSupabaseConfig(url: string, anonKey: string): boolean {
  const cleanUrl = url.trim().replace(/\/$/, '');
  const cleanKey = anonKey.trim();

  if (cleanUrl && cleanKey) {
    localStorage.setItem(STORAGE_KEYS.URL, cleanUrl);
    localStorage.setItem(STORAGE_KEYS.ANON_KEY, cleanKey);
    currentConfig = { url: cleanUrl, anonKey: cleanKey };

    // إعادة تهيئة العميل
    supabase = createClient(cleanUrl, cleanKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: window.localStorage,
      },
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
      global: {
        headers: { 'x-client': 'wms-web' },
      },
    });
    return true;
  }
  return false;
}

/** اختبار الاتصال بمشروع Supabase */
export async function testSupabaseConnection(url?: string, key?: string): Promise<{ success: boolean; message: string }> {
  try {
    const testClient = (url && key)
      ? createClient(url.trim(), key.trim(), { auth: { persistSession: false } })
      : supabase;

    // استعلام خفيف لفحص الاستجابة
    const { error } = await testClient.from('profiles').select('id').limit(1);

    if (error && error.code !== 'PGRST116' && !error.message.includes('permission denied')) {
      // إذا كان الجدول غير موجود مثلاً
      if (error.code === '42P01') {
        return {
          success: true,
          message: 'تم الاتصال بـ Supabase بنجاح! ولكن يرجى تشغيل سكربت الجداول (SQL Script) من لوحة التحكم.',
        };
      }
      return { success: false, message: error.message };
    }

    return { success: true, message: 'الاتصال بـ Supabase سليم 100%!' };
  } catch (err: any) {
    return { success: false, message: err.message || 'فشل الاتصال بـ Supabase' };
  }
}
