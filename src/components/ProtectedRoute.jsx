import { useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

const ADMIN_ROLES = ['admin', 'super_admin'];

const DefaultFallback = () => (
  <div className="fixed inset-0 flex items-center justify-center">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

// Renders nested routes only for authenticated users. When `requireAdmin` is set,
// the user must additionally carry an admin role, otherwise they are sent home.
export default function ProtectedRoute({ fallback = <DefaultFallback />, redirectTo = '/login', requireAdmin = false, requireSuperAdmin = false }) {
  const { user, isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth } = useAuth();
  const location = useLocation();

  // Remember where the user was headed so login can send them back there.
  const loginRedirect = <Navigate to={redirectTo} state={{ from: location }} replace />;

  useEffect(() => {
    if (!authChecked && !isLoadingAuth) {
      checkUserAuth();
    }
  }, [authChecked, isLoadingAuth, checkUserAuth]);

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    return loginRedirect;
  }

  if (!isAuthenticated) {
    return loginRedirect;
  }

  if (requireSuperAdmin && user?.role !== 'super_admin') {
    return <Navigate to="/admin" replace />;
  }

  if (requireAdmin && !ADMIN_ROLES.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}