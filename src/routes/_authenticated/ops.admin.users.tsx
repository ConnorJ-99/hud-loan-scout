import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { OpsPageHeader } from "@/components/ops/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchStaffProfiles, staffName, type StaffProfile } from "@/lib/ops/profiles";
import type { AppRole } from "@/lib/ops/loan-helpers";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/ops/admin/users")({
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!data) throw redirect({ to: "/ops" });
  },
  component: UsersPage,
});

const ROLES: { value: AppRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "loan_officer", label: "Loan Officer" },
  { value: "processor", label: "Processor" },
  { value: "assistant", label: "Assistant" },
  { value: "user", label: "User" },
];

function UsersPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("");

  const { data: profiles = [] } = useQuery({
    queryKey: ["ops-all-profiles"],
    queryFn: () => fetchStaffProfiles("monthly_salary, monthly_draw, comp_plan"),
  });
  const { data: roles = [] } = useQuery({
    queryKey: ["ops-all-roles"],
    queryFn: async () => (await supabase.from("user_roles").select("*")).data ?? [],
  });

  const rolesByUser = useMemo(() => {
    const m = new Map<string, AppRole[]>();
    for (const r of roles) {
      const arr = m.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      m.set(r.user_id, arr);
    }
    return m;
  }, [roles]);

  const addRole = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: AppRole }) => {
      const { error } = await supabase.from("user_roles").insert({ user_id, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role added");
      qc.invalidateQueries({ queryKey: ["ops-all-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeRole = useMutation({
    mutationFn: async ({ user_id, role }: { user_id: string; role: AppRole }) => {
      const { error } = await supabase.from("user_roles").delete().eq("user_id", user_id).eq("role", role);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role removed");
      qc.invalidateQueries({ queryKey: ["ops-all-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateProfile = useMutation({
    mutationFn: async ({ user_id, patch }: { user_id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase.from("profiles").update(patch as never).eq("user_id", user_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["ops-all-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = profiles.filter((p) => {
    const q = filter.trim().toLowerCase();
    if (!q) return true;
    return (p.full_name || "").toLowerCase().includes(q)
      || (p.email || "").toLowerCase().includes(q)
      || (p.display_name || "").toLowerCase().includes(q);
  });

  return (
    <div>
      <OpsPageHeader
        title="Users & Roles"
        subtitle="Manage staff roles and profile defaults. New users sign up via /auth, then admins assign roles here."
      />
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Input placeholder="Search by name or email…" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm" />
          <div className="text-xs text-muted-foreground">{filtered.length} user{filtered.length === 1 ? "" : "s"}</div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Add role</TableHead>
                  <TableHead className="text-right">Default LO Split %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const userRoles = rolesByUser.get(p.user_id) ?? [];
                  return (
                    <TableRow key={p.user_id}>
                      <TableCell>
                        <Input
                          defaultValue={p.full_name ?? ""}
                          placeholder={staffName(p)}
                          onBlur={(e) => e.target.value !== (p.full_name ?? "") && updateProfile.mutate({ user_id: p.user_id, patch: { full_name: e.target.value || null } })}
                          className="h-8 max-w-[180px]"
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.email ?? "—"}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {userRoles.length === 0 && <span className="text-xs text-muted-foreground">none</span>}
                          {userRoles.map((r) => (
                            <Badge key={r} variant="secondary" className="text-[10px] gap-1">
                              {r}
                              <button onClick={() => removeRole.mutate({ user_id: p.user_id, role: r })} className="hover:text-red-400">
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <RoleAdder
                          existing={userRoles}
                          onAdd={(role) => addRole.mutate({ user_id: p.user_id, role })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number" step="0.01"
                          defaultValue={((p.default_lo_split_pct ?? 0) * 100).toFixed(2)}
                          onBlur={(e) => updateProfile.mutate({
                            user_id: p.user_id,
                            patch: {
                              default_lo_split_pct: (Number(e.target.value) || 0) / 100,
                              default_house_split_pct: 1 - (Number(e.target.value) || 0) / 100,
                            },
                          })}
                          className="h-8 w-24 inline-block text-right"
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No users.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          To add a new user: have them sign up at <code>/auth</code>. They'll appear here automatically — then assign their role.
        </p>
      </div>
    </div>
  );
}

function RoleAdder({ existing, onAdd }: { existing: AppRole[]; onAdd: (r: AppRole) => void }) {
  const available = ROLES.filter((r) => !existing.includes(r.value));
  const [val, setVal] = useState<string>("");
  if (available.length === 0) return <span className="text-xs text-muted-foreground">all assigned</span>;
  return (
    <div className="flex gap-1">
      <Select value={val} onValueChange={setVal}>
        <SelectTrigger className="h-8 w-32"><SelectValue placeholder="Pick role" /></SelectTrigger>
        <SelectContent>
          {available.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button size="sm" variant="outline" disabled={!val} onClick={() => { onAdd(val as AppRole); setVal(""); }}>Add</Button>
    </div>
  );
}
