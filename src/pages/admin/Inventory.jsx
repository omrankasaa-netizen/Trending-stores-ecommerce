import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Search, Check, Edit2, Download } from "lucide-react";
import { exportViaFunction } from "@/lib/exportCsv";
import { totalStock, isInStock, totalReserved, availableStock } from "@/lib/pricing";
import { useAdminLanguage } from "@/components/admin/useAdminLanguage";

export default function AdminInventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [editingQty, setEditingQty] = useState({});
  const [savingId, setSavingId] = useState(null);
  const { toast } = useToast();
  const { t, lang, isRTL, dir } = useAdminLanguage();
  const productName = (p) => lang === "ar" ? (p.name_ar || p.name) : (p.name || p.name_ar);

  useEffect(() => {
    base44.entities.Product.list("-created_date", 200).then(setProducts).finally(() => setLoading(false));
  }, []);

  const saveQty = async (id) => {
    const raw = editingQty[id];
    if (raw === undefined) return;
    const qty = Number(raw);
    // Reject blank/NaN/negative so stock never goes below zero.
    if (raw === "" || !Number.isFinite(qty) || qty < 0) {
      toast({ title: t("Enter a valid quantity (0 or more)", "أدخل كمية صحيحة (0 أو أكثر)"), variant: "destructive" });
      return;
    }
    setSavingId(id);
    try {
      await base44.entities.Product.update(id, { stock_quantity: qty });
      setProducts(prev => prev.map(p => p.id === id ? { ...p, stock_quantity: qty } : p));
      setEditingQty(prev => { const n = { ...prev }; delete n[id]; return n; });
      toast({ title: t("✅ Quantity updated", "✅ تم تحديث الكمية") });
    } catch (err) {
      toast({ title: t("Failed to update quantity", "تعذّر تحديث الكمية"), description: err?.message || "", variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  };

  // Size-aware stock class: a product tracked per-size sums its size stocks, so a
  // product whose main quantity is blank/0 but has sizes in stock reads "ok",
  // not "out". Untracked (null total) is always "ok".
  const stockClass = (p) => {
    if (!isInStock(p)) return "out";
    const s = totalStock(p);
    return s != null && s <= 5 ? "low" : "ok";
  };

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || (p.name || "").toLowerCase().includes(q) || (p.name_ar || "").includes(search);
    if (filter === "out") return matchSearch && stockClass(p) === "out";
    if (filter === "low") return matchSearch && stockClass(p) === "low";
    if (filter === "ok") return matchSearch && stockClass(p) === "ok";
    return matchSearch;
  });

  const stats = {
    out: products.filter(p => stockClass(p) === "out").length,
    low: products.filter(p => stockClass(p) === "low").length,
    ok: products.filter(p => stockClass(p) === "ok").length,
  };

  return (
    <div dir={dir} style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="mb-6 flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-black">{t("Inventory", "المخزون")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("Monitor and update product quantities", "راقب وحدّث كميات المنتجات")}</p>
        </div>
        <Button variant="outline" onClick={() => exportViaFunction("exportInventoryCsv").catch(() => toast({ title: t("Export failed", "تعذّر التصدير"), variant: "destructive" }))} className="gap-2 rounded-xl h-11">
          <Download className="w-4 h-4" />
          {t("Export", "تصدير")}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <Card className="border-0 shadow-sm bg-red-50 cursor-pointer" onClick={() => setFilter("out")}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-black text-red-600">{stats.out}</div>
            <div className="text-xs font-bold text-red-500">{t("Out of Stock", "نفد المخزون")}</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-amber-50 cursor-pointer" onClick={() => setFilter("low")}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-black text-amber-600">{stats.low}</div>
            <div className="text-xs font-bold text-amber-500">{t("Low Stock", "مخزون منخفض")}</div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-green-50 cursor-pointer" onClick={() => setFilter("ok")}>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-black text-green-600">{stats.ok}</div>
            <div className="text-xs font-bold text-green-500">{t("In Stock", "متوفر")}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm mb-4">
        <CardContent className="p-3 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className={`absolute top-2.5 w-4 h-4 text-muted-foreground ${isRTL ? "right-3" : "left-3"}`} />
            <Input placeholder={t("Search for a product...", "ابحث عن منتج...")} value={search} onChange={e => setSearch(e.target.value)}
              className={`rounded-xl text-sm ${isRTL ? "pr-9 text-right" : "pl-9 text-left"}`} style={{ direction: isRTL ? "rtl" : "ltr" }} />
          </div>
          {[["all",t("All","الكل")],["out",t("Out","نفد")],["low",t("Low","منخفض")],["ok",t("In Stock","متوفر")]].map(([v,l]) => (
            <button key={v} onClick={() => setFilter(v)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${filter === v ? "bg-primary text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {l}
            </button>
          ))}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">{t("Loading...", "جاري التحميل...")}</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(p => {
                // Editable field is the product's main quantity; status + the
                // displayed count use the size-aware total so sized products
                // read correctly.
                const mainQty = p.stock_quantity;
                const qty = totalStock(p);
                // Read-only visibility of held reservations: on-hand shown above,
                // held + sellable (on-hand − reserved) surfaced when any hold exists.
                const reserved = totalReserved(p);
                const avail = availableStock(p);
                const cls = stockClass(p);
                const isOut = cls === "out";
                const isLow = cls === "low";
                const isEditing = editingQty[p.id] !== undefined;
                return (
                  <div key={p.id} className={`flex items-center gap-3 px-4 py-3 ${isOut ? "bg-red-50/50" : isLow ? "bg-amber-50/50" : ""}`}>
                    <img src={p.image_url || "https://placehold.co/40x40?text=?"} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{productName(p)}</div>
                      <div className="text-xs text-muted-foreground truncate">{lang === "ar" ? p.name : p.name_ar}</div>
                      {reserved > 0 && (
                        <div className="text-[11px] text-amber-600 font-semibold mt-0.5">
                          {t(`${reserved} reserved · ${avail ?? 0} available`, `${reserved} محجوز · ${avail ?? 0} متاح`)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isEditing ? (
                        <>
                          <Input
                            type="number" value={editingQty[p.id]}
                            onChange={e => setEditingQty(prev => ({ ...prev, [p.id]: e.target.value }))}
                            className="w-20 h-9 text-center rounded-xl text-sm"
                            autoFocus
                          />
                          <Button size="icon" className="h-9 w-9 rounded-xl" onClick={() => saveQty(p.id)} disabled={savingId === p.id}>
                            <Check className="w-4 h-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          {isOut && <Badge className="bg-red-500 text-white text-xs">{t("Out!", "نفد!")}</Badge>}
                          {isLow && <Badge className="bg-amber-500 text-white text-xs">{t(`${qty} pcs`, `${qty} قطعة`)}</Badge>}
                          {!isOut && !isLow && <span className="text-sm font-bold text-green-600">{qty != null ? t(`${qty} pcs`, `${qty} قطعة`) : t("Unlimited", "غير محدود")}</span>}
                          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl"
                            onClick={() => setEditingQty(prev => ({ ...prev, [p.id]: mainQty ?? 0 }))}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
              {filtered.length === 0 && <div className="p-8 text-center text-muted-foreground">{t("No products", "لا توجد منتجات")}</div>}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}