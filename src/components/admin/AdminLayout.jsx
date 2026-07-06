import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, ShoppingBag, Package, BarChart2, FolderOpen, Home, Settings, Mail, Menu, X, ExternalLink, ChevronRight, Percent, Shield, ScrollText, Users, DollarSign, Languages, History
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Outlet } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { AdminLanguageProvider, useAdminLanguage } from "@/components/admin/useAdminLanguage";

const NAV = [
  { labelEn: "Dashboard",    labelAr: "لوحة التحكم",   path: "/admin",            icon: LayoutDashboard },
  { labelEn: "Orders",       labelAr: "الطلبات",       path: "/admin/orders",     icon: ShoppingBag },
  { labelEn: "Customers",    labelAr: "العملاء",       path: "/admin/customers",  icon: Users },
  { labelEn: "Products",     labelAr: "المنتجات",      path: "/admin/products",   icon: Package },
  { labelEn: "Inventory",    labelAr: "المخزون",       path: "/admin/inventory",  icon: BarChart2 },
  { labelEn: "Stock History", labelAr: "سجل المخزون",  path: "/admin/stock-history", icon: History },
  { labelEn: "Categories",   labelAr: "الفئات",        path: "/admin/categories", icon: FolderOpen },
  { labelEn: "Discounts",    labelAr: "العروض",        path: "/admin/discounts",  icon: Percent },
  { labelEn: "Homepage",     labelAr: "المحتوى",       path: "/admin/content",    icon: Home },
  { labelEn: "Email Log",    labelAr: "سجل الإيميل",   path: "/admin/emails",     icon: Mail },
  { labelEn: "Settings",     labelAr: "الإعدادات",     path: "/admin/settings",   icon: Settings },
];

// Owner-only entries appended for super_admin users.
const SUPER_ADMIN_NAV = [
  { labelEn: "Finances",     labelAr: "المالية",          path: "/admin/finances", icon: DollarSign },
  { labelEn: "Team & Roles", labelAr: "الفريق والصلاحيات", path: "/admin/team",     icon: Shield },
  { labelEn: "Audit Log",    labelAr: "سجل التدقيق",       path: "/admin/audit",    icon: ScrollText },
];

