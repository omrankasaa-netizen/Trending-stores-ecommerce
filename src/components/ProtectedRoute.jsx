import { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
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
export default function ProtectedRoute({ fallback = <DefaultFallback />, unauthenticatedElement, requireAdmin = false, requireSuperAdmin = false }) {
  const { user, isAuthenticated, isLoadingAuth, authChecked, authError, checkUserAuth } = useAuth();

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
    return unauthenticatedElement;
  }

  if (!isAuthenticated) {
    return unauthenticatedElement;
  }

  if (requireSuperAdmin && user?.role !== 'super_admin') {
    return <Navigate to="/admin" replace />;
  }

  if (requireAdmin && !ADMIN_ROLES.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}