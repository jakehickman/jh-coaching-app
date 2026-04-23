import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Trash2, Users, Eye, Pencil } from "lucide-react";
import ExerciseLibrarySection from "./coach/ExerciseLibrarySection";
import NutritionDataSection from "./coach/NutritionDataSection";
import HabitsSection from "./coach/HabitsSection";
import TrainingSection from "./coach/TrainingSection";
import MealPlansSection from "./coach/MealPlansSection";
import ProgressSection from "./coach/ProgressSection";
import CheckInsKanban from "./coach/CheckInsKanban";
import { Button } from "@/components/ui/button";
import { SectionLabel, Card, DateInput } from "./coach/shared";
import { toUTCDateStr as toLocalDateStr } from "@/lib/dates";
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary";
import { useConfirm } from "@/components/ConfirmDialog";

// ─── Section: Clients ─────────────────────────────────────────────────────────
function ClientsSection() {
  const [confirm, ConfirmDialogNode] = useConfirm();
  const [, navigate] = useLocation();
  const { data: allUsers, refetch } = trpc.users.list.useQuery();
  const { data: latestCheckIns = [] } = trpc.checkIn.latestPerClient.useQuery();
  const [seenKeys, setSeenKeys] = useState<Record<number, number>>(() => {
    const out: Record<number, number> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('coach:seen:checkin:')) {
        const id = parseInt(k.replace('coach:seen:checkin:', ''), 10);
        out[id] = parseInt(localStorage.getItem(k) ?? '0', 10);
      }
    }
    return out;
  });
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key?.startsWith('coach:seen:checkin:')) {
        const id = parseInt(e.key.replace('coach:seen:checkin:', ''), 10);
        setSeenKeys(prev => ({ ...prev, [id]: parseInt(e.newValue ?? '0', 10) }));
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);
  const utils = trpc.useUtils();
  const setApproved = trpc.users.setApproved.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("Access updated");
    },
  });
  const deleteUser = trpc.users.delete.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      setSelectedId(null);
      toast.success("User deleted");
    },
    onError: (e) => toast.error(e.message),
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data: profile } = trpc.profile.getById.useQuery(
    { userId: selectedId! },
    { enabled: !!selectedId }
  );
  const upsertProfile = trpc.profile.upsertForClient.useMutation({
    onSuccess: () => {
      toast.success("Profile updated");
      utils.profile.getById.invalidate({ userId: selectedId! });
    }
  });

  const updateClientConfig = trpc.clientConfig.update.useMutation({
    onSuccess: () => {
      toast.success("Config updated");
      utils.profile.getById.invalidate({ userId: selectedId! });
    }
  });

  const [form, setForm] = useState({
    displayName: "",
    startDate: "", notes: "",
    checkInDay: "" as "" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday",
    stepGoal: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        displayName: (profile as any).displayName ?? "",
        startDate: profile.startDate ? toLocalDateStr(profile.startDate) : "",
        notes: profile.notes ?? "",
        checkInDay: ((profile as any).checkInDay ?? "") as any,
        stepGoal: (profile as any).stepGoal?.toString() ?? "",
      });
    } else {
      setForm({ displayName: "", startDate: "", notes: "", checkInDay: "", stepGoal: "" });
    }
  }, [profile, selectedId]);

  const clients = allUsers ?? [];

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex items-center gap-3">
        <div className="bg-card border border-border rounded-lg px-5 py-3 flex items-center gap-3">
          <Users size={16} className="text-muted-foreground" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Clients</p>
            <p className="text-xl font-bold text-foreground">{clients.filter(u => u.role !== 'admin').length}</p>
          </div>
        </div>
        <div className="bg-card border border-border rounded-lg px-5 py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Approved</p>
          <p className="text-xl font-bold text-foreground">{clients.filter(u => u.role !== 'admin' && (u as any).approved).length}</p>
        </div>
        <div className="bg-card border border-border rounded-lg px-5 py-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending</p>
          <p className="text-xl font-bold text-foreground">{clients.filter(u => u.role !== 'admin' && !(u as any).approved).length}</p>
        </div>
      </div>

      {/* Two-column desktop layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5 items-start">
        {/* Left: client list */}
        <div>
          <SectionLabel>All Users</SectionLabel>
          <div className="space-y-1.5">
            {(allUsers ?? []).map(user => (
              <div
                key={user.id}
                onClick={() => navigate(`/coach/client/${user.id}`)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors border-border bg-card hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                    {user.name?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                  {null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{user.name ?? "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email ?? "No email"}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${user.role === "admin" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
                    {user.role}
                  </span>
                  {user.role !== "admin" && (
                    <>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setApproved.mutate({ userId: user.id, approved: !(user as any).approved });
                        }}
                        className={`text-[10px] px-2 py-1 rounded-md border font-medium transition-colors ${
                          (user as any).approved
                            ? "border-primary/40 text-primary bg-primary/10 hover:bg-primary/20"
                            : "border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                        }`}
                      >
                        {(user as any).approved ? "✓ Approved" : "Approve"}
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setSelectedId(user.id === selectedId ? null : user.id);
                        }}
                        className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-md hover:bg-primary/10"
                        title={`Edit ${user.name ?? 'client'}'s details`}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          const name = encodeURIComponent(user.name ?? 'Client');
                          navigate(`/dashboard/overview?viewAs=${user.id}&viewAsName=${name}`);
                        }}
                        className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-md hover:bg-primary/10"
                        title={`View dashboard as ${user.name ?? 'client'}`}
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        onClick={async e => {
                          e.stopPropagation();
                          const ok = await confirm({
                            title: `Delete ${user.name ?? 'this user'}?`,
                            description: "This will permanently remove the client and all their data. This cannot be undone.",
                            confirmLabel: "Delete",
                            variant: "destructive",
                          });
                          if (ok) deleteUser.mutate({ userId: user.id });
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1.5 rounded-md hover:bg-destructive/10"
                        title="Delete user"
                      >
                        <Trash2 size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: profile form */}
        {selectedId ? (
          <div className="space-y-4">
            {(
              <Card className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Client Name</label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-xs text-muted-foreground block mb-1">Start Date</label>
                    <DateInput value={form.startDate} onChange={v => setForm(p => ({ ...p, startDate: v }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Check-in Day</label>
                    <select
                      value={form.checkInDay}
                      onChange={e => setForm(p => ({ ...p, checkInDay: e.target.value as any }))}
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Not set</option>
                      {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => (
                        <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Daily Step Goal</label>
                    <input
                      type="number"
                      value={form.stepGoal}
                      onChange={e => setForm(p => ({ ...p, stepGoal: e.target.value }))}
                      placeholder="e.g. 10000"
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
                <button
                  onClick={() => {
                    upsertProfile.mutate({
                      userId: selectedId,
                      displayName: form.displayName || undefined,
                      startDate: form.startDate || undefined,
                      notes: form.notes || null,
                    });
                    updateClientConfig.mutate({
                      userId: selectedId,
                      checkInDay: form.checkInDay || null,
                      stepGoal: form.stepGoal ? parseInt(form.stepGoal) : null,
                    });
                  }}
                  disabled={upsertProfile.isPending || updateClientConfig.isPending}
                  className="w-full py-2 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {(upsertProfile.isPending || updateClientConfig.isPending) ? 'Saving...' : 'Save Profile'}
                </button>
              </Card>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
            Select a client to view their profile
          </div>
        )}
      </div>
      {ConfirmDialogNode}
    </div>
  );
}

const SECTION_MAP: Record<string, () => React.ReactNode> = {
  clients: () => <SectionErrorBoundary sectionName="Clients"><ClientsSection /></SectionErrorBoundary>,
  training: () => <SectionErrorBoundary sectionName="Training Programs"><TrainingSection /></SectionErrorBoundary>,
  "meal-plans": () => <SectionErrorBoundary sectionName="Meal Plans"><MealPlansSection /></SectionErrorBoundary>,
  progress: () => <SectionErrorBoundary sectionName="Client Progress"><ProgressSection /></SectionErrorBoundary>,
  "check-ins": () => <SectionErrorBoundary sectionName="Check-ins"><CheckInsKanban /></SectionErrorBoundary>,
  "exercise-library": () => <SectionErrorBoundary sectionName="Exercise Library"><ExerciseLibrarySection /></SectionErrorBoundary>,
  "nutrition-data": () => <SectionErrorBoundary sectionName="Nutrition Data"><NutritionDataSection /></SectionErrorBoundary>,
  habits: () => <SectionErrorBoundary sectionName="Habits"><HabitsSection /></SectionErrorBoundary>,
};
const SECTION_TITLES: Record<string, string> = {
  clients: "Clients",
  training: "Training Programs",
  "meal-plans": "Meal Plans",
  progress: "Client Progress",
  "check-ins": "Check-ins",
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