function AdminLayoutInner() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, lang, toggleLang, dir, isRTL } = useAdminLanguage();
  const navItems = user?.role === "super_admin" ? [...NAV, ...SUPER_ADMIN_NAV] : NAV;

  const handleSearch = async (q) => {
    setSearch(q);
    if (!q.trim()) { setSearchResults(null); return; }
    setSearching(true);
    const [orders, products] = await Promise.all([
      base44.entities.Order.list("-created_date", 50),
      base44.entities.Product.list("-created_date", 100),
    ]);
    const ql = q.toLowerCase();
    const matchedOrders = orders.filter(o =>
      (o.order_number || "").toLowerCase().includes(ql) ||
      (o.customer_name || "").toLowerCase().includes(ql) ||
      (o.customer_phone || "").includes(ql)
    ).slice(0, 5);
    const matchedProducts = products.filter(p =>
      (p.name || "").toLowerCase().includes(ql) ||
      (p.name_ar || "").includes(q)
    ).slice(0, 5);
    setSearchResults({ orders: matchedOrders, products: matchedProducts });
    setSearching(false);
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
            <span className="text-white font-black text-sm">TS</span>
          </div>
          <div>
            <div className="text-white font-black text-base leading-none">Trending Store</div>
            <div className="text-white/60 text-xs mt-0.5">{t("Admin Panel", "لوحة الإدارة")}</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 overflow-y-auto">
        {navItems.map(item => {
          const active = location.pathname === item.path || (item.path !== "/admin" && location.pathname.startsWith(item.path));
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-1 transition-all group ${active ? "bg-white text-primary font-bold shadow-sm" : "text-white/80 hover:bg-white/10 hover:text-white"}`}
            >
              <item.icon className="w-4.5 h-4.5 flex-shrink-0" style={{ width: 18, height: 18 }} />
              <span className="text-sm">{t(item.labelEn, item.labelAr)}</span>
              {active && <ChevronRight className={`w-4 h-4 opacity-50 ${isRTL ? "ml-auto rotate-180" : "ml-auto"}`} />}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-white/10">
        <Link to="/" target="_blank">
          <Button variant="ghost" size="sm" className="w-full text-white/70 hover:text-white hover:bg-white/10 gap-2 justify-start">
            <ExternalLink className="w-4 h-4" />
            <span className="text-sm">{t("View Store", "عرض المتجر")}</span>
          </Button>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex" dir={dir}>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-primary flex-shrink-0 sticky top-0 h-screen overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-64 bg-primary flex flex-col h-full shadow-xl z-10">
            <button className={`absolute top-4 text-white/70 hover:text-white ${isRTL ? "left-4" : "right-4"}`} onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-30">
          <button className="lg:hidden p-2 rounded-xl hover:bg-gray-100" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>

          {/* Global Search */}
          <div className="flex-1 max-w-md relative">
            <Input
              placeholder={t("Search for a product, order, or phone number...", "ابحث عن منتج أو طلب أو رقم هاتف...")}
              value={search}
              onChange={e => handleSearch(e.target.value)}
              className={`rounded-xl border-gray-200 text-sm ${isRTL ? "text-right pr-4 pl-4" : "text-left pl-4 pr-4"}`}
              style={isRTL ? { fontFamily: "'Cairo', sans-serif", direction: "rtl" } : { direction: "ltr" }}
            />
            {searchResults && (
              <div className="absolute top-full mt-2 w-full bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
                {searchResults.orders.length > 0 && (
                  <div>
                    <div className={`px-4 py-2 text-xs font-bold text-muted-foreground bg-gray-50 ${isRTL ? "text-right" : "text-left"}`}>{t("Orders", "الطلبات")}</div>
                    {searchResults.orders.map(o => (
                      <button key={o.id} className={`w-full px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between ${isRTL ? "text-right" : "text-left"}`}
                        onClick={() => { navigate(`/admin/orders/${o.id}`); setSearch(""); setSearchResults(null); }}>
                        <span className="text-xs text-muted-foreground">{o.customer_phone}</span>
                        <div className={isRTL ? "text-right" : "text-left"}>
                          <div className="text-sm font-bold">{o.order_number}</div>
                          <div className="text-xs text-muted-foreground">{o.customer_name}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.products.length > 0 && (
                  <div>
                    <div className={`px-4 py-2 text-xs font-bold text-muted-foreground bg-gray-50 ${isRTL ? "text-right" : "text-left"}`}>{t("Products", "المنتجات")}</div>
                    {searchResults.products.map(p => (
                      <button key={p.id} className={`w-full px-4 py-2.5 hover:bg-gray-50 flex items-center gap-3 ${isRTL ? "text-right" : "text-left"}`}
                        onClick={() => { navigate(`/admin/products?edit=${p.id}`); setSearch(""); setSearchResults(null); }}>
                        {p.image_url && <img src={p.image_url} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />}
                        <div className={`flex-1 ${isRTL ? "text-right" : "text-left"}`}>
                          <div className="text-sm font-bold">{lang === "ar" ? (p.name_ar || p.name) : (p.name || p.name_ar)}</div>
                          <div className="text-xs text-muted-foreground" style={{ fontFamily: "'Cairo', sans-serif" }}>{p.name_ar}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {searchResults.orders.length === 0 && searchResults.products.length === 0 && (
                  <div className="px-4 py-4 text-center text-sm text-muted-foreground">{t("No results found", "لا توجد نتائج")}</div>
                )}
              </div>
            )}
          </div>

          {/* Language Toggle */}
          <button
            onClick={toggleLang}
            className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-sm font-bold text-gray-700 flex-shrink-0"
            title={t("Switch to Arabic", "التبديل إلى الإنجليزية")}
            aria-label={t("Switch language", "تغيير اللغة")}
          >
            <Languages className="w-4 h-4" />
            <span>{t("العربية", "EN")}</span>
          </button>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <AdminLanguageProvider>
      <AdminLayoutInner />
    </AdminLanguageProvider>
  );
}
