import { useState, useEffect } from 'react';
import { storeService } from '../../services/storeService';

interface StartupSyncModalProps {
  onComplete: (success: boolean) => void;
}

type SyncState = 'syncing' | 'success' | 'offline' | 'no_data';

export default function StartupSyncModal({ onComplete }: StartupSyncModalProps) {
  const [state, setState] = useState<SyncState>('syncing');
  const [count, setCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Animate progress bar while syncing
    const progressInterval = setInterval(() => {
      setProgress(p => (p < 85 ? p + Math.random() * 12 : p));
    }, 300);

    storeService.hydrateOnStartup().then(result => {
      clearInterval(progressInterval);
      setProgress(100);

      setTimeout(() => {
        if (result.success) {
          setCount(result.count ?? 0);
          setState('success');
          // Auto-close after 1.5 seconds on success
          setTimeout(() => onComplete(true), 1500);
        } else {
          // Check if we have local cached data to work offline
          if (storeService.hasLocalData()) {
            setState('offline');
            setMessage(result.message ?? '');
          } else {
            setState('no_data');
            setMessage(result.message ?? '');
          }
        }
      }, 200);
    });

    return () => clearInterval(progressInterval);
  }, []);

  return (
    <div className="startup-sync-overlay">
      <div className="startup-sync-card">

        {/* Animated DB icon */}
        <div className="startup-sync-icon-wrap">
          <div className={`startup-sync-icon ${state === 'syncing' ? 'pulse' : ''}`}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
              {state === 'syncing' && (
                <>
                  <ellipse cx="12" cy="5" rx="9" ry="3" stroke="#2563EB" strokeWidth="2"/>
                  <path d="M3 5v4c0 1.657 4.03 3 9 3s9-1.343 9-3V5" stroke="#2563EB" strokeWidth="2"/>
                  <path d="M3 9v4c0 1.657 4.03 3 9 3s9-1.343 9-3V9" stroke="#2563EB" strokeWidth="2"/>
                  <path d="M3 13v4c0 1.657 4.03 3 9 3s9-1.343 9-3v-4" stroke="#2563EB" strokeWidth="2"/>
                </>
              )}
              {state === 'success' && (
                <path d="M20 6L9 17l-5-5" stroke="#10B981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              )}
              {(state === 'offline') && (
                <>
                  <path d="M1 1l22 22" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M16.72 11.06A10.94 10.94 0 0119 12.55M5 12.55a10.94 10.94 0 015.17-2.39M10.71 5.05A16 16 0 0122.56 9M1.42 9a15.91 15.91 0 014.7-2.88M8.53 16.11a6 6 0 016.95 0M12 20h.01" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"/>
                </>
              )}
              {state === 'no_data' && (
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              )}
            </svg>
          </div>
          {state === 'syncing' && <div className="startup-sync-ring" />}
        </div>

        {/* State-specific content */}
        {state === 'syncing' && (
          <>
            <h2 className="startup-sync-title">تحديث البيانات</h2>
            <p className="startup-sync-sub">جاري سحب أحدث البيانات من Google Sheets...</p>
            <div className="startup-progress-bar">
              <div className="startup-progress-fill" style={{ width: `${progress}%` }} />
            </div>
            <p className="startup-progress-text">{Math.round(progress)}%</p>
            {progress > 45 && (
              <button
                className="startup-btn-ghost"
                style={{ marginTop: '0.75rem', fontSize: '0.78rem', border: 'none' }}
                onClick={() => onComplete(false)}
              >
                تخطي المزامنة والدخول الآن
              </button>
            )}
          </>
        )}

        {state === 'success' && (
          <>
            <h2 className="startup-sync-title success">تم التحديث بنجاح ✓</h2>
            <p className="startup-sync-sub">تم تحميل <strong>{count}</strong> منتج من Google Sheets</p>
            <div className="startup-progress-bar">
              <div className="startup-progress-fill success" style={{ width: '100%' }} />
            </div>
          </>
        )}

        {state === 'offline' && (
          <>
            <h2 className="startup-sync-title warning">تعذر الاتصال بالشيت</h2>
            <p className="startup-sync-sub">سيتم العمل بالبيانات المحلية المحفوظة مسبقاً</p>
            <div className="startup-offline-banner">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              البيانات قد لا تكون محدّثة
            </div>
            <div className="startup-actions">
              <button className="startup-btn-secondary" onClick={() => { setState('syncing'); setProgress(0); storeService.hydrateOnStartup().then(r => { if(r.success){setCount(r.count??0);setState('success');setTimeout(()=>onComplete(true),1500);}else{setState('offline');} }); }}>
                إعادة المحاولة
              </button>
              <button className="startup-btn-primary" onClick={() => onComplete(false)}>
                تشغيل أوفلاين
              </button>
            </div>
          </>
        )}

        {state === 'no_data' && (
          <>
            <h2 className="startup-sync-title danger">لا توجد بيانات</h2>
            <p className="startup-sync-sub">تعذر الاتصال ولا توجد بيانات محلية مخزّنة</p>
            <p className="startup-error-detail">{message}</p>
            <div className="startup-actions">
              <button className="startup-btn-secondary" onClick={() => { setState('syncing'); setProgress(0); storeService.hydrateOnStartup().then(r => { if(r.success){setCount(r.count??0);setState('success');setTimeout(()=>onComplete(true),1500);}else if(storeService.hasLocalData()){setState('offline');}else{setState('no_data');setMessage(r.message??'');} }); }}>
                إعادة المحاولة
              </button>
              <button
                className="startup-btn-ghost"
                onClick={() => {
                  window.location.hash = '#/settings';
                  onComplete(false);
                }}
              >
                الذهاب للإعدادات
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
