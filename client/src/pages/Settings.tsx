import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { useState, useEffect } from "react";
import { toast } from "sonner";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{children}</p>;
}
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>{children}</div>;
}

function SettingsPage() {
  const { user } = useAuth();
  const { data: profile, refetch } = trpc.profile.get.useQuery();
  const upsert = trpc.profile.upsert.useMutation({
    onSuccess: () => { refetch(); toast.success("Settings saved"); },
    onError: () => toast.error("Failed to save settings"),
  });

  const [form, setForm] = useState({
    displayName: "",
    goalWeight: "",
    startWeight: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        displayName: profile.displayName ?? "",
        goalWeight: profile.goalWeight != null ? String(profile.goalWeight) : "",
        startWeight: profile.startWeight != null ? String(profile.startWeight) : "",
      });
    }
  }, [profile]);

  function handleSave() {
    upsert.mutate({
      displayName: form.displayName || undefined,
      goalWeight: form.goalWeight ? parseFloat(form.goalWeight) : undefined,
      startWeight: form.startWeight ? parseFloat(form.startWeight) : undefined,
    });
  }

  return (
    <div className="space-y-6 max-w-lg">
      {/* Account info */}
      <Card>
        <SectionLabel>Account</SectionLabel>
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">Signed in as</p>
          <p className="text-sm font-medium text-foreground">{user?.name ?? "—"}</p>
        </div>
      </Card>

      {/* Profile settings */}
      <Card>
        <SectionLabel>Profile</SectionLabel>
        <div className="space-y-4">
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Display Name</label>
            <input
              type="text"
              value={form.displayName}
              onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Start Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              value={form.startWeight}
              onChange={e => setForm(p => ({ ...p, startWeight: e.target.value }))}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="text-sm text-muted-foreground block mb-1.5">Goal Weight (kg)</label>
            <input
              type="number"
              step="0.1"
              value={form.goalWeight}
              onChange={e => setForm(p => ({ ...p, goalWeight: e.target.value }))}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={upsert.isPending}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {upsert.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </Card>
    </div>
  );
}

export default function Settings() {
  return (
    <DashboardShell mode="client">
      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Client Dashboard</p>
        <h1 className="text-xl font-bold text-foreground mt-0.5">Settings</h1>
      </div>
      <SettingsPage />
    </DashboardShell>
  );
}
