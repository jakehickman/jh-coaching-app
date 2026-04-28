import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { AlertCircle, CheckCircle2, Calendar, RefreshCw, Settings, SlidersHorizontal, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import CheckInQuestionsManager from "./CheckInQuestionsManager";

// ─── Types ────────────────────────────────────────────────────────────────────

type CycleStatus = "upcoming" | "overdue" | "submitted";

interface ColumnConfig {
  id: CycleStatus;
  label: string;
  icon: React.ReactNode;
  headerClass: string;
  cardClass: string;
  badgeClass: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: "overdue",
    label: "Overdue",
    icon: <AlertCircle size={14} />,
    headerClass: "text-amber-400 border-amber-500/30",
    cardClass: "border-amber-500/20 hover:border-amber-500/50",
    badgeClass: "bg-amber-500/15 text-amber-400",
  },
  {
    id: "submitted",
    label: "Submitted",
    icon: <CheckCircle2 size={14} />,
    headerClass: "text-green-400 border-green-500/30",
    cardClass: "border-green-500/20 hover:border-green-500/50",
    badgeClass: "bg-green-500/15 text-green-400",
  },
  {
    id: "upcoming",
    label: "Upcoming",
    icon: <Calendar size={14} />,
    headerClass: "text-muted-foreground border-border",
    cardClass: "border-border hover:border-muted-foreground/40",
    badgeClass: "bg-secondary text-muted-foreground",
  },
];

// ─── Date formatting ──────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
}

// ─── Per-client question override panel ───────────────────────────────────────

