import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Trash2, Users, Eye, Pencil, Link2, Copy, Trash } from "lucide-react";
import ExerciseLibrarySection from "./coach/ExerciseLibrarySection";
import NutritionDataSection from "./coach/NutritionDataSection";
import HabitsSection from "./coach/HabitsSection";
import TrainingSection from "./coach/TrainingSection";
import MealPlansSection from "./coach/MealPlansSection";
import ProgressSection from "./coach/ProgressSection";
import { Button } from "@/components/ui/button";
import { SectionLabel, Card, DateInput } from "./coach/shared";
import { toUTCDateStr as toLocalDateStr } from "@/lib/dates";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { useConfirm } from "@/components/ConfirmDialog";

// ─── Edit Client Dialog ───────────────────────────────────────────────────────
function EditClientDialog({ userId, onClose }: { userId: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const { data: profile } = trpc.profile.getById.useQuery({ userId }, { enabled: !!userId });
  const upsertProfile = trpc.profile.upsertForClient.useMutation({
    onSuccess: () => { toast.success("Profile updated"); utils.profile.getById.invalidate({ userId }); utils.users.list.invalidate(); onClose(); }
  });
  const updateClientConfig = trpc.clientConfig.update.useMutation({
    onSuccess: () => { toast.success("Config updated"); utils.profile.getById.invalidate({ userId }); }
  });
  const [form, setForm] = useState({ displayName: "", startDate: "", notes: "", stepGoal: "", photoType: "standard" as "standard" | "athlete" });
  useEffect(() => {
    if (profile) {
      setForm({
        displayName: (profile as any).displayName ?? "",
        startDate: profile.startDate ? toLocalDateStr(profile.startDate) : "",
        notes: profile.notes ?? "",
        stepGoal: (profile as any).stepGoal?.toString() ?? "",
        photoType: ((profile as any).photoType ?? "standard") as "standard" | "athlete",
      });
    }
  }, [profile]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Edit Client Details</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-lg leading-none">&times;</button>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Display Name</label>
          <input type="text" value={form.displayName} onChange={e => setForm((p: any) => ({ ...p, displayName: e.target.value }))}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Start Date</label>
          <DateInput value={form.startDate} onChange={v => setForm((p: any) => ({ ...p, startDate: v }))} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Progress Photo Type</label>
          <div className="flex gap-2">
            {(["standard", "athlete"] as const).map(t => (
              <button key={t} type="button"
                onClick={() => setForm((p: any) => ({ ...p, photoType: t }))}
                className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  form.photoType === t
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-muted-foreground border-border hover:text-foreground"
                }`}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Daily Step Goal</label>
          <input type="number" value={form.stepGoal} onChange={e => setForm((p: any) => ({ ...p, stepGoal: e.target.value }))}
            placeholder="" className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => setForm((p: any) => ({ ...p, notes: e.target.value }))} rows={3}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
        </div>
        <button
          onClick={() => {
            upsertProfile.mutate({ userId, displayName: form.displayName || undefined, startDate: form.startDate || undefined, notes: form.notes || null, photoType: form.photoType });
            updateClientConfig.mutate({ userId, stepGoal: form.stepGoal ? parseInt(form.stepGoal) : null });
          }}
          disabled={upsertProfile.isPending || updateClientConfig.isPending}
          className="w-full py-2 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
        >
          {(upsertProfile.isPending || updateClientConfig.isPending) ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ─── Section: Clients ─────────────────────────────────────────────────────────
// ─── Invite Links Section ────────────────────────────────────────────────────
function InviteLinksSection() {
  const utils = trpc.useUtils();
  const { data: invites = [] } = trpc.invites.list.useQuery();
  const createInvite = trpc.invites.create.useMutation({
    onSuccess: () => utils.invites.list.invalidate(),
  });
  const deleteInvite = trpc.invites.delete.useMutation({
    onSuccess: () => utils.invites.list.invalidate(),
  });
  const [label, setLabel] = useState("");

  const getInviteUrl = (token: string) =>
    `${window.location.origin}/invite/${token}`;

  const handleCreate = () => {
    createInvite.mutate(
      { label: label.trim() || undefined },
      { onSuccess: () => setLabel("") }
    );
  };

  const handleCopy = (token: string) => {
    navigator.clipboard.writeText(getInviteUrl(token));
    toast.success("Invite link copied");
  };

  return (
    <div>
      <SectionLabel>Invite Links</SectionLabel>
      <div className="space-y-3">
        {/* Create new invite */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Client name"
            value={label}
            onChange={e => setLabel(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCreate()}
            className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <Button
            onClick={handleCreate}
            disabled={createInvite.isPending || !label.trim()}
            size="sm"
            className="gap-1.5 flex-shrink-0"
          >
            <Link2 size={14} />
            Generate
          </Button>
        </div>

        {/* Existing invite tokens */}
        {invites.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">No invite links yet. Generate one above to share with a new client.</p>
        ) : (
          <div className="space-y-2">
            {(invites as any[]).map((invite: any) => (
              <div
                key={invite.id}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
                  invite.usedByUserId
                    ? "border-border bg-muted/30 opacity-60"
                    : "border-border bg-card"
                }`}
              >
                <Link2 size={14} className="text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {invite.label || "—"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {invite.usedByUserId ? (
                      <span className="text-emerald-400">Used ✓</span>
                    ) : (
                      getInviteUrl(invite.token)
                    )}
                  </p>
                </div>
                {!invite.usedByUserId && (
                  <button
                    onClick={() => handleCopy(invite.token)}
                    className="text-muted-foreground hover:text-primary transition-colors p-2 rounded-lg hover:bg-primary/10 flex-shrink-0"
                    title="Copy link"
                  >
                    <Copy size={14} />
                  </button>
                )}
                <button
                  onClick={() => deleteInvite.mutate({ id: invite.id })}
                  className="text-muted-foreground hover:text-destructive transition-colors p-2 rounded-lg hover:bg-destructive/10 flex-shrink-0"
                  title="Delete invite"
                >
                  <Trash size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ClientsSection() {
  const [confirm, ConfirmDialogNode] = useConfirm();
  const [, navigate] = useLocation();
  const { data: allUsers } = trpc.users.list.useQuery();
  const utils = trpc.useUtils();
  const [editingId, setEditingId] = useState<number | null>(null);

  const setApproved = trpc.users.setApproved.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); toast.success("Access updated"); },
  });
  const deleteUser = trpc.users.delete.useMutation({
    onSuccess: () => { utils.users.list.invalidate(); toast.success("User deleted"); },
    onError: (e) => toast.error(e.message),
  });

  // All users are potential clients (admin users may also be clients)
  const clients = allUsers ?? [];
  const admins = (allUsers ?? []).filter(u => u.role === 'admin');

  const nonAdminClients = clients.filter(u => u.role !== 'admin');
  const totalClients = nonAdminClients.length;
  const approvedCount = nonAdminClients.filter(u => (u as any).approved).length;
  const pendingCount = nonAdminClients.filter(u => !(u as any).approved).length;
  const sortedClients = [...clients];


  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl px-5 py-4 flex items-center gap-3">
          <Users size={18} className="text-muted-foreground flex-shrink-0" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
            <p className="text-2xl font-bold text-foreground">{totalClients}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl px-5 py-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Approved</p>
          <p className="text-2xl font-bold text-foreground">{approvedCount}</p>
        </div>
        <div className="bg-card border border-border rounded-xl px-5 py-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending</p>
          <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
        </div>

      </div>

      {/* Client roster */}
      <div>
        <SectionLabel>Clients</SectionLabel>
        <div className="space-y-2">
          {sortedClients.map(user => {
            return (
              <div
                key={user.id}
                onClick={() => navigate(`/coach/client/${user.id}`)}
                className="flex items-center gap-4 px-4 py-3.5 rounded-xl border cursor-pointer transition-all border-border bg-card hover:border-primary/40 hover:bg-primary/5 group"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                  {user.name?.charAt(0)?.toUpperCase() ?? "?"}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground">{user.name ?? "Unnamed"}</p>
                    {user.role === 'admin' && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">admin</span>
                    )}
                    {!(user as any).approved && user.role !== 'admin' && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">Pending Approval</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <p className="text-xs text-muted-foreground">{user.email ?? "No email"}</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity">
                  {!(user as any).approved && (
                    <button
                      onClick={e => { e.stopPropagation(); setApproved.mutate({ userId: user.id, approved: true }); }}
                      className="text-[10px] px-2.5 py-1.5 rounded-lg border font-medium transition-colors border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 mr-1"
                    >
                      Approve
                    </button>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); setEditingId(user.id); }}
                    className="text-muted-foreground hover:text-primary transition-colors p-2 rounded-lg hover:bg-primary/10"
                    title={`Edit ${user.name ?? 'client'}'s details`}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); const name = encodeURIComponent(user.name ?? 'Client'); navigate(`/dashboard/overview?viewAs=${user.id}&viewAsName=${name}`); }}
                    className="text-muted-foreground hover:text-primary transition-colors p-2 rounded-lg hover:bg-primary/10"
                    title={`View dashboard as ${user.name ?? 'client'}`}
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={async e => {
                      e.stopPropagation();
                      const ok = await confirm({ title: `Delete ${user.name ?? 'this user'}?`, description: "This will permanently remove the client and all their data. This cannot be undone.", confirmLabel: "Delete", variant: "destructive" });
                      if (ok) deleteUser.mutate({ userId: user.id });
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors p-2 rounded-lg hover:bg-destructive/10"
                    title="Delete user"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>



      {/* Invite links */}
      <InviteLinksSection />

      {/* Edit dialog */}
      {editingId && <EditClientDialog userId={editingId} onClose={() => setEditingId(null)} />}
      {ConfirmDialogNode}
    </div>
  );
}

