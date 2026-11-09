import { useState } from 'react';
import { FiWifi, FiLink, FiCheck, FiAlertCircle, FiMonitor, FiSmartphone } from 'react-icons/fi';

const SERVER_URL_KEY = 'wms_sqlite_server_url';

interface LanSetupScreenProps {
  onConnected: () => void;
}

export default function LanSetupScreen({ onConnected }: LanSetupScreenProps) {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim().replace(/\/$/, '');
    if (!trimmed) {
      setErrorMsg('يرجى إدخال عنوان الجهاز الرئيسي');
      return;
    }
    setStatus('testing');
    setErrorMsg('');

    try {
      const res = await fetch(`${trimmed}/api/info`, { signal: AbortSignal.timeout(6000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.localIp && !json.port) throw new Error('رد غير صحيح من السيرفر');

      // حفظ الرابط ثم إعادة التحميل لتفعيل وضع LAN
      localStorage.setItem(SERVER_URL_KEY, trimmed);
      setStatus('success');
      setTimeout(() => {
        onConnected();
      }, 800);
    } catch (err: any) {
      setStatus('error');
      if (err.name === 'TimeoutError' || err.message.includes('fetch')) {
        setErrorMsg('تعذّر الاتصال. تأكد أن الجهاز الرئيسي يعمل وأنكما على نفس الشبكة.');
      } else {
        setErrorMsg(err.message || 'خطأ غير متوقع');
      }
    }
  };

  const handleSkip = () => {
    // إلغاء أي رابط محفوظ والعمل بالبيانات المحلية
    localStorage.removeItem(SERVER_URL_KEY);
    onConnected();
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #0F172A 100%)',
      padding: '1.5rem',
      direction: 'rtl',
    }}>
      {/* Glow effects */}
      <div style={{ position: 'fixed', top: '15%', right: '10%', width: 300, height: 300, borderRadius: '50%', background: 'rgba(59,130,246,0.12)', filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', bottom: '15%', left: '10%', width: 250, height: 250, borderRadius: '50%', background: 'rgba(139,92,246,0.10)', filter: 'blur(70px)', pointerEvents: 'none' }} />

      <div style={{
        width: '100%',
        maxWidth: 480,
        background: 'rgba(30, 41, 59, 0.85)',
        backdropFilter: 'blur(20px)',
        borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
        padding: '2.5rem',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            width: 72, height: 72, borderRadius: 18,
            background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 1.2rem',
            boxShadow: '0 8px 24px rgba(59,130,246,0.35)',
          }}>
            <FiWifi size={32} color="white" />
          </div>
          <h1 style={{ color: '#F1F5F9', fontSize: '1.35rem', fontWeight: 700, marginBottom: '0.4rem' }}>
            ربط الجهاز بالشبكة المحلية
          </h1>
          <p style={{ color: '#94A3B8', fontSize: '0.85rem', lineHeight: 1.6 }}>
            للوصول إلى نفس قاعدة البيانات وحسابات المستخدمين من جهاز آخر
          </p>
        </div>

        {/* How it works */}
        <div style={{
          background: 'rgba(59,130,246,0.1)',
          border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 12,
          padding: '1rem 1.1rem',
          marginBottom: '1.75rem',
        }}>
          <p style={{ color: '#93C5FD', fontSize: '0.78rem', fontWeight: 700, marginBottom: '0.6rem' }}>
            كيف يعمل الربط؟
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            {[
              { icon: <FiMonitor size={14} />, text: 'الجهاز الرئيسي (حيث Electron مثبت) يشغّل قاعدة البيانات على المنفذ 4989' },
              { icon: <FiSmartphone size={14} />, text: 'هذا الجهاز يتصل بالجهاز الرئيسي عبر شبكة Wi-Fi المشتركة' },
              { icon: <FiLink size={14} />, text: 'أدخل عنوان الجهاز الرئيسي الذي يظهر في شاشة تسجيل الدخول هناك' },
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.55rem', color: '#CBD5E1', fontSize: '0.77rem' }}>
                <span style={{ color: '#60A5FA', marginTop: 2, flexShrink: 0 }}>{item.icon}</span>
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', color: '#CBD5E1', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.45rem' }}>
              عنوان الجهاز الرئيسي
            </label>
            <input
              type="text"
              value={url}
              onChange={e => { setUrl(e.target.value); setStatus('idle'); setErrorMsg(''); }}
              placeholder="مثال: http://192.168.1.15:4989"
              dir="ltr"
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: 'rgba(15,23,42,0.7)',
                border: status === 'error' ? '1.5px solid #EF4444' : '1.5px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                color: '#F1F5F9',
                fontSize: '0.88rem',
                fontFamily: 'monospace',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => { if (status !== 'error') e.target.style.borderColor = 'rgba(59,130,246,0.6)'; }}
              onBlur={e => { if (status !== 'error') e.target.style.borderColor = 'rgba(255,255,255,0.12)'; }}
            />
          </div>

          {/* Status messages */}
          {status === 'error' && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '0.65rem 0.9rem', color: '#FCA5A5', fontSize: '0.8rem',
            }}>
              <FiAlertCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{errorMsg}</span>
            </div>
          )}

          {status === 'success' && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 8, padding: '0.65rem 0.9rem', color: '#86EFAC', fontSize: '0.8rem', fontWeight: 600,
            }}>
              <FiCheck size={15} />
              <span>✓ تم الاتصال بنجاح! جاري التوجيه...</span>
            </div>
          )}

          {/* Connect button */}
          <button
            type="submit"
            disabled={status === 'testing' || status === 'success'}
            style={{
              width: '100%',
              padding: '0.8rem',
              background: status === 'success'
                ? 'linear-gradient(135deg, #16A34A, #22C55E)'
                : 'linear-gradient(135deg, #2563EB, #7C3AED)',
              border: 'none',
              borderRadius: 10,
              color: 'white',
              fontSize: '0.92rem',
              fontWeight: 700,
              cursor: status === 'testing' || status === 'success' ? 'not-allowed' : 'pointer',
              opacity: status === 'testing' ? 0.75 : 1,
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
            }}
          >
            {status === 'testing' ? (
              <>
                <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                <span>جاري الاتصال...</span>
              </>
            ) : status === 'success' ? (
              <><FiCheck size={16} /> تم الاتصال</>
            ) : (
              <><FiLink size={16} /> اتصال وتوصيل</>
            )}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: '#475569', fontSize: '0.75rem' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            <span>أو</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          </div>

          {/* Skip button */}
          <button
            type="button"
            onClick={handleSkip}
            style={{
              width: '100%',
              padding: '0.7rem',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              color: '#94A3B8',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          >
            تخطّي — العمل بهذا الجهاز فقط (بيانات محلية)
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '1.25rem', color: '#475569', fontSize: '0.72rem' }}>
          يمكنك تغيير إعداد الربط لاحقاً من صفحة تسجيل الدخول
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
