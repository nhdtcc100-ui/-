import { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import TopNav from './TopNav';
import MobileBottomNav from './MobileBottomNav';
import Sidebar from './Sidebar';
import { useAuth } from '../../hooks/useAuth';

export default function AppLayout() {
  const { isAuthenticated } = useAuth();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return (
    <div className="app-layout-top">

      {/* Top Bar */}
      <TopNav
        mobileMenuOpen={mobileSidebarOpen}
        onMobileMenuToggle={() => setMobileSidebarOpen(prev => !prev)}
      />

      {/* Mobile Sidebar Drawer & Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="mobile-sidebar-backdrop"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}
      <Sidebar
        collapsed={false}
        onToggle={() => {}}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      {/* Main page content */}
      <main className="app-content-top" id="main-content">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav />
    </div>
  );
}
