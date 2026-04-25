import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { AlertCircle, CheckCircle2, Calendar, RefreshCw, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
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

// ─── Client card ──────────────────────────────────────────────────────────────

interface ClientCardProps {
  clientId: number;
  name: string;
  status: CycleStatus;
  dueDate: string | null;
  weekNumber: number | null;
  cardClass: string;
  badgeClass: string;
}

function ClientCard({ clientId, name, status, dueDate, weekNumber, cardClass, badgeClass }: ClientCardProps) {
  const [, navigate] = useLocation();

  function handleClick() {
    navigate(`/coach/progress?clientId=${clientId}&tab=check-ins`);
  }

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

  const weekLabel = weekNumber != null ? `W${weekNumber}` : null;
  const dateLabel = dueDate
    ? status === "overdue"
      ? `Was due ${fmtDate(dueDate)}`
      : `Due ${fmtDate(dueDate)}`
    : null;
  const subtext = [weekLabel, dateLabel].filter(Boolean).join(" · ") || null;

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
          {subtext && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{subtext}</p>
          )}
        </div>

        {/* Status badge */}
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${badgeClass}`}>
          {statusLabel[status]}
        </span>
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

  // Build a name map from users list
  const nameMap = new Map<number, string>();
  for (const u of allUsers as any[]) {
    nameMap.set(u.id, u.name ?? u.email ?? `Client ${u.id}`);
  }

  // Group cards by column
  const columnCards = new Map<CycleStatus, ClientCardProps[]>(
    COLUMNS.map(c => [c.id, []])
  );

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
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <RefreshCw size={18} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const [questionsOpen, setQuestionsOpen] = useState(false);

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Click any client card to view their check-in details and submission.
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

      {/* Question management side sheet */}
      <Sheet open={questionsOpen} onOpenChange={setQuestionsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Check-in Questions</SheetTitle>
          </SheetHeader>
          <CheckInQuestionsManager />
        </SheetContent>
      </Sheet>
    </>
  );
}
