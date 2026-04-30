import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Activity, Trash2 } from "lucide-react";

interface CardioChangeEntry {
  field: "stepGoal" | "lissSessionsPerWeek" | "lissMinutesPerSession";
  oldValue?: string | null;
  newValue?: string | null;
}

interface ChangeLogRow {
  id: number;
  userId: number;
  coachId: number | null;
  changes: CardioChangeEntry[];
  note?: string | null;
  changedAt: string | Date;
}

const FIELD_LABELS: Record<CardioChangeEntry["field"], string> = {
  stepGoal: "Daily Step Goal",
  lissSessionsPerWeek: "LISS Sessions / Week",
  lissMinutesPerSession: "Mins / Session",
};

function ChangeRow({ entry }: { entry: CardioChangeEntry }) {
  const label = FIELD_LABELS[entry.field] ?? entry.field;
  return (
    <div className="flex items-start gap-2 py-1">
      <Pencil className="h-3.5 w-3.5 mt-0.5 text-amber-500 shrink-0" />
      <span className="text-sm">
        <span className="text-muted-foreground">{label}: </span>
        {entry.oldValue != null && (
          <span className="line-through text-muted-foreground">{entry.oldValue}</span>
        )}
        {entry.oldValue != null && entry.newValue != null && (
          <span className="text-muted-foreground mx-1">→</span>
        )}
        {entry.newValue != null ? (
          <span className="font-medium text-foreground">{entry.newValue}</span>
        ) : (
          <span className="text-muted-foreground italic">cleared</span>
        )}
      </span>
    </div>
  );
}

function formatDate(ts: string | Date) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

function NoteEditor({ logId, initialNote }: { logId: number; initialNote?: string | null }) {
  const [note, setNote] = useState(initialNote ?? "");
  const [saved, setSaved] = useState(false);
  const utils = trpc.useUtils();
  const updateNote = trpc.clientConfig.updateChangeLogNote.useMutation({
    onSuccess: () => {
      utils.clientConfig.getChangeLogs.invalidate();
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    },
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleBlur() {
    const trimmed = note.trim();
    const current = initialNote?.trim() ?? "";
    if (trimmed !== current) {
      updateNote.mutate({ id: logId, note: trimmed || null });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      textareaRef.current?.blur();
    }
    if (e.key === "Escape") {
      setNote(initialNote ?? "");
      textareaRef.current?.blur();
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-border/30">
      <textarea
        ref={textareaRef}
        value={note}
        onChange={e => setNote(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder=""
        rows={2}
        className="w-full resize-none rounded-md bg-muted/30 border border-border/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring/50 transition-colors"
      />
      {saved && <p className="text-xs text-emerald-500 mt-1">Note saved</p>}
    </div>
  );
}

export default function CardioChangeLogTab({ clientId }: { clientId: number }) {
  const utils = trpc.useUtils();
  const { data: logs, isLoading } = trpc.clientConfig.getChangeLogs.useQuery(
    { userId: clientId },
    { enabled: !!clientId }
  );

  const deleteEntry = trpc.clientConfig.deleteChangeLogEntry.useMutation({
    onSuccess: () => utils.clientConfig.getChangeLogs.invalidate(),
  });

  if (isLoading) {
    return (
      <div className="space-y-3 mt-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-lg bg-muted/30 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <Activity className="h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No cardio target changes recorded yet.</p>
        <p className="text-xs text-muted-foreground/60">
          Changes will appear here whenever step goal or LISS targets are updated.
        </p>
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
        const changes: CardioChangeEntry[] = Array.isArray(log.changes) ? log.changes : [];
        return (
          <Card key={log.id} className="bg-card/60 border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold">{formatDate(log.changedAt)}</p>
                <button
                  onClick={() => {
                    if (confirm("Delete this change log entry?")) {
                      deleteEntry.mutate({ id: log.id });
                    }
                  }}
                  disabled={deleteEntry.isPending}
                  className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                  title="Delete entry"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="divide-y divide-border/30">
                {changes.map((entry, i) => (
                  <ChangeRow key={i} entry={entry} />
                ))}
              </div>
              <NoteEditor logId={log.id} initialNote={log.note} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
