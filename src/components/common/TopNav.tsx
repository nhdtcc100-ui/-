import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { storeService } from '../../services/storeService';
import { isSupabaseConfigured } from '../../services/supabaseClient';
import {
  FiGrid, FiBox, FiShoppingCart, FiClipboard, FiSettings,
  FiLogOut, FiBell, FiMenu, FiX, FiUsers, FiCloud
} from 'react-icons/fi';

interface TopNavProps {
  mobileMenuOpen?: boolean;
  onMobileMenuToggle?: () => void;
}

export default function TopNav({ mobileMenuOpen, onMobileMenuToggle }: TopNavProps = {}) {
  const { currentUser, isElectron, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [settings] = useState(() => storeService.getSettings());

  const navItems = [
    { to: '/dashboard', label: 'لوحة التحكم',     icon: <FiGrid size={15} /> },
    { to: '/products',  label: 'المنتجات',         icon: <FiBox size={15} /> },
    { to: '/sell',      label: 'نقطة البيع (POS)', icon: <FiShoppingCart size={15} /> },
    { to: '/sales',     label: 'سجل المبيعات',     icon: <FiClipboard size={15} /> },
    ...(isElectron && (!currentUser || currentUser.role === 'admin') ? [
      { to: '/users',   label: 'المستخدمين',       icon: <FiUsers size={15} /> },
    ] : []),
    { to: '/settings',  label: 'الإعدادات',        icon: <FiSettings size={15} /> },
  ];
  const [products, setProducts] = useState(() => storeService.getProducts());
  const [showAlerts, setShowAlerts] = useState(false);
  const isSupabase = isSupabaseConfigured();

  const alerts = products
    .filter(p => p.stock <= (p.minStock ?? 5))
    .map(p => ({
      id: p.id,
      message: p.stock === 0 ? `نفد رصيد: ${p.name}` : `مخزون منخفض (${p.stock} قطعة): ${p.name}`,
      type: p.stock === 0 ? 'out_of_stock' : 'low_stock',
    }));

  const pageTitles: Record<string, string> = {
    '/dashboard': 'لوحة التحكم',
    '/products':  'إدارة المنتجات',
    '/sell':      'نقطة البيع POS',
    '/sales':     'سجل المبيعات',
    '/settings':  'الإعدادات',
  };

  useEffect(() => {
    const unsub = storeService.subscribeProducts(() => {
      setProducts(storeService.getProducts());
    });
    return unsub;
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const currentTitle = pageTitles[location.pathname] ?? 'مخزن ميثم';

  return (
    <nav className="top-nav" role="navigation" aria-label="القائمة الرئيسية">
      {/* Mobile Menu Hamburger Toggle */}
      <button
        type="button"
        onClick={onMobileMenuToggle}
        className="top-nav-menu-btn"
        aria-label="القائمة الجانبية"
        title="القائمة الجانبية"
      >
        {mobileMenuOpen ? <FiX size={20} /> : <FiMenu size={20} />}
      </button>
      {/* Brand */}
      <div className="top-nav-brand">
        <div className="top-nav-logo">
          <img
            src="/logo.jpg"
            alt="شعار المنصة"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                const icon = document.createElement('div');
                icon.style.display = 'flex';
                icon.style.alignItems = 'center';
                icon.style.justifyContent = 'center';
                parent.appendChild(icon);
              }
            }}
          />
        </div>
        <div>
          <div className="top-nav-brand-text">{settings.storeName || 'مخزن ميثم'}</div>
          <div className="top-nav-brand-sub">إدارة المخازن</div>
        </div>
      </div>

      {/* Divider */}
      <div className="top-nav-divider" />

      {/* Page title (current active) */}
      <div className="top-nav-page-title">{currentTitle}</div>

      {/* Nav Links */}
      <div className="top-nav-links">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `top-nav-link${isActive ? ' active' : ''}`}
            aria-label={item.label}
          >
            <span className="top-nav-link-icon">{item.icon}</span>
            <span className="top-nav-link-label">{item.label}</span>
          </NavLink>
        ))}
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right actions */}
      <div className="top-nav-actions">

        {/* Status chip: Supabase cloud status */}
        <div
          className="top-nav-chip"
          title={isSupabase ? 'متصل بـ Supabase — مزامنة فورية بين جميع الأجهزة' : 'وضع محلي — يرجى ربط Supabase'}
        >
          <span className="top-nav-chip-dot active" style={{
            background: isSupabase ? '#22C55E' : '#F59E0B',
            boxShadow: isSupabase ? '0 0 6px #22C55E' : 'none',
          }} />
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: isSupabase ? '#16A34A' : '#92400E', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <FiCloud size={12} />
            <span>{isSupabase ? 'Supabase ⚡ مزامنة فورية' : 'وضع محلي'}</span>
          </span>
        </div>


        {/* Alerts bell */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowAlerts(!showAlerts)}
            className="top-nav-icon-btn top-nav-alerts-btn"
            aria-label={`${alerts.length} تنبيه`}
          >
            <FiBell size={16} />
            {alerts.length > 0 && (
              <span style={{
                position: 'absolute', top: 2, left: 2,
                width: 8, height: 8, borderRadius: '50%',
                background: '#EF4444', border: '1.5px solid white',
              }} />
            )}
          </button>

          {showAlerts && (
            <>
              <div
                onClick={() => setShowAlerts(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 199 }}
              />
              <div className="top-nav-dropdown" style={{ left: 0 }}>
                <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>التنبيهات</span>
                  <span className={alerts.length > 0 ? "badge-danger" : "badge-success"} style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: '6px' }}>
                    {alerts.length > 0 ? `${alerts.length} جديد` : 'لا توجد تنبيهات'}
                  </span>
                </div>
                {alerts.length === 0 ? (
                  <div style={{ padding: '1.25rem 1rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                    ✓ جميع المنتجات بمستويات مخزون جيدة
                  </div>
                ) : (
                  alerts.slice(0, 5).map(alert => (
                    <div key={alert.id} className="alert-item">
                      <span className="alert-item-icon">
                        {alert.type === 'out_of_stock' ? '🔴' : '⚠️'}
                      </span>
                      <div className="alert-item-text">
                        <div className="alert-item-title" style={{ fontSize: '0.78rem' }}>{alert.message}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Divider */}
        <div className="top-nav-divider top-nav-profile-divider" style={{ height: 28 }} />

        {/* User avatar */}
        <div className="top-nav-profile" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div className="top-nav-avatar">
            {(currentUser?.displayName || currentUser?.username || settings.adminUsername || 'المدير').trim().charAt(0) || 'م'}
          </div>
          <span className="top-nav-username" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {currentUser?.displayName || currentUser?.username || settings.adminUsername || 'المدير'}
          </span>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="top-nav-icon-btn danger top-nav-logout-btn"
          title="تسجيل الخروج"
          aria-label="تسجيل الخروج"
        >
          <FiLogOut size={15} />
        </button>
      </div>
    </nav>
  );
}
