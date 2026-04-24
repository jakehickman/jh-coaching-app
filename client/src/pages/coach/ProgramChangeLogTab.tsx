import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Pencil, ClipboardList } from "lucide-react";

interface ProgramChangeEntry {
  type: "add" | "remove" | "modify";
  session: string;
  exercise: string;
  field?: string;
  oldValue?: string;
  newValue?: string;
}

interface ChangeLogRow {
  id: number;
  userId: number;
  coachId: number | null;
  changes: ProgramChangeEntry[];
  changedAt: string | Date;
}

function ChangeRow({ entry }: { entry: ProgramChangeEntry }) {
  if (entry.type === "add") {
    return (
      <div className="flex items-start gap-2 py-1">
        <Plus className="h-3.5 w-3.5 mt-0.5 text-emerald-500 shrink-0" />
        <span className="text-sm">
          <span className="text-muted-foreground">{entry.session} — </span>
          <span className="font-medium text-foreground">{entry.exercise}</span>
          <span className="text-muted-foreground"> added</span>
        </span>
      </div>
    );
  }

  if (entry.type === "remove") {
    return (
      <div className="flex items-start gap-2 py-1">
        <Minus className="h-3.5 w-3.5 mt-0.5 text-red-500 shrink-0" />
        <span className="text-sm">
          <span className="text-muted-foreground">{entry.session} — </span>
          <span className="font-medium text-foreground">{entry.exercise}</span>
          <span className="text-muted-foreground"> removed</span>
        </span>
      </div>
    );
  }

  // modify
  const fieldLabel = entry.field === "sets" ? "sets" : entry.field === "reps" ? "reps" : entry.field ?? "value";
  return (
    <div className="flex items-start gap-2 py-1">
      <Pencil className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
      <span className="text-sm">
        <span className="text-muted-foreground">{entry.session} — </span>
        <span className="font-medium text-foreground">{entry.exercise}</span>
        <span className="text-muted-foreground"> {fieldLabel}: </span>
        {entry.oldValue && (
          <span className="line-through text-muted-foreground">{entry.oldValue}</span>
        )}
        {entry.oldValue && entry.newValue && <span className="text-muted-foreground mx-1">→</span>}
        {entry.newValue && (
          <span className="font-medium text-foreground">{entry.newValue}</span>
        )}
      </span>
    </div>
  );
}

function formatDate(ts: string | Date) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function formatTime(ts: string | Date) {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" });
}

export default function ProgramChangeLogTab({ clientId }: { clientId: number }) {
  const { data: logs, isLoading } = trpc.training.getChangeLogs.useQuery(
    { userId: clientId },
    { enabled: !!clientId }
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <ClipboardList className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No program changes recorded yet.</p>
        <p className="text-xs text-muted-foreground/60">Changes will appear here whenever the program is updated.</p>
      </div>
    );
  }

  // Sort newest first
  const sorted = [...logs].sort(
    (a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
  );

  return (
    <div className="space-y-4">
      {sorted.map((log: ChangeLogRow) => {
        const changes: ProgramChangeEntry[] = Array.isArray(log.changes) ? log.changes : [];
        const adds = changes.filter(c => c.type === "add").length;
        const removes = changes.filter(c => c.type === "remove").length;
        const modifies = changes.filter(c => c.type === "modify").length;

        return (
          <Card key={log.id} className="bg-card/60 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-semibold">{formatDate(log.changedAt)}</p>
                  <p className="text-xs text-muted-foreground">{formatTime(log.changedAt)}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {adds > 0 && (
                    <Badge variant="outline" className="text-emerald-500 border-emerald-500/30 bg-emerald-500/10 text-xs px-2 py-0.5">
                      +{adds}
                    </Badge>
                  )}
                  {removes > 0 && (
                    <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10 text-xs px-2 py-0.5">
                      -{removes}
                    </Badge>
                  )}
                  {modifies > 0 && (
                    <Badge variant="outline" className="text-amber-500 border-amber-500/30 bg-amber-500/10 text-xs px-2 py-0.5">
                      ~{modifies}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="divide-y divide-border/30">
                {changes.map((entry, i) => (
                  <ChangeRow key={i} entry={entry} />
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
