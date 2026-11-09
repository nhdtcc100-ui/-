import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth';
import AppLayout from './components/common/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import SellProduct from './pages/SellProduct';
import SalesHistory from './pages/SalesHistory';
import Settings from './pages/Settings';
import Users from './pages/Users';
import './index.css';

export default function App() {
  return (
    <AuthProvider>
      <HashRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />

          {/* Protected — inside AppLayout */}
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/products"  element={<Products />} />
            <Route path="/sell"      element={<SellProduct />} />
            <Route path="/sales"     element={<SalesHistory />} />
            <Route path="/settings"  element={<Settings />} />
            <Route path="/users"     element={<Users />} />

            {/* Backwards-compatible redirects */}
            <Route path="/inventory"  element={<Navigate to="/products" replace />} />
            <Route path="/purchasing" element={<Navigate to="/sell" replace />} />
            <Route path="/suppliers"  element={<Navigate to="/products" replace />} />
            <Route path="/counts"     element={<Navigate to="/products" replace />} />
            <Route path="/reports"    element={<Navigate to="/sales" replace />} />
          </Route>

          {/* Default redirect */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </HashRouter>
    </AuthProvider>
  );
}
