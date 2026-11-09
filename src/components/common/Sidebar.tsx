import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { storeService } from '../../services/storeService';
import {
  FiGrid, FiBox, FiShoppingCart,
  FiClipboard, FiSettings,
  FiLogOut, FiX, FiUser, FiUsers,
} from 'react-icons/fi';

interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { currentUser, isElectron, logout } = useAuth();
  const navigate = useNavigate();
  const [settings] = useState(() => storeService.getSettings());

  const navItems = [
    { to: '/dashboard', label: 'لوحة التحكم',       icon: <FiGrid size={18} />, desc: 'إحصاءات وحركة المخزن' },
    { to: '/products',  label: 'إدارة المنتجات',   icon: <FiBox size={18} />, desc: 'عرض وتعديل الأصناف' },
    { to: '/sell',      label: 'نقطة البيع (POS)', icon: <FiShoppingCart size={18} />, desc: 'تسجيل فاتورة فورية' },
    { to: '/sales',     label: 'سجل المبيعات',     icon: <FiClipboard size={18} />, desc: 'فواتير وتقارير وطباعة' },
    ...(isElectron && (!currentUser || currentUser.role === 'admin') ? [
      { to: '/users',   label: 'إدارة المستخدمين', icon: <FiUsers size={18} />, desc: 'المستخدمين والصلاحيات' },
    ] : []),
    { to: '/settings',  label: 'الإعدادات والمزامنة',  icon: <FiSettings size={18} />, desc: 'إعدادات النظام' },
  ];

  const roleLabels: Record<string, string> = {
    admin: 'مدير عام',
    manager: 'مسؤول مخزن',
    staff: 'موظف مبيعات',
    viewer: 'مشاهد فقط',
  };

  const handleLogout = () => {
    onCloseMobile?.();
    logout();
    navigate('/login');
  };

  return (
    <aside
      className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`}
      aria-label="القائمة الجانبية للتطبيق"
    >
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="sidebar-logo">
            <img src="/logo.jpg" alt="شعار المتجر" />
          </div>
          <div>
            <div className="sidebar-brand-text">{settings.storeName || 'مخزن ميثم'}</div>
            <div className="sidebar-brand-sub">إدارة المخزن والمبيعات</div>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onCloseMobile}
          className="sidebar-close-btn"
          aria-label="إغلاق القائمة الجانبية"
        >
          <FiX size={18} />
        </button>
      </div>

      {/* User Info Card in Drawer */}
      <div className="sidebar-user-card">
        <div className="sidebar-user-avatar">
          <FiUser size={16} />
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#0F172A' }}>
            {currentUser?.displayName || currentUser?.username || settings.adminUsername || 'مدير النظام'}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#16A34A', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span>● متصل</span>
            {currentUser?.role && (
              <span style={{
                background: currentUser.role === 'admin' ? '#FEE2E2' : '#E0E7FF',
                color: currentUser.role === 'admin' ? '#991B1B' : '#3730A3',
                padding: '0.1rem 0.4rem',
                borderRadius: '4px',
                fontSize: '0.68rem',
              }}>
                {roleLabels[currentUser.role] || currentUser.role}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="sidebar-nav">
        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#94A3B8', padding: '0.4rem 0.6rem 0.2rem', letterSpacing: '0.5px' }}>
          أقسام النظام الرئيسية
        </div>
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => onCloseMobile?.()}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="sidebar-link-text">{item.label}</span>
              <span className="sidebar-link-desc">{item.desc}</span>
            </div>
          </NavLink>
        ))}
      </div>

      {/* Footer / Logout */}
      <div className="sidebar-footer">
        <button
          onClick={handleLogout}
          className="sidebar-logout-btn"
          aria-label="تسجيل الخروج"
        >
          <FiLogOut size={16} />
          <span>تسجيل الخروج من النظام</span>
        </button>
      </div>
    </aside>
  );
}
