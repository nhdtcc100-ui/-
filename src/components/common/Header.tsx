import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiMenu, FiBell, FiLogOut, FiRefreshCw, FiExternalLink } from 'react-icons/fi';
import { mockAlerts } from '../../data/mockData';
import { storeService } from '../../services/storeService';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard':  { title: 'لوحة التحكم',           subtitle: 'نظرة عامة على المبيعات والمخزن' },
  '/products':   { title: 'إدارة المنتجات',         subtitle: 'إضافة وتعديل المنتجات والمخزون' },
  '/sell':       { title: 'نقطة البيع (POS)',       subtitle: 'تسجيل عملية بيع وخصم من المخزون' },
  '/sales':      { title: 'سجل المبيعات',           subtitle: 'فواتير وعمليات البيع السابقة' },
  '/settings':   { title: 'الإعدادات وكلمة السر',   subtitle: 'إدارة الحساب ومزامنة Google Sheets' },
};

interface HeaderProps { onMenuClick: () => void; }

export default function Header({ onMenuClick }: HeaderProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [showAlerts, setShowAlerts] = useState(false);
  const [settings, setSettings] = useState(() => storeService.getSettings());
  const [syncing, setSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = storeService.subscribeSync(({ syncing: s, error }) => {
      setSyncing(s);
      if (!s) {
        setSettings(storeService.getSettings());
        if (error) {
          setSyncFeedback('فشل المزامنة');
          setTimeout(() => setSyncFeedback(null), 3000);
        } else {
          setSyncFeedback('تمت المزامنة');
          setTimeout(() => setSyncFeedback(null), 3000);
        }
      }
    });
    return unsubscribe;
  }, []);

  const page = pageTitles[location.pathname] ?? { title: 'نظام المخازن', subtitle: '' };
  const unread = mockAlerts.filter(a => !a.isRead);

  const today = new Date().toLocaleDateString('ar-IQ', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const handleManualSync = async () => {
    if (!settings.appsScriptUrl) {
      navigate('/settings');
      return;
    }
    setSyncing(true);
    const res = await storeService.syncToGoogleSheet();
    setSyncing(false);
    setSyncFeedback(res.success ? 'تمت المزامنة' : 'فشلت المزامنة');
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  return (
    <header className="app-header" role="banner">
      {/* Left side — mobile menu + page title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={onMenuClick}
          className="btn-outline-custom"
          style={{ padding: '0.4rem 0.6rem', display: 'none' }}
          aria-label="فتح القائمة"
          id="mobile-menu-btn"
        >
          <FiMenu size={18} />
        </button>
        <div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
            {page.title}
          </h1>
          <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', margin: 0 }}>
            {today}
          </p>
        </div>
      </div>

      {/* Right side — Google Sheets status + alerts + user */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>

        {/* Google Sheets Live Status & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'var(--surface-muted)', padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
          {settings.appsScriptUrl ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--success-700)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E', display: 'inline-block' }}></span>
              <span>متصل بـ Sheets</span>
            </div>
          ) : (
            <button
              onClick={() => navigate('/settings')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem', fontWeight: 600, color: '#D97706' }}
              title="اضغط للربط مع Google Sheets"
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }}></span>
              <span>ربط Sheets ⚠️</span>
            </button>
          )}

          <button
            onClick={handleManualSync}
            disabled={syncing}
            className="btn-outline-custom"
            style={{ padding: '0.25rem 0.45rem', fontSize: '0.72rem', height: 'auto' }}
            title={syncing ? 'جارٍ المزامنة...' : 'مزامنة المخزن والمبيعات مع Google Sheets فوراً'}
          >
            <FiRefreshCw size={12} className={syncing ? 'spin' : ''} />
            {syncing ? 'مزامنة...' : (syncFeedback || 'مزامنة')}
          </button>

          <a
            href={settings.googleSheetUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-outline-custom"
            style={{ padding: '0.25rem 0.45rem', fontSize: '0.72rem', height: 'auto', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
            title="فتح ملف Google Sheets في تبويب جديد"
          >
            <FiExternalLink size={12} />
            <span>الشيت</span>
          </a>
        </div>

        {/* Alerts Bell */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className="btn-outline-custom"
            style={{ padding: '0.45rem 0.65rem', position: 'relative' }}
            aria-label={`${unread.length} تنبيه غير مقروء`}
            aria-expanded={showAlerts}
          >
            <FiBell size={17} />
            {unread.length > 0 && (
              <span
                style={{
                  position: 'absolute', top: '-4px', left: '-4px',
                  background: 'var(--danger-500)', color: 'white',
                  borderRadius: '99px', fontSize: '0.6rem', fontWeight: 700,
                  padding: '0.05rem 0.38rem', lineHeight: 1.6,
                }}
                aria-hidden="true"
              >
                {unread.length}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {showAlerts && (
            <div
              style={{
                position: 'absolute', left: 0, top: 'calc(100% + 8px)',
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-md)',
                width: 340, zIndex: 200,
              }}
              role="dialog"
              aria-label="التنبيهات"
            >
              <div style={{ padding: '0.875rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>التنبيهات</span>
                <span className="badge-danger">{unread.length} جديد</span>
              </div>
              {mockAlerts.slice(0, 4).map(alert => (
                <div key={alert.id} className="alert-item">
                  <span className="alert-item-icon">
                    {alert.type === 'low_stock' ? '⚠️' : alert.type === 'expiry_near' ? '🕐' : '🔴'}
                  </span>
                  <div className="alert-item-text">
                    <div className="alert-item-title" style={{ fontSize: '0.8rem' }}>
                      {alert.message}
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ padding: '0.75rem 1rem', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
                <button
                  className="btn-outline-custom"
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.875rem' }}
                  onClick={() => { setShowAlerts(false); navigate('/inventory'); }}
                >
                  عرض الكل
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div
            style={{
              width: 34, height: 34, borderRadius: '50%',
              background: 'var(--primary-100)', color: 'var(--primary-700)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '0.85rem',
            }}
            aria-hidden="true"
          >
            م
          </div>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>المدير</span>
        </div>

        {/* Logout */}
        <button
          onClick={() => { navigate('/login'); }}
          className="btn-outline-custom"
          style={{ padding: '0.4rem 0.6rem', color: 'var(--danger-500)', borderColor: 'var(--danger-100)' }}
          aria-label="تسجيل الخروج"
        >
          <FiLogOut size={16} />
        </button>
      </div>
    </header>
  );
}
