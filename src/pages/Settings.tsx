import { useState } from 'react';
import {
  FiDatabase, FiSave, FiUser, FiCloud
} from 'react-icons/fi';
import { storeService } from '../services/storeService';
import { supabase, isSupabaseConfigured, getSupabaseConfig, saveSupabaseConfig, testSupabaseConnection } from '../services/supabaseClient';
import { supabaseService } from '../services/supabaseService';
import { useAuth } from '../hooks/useAuth';
import type { AppSettings } from '../types';

export default function Settings() {
  const { currentUser, isSupabase } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(() => storeService.getSettings());

  // Supabase State
  const [supabaseUrl, setSupabaseUrl]         = useState(() => getSupabaseConfig().url);
  const [supabaseAnonKey, setSupabaseAnonKey] = useState(() => getSupabaseConfig().anonKey);
  const [supabaseTesting, setSupabaseTesting] = useState(false);
  const [supabaseMsg, setSupabaseMsg]         = useState<{ text: string; isError: boolean } | null>(null);

  // Admin Profile & Password Change State
  const [adminUsername, setAdminUsername] = useState(currentUser?.displayName || currentUser?.username || settings.adminUsername || 'ميثم');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Store Settings State
  const [storeName, setStoreName] = useState(settings.storeName);
  const [currency, setCurrency] = useState(settings.currency);
  const [storeMsg, setStoreMsg] = useState<{ text: string; isError: boolean } | null>(null);

  // Handle Admin Profile & Password Change
  const handleUpdateAdminProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);

    if (!adminUsername.trim()) {
      setPwMsg({ text: 'يرجى إدخال اسم الأدمن', isError: true });
      return;
    }
    if (!oldPassword) {
      setPwMsg({ text: 'يرجى إدخال الرمز السري الحالي لتأكيد التعديلات', isError: true });
      return;
    }

    if (newPassword) {
      if (newPassword.length < 4) {
        setPwMsg({ text: 'يجب ألا يقل الرمز السري الجديد عن 4 خانات', isError: true });
        return;
      }
      if (newPassword !== confirmPassword) {
        setPwMsg({ text: 'الرمز السري الجديد غير متطابق مع التأكيد', isError: true });
        return;
      }
    }

    const res = storeService.updateAdminProfile(
      adminUsername.trim(),
      oldPassword,
      newPassword ? newPassword.trim() : undefined
    );

    setPwMsg({ text: res.message, isError: !res.success });

    if (res.success) {
      if (res.updatedSettings) {
        setSettings(res.updatedSettings);
      }
      if (isSupabase && currentUser?.id) {
        if (newPassword) {
          supabaseService.updatePinCode(currentUser.id, newPassword.trim()).catch(console.error);
          supabaseService.changePassword(newPassword.trim()).catch(console.error);
        }
        if (adminUsername.trim() !== currentUser.displayName) {
          supabase.from('profiles').update({ display_name: adminUsername.trim(), updated_at: new Date().toISOString() }).eq('id', currentUser.id).then();
        }
      }
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwMsg(null), 5000);
    }
  };

  // Handle Save Store Settings
  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setStoreMsg(null);

    const updated = storeService.updateSettings({
      storeName: storeName.trim() || 'مخزن ميثم',
      currency: currency.trim() || 'د.ع',
    });

    setSettings(updated);
    setStoreMsg({ text: 'تم حفظ إعدادات المتجر بنجاح!', isError: false });
    setTimeout(() => setStoreMsg(null), 4000);
  };

  // Handle Save Supabase
  const handleSaveSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupabaseMsg(null);

    if (!supabaseUrl.trim() || !supabaseAnonKey.trim()) {
      setSupabaseMsg({ text: 'يرجى إدخال الرابط والمفتاح معاً', isError: true });
      return;
    }

    setSupabaseTesting(true);
    const test = await testSupabaseConnection(supabaseUrl, supabaseAnonKey);
    setSupabaseTesting(false);

    if (test.success) {
      saveSupabaseConfig(supabaseUrl, supabaseAnonKey);
      setSupabaseMsg({ text: '✓ ' + test.message + ' (جاري تحديث الصفحة...)', isError: false });
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } else {
      setSupabaseMsg({ text: test.message, isError: true });
    }
  };

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '850px' }}>

      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>الإعدادات وقاعدة البيانات</h2>
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          إدارة حساب المدير، اسم المتجر، والربط السحابي مع Supabase
        </p>
      </div>

      {/* Section 1: Change Admin Username & Password */}
      <div className="table-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          <FiUser size={20} color="var(--primary)" />
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>بيانات حساب الأدمن والرمز السري</h3>
        </div>

        {pwMsg && (
          <div style={{
            background: pwMsg.isError ? 'var(--danger-100)' : 'var(--success-100)',
            color: pwMsg.isError ? '#B91C1C' : '#15803D',
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.82rem',
            fontWeight: 600,
            marginBottom: '1rem',
          }}>
            {pwMsg.isError ? '⚠️ ' : '✅ '} {pwMsg.text}
          </div>
        )}

        <form onSubmit={handleUpdateAdminProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Admin Username */}
          <div className="form-group">
            <label className="form-label">اسم الأدمن (اسم المستخدم الحالي) *</label>
            <input
              type="text"
              required
              className="form-control-custom"
              placeholder="مثال: ميثم أو المدير"
              value={adminUsername}
              onChange={e => setAdminUsername(e.target.value)}
            />
            <small style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
              هذا الاسم سيظهر في الشريط العلوي للبرنامج ويمكن استخدامه لتسجيل الدخول
            </small>
          </div>

          {/* Current Password */}
          <div className="form-group">
            <label className="form-label">الرمز السري الحالي (كلمة المرور الحالية) *</label>
            <input
              type="password"
              required
              className="form-control-custom"
              placeholder="••••••••"
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
            />
            <small style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
              مطلوب لتأكيد أي تعديل على اسم الأدمن أو الرمز السري
            </small>
          </div>

          {/* New Password & Confirm */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">الرمز السري الجديد (اختياري)</label>
              <input
                type="password"
                className="form-control-custom"
                placeholder="اتركه فارغاً إذا أردت تغيير الاسم فقط"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">تأكيد الرمز السري الجديد</label>
              <input
                type="password"
                className="form-control-custom"
                placeholder="أعد كتابة الرمز السري الجديد"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="submit" className="btn-primary-custom" style={{ fontWeight: 700 }}>
              <FiSave size={16} /> حفظ تعديلات حساب الأدمن
            </button>
          </div>
        </form>
      </div>

      {/* Section 2: Store & Database Integration */}
      <div className="table-card" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
          <FiDatabase size={20} color="var(--primary)" />
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>بيانات المنشأة والنظام</h3>
        </div>

        {/* Supabase Cloud Database Card */}
        <div style={{
          background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
          color: '#fff',
          padding: '1.5rem',
          borderRadius: 'var(--radius-lg)',
          marginBottom: '1.5rem',
          border: isSupabaseConfigured() ? '1px solid rgba(34, 197, 94, 0.4)' : '1px solid #334155',
          boxShadow: '0 8px 16px -4px rgba(0, 0, 0, 0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: 44, height: 44, borderRadius: '12px',
                background: isSupabaseConfigured() ? 'rgba(34, 197, 94, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isSupabaseConfigured() ? '#4ADE80' : '#38BDF8',
              }}>
                <FiCloud size={24} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: '#F8FAFC' }}>
                  قاعدة البيانات السحابية: Supabase Cloud Database
                </h4>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#94A3B8' }}>
                  مزامنة تلقائية فورية بين جميع الأجهزة (كمبيوتر، هاتف، لابتوب) مع حسابات ومبيعات وأرباح لكل مستخدم.
                </p>
              </div>
            </div>

            <div style={{
              background: isSupabaseConfigured() ? 'rgba(34, 197, 94, 0.15)' : 'rgba(245, 158, 11, 0.15)',
              color: isSupabaseConfigured() ? '#4ADE80' : '#FBBF24',
              padding: '0.4rem 0.85rem',
              borderRadius: '99px',
              fontSize: '0.78rem',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              border: isSupabaseConfigured() ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: isSupabaseConfigured() ? '#22C55E' : '#F59E0B',
                boxShadow: isSupabaseConfigured() ? '0 0 8px #22C55E' : 'none',
              }} />
              {isSupabaseConfigured() ? 'متصل بالسحابة (مزامنة حية ⚡)' : 'غير مهيأ — أدخل مفاتيح Supabase أدناه'}
            </div>
          </div>

          {/* Form إدخال مفاتيح Supabase */}
          <form onSubmit={handleSaveSupabase} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', background: 'rgba(15, 23, 42, 0.6)', padding: '1.25rem', borderRadius: 12, border: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#CBD5E1', marginBottom: '0.35rem' }}>
                  Project URL (رابط مشروع Supabase)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="https://xyzcompany.supabase.co"
                  value={supabaseUrl}
                  onChange={e => setSupabaseUrl(e.target.value)}
                  style={{
                    width: '100%', padding: '0.55rem 0.75rem',
                    background: '#0F172A', border: '1px solid #334155',
                    borderRadius: 8, color: '#F1F5F9', fontSize: '0.82rem',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#CBD5E1', marginBottom: '0.35rem' }}>
                  Anon Key (المفتاح العام)
                </label>
                <input
                  type="password"
                  dir="ltr"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  value={supabaseAnonKey}
                  onChange={e => setSupabaseAnonKey(e.target.value)}
                  style={{
                    width: '100%', padding: '0.55rem 0.75rem',
                    background: '#0F172A', border: '1px solid #334155',
                    borderRadius: 8, color: '#F1F5F9', fontSize: '0.82rem',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            {supabaseMsg && (
              <div style={{
                padding: '0.6rem 0.85rem', borderRadius: 8, fontSize: '0.8rem',
                background: supabaseMsg.isError ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                border: supabaseMsg.isError ? '1px solid #EF4444' : '1px solid #22C55E',
                color: supabaseMsg.isError ? '#FCA5A5' : '#86EFAC',
              }}>
                {supabaseMsg.text}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}>
              <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
                💡 مشروع سوبابيس المتصل يوفر مزامنة آنية لكل المنتجات والمبيعات والفواتير بين كل الأجهزة.
              </span>

              <button
                type="submit"
                disabled={supabaseTesting}
                style={{
                  padding: '0.55rem 1.25rem',
                  background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
                  border: 'none', borderRadius: 8,
                  color: '#fff', fontSize: '0.82rem', fontWeight: 700,
                  cursor: supabaseTesting ? 'not-allowed' : 'pointer',
                  opacity: supabaseTesting ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                }}
              >
                <FiSave size={15} />
                {supabaseTesting ? 'جاري الفحص والحفظ...' : 'حفظ واختبار اتصال Supabase'}
              </button>
            </div>
          </form>
        </div>

        {storeMsg && (
          <div style={{
            background: 'var(--success-100)',
            color: '#15803D',
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.82rem',
            fontWeight: 600,
            marginBottom: '1rem',
          }}>
            ✅ {storeMsg.text}
          </div>
        )}

        <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">اسم المتجر / المخزن</label>
              <input
                type="text"
                className="form-control-custom"
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">رمز العملة</label>
              <input
                type="text"
                className="form-control-custom"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
            <button type="submit" className="btn-primary-custom" style={{ fontWeight: 700 }}>
              <FiSave size={16} /> حفظ إعدادات المتجر
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
