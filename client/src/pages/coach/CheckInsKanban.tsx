import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { toast } from "sonner";
import {
  AlertCircle, Clock, CalendarCheck, CheckCircle2, Calendar, SkipForward, RefreshCw
} from "lucide-react";

// ─── Status config ────────────────────────────────────────────────────────────

type CheckInStatus =
  | "overdue"
  | "due_today"
  | "open"
  | "completed"
  | "completed_late"
  | "missed"
  | "skipped"
  | "upcoming";

interface ColumnConfig {
  id: CheckInStatus | CheckInStatus[];
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
    id: "due_today",
    label: "Due Today",
    icon: <Clock size={14} />,
    headerClass: "text-green-400 border-green-500/30",
    cardClass: "border-green-500/20 hover:border-green-500/50",
    badgeClass: "bg-green-500/15 text-green-400",
  },
  {
    id: "open",
    label: "Open",
    icon: <CalendarCheck size={14} />,
    headerClass: "text-blue-400 border-blue-500/30",
    cardClass: "border-blue-500/20 hover:border-blue-500/50",
    badgeClass: "bg-blue-500/15 text-blue-400",
  },
  {
    id: ["completed", "completed_late"],
    label: "Submitted",
    icon: <CheckCircle2 size={14} />,
    headerClass: "text-muted-foreground border-border",
    cardClass: "border-border hover:border-muted-foreground/40",
    badgeClass: "bg-secondary text-muted-foreground",
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

function matchesColumn(status: CheckInStatus, colId: CheckInStatus | CheckInStatus[]): boolean {
  if (Array.isArray(colId)) return colId.includes(status);
  return status === colId;
}

// ─── Date formatting ──────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
}

// ─── Client card ──────────────────────────────────────────────────────────────

interface ClientCardProps {
  clientId: number;
  name: string;
  status: CheckInStatus;
  scheduledDate: string | null;
  dueDate: string | null;
  cardClass: string;
  badgeClass: string;
  onSkip: (clientId: number, weekStartDate: string) => void;
  skipLoading: boolean;
}

function ClientCard({
  clientId, name, status, scheduledDate, dueDate,
  cardClass, badgeClass, onSkip, skipLoading,
}: ClientCardProps) {
  const [, navigate] = useLocation();

  function handleClick() {
    navigate(`/coach/progress?clientId=${clientId}&tab=check-ins`);
  }

  function handleSkip(e: React.MouseEvent) {
    e.stopPropagation();
    if (scheduledDate) onSkip(clientId, scheduledDate);
  }

  const initials = name
    .split(" ")
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const statusLabel: Record<CheckInStatus, string> = {
    overdue: "Overdue",
    due_today: "Due Today",
    open: "Open",
    completed: "Submitted",
    completed_late: "Submitted Late",
    missed: "Missed",
    skipped: "Skipped",
    upcoming: "Upcoming",
  };

  return (
    <div
      onClick={handleClick}
      className={`
        group relative bg-card border rounded-xl p-3 cursor-pointer transition-all duration-150
        ${cardClass}
      `}
    >
      <div className="flex items-center gap-2.5">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
          {initials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{name}</p>
          {scheduledDate && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {status === "completed" || status === "completed_late"
                ? `Submitted`
                : status === "upcoming"
                ? `Due ${fmtDate(scheduledDate)}`
                : `Since ${fmtDate(scheduledDate)}`}
            </p>
          )}
        </div>

        {/* Status badge */}
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badgeClass}`}>
          {statusLabel[status]}
        </span>
      </div>

      {/* Skip button — only on overdue */}
      {status === "overdue" && scheduledDate && (
        <button
          onClick={handleSkip}
          disabled={skipLoading}
          className="mt-2 w-full flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground border border-border hover:border-muted-foreground/40 rounded-lg py-1.5 transition-colors disabled:opacity-50"
        >
          <SkipForward size={11} />
          Skip this week
        </button>
      )}
    </div>
  );
}

// ─── Kanban column ────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  config: ColumnConfig;
  cards: ClientCardProps[];
  onSkip: (clientId: number, weekStartDate: string) => void;
  skipLoadingId: number | null;
}

function KanbanColumn({ config, cards, onSkip, skipLoadingId }: KanbanColumnProps) {
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
            <ClientCard
              key={card.clientId}
              {...card}
              cardClass={config.cardClass}
              badgeClass={config.badgeClass}
              onSkip={onSkip}
              skipLoading={skipLoadingId === card.clientId}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main kanban view ─────────────────────────────────────────────────────────

export default function CheckInsKanban() {
  const utils = trpc.useUtils();
  const [skipLoadingId, setSkipLoadingId] = useState<number | null>(null);

  const { data: statusList = [], isLoading } = trpc.checkIn.clientStatusList.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const { data: allUsers = [] } = trpc.users.list.useQuery();

  const skipWeek = trpc.checkIn.skipWeek.useMutation({
    onSuccess: () => {
      utils.checkIn.clientStatusList.invalidate();
      utils.checkIn.overdueClients.invalidate();
      setSkipLoadingId(null);
      toast.success("Week skipped");
    },
    onError: (e) => {
      setSkipLoadingId(null);
      toast.error(e.message);
    },
  });

  function handleSkip(clientId: number, weekStartDate: string) {
    setSkipLoadingId(clientId);
    skipWeek.mutate({ clientId, weekStartDate });
  }

  // Build a name map from users list
  const nameMap = new Map<number, string>();
  for (const u of allUsers as any[]) {
    nameMap.set(u.id, u.name ?? u.email ?? `Client ${u.id}`);
  }

  // Build card list per column
  const columnCards: Map<string, ClientCardProps[]> = new Map(
    COLUMNS.map(c => [JSON.stringify(c.id), []])
  );

  for (const entry of statusList as any[]) {
    const status = entry.status as CheckInStatus;
    for (const col of COLUMNS) {
      if (matchesColumn(status, col.id)) {
        const cards = columnCards.get(JSON.stringify(col.id))!;
        cards.push({
          clientId: entry.clientId,
          name: nameMap.get(entry.clientId) ?? `Client ${entry.clientId}`,
          status,
          scheduledDate: entry.scheduledDate ?? null,
          dueDate: entry.dueDate ?? null,
          cardClass: col.cardClass,
          badgeClass: col.badgeClass,
          onSkip: handleSkip,
          skipLoading: skipLoadingId === entry.clientId,
        });
        break;
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <RefreshCw size={18} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Click any client card to view their check-in history and submissions.
      </p>

      {/* Kanban board — horizontal scroll on smaller screens */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(col => (
          <KanbanColumn
            key={JSON.stringify(col.id)}
            config={col}
            cards={columnCards.get(JSON.stringify(col.id)) ?? []}
            onSkip={handleSkip}
            skipLoadingId={skipLoadingId}
          />
        ))}
      </div>
    </div>
  );
}
