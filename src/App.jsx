import { Suspense, lazy } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ProtectedRoute from '@/components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import About from './pages/About';
import Delivery from './pages/Delivery';
import Contact from './pages/Contact';
import Search from './pages/Search';
import CmsPage from './pages/CmsPage';
import Faq from './pages/Faq';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';

// Route-level code splitting: ad-click shoppers land on the storefront
// (Home/Shop/ProductDetail), so checkout, the customer account area, and the
// entire admin panel are lazy-loaded to keep the initial bundle small. Each
// becomes its own chunk fetched only when the route is visited.
const Checkout = lazy(() => import('./pages/Checkout'));
const AccountLayout = lazy(() => import('./pages/account/AccountLayout'));
const ProfilePage = lazy(() => import('./pages/account/ProfilePage'));
const OrderHistoryPage = lazy(() => import('./pages/account/OrderHistoryPage'));
const AddressesPage = lazy(() => import('./pages/account/AddressesPage'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const AdminProducts = lazy(() => import('./pages/admin/Products'));
const AdminOrders = lazy(() => import('./pages/admin/Orders'));
const OrderCreate = lazy(() => import('./pages/admin/OrderCreate'));
const OrderDetail = lazy(() => import('./pages/admin/OrderDetail'));
const AdminInventory = lazy(() => import('./pages/admin/Inventory'));
const AdminStockHistory = lazy(() => import('./pages/admin/StockHistory'));
const AdminCategories = lazy(() => import('./pages/admin/Categories'));
const AdminDiscounts = lazy(() => import('./pages/admin/Discounts'));
const AdminContent = lazy(() => import('./pages/admin/Content'));
const AdminSettings = lazy(() => import('./pages/admin/Settings'));
const AdminEmailLog = lazy(() => import('./pages/admin/EmailLog'));
const AdminTeam = lazy(() => import('./pages/admin/Team'));
const AdminAuditLog = lazy(() => import('./pages/admin/AuditLog'));
const AdminCustomers = lazy(() => import('./pages/admin/Customers'));
const AdminFinances = lazy(() => import('./pages/admin/Finances'));
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'));

function RouteFallback() {
  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" />
    </div>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-foreground rounded-full animate-spin" />
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Suspense fallback={<RouteFallback />}>
    <Routes>
      {/* Storefront Routes (with Header/Footer) */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/about" element={<About />} />
        <Route path="/delivery" element={<Delivery />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/search" element={<Search />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/privacy" element={<CmsPage sectionKey="legal_privacy" fallbackTitle="Privacy Policy" fallbackTitleAr="سياسة الخصوصية" />} />
        <Route path="/terms" element={<CmsPage sectionKey="legal_terms" fallbackTitle="Terms & Conditions" fallbackTitleAr="الشروط والأحكام" />} />
        <Route path="/shipping" element={<CmsPage sectionKey="legal_shipping" fallbackTitle="Shipping Policy" fallbackTitleAr="سياسة الشحن" />} />
        <Route path="/returns" element={<CmsPage sectionKey="legal_returns" fallbackTitle="Returns & Exchanges" fallbackTitleAr="الإرجاع والاستبدال" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Customer account area (self-guards via AuthContext) */}
        <Route path="/account" element={<AccountLayout />}>
          <Route index element={<ProfilePage />} />
          <Route path="orders" element={<OrderHistoryPage />} />
          <Route path="addresses" element={<AddressesPage />} />
        </Route>
      </Route>

      {/* Admin Routes (gated: admin role only) */}
      <Route element={<ProtectedRoute requireAdmin redirectTo="/login" />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="orders/new" element={<OrderCreate />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="inventory" element={<AdminInventory />} />
          <Route path="stock-history" element={<AdminStockHistory />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="discounts" element={<AdminDiscounts />} />
          <Route path="content" element={<AdminContent />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="emails" element={<AdminEmailLog />} />
          <Route path="customers" element={<AdminCustomers />} />
        </Route>
      </Route>

      {/* Super-admin-only admin routes (Team & Roles, Audit Log, Finances) */}
      <Route element={<ProtectedRoute requireAdmin requireSuperAdmin redirectTo="/login" />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="team" element={<AdminTeam />} />
          <Route path="audit" element={<AdminAuditLog />} />
          <Route path="finances" element={<AdminFinances />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App