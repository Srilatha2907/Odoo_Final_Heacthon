import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Public pages
import LandingPage       from './pages/LandingPage';
import LoginPage         from './pages/LoginPage';
import SignUpPage        from './pages/SignUpPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import AccessDenied      from './pages/AccessDenied';

// Protected pages
import DashboardPage      from './pages/DashboardPage';
import ProductsPage       from './pages/ProductsPage';
import SalesPage          from './pages/SalesPage';
import PurchasePage       from './pages/PurchasePage';
import ManufacturingPage  from './pages/ManufacturingPage';
import InventoryPage      from './pages/InventoryPage';
import ReportsPage        from './pages/ReportsPage';
import UserManagementPage from './pages/UserManagementPage';

import './index.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Public ─────────────────────────────── */}
          <Route path="/"               element={<LandingPage />} />
          <Route path="/login"          element={<LoginPage />} />
          <Route path="/signup"         element={<SignUpPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/403"            element={<AccessDenied />} />

          {/* ── Protected (authenticated) ──────────── */}
          <Route element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            {/* All authenticated users */}
            <Route path="/dashboard"
              element={<ProtectedRoute allowedRoles={['ADMIN','OWNER']}><DashboardPage /></ProtectedRoute>} />
            <Route path="/products"
              element={<ProtectedRoute allowedRoles={['ADMIN','OWNER']}><ProductsPage /></ProtectedRoute>} />
            <Route path="/sales"
              element={<ProtectedRoute allowedRoles={['ADMIN','SALES']}><SalesPage /></ProtectedRoute>} />
            <Route path="/purchase"
              element={<ProtectedRoute allowedRoles={['ADMIN','PURCHASE']}><PurchasePage /></ProtectedRoute>} />
            <Route path="/manufacturing"
              element={<ProtectedRoute allowedRoles={['ADMIN','MANUFACTURING']}><ManufacturingPage /></ProtectedRoute>} />
            <Route path="/inventory"
              element={<ProtectedRoute allowedRoles={['ADMIN','INVENTORY']}><InventoryPage /></ProtectedRoute>} />
            <Route path="/reports"
              element={<ProtectedRoute allowedRoles={['ADMIN','OWNER','SALES','PURCHASE','MANUFACTURING','INVENTORY']}><ReportsPage /></ProtectedRoute>} />
            {/* Admin only */}
            <Route path="/users"
              element={<ProtectedRoute allowedRoles={['ADMIN']}><UserManagementPage /></ProtectedRoute>} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
