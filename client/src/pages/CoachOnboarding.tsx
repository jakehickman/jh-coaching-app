import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardShell from "@/components/DashboardShell";
import { ChevronDown, ChevronUp } from "lucide-react";

function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "muted" }) {
  const cls =
    variant === "success"
      ? "bg-primary/20 text-primary"
      : variant === "muted"
      ? "bg-muted text-muted-foreground"
      : "bg-muted text-muted-foreground";
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold uppercase tracking-wide ${cls}`}>
      {children}
    </span>
  );
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm text-foreground mt-0.5">{value}</p>
    </div>
  );
}

type Submission = {
  id: number;
  fullName: string | null;
  email: string | null;
  age: number | null;
  heightCm: number | null;
  currentWeightKg: number | null;
  goalWeightKg: number | null;
  primaryGoal: string | null;
  trainingExperience: string | null;
  trainingFrequency: string | null;
  equipment: string | null;
  dietApproach: string | null;
  injuries: string | null;
  lifestyle: string | null;
  additionalInfo: string | null;
  submittedAt: Date | string;
  reviewed: boolean;
};

function SubmissionRow({ sub }: { sub: Submission }) {
  const [expanded, setExpanded] = useState(false);
  const utils = trpc.useUtils();
  const markReviewed = trpc.onboarding.markReviewed.useMutation({
    onSuccess: () => utils.onboarding.list.invalidate(),
  });

  const date = new Date(sub.submittedAt).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-primary text-xs font-bold">
              {(sub.fullName ?? "?")[0].toUpperCase()}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{sub.fullName ?? "Unknown"}</p>
            <p className="text-[10px] text-muted-foreground truncate">{sub.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0 ml-4">
          <span className="text-[10px] text-muted-foreground hidden sm:block">{date}</span>
          <Badge variant={sub.reviewed ? "success" : "muted"}>
            {sub.reviewed ? "Reviewed" : "New"}
          </Badge>
          {expanded ? (
            <ChevronUp className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-5 bg-muted/10 border-t border-border">
          <div className="pt-4 grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
            <DetailRow label="Submitted" value={date} />
            <DetailRow label="Age" value={sub.age != null ? `${sub.age} yrs` : null} />
            <DetailRow label="Height" value={sub.heightCm != null ? `${sub.heightCm} cm` : null} />
            <DetailRow label="Current weight" value={sub.currentWeightKg != null ? `${sub.currentWeightKg} kg` : null} />
            <DetailRow label="Goal weight" value={sub.goalWeightKg != null ? `${sub.goalWeightKg} kg` : null} />
            <DetailRow label="Training experience" value={sub.trainingExperience} />
            <DetailRow label="Training frequency" value={sub.trainingFrequency} />
            <DetailRow label="Equipment" value={sub.equipment} />
            <DetailRow label="Diet approach" value={sub.dietApproach} />
          </div>
          {sub.primaryGoal && (
            <div className="mt-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Primary Goal</p>
              <p className="text-sm text-foreground mt-0.5 leading-relaxed">{sub.primaryGoal}</p>
            </div>
          )}
          {sub.injuries && (
            <div className="mt-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Injuries / Limitations</p>
              <p className="text-sm text-foreground mt-0.5 leading-relaxed">{sub.injuries}</p>
            </div>
          )}
          {sub.lifestyle && (
            <div className="mt-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Lifestyle</p>
              <p className="text-sm text-foreground mt-0.5 leading-relaxed">{sub.lifestyle}</p>
            </div>
          )}
          {sub.additionalInfo && (
            <div className="mt-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Additional Info</p>
              <p className="text-sm text-foreground mt-0.5 leading-relaxed">{sub.additionalInfo}</p>
            </div>
          )}
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => markReviewed.mutate({ id: sub.id, reviewed: !sub.reviewed })}
              disabled={markReviewed.isPending}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 ${
                sub.reviewed
                  ? "bg-muted text-muted-foreground hover:bg-muted/70"
                  : "bg-primary text-primary-foreground hover:opacity-90"
              }`}
            >
              {sub.reviewed ? "Mark as Unreviewed" : "Mark as Reviewed"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CoachOnboarding() {
  const { data: submissions, isLoading } = trpc.onboarding.list.useQuery();

  const unreviewed = submissions?.filter((s) => !s.reviewed) ?? [];
  const reviewed = submissions?.filter((s) => s.reviewed) ?? [];

  return (
    <DashboardShell mode="coach">
      <div className="mb-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Coach Panel</p>
        <h1 className="text-xl font-bold text-foreground mt-0.5">Onboarding</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !submissions || submissions.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm">No onboarding submissions yet.</p>
          <p className="text-xs text-muted-foreground mt-2">
            New clients who complete the form at <span className="text-primary">/onboarding</span> will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total", value: submissions.length },
              { label: "New", value: unreviewed.length },
              { label: "Reviewed", value: reviewed.length },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
                <p className="text-2xl font-bold text-foreground mt-1">{s.value}</p>
              </div>
            ))}
          </div>

          {/* New submissions */}
          {unreviewed.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">
                  New Submissions
                </p>
              </div>
              {unreviewed.map((sub) => (
                <SubmissionRow key={sub.id} sub={sub} />
              ))}
            </div>
          )}

          {/* Reviewed */}
          {reviewed.length > 0 && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Reviewed
                </p>
              </div>
              {reviewed.map((sub) => (
                <SubmissionRow key={sub.id} sub={sub} />
              ))}
            </div>
          )}
        </div>
      )}
    </DashboardShell>
  );
}
