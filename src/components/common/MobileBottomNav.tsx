import { NavLink } from 'react-router-dom';
import { FiGrid, FiBox, FiShoppingCart, FiClipboard, FiSettings } from 'react-icons/fi';

const navItems = [
  { to: '/dashboard', label: 'الرئيسية', icon: <FiGrid /> },
  { to: '/products',  label: 'المنتجات', icon: <FiBox /> },
  { to: '/sell',      label: 'بيع POS',  icon: <FiShoppingCart /> },
  { to: '/sales',     label: 'المبيعات', icon: <FiClipboard /> },
  { to: '/settings',  label: 'الإعدادات', icon: <FiSettings /> },
];

export default function MobileBottomNav() {
  return (
    <nav className="mobile-bottom-nav" aria-label="شريط التنقل السريع للهاتف">
      <div className="mobile-bottom-nav-inner">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="mobile-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
