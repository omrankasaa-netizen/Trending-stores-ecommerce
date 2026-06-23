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
import Checkout from './pages/Checkout';
import About from './pages/About';
import Delivery from './pages/Delivery';
import Contact from './pages/Contact';
import Search from './pages/Search';
import CmsPage from './pages/CmsPage';
import Faq from './pages/Faq';
import AccountLayout from './pages/account/AccountLayout';
import ProfilePage from './pages/account/ProfilePage';
import OrderHistoryPage from './pages/account/OrderHistoryPage';
import AddressesPage from './pages/account/AddressesPage';
import AdminDashboard from './pages/admin/Dashboard';
import AdminProducts from './pages/admin/Products';
import AdminOrders from './pages/admin/Orders';
import OrderDetail from './pages/admin/OrderDetail';
import AdminInventory from './pages/admin/Inventory';
import AdminCategories from './pages/admin/Categories';
import AdminDiscounts from './pages/admin/Discounts';
import AdminContent from './pages/admin/Content';
import AdminSettings from './pages/admin/Settings';
import AdminEmailLog from './pages/admin/EmailLog';
import AdminTeam from './pages/admin/Team';
import AdminAuditLog from './pages/admin/AuditLog';
import AdminCustomers from './pages/admin/Customers';
import AdminFinances from './pages/admin/Finances';
import AdminLayout from './components/admin/AdminLayout';
import Layout from './components/Layout';

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
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="inventory" element={<AdminInventory />} />
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
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App