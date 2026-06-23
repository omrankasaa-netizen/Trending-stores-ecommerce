import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { Users, Shield, UserPlus } from "lucide-react";

const ROLES = [
  { value: "customer", label: "عميل", labelEn: "Customer" },
  { value: "staff", label: "موظف", labelEn: "Staff" },
  { value: "admin", label: "مدير", labelEn: "Admin" },
  { value: "super_admin", label: "مالك", labelEn: "Super Admin" },
];

const ROLE_BADGE = {
  super_admin: "bg-amber-100 text-amber-700",
  admin: "bg-teal-100 text-teal-700",
  staff: "bg-blue-100 text-blue-700",
  customer: "bg-gray-100 text-gray-600",
};

export default function AdminTeam() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("staff");
  const [inviting, setInviting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    base44.functions.listUsers()
      .then((res) => setUsers(res?.users || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const changeRole = async (u, role) => {
    if (u.role === role) return;
    setBusyId(u.id);
    try {
      await base44.functions.setUserRole({ user_id: u.id, role });
      toast({ title: "تم تحديث الصلاحية" });
      load();
    } catch (e) {
      toast({ title: "تعذّر تحديث الصلاحية", description: e?.data?.error || e?.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      await fetch("/api/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      }).then(async (r) => { if (!r.ok) throw new Error((await r.json())?.error || "فشل"); });
      toast({ title: "تمت الدعوة" });
      setInviteEmail("");
      load();
    } catch (e) {
      toast({ title: "تعذّرت الدعوة", description: e?.message, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  return (
    <div dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="mb-6 flex items-center gap-2">
        <Shield className="w-6 h-6 text-amber-600" />
        <div>
          <h1 className="text-2xl font-black">الفريق والصلاحيات</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة أدوار المستخدمين — للمالك فقط</p>
        </div>
      </div>

      <Card className="border-0 shadow-sm mb-6">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-bold"><UserPlus className="w-4 h-4" /> دعوة عضو</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              placeholder="email@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              dir="ltr"
              className="flex-1"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <Button onClick={invite} disabled={inviting}>{inviting ? "..." : "دعوة"}</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            ملاحظة: منح صلاحية «مدير» أو «مالك» متاح للمالك فقط.
          </p>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-muted-foreground font-bold">لا يوجد مستخدمون</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {users.map((u) => (
                <div key={u.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{u.full_name || u.email}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">{u.email}</div>
                  </div>
                  <Badge className={`text-xs ${ROLE_BADGE[u.role] || ROLE_BADGE.customer}`}>
                    {ROLES.find((r) => r.value === u.role)?.label || u.role}
                  </Badge>
                  <select
                    value={u.role}
                    disabled={busyId === u.id || u.id === user?.id}
                    onChange={(e) => changeRole(u, e.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm disabled:opacity-50"
                  >
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
