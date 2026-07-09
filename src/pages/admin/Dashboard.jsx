import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAdminLanguage } from "@/components/admin/useAdminLanguage";
import { totalStock, isInStock } from "@/lib/pricing";
import {
  ShoppingBag, Clock, CheckCircle2, AlertTriangle, Plus, Eye,
  Home, Tag, ArrowLeft, Truck
} from "lucide-react";

const STATUS_CONFIG = {
  pending:    { labelAr: "في الانتظار",  labelEn: "Pending",   color: "bg-yellow-100 text-yellow-800" },
  confirmed:  { labelAr: "مؤكد",        labelEn: "Confirmed",  color: "bg-blue-100 text-blue-800" },
  processing: { labelAr: "قيد التجهيز", labelEn: "Preparing",  color: "bg-purple-100 text-purple-800" },
  shipped:    { labelAr: "في الطريق",   labelEn: "Shipping",   color: "bg-indigo-100 text-indigo-800" },
  delivered:  { labelAr: "تم التسليم",  labelEn: "Delivered",  color: "bg-green-100 text-green-800" },
  cancelled:  { labelAr: "ملغي",        labelEn: "Cancelled",  color: "bg-red-100 text-red-800" },
};

function formatPrice(p) {
  return `$${(Number(p) || 0).toLocaleString("en-US")}`;
}

