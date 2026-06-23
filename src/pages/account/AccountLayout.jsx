import { Link, useLocation, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { useLanguage } from "@/components/useLanguage";
import { Button } from "@/components/ui/button";
import { User, ShoppingBag, MapPin, LogOut, LayoutDashboard } from "lucide-react";

const ADMIN_ROLES = ["admin", "super_admin"];

export default function AccountLayout() {
  const { user, isAuthenticated, isLoadingAuth, logout } = useAuth();
  const { t, isRTL } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();

  if (isLoadingAuth) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 text-center px-4" style={{ direction: isRTL ? "rtl" : "ltr" }}>
        <p className="text-muted-foreground" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
          {t("Please log in to view your account.", "الرجاء تسجيل الدخول لعرض حسابك.")}
        </p>
        <Button
          className="rounded-full px-8"
          onClick={() => navigate("/login", { state: { from: location } })}
        >
          {t("Log In", "تسجيل الدخول")}
        </Button>
      </div>
    );
  }

  const isAdmin = ADMIN_ROLES.includes(user?.role);
  const links = [
    { to: "/account", label: t("Profile", "الملف الشخصي"), icon: User, exact: true },
    { to: "/account/orders", label: t("My Orders", "طلباتي"), icon: ShoppingBag },
    { to: "/account/addresses", label: t("Addresses", "العناوين"), icon: MapPin },
  ];

  return (
    <div className="min-h-screen bg-background" style={{ direction: isRTL ? "rtl" : "ltr" }}>
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex gap-6 flex-col md:flex-row">
          {/* Sidebar */}
          <aside className="md:w-60 shrink-0">
            <div className="bg-card border border-border rounded-2xl p-4 space-y-1 sticky top-24">
              <div className="px-3 py-2 mb-2 border-b border-border">
                <p className="font-black text-foreground text-sm truncate" style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}>
                  {user?.full_name || t("My Account", "حسابي")}
                </p>
                <p className="text-xs text-muted-foreground truncate" dir="ltr">{user?.email}</p>
              </div>
              {links.map(({ to, label, icon: Icon, exact }) => {
                const active = exact ? location.pathname === to : location.pathname.startsWith(to);
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    {label}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  to="/admin"
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  {t("Admin Panel", "لوحة التحكم")}
                </Link>
              )}
              <button
                onClick={() => logout()}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors mt-2"
                style={{ fontFamily: isRTL ? "'Cairo', sans-serif" : undefined }}
              >
                <LogOut className="w-4 h-4" />
                {t("Log Out", "تسجيل الخروج")}
              </button>
            </div>
          </aside>
          {/* Content */}
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
