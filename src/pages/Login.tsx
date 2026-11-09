import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured, getSupabaseConfig, saveSupabaseConfig, testSupabaseConnection } from '../services/supabaseClient';
import {
  FiEye,
  FiEyeOff,
  FiLogIn,
  FiUserPlus,
  FiUser,
  FiShield,
  FiShoppingBag,
  FiPackage,
  FiCheck,
  FiLock,
} from 'react-icons/fi';

const SAVED_CREDENTIALS_KEY = 'wms_saved_credentials';
const SAVED_ACCOUNTS_KEY = 'wms_saved_accounts_list';

interface SavedAccount {
  username: string;
  displayName: string;
  role: string;
  lastUsed: string;
}

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  // Active Tab: 'login' or 'register'
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPass, setShowPass] = useState(false);

  // Register form state
  const [regUsername, setRegUsername] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPass, setRegConfirmPass] = useState('');
  const [regRole, setRegRole] = useState<'admin' | 'cashier' | 'staff'>('admin');
  const [regRemember, setRegRemember] = useState(true);
  const [showRegPass, setShowRegPass] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [isPrefilled, setIsPrefilled] = useState(false);

  // ── استرجاع البيانات المحفوظة عند فتح الصفحة ─────────────────────
  useEffect(() => {
    try {
      // 1. استرجاع بيانات آخر تسجيل دخول
      const savedCredsRaw = localStorage.getItem(SAVED_CREDENTIALS_KEY);
      if (savedCredsRaw) {
        const creds = JSON.parse(savedCredsRaw);
        if (creds?.username && creds?.password) {
          setUsername(creds.username);
          setPassword(creds.password);
          setRememberMe(true);
          setIsPrefilled(true);
        }
      }

      // 2. استرجاع قائمة الحسابات المحفوظة على هذا الجهاز
      const savedListRaw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
      if (savedListRaw) {
        const list = JSON.parse(savedListRaw);
        if (Array.isArray(list)) {
          setSavedAccounts(list);
        }
      }
    } catch {
      // ignore JSON parse errors
    }
  }, []);

  // ── حفظ الحساب في قائمة الحسابات على هذا الجهاز ─────────────────
  const persistAccount = (uName: string, pass: string, dName?: string, roleStr?: string) => {
    try {
      // حفظ بيانات الدخول لتسجيل الدخول التلقائي أو التعبئة السريعة
      localStorage.setItem(
        SAVED_CREDENTIALS_KEY,
        JSON.stringify({ username: uName, password: pass })
      );

      // تحديث قائمة الحسابات المعروفة
      const existing = savedAccounts.filter(a => a.username.toLowerCase() !== uName.toLowerCase());
      const updated: SavedAccount[] = [
        {
          username: uName,
          displayName: dName || uName,
          role: roleStr || 'admin',
          lastUsed: new Date().toISOString(),
        },
        ...existing,
      ].slice(0, 5); // الاحتفاظ بآخر 5 حسابات كحد أقصى

      localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updated));
      setSavedAccounts(updated);
    } catch {
      // ignore storage errors
    }
  };

  // ── معالجة تسجيل الدخول ─────────────────────────────────────────
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanUser = username.trim();
    if (!cleanUser) { setError('يرجى إدخال اسم المستخدم'); return; }
    if (!password) { setError('يرجى إدخال كلمة المرور'); return; }

    setLoading(true);
    const res = await login(cleanUser, password);
    setLoading(false);

    if (res.success) {
      if (rememberMe) {
        persistAccount(cleanUser, password);
      } else {
        localStorage.removeItem(SAVED_CREDENTIALS_KEY);
      }
      navigate('/dashboard');
    } else {
      setError(res.message || 'اسم المستخدم أو كلمة المرور غير صحيحة');
    }
  };

  // ── معالجة إنشاء الحساب الجديد ──────────────────────────────────
  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    const cleanUser = regUsername.trim();
    const cleanDisplay = regDisplayName.trim() || cleanUser;

    if (!cleanUser) {
      setError('يرجى كتابة اسم المستخدم');
      return;
    }
    if (cleanUser.length < 3) {
      setError('اسم المستخدم يجب أن يكون 3 أحرف على الأقل');
      return;
    }
    if (!regPassword || regPassword.length < 3) {
      setError('كلمة المرور يجب أن تكون 3 أحرف على الأقل');
      return;
    }
    if (regPassword !== regConfirmPass) {
      setError('كلمات المرور غير متطابقة، يرجى التأكد');
      return;
    }

    setLoading(true);
    const res = await register({
      username: cleanUser,
      displayName: cleanDisplay,
      password: regPassword,
      role: regRole,
    });
    setLoading(false);

    if (res.success) {
      setSuccessMsg('🎉 تم إنشاء الحساب بنجاح! جاري الدخول للوحة التحكم...');
      if (regRemember) {
        persistAccount(cleanUser, regPassword, cleanDisplay, regRole);
      }
      setTimeout(() => {
        navigate('/dashboard');
      }, 700);
    } else {
      setError(res.message || 'تعذر إنشاء الحساب');
    }
  };

  // ── تعبئة سريعة لحساب محفوظ ────────────────────────────────────
  const handleSelectSavedAccount = (acc: SavedAccount) => {
    setUsername(acc.username);
    setError('');
    // إذا كانت كلمة المرور لنفس الحساب مخزنة في wms_saved_credentials
    try {
      const savedCredsRaw = localStorage.getItem(SAVED_CREDENTIALS_KEY);
      if (savedCredsRaw) {
        const creds = JSON.parse(savedCredsRaw);
        if (creds?.username?.toLowerCase() === acc.username.toLowerCase()) {
          setPassword(creds.password);
        } else {
          setPassword('');
        }
      }
    } catch {
      setPassword('');
    }
  };

  return (
    <main className="login-page" aria-label="صفحة الدخول وإنشاء الحساب">
      <div className="login-card" style={{ maxWidth: '440px' }}>

        {/* Logo */}
        <div className="login-logo" aria-hidden="true">
          <img
            src="/logo.jpg"
            alt="شعار المنصة"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => {
              const img = e.currentTarget as HTMLImageElement;
              img.style.display = 'none';
            }}
          />
        </div>

        <h1 className="login-title">نظام إدارة المخازن والمبيعات</h1>
        <p className="login-sub">
          {activeTab === 'login'
            ? 'سجّل دخولك للوصول إلى لوحة التحكم والمبيعات'
            : 'أنشئ حساب مستخدم جديد ومستقل في النظام'}
        </p>

        {/* التبديل بين تسجيل الدخول وإنشاء الحساب */}
        <div className="login-tabs" role="tablist" aria-label="نوع العملية">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'login'}
            className={`login-tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => { setActiveTab('login'); setError(''); setSuccessMsg(''); }}
          >
            <FiLogIn size={15} />
            <span>تسجيل الدخول</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'register'}
            className={`login-tab ${activeTab === 'register' ? 'active' : ''}`}
            onClick={() => { setActiveTab('register'); setError(''); setSuccessMsg(''); }}
          >
            <FiUserPlus size={15} />
            <span>إنشاء حساب جديد</span>
          </button>
        </div>

        {/* تنبيه الخطأ */}
        {error && (
          <div
            id="login-error"
            role="alert"
            style={{
              background: '#FEE2E2',
              border: '1px solid #FCA5A5',
              color: '#991B1B',
              borderRadius: 'var(--radius-sm)',
              padding: '0.65rem 0.875rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              marginBottom: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              textAlign: 'right',
            }}
          >
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* تنبيه النجاح */}
        {successMsg && (
          <div
            role="status"
            style={{
              background: '#DCFCE7',
              border: '1px solid #86EFAC',
              color: '#166534',
              borderRadius: 'var(--radius-sm)',
              padding: '0.65rem 0.875rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              marginBottom: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              textAlign: 'right',
            }}
          >
            <FiCheck size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════
            1. تبويب تسجيل الدخول
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'login' && (
          <form onSubmit={handleLoginSubmit} noValidate>

            {/* إشعار استرجاع البيانات المحفوظة */}
            {isPrefilled && (
              <div
                style={{
                  background: '#EFF6FF',
                  border: '1px solid #BFDBFE',
                  color: '#1E40AF',
                  padding: '0.45rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  marginBottom: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>💾 تم استرجاع بيانات الدخول المحفوظة</span>
                <button
                  type="button"
                  onClick={() => {
                    setUsername('');
                    setPassword('');
                    setIsPrefilled(false);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#2563EB',
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                  }}
                >
                  مسح
                </button>
              </div>
            )}

            {/* Username */}
            <div className="form-group" style={{ textAlign: 'right' }}>
              <label htmlFor="username" className="form-label">
                اسم المستخدم
              </label>
              <div className="input-wrapper">
                <input
                  id="username"
                  type="text"
                  className={`form-control-custom ${error ? 'error' : ''}`}
                  placeholder="admin"
                  value={username}
                  onChange={e => {
                    setUsername(e.target.value);
                    setError('');
                    setIsPrefilled(false);
                  }}
                  autoComplete="username"
                  autoFocus
                  style={{ direction: 'ltr', textAlign: 'right' }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="form-group" style={{ textAlign: 'right' }}>
              <label htmlFor="password" className="form-label">
                كلمة المرور
              </label>
              <div className="input-wrapper">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  className={`form-control-custom ${error ? 'error' : ''}`}
                  placeholder="••••••••"
                  value={password}
                  onChange={e => {
                    setPassword(e.target.value);
                    setError('');
                    setIsPrefilled(false);
                  }}
                  autoComplete="current-password"
                  style={{ paddingLeft: '2.5rem', direction: 'ltr', textAlign: 'right' }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>

            {/* خيار تذكرني وحفظ بيانات الدخول */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.25rem',
                fontSize: '0.8rem',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                }}
              >
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  style={{
                    width: 16,
                    height: 16,
                    accentColor: '#2563EB',
                    cursor: 'pointer',
                  }}
                />
                <span>حفظ بيانات الدخول على هذا الجهاز</span>
              </label>
            </div>

            {/* زر تسجيل الدخول */}
            <button
              type="submit"
              className="btn-login"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <span className="btn-login-spinner" aria-hidden="true" />
                  جارٍ التحقق والدخول...
                </>
              ) : (
                <>
                  <FiLogIn size={16} aria-hidden="true" />
                  تسجيل الدخول
                </>
              )}
            </button>

            {/* الحسابات المحفوظة على هذا الجهاز (إن وُجدت) */}
            {savedAccounts.length > 0 && (
              <div style={{ marginTop: '1rem', textAlign: 'right' }}>
                <span style={{ fontSize: '0.73rem', color: '#64748B', fontWeight: 700 }}>
                  الحسابات المحفوظة مؤخراً على هذا الجهاز:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.35rem' }}>
                  {savedAccounts.map(acc => (
                    <button
                      key={acc.username}
                      type="button"
                      onClick={() => handleSelectSavedAccount(acc)}
                      style={{
                        background: username.toLowerCase() === acc.username.toLowerCase() ? '#EFF6FF' : '#F8FAFC',
                        border: username.toLowerCase() === acc.username.toLowerCase() ? '1px solid #2563EB' : '1px solid #E2E8F0',
                        color: username.toLowerCase() === acc.username.toLowerCase() ? '#1D4ED8' : '#334155',
                        borderRadius: '20px',
                        padding: '0.2rem 0.6rem',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.3rem',
                      }}
                      title="انقر لتعبئة بيانات هذا الحساب"
                    >
                      <FiUser size={11} />
                      <span>{acc.displayName || acc.username}</span>
                      <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>({acc.username})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* زر سريع لتجربة حساب الأدمن الافتراضي */}
            <button
              type="button"
              onClick={() => {
                setUsername('admin');
                setPassword('admin123');
                setError('');
                setIsPrefilled(false);
              }}
              style={{
                marginTop: '0.85rem',
                width: '100%',
                padding: '0.45rem',
                background: 'transparent',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--primary)',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
              }}
            >
              ⚡ تعبئة بيانات الأدمن الافتراضي (admin / admin123)
            </button>

            {/* رابط للانتقال لإنشاء حساب */}
            <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#64748B' }}>
              ليس لديك حساب بعد؟{' '}
              <button
                type="button"
                onClick={() => { setActiveTab('register'); setError(''); setSuccessMsg(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563EB',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                أنشئ حساباً جديداً الآن
              </button>
            </p>

          </form>
        )}

        {/* ════════════════════════════════════════════════════════════
            2. تبويب إنشاء حساب جديد
        ════════════════════════════════════════════════════════════ */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegisterSubmit} noValidate>

            {/* Username */}
            <div className="form-group" style={{ textAlign: 'right' }}>
              <label htmlFor="regUsername" className="form-label">
                اسم المستخدم للدخول (بالأحرف أو الأرقام)
              </label>
              <div className="input-wrapper">
                <input
                  id="regUsername"
                  type="text"
                  className={`form-control-custom ${error ? 'error' : ''}`}
                  placeholder="مثال: ahmed_pos أو cashier1"
                  value={regUsername}
                  onChange={e => { setRegUsername(e.target.value); setError(''); }}
                  autoComplete="off"
                  autoFocus
                  style={{ direction: 'ltr', textAlign: 'right' }}
                />
              </div>
            </div>

            {/* Display Name */}
            <div className="form-group" style={{ textAlign: 'right' }}>
              <label htmlFor="regDisplayName" className="form-label">
                الاسم الكامل / المعروض في الفواتير والنظام
              </label>
              <input
                id="regDisplayName"
                type="text"
                className="form-control-custom"
                placeholder="مثال: أحمد علي (كاشير الفرع)"
                value={regDisplayName}
                onChange={e => { setRegDisplayName(e.target.value); setError(''); }}
              />
            </div>

            {/* اختيار الصلاحية / الدور */}
            <div style={{ textAlign: 'right', marginBottom: '0.4rem' }}>
              <label className="form-label">
                نوع الحساب والصلاحية
              </label>
              <div className="role-selector-grid">
                <button
                  type="button"
                  className={`role-option-card ${regRole === 'admin' ? 'active' : ''}`}
                  onClick={() => setRegRole('admin')}
                >
                  <FiShield size={16} />
                  <span>مدير نظام</span>
                  <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>كامل الصلاحيات</span>
                </button>

                <button
                  type="button"
                  className={`role-option-card ${regRole === 'cashier' ? 'active' : ''}`}
                  onClick={() => setRegRole('cashier')}
                >
                  <FiShoppingBag size={16} />
                  <span>كاشير</span>
                  <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>مبيعات فقط</span>
                </button>

                <button
                  type="button"
                  className={`role-option-card ${regRole === 'staff' ? 'active' : ''}`}
                  onClick={() => setRegRole('staff')}
                >
                  <FiPackage size={16} />
                  <span>موظف مخزن</span>
                  <span style={{ fontSize: '0.65rem', opacity: 0.8 }}>إدارة المخزون</span>
                </button>
              </div>
            </div>

            {/* Password */}
            <div className="form-group" style={{ textAlign: 'right' }}>
              <label htmlFor="regPassword" className="form-label">
                كلمة المرور
              </label>
              <div className="input-wrapper">
                <input
                  id="regPassword"
                  type={showRegPass ? 'text' : 'password'}
                  className={`form-control-custom ${error ? 'error' : ''}`}
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={e => { setRegPassword(e.target.value); setError(''); }}
                  autoComplete="new-password"
                  style={{ paddingLeft: '2.5rem', direction: 'ltr', textAlign: 'right' }}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowRegPass(!showRegPass)}
                  aria-label={showRegPass ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showRegPass ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="form-group" style={{ textAlign: 'right' }}>
              <label htmlFor="regConfirmPass" className="form-label">
                تأكيد كلمة المرور
              </label>
              <div className="input-wrapper">
                <input
                  id="regConfirmPass"
                  type={showRegPass ? 'text' : 'password'}
                  className={`form-control-custom ${error ? 'error' : ''}`}
                  placeholder="••••••••"
                  value={regConfirmPass}
                  onChange={e => { setRegConfirmPass(e.target.value); setError(''); }}
                  autoComplete="new-password"
                  style={{ paddingLeft: '2.5rem', direction: 'ltr', textAlign: 'right' }}
                />
                <span
                  style={{
                    position: 'absolute',
                    left: '0.85rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: regPassword && regPassword === regConfirmPass ? '#22C55E' : '#94A3B8',
                  }}
                >
                  <FiLock size={15} />
                </span>
              </div>
            </div>

            {/* خيار تذكر الحساب الجديد */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '1.25rem',
                fontSize: '0.8rem',
              }}
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                  userSelect: 'none',
                  color: 'var(--text-secondary)',
                  fontWeight: 600,
                }}
              >
                <input
                  type="checkbox"
                  checked={regRemember}
                  onChange={e => setRegRemember(e.target.checked)}
                  style={{
                    width: 16,
                    height: 16,
                    accentColor: '#2563EB',
                    cursor: 'pointer',
                  }}
                />
                <span>حفظ بيانات هذا الحساب للدخول التلقائي لاحقاً</span>
              </label>
            </div>

            {/* زر إنشاء الحساب */}
            <button
              type="submit"
              className="btn-login"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <>
                  <span className="btn-login-spinner" aria-hidden="true" />
                  جارٍ إنشاء الحساب والدخول...
                </>
              ) : (
                <>
                  <FiUserPlus size={16} aria-hidden="true" />
                  إنشاء الحساب والدخول الفوري 🚀
                </>
              )}
            </button>

            {/* رابط العودة لتسجيل الدخول */}
            <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: '#64748B' }}>
              لديك حساب بالفعل؟{' '}
              <button
                type="button"
                onClick={() => { setActiveTab('login'); setError(''); setSuccessMsg(''); }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563EB',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                تسجيل الدخول الآن
              </button>
            </p>

          </form>
        )}

        {/* حالة الاتصال بسحابة Supabase */}
        <SupabaseStatusBadge />

      </div>
    </main>
  );
}

function SupabaseStatusBadge() {
  const [configured, setConfigured] = useState(isSupabaseConfigured());
  const [showModal, setShowModal]   = useState(false);
  const [url, setUrl]               = useState(() => getSupabaseConfig().url);
  const [anonKey, setAnonKey]       = useState(() => getSupabaseConfig().anonKey);
  const [testing, setTesting]       = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || !anonKey.trim()) {
      setTestResult({ success: false, message: 'يرجى إدخال الرابط والمفتاح معاً' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    const test = await testSupabaseConnection(url, anonKey);
    setTesting(false);
    setTestResult(test);

    if (test.success) {
      saveSupabaseConfig(url, anonKey);
      setConfigured(true);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  };

  return (
    <>
      <div style={{
        marginTop: '1.25rem',
        padding: '0.75rem 0.9rem',
        borderRadius: 'var(--radius-md)',
        background: configured ? 'rgba(240, 253, 244, 0.85)' : 'rgba(255, 247, 237, 0.85)',
        border: configured ? '1px solid #86EFAC' : '1px dashed #FCD34D',
        fontSize: '0.75rem',
        lineHeight: 1.5,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, color: configured ? '#166534' : '#92400E' }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: configured ? '#22C55E' : '#F59E0B',
              boxShadow: configured ? '0 0 6px #22C55E' : 'none',
            }} />
            <span>
              {configured
                ? 'قاعدة بيانات Supabase السحابية (مزامنة فورية بين جميع الأجهزة ⚡)'
                : 'وضع محلي — لم يتم ربط Supabase بعد'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowModal(true)}
            style={{
              background: 'none', border: 'none',
              color: '#2563EB', cursor: 'pointer',
              fontSize: '0.73rem', fontWeight: 700,
              textDecoration: 'underline',
            }}
          >
            {configured ? 'إعدادات Supabase ⚙️' : 'ربط Supabase الآن ⚡'}
          </button>
        </div>
      </div>

      {/* Modal ضبط إعدادات Supabase */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.75)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1rem', direction: 'rtl',
        }}>
          <div style={{
            background: '#1E293B', borderRadius: 16,
            border: '1px solid rgba(255,255,255,0.15)',
            width: '100%', maxWidth: 500, padding: '1.75rem',
            color: '#F1F5F9', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#38BDF8' }}>
                ⚡ إعدادات ربط سوبابيس (Supabase)
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '1.25rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <p style={{ color: '#94A3B8', fontSize: '0.82rem', lineHeight: 1.6, marginBottom: '1.25rem' }}>
              أدخل مفاتيح مشروعك من لوحة تحكم Supabase (Project Settings ➔ API) لتعمل قاعدة البيانات السحابية والمزامنة اللحظية بين جميع الأجهزة:
            </p>

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#CBD5E1', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Project URL (رابط المشروع)
                </label>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="https://xyzcompany.supabase.co"
                  value={url}
                  onChange={e => setUrl(e.target.value)}
                  style={{
                    width: '100%', padding: '0.65rem 0.85rem',
                    background: '#0F172A', border: '1px solid #334155',
                    borderRadius: 8, color: '#fff', fontSize: '0.85rem',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#CBD5E1', marginBottom: '0.35rem', fontWeight: 600 }}>
                  Anon Key (المفتاح العام)
                </label>
                <textarea
                  dir="ltr"
                  rows={3}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  value={anonKey}
                  onChange={e => setAnonKey(e.target.value)}
                  style={{
                    width: '100%', padding: '0.65rem 0.85rem',
                    background: '#0F172A', border: '1px solid #334155',
                    borderRadius: 8, color: '#fff', fontSize: '0.8rem',
                    fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {testResult && (
                <div style={{
                  padding: '0.7rem 0.9rem', borderRadius: 8, fontSize: '0.8rem',
                  background: testResult.success ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                  border: testResult.success ? '1px solid #22C55E' : '1px solid #EF4444',
                  color: testResult.success ? '#86EFAC' : '#FCA5A5',
                }}>
                  {testResult.message}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="submit"
                  disabled={testing}
                  style={{
                    flex: 1, padding: '0.75rem',
                    background: 'linear-gradient(135deg, #2563EB, #7C3AED)',
                    border: 'none', borderRadius: 8,
                    color: '#fff', fontSize: '0.88rem', fontWeight: 700,
                    cursor: testing ? 'not-allowed' : 'pointer',
                    opacity: testing ? 0.7 : 1,
                  }}
                >
                  {testing ? 'جاري الفحص والحفظ...' : '✓ حفظ وتفعيل الاتصال'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '0.75rem 1.25rem',
                    background: '#334155', border: 'none',
                    borderRadius: 8, color: '#CBD5E1',
                    fontSize: '0.85rem', cursor: 'pointer',
                  }}
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}


