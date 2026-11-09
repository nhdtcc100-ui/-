import { useState } from 'react';
import { storeService } from '../../services/storeService';

interface SetupWizardProps {
  onSetupComplete: () => void;
}

export default function SetupWizard({ onSetupComplete }: SetupWizardProps) {
  const [url, setUrl] = useState('');
  const [step, setStep] = useState<'input' | 'testing' | 'success' | 'error'>('input');
  const [errorMsg, setErrorMsg] = useState('');
  const [productCount, setProductCount] = useState(0);

  const handleTest = async () => {
    const trimmed = url.trim();
    if (!trimmed.includes('script.google.com')) {
      setErrorMsg('الرابط غير صحيح. يجب أن يكون رابط Apps Script من Google.');
      return;
    }
    setStep('testing');
    setErrorMsg('');
    storeService.updateSettings({ appsScriptUrl: trimmed });
    const result = await storeService.hydrateOnStartup();
    if (result.success) {
      setProductCount(result.count ?? 0);
      setStep('success');
    } else {
      storeService.updateSettings({ appsScriptUrl: '' });
      setErrorMsg(result.message || 'تعذر الاتصال. تحقق من الرابط والصلاحيات.');
      setStep('error');
    }
  };

  return (
    <div className="setup-wizard-overlay">
      <div className="setup-wizard-card">

        {/* Header */}
        <div className="setup-wizard-logo">
          <div className="setup-logo-icon">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="12" fill="url(#setupLogoGrad)"/>
              <path d="M8 14h24M8 20h16M8 26h20" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="30" cy="26" r="6" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.5"/>
              <path d="M28 26l1.5 1.5L32 24" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="setupLogoGrad" x1="0" y1="0" x2="40" y2="40">
                  <stop stopColor="#2563EB"/>
                  <stop offset="1" stopColor="#7C3AED"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <h1 className="setup-wizard-title">مرحباً بك في نظام إدارة المخزن</h1>
            <p className="setup-wizard-subtitle">قبل البدء، نحتاج ربط قاعدة البيانات (Google Sheets)</p>
          </div>
        </div>

        {/* Steps */}
        <div className="setup-steps">
          <div className={`setup-step ${step !== 'input' ? 'done' : 'active'}`}>
            <span className="setup-step-num">1</span>
            <span>إدخال الرابط</span>
          </div>
          <div className="setup-step-line" />
          <div className={`setup-step ${step === 'success' ? 'done' : step === 'testing' ? 'active' : ''}`}>
            <span className="setup-step-num">2</span>
            <span>اختبار الاتصال</span>
          </div>
          <div className="setup-step-line" />
          <div className={`setup-step ${step === 'success' ? 'done' : ''}`}>
            <span className="setup-step-num">3</span>
            <span>ابدأ الاستخدام</span>
          </div>
        </div>

        {/* Input / Error Step */}
        {(step === 'input' || step === 'error') && (
          <div className="setup-form">
            <div className="setup-info-box">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{flexShrink:0,marginTop:'2px'}}>
                <circle cx="12" cy="12" r="10" stroke="#2563EB" strokeWidth="2"/>
                <path d="M12 8v4M12 16h.01" stroke="#2563EB" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              <div>
                <p className="setup-info-title">كيفية الحصول على الرابط</p>
                <ol className="setup-info-steps">
                  <li>افتح Google Sheet الخاص بك</li>
                  <li>الإضافات (Extensions) ← Apps Script</li>
                  <li>نشر (Deploy) ← نشر جديد ← Web app ← Anyone</li>
                  <li>انسخ رابط <code>/exec</code> وضعه أدناه</li>
                </ol>
              </div>
            </div>

            <label className="setup-label">رابط Google Apps Script (exec)</label>
            <input
              className={`setup-input${errorMsg ? ' error' : ''}`}
              type="url"
              placeholder="https://script.google.com/macros/s/.../exec"
              value={url}
              onChange={e => { setUrl(e.target.value); setErrorMsg(''); setStep('input'); }}
              dir="ltr"
            />
            {errorMsg && (
              <div className="setup-error-msg">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="#FEE2E2"/>
                  <path d="M12 8v4M12 16h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                {errorMsg}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', width: '100%', flexWrap: 'wrap' }}>
              <button
                className="setup-btn-primary"
                onClick={handleTest}
                disabled={!url.trim()}
                style={{ flex: 1, minWidth: '180px' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h14M12 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                اختبار الاتصال وجلب البيانات
              </button>
              <button
                type="button"
                className="setup-btn-ghost"
                onClick={() => {
                  window.location.hash = '#/settings';
                  onSetupComplete();
                }}
                title="الدخول إلى صفحة الإعدادات لتعديل الروابط والخيارات"
              >
                الدخول للإعدادات
              </button>
            </div>
          </div>
        )}

        {/* Loading Step */}
        {step === 'testing' && (
          <div className="setup-loading">
            <div className="setup-spinner" />
            <p className="setup-loading-title">جاري الاتصال بـ Google Sheets...</p>
            <p className="setup-loading-sub">يتم جلب بياناتك من الشيت، يرجى الانتظار</p>
          </div>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <div className="setup-success">
            <div className="setup-success-icon">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="32" fill="#DCFCE7"/>
                <path d="M20 32l10 10 14-16" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="setup-success-title">تم الاتصال بنجاح! 🎉</h2>
            <p className="setup-success-sub">
              تم استيراد <strong>{productCount}</strong> منتج من Google Sheets
            </p>
            <div className="setup-success-badges">
              <div className="setup-badge green">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2"/>
                </svg>
                قاعدة البيانات متصلة
              </div>
              <div className="setup-badge blue">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
                مزامنة تلقائية فعّالة
              </div>
            </div>
            <button className="setup-btn-primary" onClick={onSetupComplete}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="2"/>
                <polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="2"/>
              </svg>
              ابدأ الاستخدام الآن
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