export default function AdminDashboard() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { t, lang, isRTL, dir } = useAdminLanguage();

  useEffect(() => {
    Promise.all([
      base44.entities.Order.list("-created_date", 100),
      base44.entities.Product.list("-created_date", 200),
    ]).then(([o, p]) => { setOrders(o); setProducts(p); }).finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
  const thisWeek = orders.filter(o => new Date(o.created_date) >= weekAgo);

  // Low-stock uses the per-size aware total: a product tracked at ≤5 total units
  // (summed across sizes when present). Untracked stock (null) is never "low".
  const isLowStock = (p) => { const s = totalStock(p); return s != null && s <= 5; };

  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.status === "pending").length,
    delivered: orders.filter(o => o.status === "delivered").length,
    thisWeek: thisWeek.length,
    lowStock: products.filter(isLowStock).length,
  };

  const lowStockProducts = products.filter(isLowStock).slice(0, 8);
  const recentOrders = orders.slice(0, 10);
  const productName = (p) => lang === "ar" ? (p.name_ar || p.name) : (p.name || p.name_ar);

  return (
    <div style={{ fontFamily: "'Cairo', sans-serif" }} dir={dir}>
      <div className="mb-6">
        <h1 className="text-2xl font-black text-foreground">{t("Dashboard", "لوحة التحكم")}</h1>
        <p className="text-muted-foreground text-sm mt-1">{t("Welcome to the Trending Store admin panel", "مرحباً بك في إدارة متجر ترندينج ستور")}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
        {[
          { label: t("Total Orders", "إجمالي الطلبات"), value: stats.total, icon: ShoppingBag, bg: "bg-primary/10", iconColor: "text-primary" },
          { label: t("Pending", "في الانتظار"),    value: stats.pending, icon: Clock, bg: "bg-yellow-50", iconColor: "text-yellow-600" },
          { label: t("Delivered", "تم التسليم"),     value: stats.delivered, icon: CheckCircle2, bg: "bg-green-50", iconColor: "text-green-600" },
          { label: t("Orders This Week", "طلبات هذا الأسبوع"), value: stats.thisWeek, icon: Truck, bg: "bg-blue-50", iconColor: "text-blue-600" },
          { label: t("Low Stock", "مخزون منخفض"),   value: stats.lowStock, icon: AlertTriangle, bg: "bg-red-50", iconColor: "text-red-500" },
        ].map((s, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-11 h-11 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <s.icon className={`w-5 h-5 ${s.iconColor}`} />
              </div>
              <div>
                <p className="text-xl font-black text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground leading-tight">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <Card className="border-0 shadow-sm mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-black">{t("Quick Actions", "إجراءات سريعة")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link to="/admin/products?new=1">
              <Button className="gap-2 rounded-xl h-11">
                <Plus className="w-4 h-4" />
                {t("Add New Product", "إضافة منتج جديد")}
              </Button>
            </Link>
            <Link to="/admin/orders">
              <Button variant="outline" className="gap-2 rounded-xl h-11">
                <Eye className="w-4 h-4" />
                {t("View Orders", "عرض الطلبات")}
              </Button>
            </Link>
            <Link to="/admin/content">
              <Button variant="outline" className="gap-2 rounded-xl h-11">
                <Home className="w-4 h-4" />
                {t("Edit Homepage", "تعديل الصفحة الرئيسية")}
              </Button>
            </Link>
            <Link to="/admin/discounts">
              <Button variant="outline" className="gap-2 rounded-xl h-11">
                <Tag className="w-4 h-4" />
                {t("Add Discount", "إضافة خصم")}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2">
          <Card className="border-0 shadow-sm">
            <CardHeader className="border-b border-gray-100 pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-black">{t("Latest Orders", "آخر الطلبات")}</CardTitle>
              <Link to="/admin/orders">
                <Button variant="ghost" size="sm" className="gap-1 text-primary text-xs">
                  {t("View All", "عرض الكل")} <ArrowLeft className={`w-3 h-3 ${!isRTL ? "rotate-180" : ""}`} />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 text-center text-muted-foreground text-sm">{t("Loading...", "جاري التحميل...")}</div>
              ) : recentOrders.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground text-sm">{t("No orders yet", "لا توجد طلبات بعد")}</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {recentOrders.map(order => {
                    const sc = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                    return (
                      <button
                        key={order.id}
                        onClick={() => navigate(`/admin/orders/${order.id}`)}
                        className={`w-full px-4 py-3 hover:bg-gray-50 transition-colors flex items-center justify-between gap-4 ${isRTL ? "text-right" : "text-left"}`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${sc.color}`}>
                            {t(sc.labelEn, sc.labelAr)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {t(`${(order.items || []).length} items`, `${(order.items || []).length} منتج`)}
                          </span>
                          <span className="font-black text-sm">
                            {formatPrice(order.total)}
                          </span>
                        </div>
                        <div className={isRTL ? "text-right" : "text-left"}>
                          <div className="font-bold text-sm text-primary">{order.order_number}</div>
                          <div className="text-xs text-muted-foreground">{order.customer_name}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alert */}
        <div>
          <Card className="border-0 shadow-sm">
            <CardHeader className="border-b border-gray-100 pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-black flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                {t("Stock Alert", "تنبيه المخزون")}
              </CardTitle>
              <Link to="/admin/inventory">
                <Button variant="ghost" size="sm" className="text-primary text-xs gap-1">
                  {t("Manage", "إدارة")} <ArrowLeft className={`w-3 h-3 ${!isRTL ? "rotate-180" : ""}`} />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="p-3">
              {loading ? (
                <div className="p-4 text-center text-sm text-muted-foreground">{t("Loading...", "جاري التحميل...")}</div>
              ) : lowStockProducts.length === 0 ? (
                <div className="p-4 text-center text-sm text-green-600 font-medium">
                  {t("✅ All products are sufficiently stocked", "✅ جميع المنتجات متوفرة بكمية كافية")}
                </div>
              ) : (
                <div className="space-y-2">
                  {lowStockProducts.map(p => (
                    <Link
                      key={p.id}
                      to={`/admin/inventory`}
                      className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-red-50 transition-colors"
                    >
                      <img
                        src={p.image_url || "https://placehold.co/40x40?text=?"}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold truncate">{productName(p)}</div>
                        <div className={`text-xs font-bold ${!isInStock(p) ? "text-red-600" : "text-amber-600"}`}>
                          {!isInStock(p) ? t("Out of stock!", "نفد المخزون!") : t(`${totalStock(p)} left`, `${totalStock(p)} قطعة متبقية`)}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