const SECTION_MAP: Record<string, () => React.ReactNode> = {
  clients: () => <SectionErrorBoundary sectionName="Clients"><ClientsSection /></SectionErrorBoundary>,
  training: () => <SectionErrorBoundary sectionName="Training Programs"><TrainingSection /></SectionErrorBoundary>,
  "meal-plans": () => <SectionErrorBoundary sectionName="Meal Plans"><MealPlansSection /></SectionErrorBoundary>,
  progress: () => <SectionErrorBoundary sectionName="Client Progress"><ProgressSection /></SectionErrorBoundary>,
  "exercise-library": () => <SectionErrorBoundary sectionName="Exercise Library"><ExerciseLibrarySection /></SectionErrorBoundary>,
  "nutrition-data": () => <SectionErrorBoundary sectionName="Nutrition Data"><NutritionDataSection /></SectionErrorBoundary>,
  habits: () => <SectionErrorBoundary sectionName="Habits"><HabitsSection /></SectionErrorBoundary>,
};
const SECTION_TITLES: Record<string, string> = {
  clients: "Clients",
  training: "Training Programs",
  "meal-plans": "Meal Plans",
  progress: "Client Progress",
  "exercise-library": "Exercise Library",
  "nutrition-data": "Nutrition Data",
  habits: "Habits",
};

export default function CoachPanel() {
  const params = useParams<{ section?: string }>();
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading } = useAuth();
  const section = params.section ?? "clients";

  useEffect(() => {
    if (!params.section) navigate("/coach/clients");
  }, [params.section]);

  if (!loading && isAuthenticated && user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Access denied. Coach accounts only.</p>
      </div>
    );
  }

  return (
    <DashboardShell mode="coach">
      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Coach Panel</p>
        <h1 className="text-xl font-bold text-foreground mt-0.5">{SECTION_TITLES[section] ?? "Coach Panel"}</h1>
      </div>
      {(SECTION_MAP[section] ?? (() => <ClientsSection />))()}
    </DashboardShell>
  );
}