function ClientQuestionOverridePanel({ clientId, clientName }: { clientId: number; clientName: string }) {
  const utils = trpc.useUtils();
  const { data: allQuestions = [] } = trpc.questions.list.useQuery();
  const { data: overrides = [] } = trpc.questions.getClientOverrides.useQuery({ clientId });
  const setOverride = trpc.questions.setClientOverride.useMutation({
    onSuccess: () => {
      utils.questions.getClientOverrides.invalidate({ clientId });
      utils.questions.listActiveForClient.invalidate({ clientId });
    },
  });

  // Build a map of questionId → override active state
  const overrideMap = new Map((overrides as any[]).map((o: any) => [o.questionId, o.active]));

  // Active questions only (globally active)
  const activeQuestions = (allQuestions as any[]).filter((q: any) => q.active);

  function getEffectiveState(q: any): boolean {
    if (overrideMap.has(q.id)) return overrideMap.get(q.id)!;
    return q.active; // global default
  }

  function isOverridden(q: any): boolean {
    return overrideMap.has(q.id);
  }

  function handleToggle(q: any, newValue: boolean) {
    // If toggling back to the global default, clear the override
    const globalDefault = q.active;
    if (newValue === globalDefault) {
      setOverride.mutate({ clientId, questionId: q.id, active: null });
    } else {
      setOverride.mutate({ clientId, questionId: q.id, active: newValue });
    }
  }

  if (activeQuestions.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No active questions. Add questions using the Questions button.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-5">
        Toggle questions on or off for <span className="font-medium text-foreground">{clientName}</span>.
        A green dot marks questions that differ from the global default.
      </p>
      {activeQuestions.map((q: any) => {
        const effective = getEffectiveState(q);
        const overridden = isOverridden(q);
        return (
          <div
            key={q.id}
            className="flex items-start gap-3 py-3.5 px-3 rounded-lg border border-border bg-card transition-colors"
          >
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-start gap-2">
                <p className={`text-sm leading-snug transition-opacity ${effective ? "text-foreground" : "text-muted-foreground opacity-50"}`}>
                  {q.questionText}
                </p>
                {overridden && (
                  <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1" title="Customised for this client" />
                )}
              </div>
            </div>
            <Switch
              checked={effective}
              onCheckedChange={(v) => handleToggle(q, v)}
              disabled={setOverride.isPending}
              className="flex-shrink-0 mt-0.5"
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Client card ──────────────────────────────────────────────────────────────

interface ClientCardProps {
  clientId: number;
  name: string;
  status: CycleStatus;
  dueDate: string | null;
  weekNumber: number | null;
  cardClass: string;
  badgeClass: string;
  onCustomise: (clientId: number, name: string) => void;
}

function ClientCard({ clientId, name, status, dueDate, weekNumber, cardClass, badgeClass, onCustomise }: ClientCardProps) {
  const [, navigate] = useLocation();

  const initials = name
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const statusLabel: Record<CycleStatus, string> = {
    overdue: "Overdue",
    submitted: "Submitted",
    upcoming: "Upcoming",
  };

  const subtext = dueDate
    ? status === "overdue"
      ? `Was due ${fmtDate(dueDate)}`
      : status === "upcoming"
        ? fmtDate(dueDate)
        : `Due ${fmtDate(dueDate)}`
    : null;

  return (
    <div
      className={`
        group relative bg-card border rounded-xl p-3 transition-all duration-150
        ${cardClass}
      `}
    >
      <div className="flex items-center gap-2.5">
        {/* Avatar */}
        <div
          className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0"
        >
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{name}</p>
          {subtext && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{subtext}</p>
          )}
        </div>

        {/* Status badge — hidden for upcoming (due date in subtext is enough) */}
        {status !== "upcoming" && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badgeClass}`}>
            {statusLabel[status]}
          </span>
        )}

        {/* Hover action buttons */}
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
          <button
            onClick={(e) => { e.stopPropagation(); navigate(`/coach/client/${clientId}?tab=check-ins`); }}
            title="View check-ins"
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <ExternalLink size={13} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onCustomise(clientId, name); }}
            title="Customise check-in questions for this client"
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary"
          >
            <SlidersHorizontal size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Kanban column ────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  config: ColumnConfig;
  cards: ClientCardProps[];
}

function KanbanColumn({ config, cards }: KanbanColumnProps) {
  return (
    <div className="flex flex-col min-w-[220px] flex-1">
      {/* Column header */}
      <div className={`flex items-center gap-2 pb-2 mb-3 border-b ${config.headerClass}`}>
        <span className={config.headerClass.split(" ")[0]}>{config.icon}</span>
        <span className={`text-xs font-semibold uppercase tracking-wider ${config.headerClass.split(" ")[0]}`}>
          {config.label}
        </span>
        <span className="ml-auto text-xs text-muted-foreground font-medium">{cards.length}</span>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {cards.length === 0 ? (
          <div className="text-[11px] text-muted-foreground/50 text-center py-4 border border-dashed border-border/50 rounded-xl">
            None
          </div>
        ) : (
          cards.map(card => (
            <ClientCard key={card.clientId} {...card} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main kanban view ─────────────────────────────────────────────────────────

export default function CheckInsKanban() {
  const { data: statusList = [], isLoading } = trpc.checkIn.clientStatusList.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const { data: allUsers = [] } = trpc.users.list.useQuery();

  const [questionsOpen, setQuestionsOpen] = useState(false);
  const [customiseClient, setCustomiseClient] = useState<{ id: number; name: string } | null>(null);

  // Build a name map from users list
  const nameMap = new Map<number, string>();
  for (const u of allUsers as any[]) {
    nameMap.set(u.id, u.name ?? u.email ?? `Client ${u.id}`);
  }

  // Group cards by column
  const columnCards = new Map<CycleStatus, ClientCardProps[]>(
    COLUMNS.map(c => [c.id, []])
  );

  function handleCustomise(clientId: number, name: string) {
    setCustomiseClient({ id: clientId, name });
  }

  for (const entry of statusList as any[]) {
    const status = entry.status as CycleStatus;
    const bucket = columnCards.get(status);
    if (bucket) {
      bucket.push({
        clientId: entry.clientId,
        name: nameMap.get(entry.clientId) ?? `Client ${entry.clientId}`,
        status,
        dueDate: entry.dueDate ?? null,
        weekNumber: entry.weekNumber ?? null,
        cardClass: COLUMNS.find(c => c.id === status)!.cardClass,
        badgeClass: COLUMNS.find(c => c.id === status)!.badgeClass,
        onCustomise: handleCustomise,
      });
    }
  }

  // Sort Upcoming column: soonest due date first
  const upcomingBucket = columnCards.get("upcoming");
  if (upcomingBucket) {
    upcomingBucket.sort((a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <RefreshCw size={18} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Click a client card to open their overview. Hover a card to customise their check-in questions.
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => setQuestionsOpen(true)}
          >
            <Settings size={13} />
            <span className="text-xs">Questions</span>
          </Button>
        </div>

        {/* Kanban board — horizontal scroll on smaller screens */}
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.id}
              config={col}
              cards={columnCards.get(col.id) ?? []}
            />
          ))}
        </div>
      </div>

      {/* Global question management side sheet */}
      <Sheet open={questionsOpen} onOpenChange={setQuestionsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto px-6">
          <SheetHeader className="mb-6">
            <SheetTitle>Check-in Questions</SheetTitle>
          </SheetHeader>
          <CheckInQuestionsManager />
        </SheetContent>
      </Sheet>

      {/* Per-client question customisation sheet */}
      <Sheet open={!!customiseClient} onOpenChange={(o) => !o && setCustomiseClient(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto px-6">
          <SheetHeader className="mb-6">
            <SheetTitle>Customise Questions</SheetTitle>
          </SheetHeader>
          {customiseClient && (
            <ClientQuestionOverridePanel
              clientId={customiseClient.id}
              clientName={customiseClient.name}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
