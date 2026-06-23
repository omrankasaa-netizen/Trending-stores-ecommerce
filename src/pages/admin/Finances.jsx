import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { TrendingUp, DollarSign, Package, Plus, Trash2, Save } from "lucide-react";

function money(v, label = "USD") {
  const n = Number(v) || 0;
  return `${label === "USD" ? "$" : ""}${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

export default function AdminFinances() {
  const { toast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [ratio, setRatio] = useState(0.6);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    base44.functions.getFinancials()
      .then((res) => {
        setData(res);
        setRows(res?.overhead_rows || []);
        setRatio(res?.default_cost_ratio ?? 0.6);
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await base44.functions.saveFinancialsConfig({
        currency_label: data?.currency_label || "USD",
        default_cost_ratio: Number(ratio),
        overhead_rows: rows,
      });
      toast({ title: "تم الحفظ" });
      load();
    } catch (e) {
      toast({ title: "تعذّر الحفظ", description: e?.data?.error || e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const label = data?.currency_label || "USD";
  const cards = data ? [
    { icon: DollarSign, label: "الإيراد المتوقّع", value: money(data.projected_revenue, label), bg: "bg-teal-50", color: "text-teal-600" },
    { icon: Package, label: "تكلفة البضاعة المقدّرة", value: money(data.estimated_cogs, label), bg: "bg-orange-50", color: "text-orange-600" },
    { icon: TrendingUp, label: "الربح الإجمالي المتوقّع", value: money(data.projected_gross_profit, label), bg: "bg-green-50", color: "text-green-600" },
    { icon: TrendingUp, label: "هامش الربح", value: `${Math.round((data.projected_margin || 0) * 100)}%`, bg: "bg-blue-50", color: "text-blue-600" },
  ] : [];

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="mb-6 flex items-center gap-2">
        <DollarSign className="w-6 h-6 text-amber-600" />
        <div>
          <h1 className="text-2xl font-black">المالية</h1>
          <p className="text-sm text-muted-foreground mt-1">الإيراد المتوقّع من المخزون الحالي — للمالك فقط</p>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
      ) : !data ? (
        <div className="p-8 text-center text-muted-foreground">تعذّر تحميل البيانات</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {cards.map((c, i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`w-11 h-11 ${c.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <c.icon className={`w-5 h-5 ${c.color}`} />
                  </div>
                  <div>
                    <p className="text-lg font-black">{c.value}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{c.label}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6 text-sm text-muted-foreground">
            <div>المنتجات الفعّالة: <b className="text-foreground">{data.products_count}</b></div>
            <div>الوحدات في المخزون: <b className="text-foreground">{data.units_in_stock}</b></div>
            <div>إجمالي المصاريف: <b className="text-foreground">{money(data.overheads_total, label)}</b></div>
          </div>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <h2 className="font-bold mb-3">الإعدادات والمصاريف</h2>
              <div className="mb-4 flex items-center gap-2">
                <span className="text-sm">نسبة التكلفة الافتراضية (0–1):</span>
                <Input
                  type="number" step="0.05" min="0" max="1"
                  value={ratio}
                  onChange={(e) => setRatio(e.target.value)}
                  className="w-28" dir="ltr"
                />
              </div>
              <div className="flex flex-col gap-2">
                {rows.map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      placeholder="البند" value={r.label}
                      onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                      className="flex-1"
                    />
                    <Input
                      type="number" placeholder="الكمية" value={r.qty} dir="ltr"
                      onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, qty: e.target.value } : x))}
                      className="w-24"
                    />
                    <Input
                      type="number" placeholder="السعر" value={r.unit_price} dir="ltr"
                      onChange={(e) => setRows(rows.map((x, j) => j === i ? { ...x, unit_price: e.target.value } : x))}
                      className="w-28"
                    />
                    <Button variant="ghost" size="icon" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" onClick={() => setRows([...rows, { label: "", qty: 0, unit_price: 0 }])}>
                  <Plus className="w-4 h-4 ml-1" /> إضافة بند
                </Button>
                <Button onClick={save} disabled={saving}>
                  <Save className="w-4 h-4 ml-1" /> {saving ? "..." : "حفظ"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
