import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef } from "react";
import { useViewAs } from "@/contexts/ViewAsContext";
import { Check, ChevronDown, ChevronUp, Play, X, Plus, Minus, Trash2, Shuffle, Settings, History, Pencil, Calendar } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { toUTCDateStr as toLocalDateStr } from "@/lib/dates";
import { SectionLabel, Card, DateInput } from "./shared";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getYouTubeEmbedUrl(url: string): string | null {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\.\w-]+)/);
  if (!match) return null;
  return `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0`;
}

// ─── TrainingTab ────────────────────────────────────────────────────────────────────────────────
function TrainingTab() {
  const { viewAsUserId } = useViewAs();
  const { data: programOwn } = trpc.training.get.useQuery(undefined, { enabled: !viewAsUserId });
  const { data: programAdmin } = trpc.training.getForClient.useQuery({ userId: viewAsUserId! }, { enabled: !!viewAsUserId });
  const program = viewAsUserId ? programAdmin : programOwn;
  const { data: exerciseLib = [] } = trpc.exerciseLibrary.list.useQuery();
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [videoModal, setVideoModal] = useState<{ name: string; embedUrl: string } | null>(null);

  const days = (program?.days as any[]) ?? [];
  const schedule = Array.isArray(program?.schedule) ? (program!.schedule as string[]) : [];

  const videoMap = Object.fromEntries(
    exerciseLib
      .filter((e: any) => e.videoUrl)
      .map((e: any) => [e.name, e.videoUrl as string])
  );

  return (
    <div className="space-y-4">
      {program?.programName && (
        <p className="text-sm font-semibold text-foreground">{program.programName}</p>
      )}

      {schedule.length > 0 && (
        <Card>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Training Schedule</p>
          <div className="flex gap-1.5 items-center overflow-x-auto pb-0.5">
            {schedule.map((slot: string, i: number) => (
              <span key={i} className={`flex-shrink-0 px-3 py-1 rounded-lg text-sm font-semibold ${
                slot === "Off"
                  ? "bg-secondary text-muted-foreground"
                  : "bg-primary/10 text-primary border border-primary/20"
              }`}>{slot === "Off" ? "OFF" : slot}</span>
            ))}
            <span className="flex-shrink-0 text-xs text-muted-foreground/50 ml-1">→ repeat</span>
          </div>
        </Card>
      )}

      {days.length === 0 && (
        <Card className="text-center py-12">
          <p className="text-muted-foreground text-sm">No training program set yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Your coach will add your program here.</p>
        </Card>
      )}

      {days.map((day: any, i: number) => (
        <Card key={i} className="overflow-hidden">
          <button
            onClick={() => setExpandedDay(expandedDay === i ? null : i)}
            className="w-full flex items-center justify-between"
          >
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">{day.name ?? `Day ${i + 1}`}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{(day.exercises ?? []).length} exercises</span>
              {expandedDay === i ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </div>
          </button>

          {expandedDay === i && (
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-12 gap-2 px-1 mb-1">
                <p className="col-span-6 text-[10px] text-muted-foreground uppercase tracking-wider">Exercise</p>
                <p className="col-span-3 text-[10px] text-muted-foreground uppercase tracking-wider text-center">Sets</p>
                <p className="col-span-3 text-[10px] text-muted-foreground uppercase tracking-wider text-center">Reps</p>
              </div>
              {(day.exercises ?? []).map((ex: any, j: number) => {
                const videoUrl = videoMap[ex.name];
                const embedUrl = videoUrl ? getYouTubeEmbedUrl(videoUrl) : null;
                return (
                  <div key={j} className="border-t border-border">
                    <div className="grid grid-cols-12 gap-2 items-center py-2">
                      <div className="col-span-6 flex items-center gap-2">
                        <p className="text-sm text-foreground flex-1 min-w-0">{ex.name}</p>
                        {embedUrl && (
                          <button
                            onClick={() => setVideoModal({ name: ex.name, embedUrl })}
                            className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                            title="Watch demo"
                          >
                            <Play size={10} />
                            <span className="text-[9px] font-semibold">Demo</span>
                          </button>
                        )}
                      </div>
                      <p className="col-span-3 text-sm text-foreground text-center">{ex.sets}</p>
                      <p className="col-span-3 text-sm text-foreground text-center">{ex.reps}</p>
                    </div>
                    {ex.notes && (
                      <p className="text-xs text-muted-foreground pb-2 leading-relaxed">{ex.notes}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      ))}

      {program?.notes && (
        <Card>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Coach Notes</p>
          <p className="text-sm text-foreground">{program.notes}</p>
        </Card>
      )}

      {videoModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setVideoModal(null)}
        >
          <div
            className="relative w-full max-w-2xl bg-card rounded-xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground">{videoModal.name}</p>
              <button onClick={() => setVideoModal(null)} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div className="aspect-video w-full">
              <iframe
                src={videoModal.embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={videoModal.name}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── PresetSelector ─────────────────────────────────────────────────────────────────────────────
interface PresetSelectorProps {
  exerciseName: string;
  currentPreset: string;
  currentSettings: string;
  isAddingNew: boolean;
  newPresetValue: string;
  onSelectPreset: (presetName: string, lastSettings: string | null, presetId?: number) => void;
  onStartAddNew: () => void;
  onNewPresetChange: (val: string) => void;
  onSaveNewPreset: (name: string) => void;
  onCancelAddNew: () => void;
  onSettingsChange: (val: string) => void;
  onSettingsBlur: (val: string) => void;
  onDeletePreset: (id: number, presetName: string) => void;
}

function PresetSelector({
  exerciseName, currentPreset, currentSettings, isAddingNew, newPresetValue,
  onSelectPreset, onStartAddNew, onNewPresetChange, onSaveNewPreset, onCancelAddNew,
  onSettingsChange, onSettingsBlur, onDeletePreset,
}: PresetSelectorProps) {
  const utils = trpc.useUtils();
  const { data: presetList = [] } = trpc.equipmentPresets.list.useQuery(
    { exerciseName },
    { staleTime: 30_000 }
  );
  const upsertMutation = trpc.equipmentPresets.upsert.useMutation({
    onSuccess: () => utils.equipmentPresets.list.invalidate({ exerciseName }),
  });
  const deleteMutation = trpc.equipmentPresets.delete.useMutation({
    onSuccess: () => utils.equipmentPresets.list.invalidate({ exerciseName }),
  });
  const renameMutation = trpc.equipmentPresets.rename.useMutation({
    onSuccess: (_data, vars) => {
      utils.equipmentPresets.list.invalidate({ exerciseName });
      // If the renamed preset was selected, update the parent selection to the new name
      if (currentPreset === renamingFrom) {
        onSelectPreset(vars.newName, currentSettings || null);
      }
      setRenamingId(null);
      setRenamingFrom("");
      setRenameValue("");
    },
  });

  // Rename state — local to this component
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renamingFrom, setRenamingFrom] = useState("");
  const [renameValue, setRenameValue] = useState("");

  const handleSaveNewPreset = (name: string) => {
    upsertMutation.mutate({ exerciseName, presetName: name });
    onSaveNewPreset(name);
  };
  const handleSettingsBlur = (val: string) => {
    if (currentPreset) upsertMutation.mutate({ exerciseName, presetName: currentPreset, lastSettings: val });
    onSettingsBlur(val);
  };

  const selectedPresetObj = (presetList as any[]).find((p: any) => p.presetName === currentPreset);

  const startRename = (preset: any) => {
    setRenamingId(preset.id);
    setRenamingFrom(preset.presetName);
    setRenameValue(preset.presetName);
  };
  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (!trimmed || !renamingId) { setRenamingId(null); return; }
    renameMutation.mutate({ id: renamingId, newName: trimmed });
  };

  return (
    <div className="mb-3 -mt-1 space-y-2">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Machine</p>
      {renamingId !== null ? (
        /* ── Rename mode ── */
        <div className="flex gap-2">
          <input
            type="text"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }}
            autoFocus
            className="flex-1 bg-secondary border border-primary rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={commitRename}
            disabled={renameMutation.isPending}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50"
          >Save</button>
          <button
            onClick={() => setRenamingId(null)}
            className="px-3 py-2 bg-secondary text-muted-foreground rounded-lg text-sm"
          >Cancel</button>
        </div>
      ) : !isAddingNew ? (
        /* ── Normal select mode ── */
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <select
              value={currentPreset}
              onChange={e => {
                const val = e.target.value;
                if (val === "__new__") {
                  onStartAddNew();
                } else {
                  const preset = (presetList as any[]).find((p: any) => p.presetName === val);
                  onSelectPreset(val, preset?.lastSettings ?? null, preset?.id);
                }
              }}
              className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select machine…</option>
              {(presetList as any[]).map((p: any) => (
                <option key={p.id} value={p.presetName}>{p.presetName}</option>
              ))}
              <option value="__new__">+ Add new machine</option>
            </select>
            {selectedPresetObj && (
              <>
                <button
                  onClick={() => startRename(selectedPresetObj)}
                  title="Rename this machine preset"
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${selectedPresetObj.presetName}"?`)) {
                      onDeletePreset(selectedPresetObj.id, selectedPresetObj.presetName);
                      deleteMutation.mutate({ id: selectedPresetObj.id });
                    }
                  }}
                  title="Delete this machine preset"
                  className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        /* ── Add new mode ── */
        <div className="flex gap-2">
          <input
            type="text"
            value={newPresetValue}
            onChange={e => onNewPresetChange(e.target.value)}
            autoFocus
            className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={() => { const name = newPresetValue.trim(); if (name) handleSaveNewPreset(name); }}
            className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium"
          >Save</button>
          <button
            onClick={onCancelAddNew}
            className="px-3 py-2 bg-secondary text-muted-foreground rounded-lg text-sm"
          >Cancel</button>
        </div>
      )}
      {currentPreset && renamingId === null && (
        <>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Setup</p>
          <input
            type="text"
            value={currentSettings}
            onChange={e => onSettingsChange(e.target.value)}
            onBlur={e => handleSettingsBlur(e.target.value)}
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </>
      )}
    </div>
  );
}

// ─── PastSessionsList ────────────────────────────────────────────────────────
function PastSessionsList({
  sessions, viewAsUserId, deleting, changingDateId, newDateVal, updateDatePending,
  onEdit, onChangeDate, onSaveDate, onCancelDate, onNewDateVal, onDelete,
}: {
  sessions: any[];
  viewAsUserId: string | null | undefined;
  deleting: number | null;
  changingDateId: number | null;
  newDateVal: string;
  updateDatePending: boolean;
  onEdit: (s: any) => void;
  onChangeDate: (id: number, val: string) => void;
  onSaveDate: (id: number) => void;
  onCancelDate: () => void;
  onNewDateVal: (v: string) => void;
  onDelete: (id: number) => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const displayed = showAll ? sessions.slice(0, 50) : sessions.slice(0, 10);

  function toggleExpand(id: number) {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Past Sessions</p>
        <p className="text-[11px] text-muted-foreground">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</p>
      </div>
      {displayed.map(s => {
        const isExpanded = expandedIds.has(s.id);
        const dateStr = toLocalDateStr(s.sessionDate);
        const dateLabel = (() => { const d = new Date(dateStr + 'T12:00:00Z'); return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }); })();
        const allExercises = (s.exercises as any[]).filter((ex: any) => {
          const sets = (ex.sets ?? []).filter((st: any) => st.completed || st.weight != null || st.reps != null);
          return sets.length > 0;
        });
        const totalSets = allExercises.reduce((sum: number, ex: any) => {
          return sum + (ex.sets ?? []).filter((st: any) => st.completed || st.weight != null || st.reps != null).length;
        }, 0);

        return (
          <div key={s.id} className="bg-card border border-border rounded-xl overflow-hidden border-l-4 border-l-primary/60">
            {/* Header row ─ always visible */}
            <div
              className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
              onClick={() => toggleExpand(s.id)}
            >
              {/* Day badge */}
              <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-bold text-primary">{s.dayLabel}</span>
              </div>
              {/* Date + summary */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{dateLabel}</p>
                <p className="text-xs text-muted-foreground">{allExercises.length} exercise{allExercises.length !== 1 ? 's' : ''} &middot; {totalSets} set{totalSets !== 1 ? 's' : ''}</p>
              </div>
              {/* Action buttons (stop propagation so they don't toggle expand) */}
              {!viewAsUserId && (
                <div className="flex items-center gap-1.5 flex-shrink-0" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => onEdit(s)}
                    title="Edit session"
                    className="flex items-center justify-center w-9 h-9 rounded-lg bg-secondary text-muted-foreground hover:text-primary hover:bg-secondary/70 transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => onChangeDate(s.id, dateStr)}
                    title="Change date"
                    className="flex items-center justify-center w-9 h-9 rounded-lg bg-secondary text-muted-foreground hover:text-primary hover:bg-secondary/70 transition-colors"
                  >
                    <Calendar size={15} />
                  </button>
                  <button
                    onClick={() => onDelete(s.id)}
                    disabled={deleting === s.id}
                    title="Delete session"
                    className="flex items-center justify-center w-9 h-9 rounded-lg bg-secondary text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
              <ChevronDown size={15} className={`text-muted-foreground transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`} />
            </div>

            {/* Change date inline row */}
            {changingDateId === s.id && (
              <div className="px-4 pb-3 flex items-center gap-2">
                <input
                  type="date"
                  value={newDateVal}
                  onChange={e => onNewDateVal(e.target.value)}
                  className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={() => onSaveDate(s.id)}
                  disabled={!newDateVal || updateDatePending}
                  className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={onCancelDate}
                  className="flex items-center justify-center w-9 h-9 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            )}

            {/* Expanded exercise list */}
            {isExpanded && (
              <div className="border-t border-border px-4 py-3 space-y-2">
                {allExercises.map((ex: any, i: number) => {
                  const completedSets = (ex.sets ?? []).filter((st: any) => st.completed || st.weight != null || st.reps != null);
                  const firstSet = completedSets.find((st: any) => st.weight != null || st.reps != null) ?? completedSets[0];
                  const setCount = completedSets.length;
                  return (
                    <div key={i} className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground leading-snug">
                          {ex.name}
                          {ex.substitutedFor && (
                            <span className="ml-1.5 text-[9px] font-semibold bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded align-middle">SUB</span>
                          )}
                        </p>
                        {ex.machinePreset && (
                          <p className="text-[11px] text-muted-foreground/60">{ex.machinePreset}</p>
                        )}
                        {ex.substitutedFor && (
                          <p className="text-[11px] text-muted-foreground/50">↳ for {ex.substitutedFor}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm text-muted-foreground">
                          {firstSet?.weight != null ? `${firstSet.weight}kg` : '—'} × {firstSet?.reps != null ? firstSet.reps : '—'}
                        </p>
                        <p className="text-[11px] text-muted-foreground/60">{setCount} {setCount === 1 ? 'set' : 'sets'}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {sessions.length > 10 && (
        <button
          onClick={() => setShowAll(v => !v)}
          className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {showAll ? 'Show less ↑' : `View all ${sessions.length} sessions ↓`}
        </button>
      )}
    </div>
  );
}

function WorkoutLogTab() {
  const { viewAsUserId } = useViewAs();
  const { data: programOwn } = trpc.training.get.useQuery(undefined, { enabled: !viewAsUserId });
  const { data: programAdmin } = trpc.training.getForClient.useQuery({ userId: viewAsUserId! }, { enabled: !!viewAsUserId });
  const program = viewAsUserId ? programAdmin : programOwn;
  const { data: sessionsOwn = [], refetch: refetchOwn, isSuccess: sessionsLoadedOwn } = trpc.workoutSessions.list.useQuery(undefined, { enabled: !viewAsUserId });
  const { data: sessionsAdmin = [], refetch: refetchAdmin, isSuccess: sessionsLoadedAdmin } = trpc.workoutSessions.listForClient.useQuery({ userId: viewAsUserId! }, { enabled: !!viewAsUserId });
  const sessions = viewAsUserId ? sessionsAdmin : sessionsOwn;
  const refetch = viewAsUserId ? refetchAdmin : refetchOwn;
  const sessionsLoaded = viewAsUserId ? sessionsLoadedAdmin : sessionsLoadedOwn;
  const { data: exerciseLib = [] } = trpc.exerciseLibrary.list.useQuery();
  const utils = trpc.useUtils();

  const videoMap: Record<string, string> = Object.fromEntries(
    (exerciseLib as any[]).filter((e: any) => e.videoUrl).map((e: any) => [e.name, e.videoUrl as string])
  );
  const [videoModal, setVideoModal] = useState<{ name: string; embedUrl: string } | null>(null);
  const [historySheet, setHistorySheet] = useState<string | null>(null); // exercise name

  const today = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  })();

  const days: Array<{ label: string; exercises: Array<{ name: string; sets: number; reps: string; notes?: string }> }> =
    ((program?.days as any[]) ?? []).map((d: any) => ({ ...d, label: d.label ?? d.name }));

  // ── Persistent state ──────────────────────────────────────────────────────
  const [selectedDay, setSelectedDay] = useState<string | null>(() => {
    try { return sessionStorage.getItem('workoutLog:selectedDay') ?? null; } catch { return null; }
  });
  const [sessionDate, setSessionDate] = useState(() => {
    try { return sessionStorage.getItem('workoutLog:sessionDate') ?? today; } catch { return today; }
  });
  useEffect(() => {
    try {
      if (selectedDay) sessionStorage.setItem('workoutLog:selectedDay', selectedDay);
      else sessionStorage.removeItem('workoutLog:selectedDay');
    } catch {}
  }, [selectedDay]);
  useEffect(() => {
    try { sessionStorage.setItem('workoutLog:sessionDate', sessionDate); } catch {}
  }, [sessionDate]);

  // ── Form state ────────────────────────────────────────────────────────────
  const [exerciseData, setExerciseData] = useState<Record<string, Array<{ weight: string; reps: string; notes: string; completed: boolean }>>>({});
  const [equipmentDetails, setEquipmentDetails] = useState<Record<string, string>>({});
  const [machinePreset, setMachinePreset] = useState<Record<string, string>>({}); // exerciseName -> preset name
  const [machinePresetId, setMachinePresetId] = useState<Record<string, number>>({}); // exerciseName -> preset ID
  const [machineSettings, setMachineSettings] = useState<Record<string, string>>({}); // exerciseName -> settings
  const [newPresetInput, setNewPresetInput] = useState<Record<string, string>>({}); // exerciseName -> new preset being typed
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({});
  const [sessionNotes, setSessionNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [substitutions, setSubstitutions] = useState<Record<string, string>>({});
  const [changingDateId, setChangingDateId] = useState<number | null>(null);
  const [newDateVal, setNewDateVal] = useState("");

  // ── Draft helpers ─────────────────────────────────────────────────────────
  const draftKey = (date: string, day: string) => `draft:workout:${date}:${day}`;

  function readDraft(date: string, day: string) {
    try {
      const raw = localStorage.getItem(draftKey(date, day));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if ((parsed.v ?? 1) < 2) { localStorage.removeItem(draftKey(date, day)); return null; }
      return parsed;
    } catch { return null; }
  }

  function writeDraft(date: string, day: string) {
    try { localStorage.setItem(draftKey(date, day), JSON.stringify({ v: 2, exerciseData, sessionNotes, equipmentDetails, machinePreset, machineSettings, exerciseNotes, substitutions })); } catch {}
  }

  function clearDraft(date: string, day: string) {
    try { localStorage.removeItem(draftKey(date, day)); } catch {}
  }

  const loadedRef = useRef<string | null>(null);
  const [expandedSets, setExpandedSets] = useState<Record<string, boolean>>({});
  const [equipmentOpen, setEquipmentOpen] = useState<Record<string, boolean>>({});
  const [prevNoteOpen, setPrevNoteOpen] = useState<Record<string, boolean>>({});
  const [collapsedExercises, setCollapsedExercisesRaw] = useState<Record<string, boolean>>({});

  function getCollapseKey(date: string, dayLabel: string) {
    return `collapse:workout:${date}:${dayLabel}`;
  }
  function loadCollapsed(date: string, dayLabel: string): Record<string, boolean> {
    try {
      const stored = sessionStorage.getItem(getCollapseKey(date, dayLabel));
      return stored ? JSON.parse(stored) : {};
    } catch { return {}; }
  }
  function saveCollapsed(date: string, dayLabel: string, state: Record<string, boolean>) {
    try { sessionStorage.setItem(getCollapseKey(date, dayLabel), JSON.stringify(state)); } catch {}
  }
  function toggleExerciseCollapse(exName: string) {
    setCollapsedExercisesRaw(prev => {
      const next = { ...prev, [exName]: !prev[exName] };
      if (selectedDay) saveCollapsed(sessionDate, selectedDay, next);
      // Reset equipment open state when collapsing
      if (!next[exName] === false) {
        setEquipmentOpen(p => ({ ...p, [exName]: false }));
      }
      return next;
    });
  }

  const autoCollapsedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    setCollapsedExercisesRaw(prev => {
      let changed = false;
      const next = { ...prev };
      for (const [exName, sets] of Object.entries(exerciseData)) {
        const allDone = sets.length > 0 && sets.every(s => s.completed);
        if (allDone && !autoCollapsedRef.current.has(exName) && !prev[exName]) {
          next[exName] = true;
          autoCollapsedRef.current.add(exName);
          changed = true;
        }
        if (!allDone) autoCollapsedRef.current.delete(exName);
      }
      if (!changed) return prev;
      if (selectedDay) saveCollapsed(sessionDate, selectedDay, next);
      return next;
    });
  }, [exerciseData]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-persist draft ────────────────────────────────────────────────────
  useEffect(() => {
    if (!loadedRef.current) return;
    const [date, day] = loadedRef.current.split(':');
    writeDraft(date, day);
  }, [exerciseData, sessionNotes, equipmentDetails, exerciseNotes, substitutions]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sub picker ────────────────────────────────────────────────────────────
  const [subPicker, setSubPicker] = useState<{ originalName: string } | null>(null);
  const [subSearch, setSubSearch] = useState("");

  const MUSCLE_KEYS = ["chest","frontDelts","sideDelts","triceps","lats","upperBack","rearDelts","biceps","quads","hams","glutes","gluteMed","calves","abs"] as const;
  function muscleScore(a: any, b: any): number {
    return MUSCLE_KEYS.reduce((sum, k) => sum + (a[k] ?? 0) * (b[k] ?? 0), 0);
  }
  function getSimilarExercises(originalName: string): any[] {
    const original = (exerciseLib as any[]).find(e => e.name === originalName);
    if (!original) return (exerciseLib as any[]).filter(e => e.name !== originalName);
    return (exerciseLib as any[])
      .filter(e => e.name !== originalName)
      .map(e => ({ ...e, _score: muscleScore(original, e) }))
      .sort((a, b) => b._score - a._score);
  }

  function applySubstitution(originalName: string, newName: string) {
    setSubstitutions(prev => ({ ...prev, [originalName]: newName }));
    setExerciseData(prev => {
      const existing = prev[originalName] ?? [{ weight: "", reps: "", notes: "" }];
      const next = { ...prev };
      delete next[originalName];
      next[newName] = existing;
      return next;
    });
    setSubPicker(null);
    setSubSearch("");
  }

  // ── Equipment presets ────────────────────────────────────────────────────────────────────────────────
  // PresetSelector sub-component handles all preset mutations internally
  const dailyLogMutation = trpc.dailyLog.upsert.useMutation();
  const saveMutation = trpc.workoutSessions.save.useMutation({
    onSuccess: () => {
      if (selectedDay) clearDraft(sessionDate, selectedDay);
      // Do NOT reset loadedRef.current here — resetting it causes the useEffect to re-run loadDay,
      // which can load a stale localStorage draft and wipe the in-memory set data.
      // The session is already saved; invalidating the query updates the cache in the background.
      utils.workoutSessions.list.invalidate();
      utils.dailyLog.list.invalidate();
      setSaving(false);
      setLastSaved(new Date());
      toast.success("Session saved!");
    },
    onError: () => { setSaving(false); toast.error("Failed to save session."); },
  });
  const deleteMutation = trpc.workoutSessions.delete.useMutation({
    onSuccess: () => { utils.workoutSessions.list.invalidate(); setDeleting(null); toast.success("Session deleted."); },
    onError: () => { setDeleting(null); toast.error("Failed to delete."); },
  });
  const updateDateMutation = trpc.workoutSessions.updateDate.useMutation({
    onSuccess: () => { utils.workoutSessions.list.invalidate(); setChangingDateId(null); toast.success("Session date updated."); },
    onError: () => { toast.error("Failed to update date."); },
  });

  // ── Load day ──────────────────────────────────────────────────────────────
  function loadDay(date: string, label: string) {
    const dayDef = days.find(d => d.label === label);

    const draft = readDraft(date, label);
    if (draft) {
      const migratedData: Record<string, Array<{ weight: string; reps: string; notes: string; completed: boolean }>> = {};
      for (const [k, sets] of Object.entries(draft.exerciseData ?? {})) {
        migratedData[k] = (sets as any[]).map((s: any) => ({ ...s, completed: s.completed ?? (s.weight !== '' || s.reps !== '') }));
      }
      setExerciseData(migratedData);
      setSessionNotes(draft.sessionNotes ?? '');
      setEquipmentDetails(draft.equipmentDetails ?? {});
      setMachinePreset(draft.machinePreset ?? {});
      setMachineSettings(draft.machineSettings ?? {});
      setExerciseNotes(draft.exerciseNotes ?? {});
      setSubstitutions(draft.substitutions ?? {});
      const persisted = loadCollapsed(date, label);
      const collapsed: Record<string, boolean> = {};
      for (const [exName, sets] of Object.entries(migratedData)) {
        const allDone = sets.length > 0 && sets.every(s => s.completed);
        collapsed[exName] = allDone ? (persisted[exName] ?? true) : false;
      }
      setCollapsedExercisesRaw(collapsed);
      return;
    }

    const existing = sessions.find(s => toLocalDateStr(s.sessionDate) === date && s.dayLabel === label);
    if (existing) {
      const exData: Record<string, Array<{ weight: string; reps: string; notes: string; completed: boolean }>> = {};
      const eqData: Record<string, string> = {};
      const mpData: Record<string, string> = {};
      const msData: Record<string, string> = {};
      const enData: Record<string, string> = {};
      const subData: Record<string, string> = {};
      for (const ex of (existing.exercises as any[])) {
        if (ex.substitutedFor) subData[ex.substitutedFor] = ex.name;
        exData[ex.name] = (ex.sets ?? []).map((s: any) => ({
          weight: s.weight != null ? String(s.weight) : '',
          reps: s.reps != null ? String(s.reps) : '',
          notes: s.notes ?? '',
          completed: s.completed ?? (s.weight != null || s.reps != null),
        }));
        if (ex.equipmentDetails) eqData[ex.name] = ex.equipmentDetails;
        if (ex.machinePreset) mpData[ex.name] = ex.machinePreset;
        if (ex.presetId) { setMachinePresetId(prev => ({ ...prev, [ex.name]: ex.presetId })); }
        if (ex.machineSettings) msData[ex.name] = ex.machineSettings;
        if (ex.exerciseNotes) enData[ex.name] = ex.exerciseNotes;
      }
      setExerciseData(exData);
      setEquipmentDetails(eqData);
      setMachinePreset(mpData);
      setMachineSettings(msData);
      setExerciseNotes(enData);
      setSubstitutions(subData);
      setSessionNotes((existing.notes as string) ?? '');
      const persisted = loadCollapsed(date, label);
      const defaultCollapsed: Record<string, boolean> = {};
      for (const ex of (existing.exercises as any[])) {
        const sets = exData[ex.name] ?? [];
        const allDone = sets.length > 0 && sets.every(s => s.completed);
        defaultCollapsed[ex.name] = allDone ? (persisted[ex.name] ?? true) : false;
      }
      setCollapsedExercisesRaw(defaultCollapsed);
      saveCollapsed(date, label, defaultCollapsed);
      return;
    }

    const blankEx: Record<string, Array<{ weight: string; reps: string; notes: string; completed: boolean }>> = {};
    for (const ex of (dayDef?.exercises ?? [])) {
      const setCount = Math.max(1, parseInt(String(ex.sets ?? 1), 10) || 1);
      blankEx[ex.name] = Array.from({ length: setCount }, () => ({ weight: '', reps: '', notes: '', completed: false }));
    }
    // Pre-populate equipment details from the most recent previous session for this day
    const prevForDay = [...sessions]
      .filter(s => s.dayLabel === label && toLocalDateStr(s.sessionDate) < date)
      .sort((a, b) => toLocalDateStr(b.sessionDate).localeCompare(toLocalDateStr(a.sessionDate)))[0];
    const prefillEquipment: Record<string, string> = {};
    const prefillMachinePreset: Record<string, string> = {};
    const prefillMachineSettings: Record<string, string> = {};
    if (prevForDay) {
      for (const ex of (prevForDay.exercises as any[])) {
        if (ex.equipmentDetails) prefillEquipment[ex.name] = ex.equipmentDetails;
        if (ex.machinePreset) prefillMachinePreset[ex.name] = ex.machinePreset;
        if (ex.machineSettings) prefillMachineSettings[ex.name] = ex.machineSettings;
      }
    }
    setExerciseData(blankEx);
    setSessionNotes('');
    setEquipmentDetails(prefillEquipment);
    setMachinePreset(prefillMachinePreset);
    setMachineSettings(prefillMachineSettings);
    setExerciseNotes({});
    setSubstitutions({});
    setCollapsedExercisesRaw(loadCollapsed(date, label));
  }

  function selectDay(label: string) {
    setSelectedDay(label);
    loadedRef.current = null;
  }

  useEffect(() => {
    if (!selectedDay || !sessionsLoaded) return;
    const combo = `${sessionDate}:${selectedDay}`;
    if (loadedRef.current === combo) return;
    loadedRef.current = combo;
    loadDay(sessionDate, selectedDay);
  }, [sessionDate, selectedDay, sessionsLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  function setSet(exName: string, idx: number, field: "weight" | "reps" | "notes", val: string) {
    setExerciseData(prev => {
      const sets = [...(prev[exName] ?? [{ weight: "", reps: "", notes: "", completed: false }])];
      const updated = { ...sets[idx], [field]: val };
      // Do NOT auto-complete on type — user must tap the tick button
      sets[idx] = updated;
      return { ...prev, [exName]: sets };
    });
  }

  function addSet(exName: string) {
    setExerciseData(prev => ({
      ...prev,
      [exName]: [...(prev[exName] ?? []), { weight: "", reps: "", notes: "", completed: false }],
    }));
  }

  function toggleSetCompleted(exName: string, idx: number) {
    setExerciseData(prev => {
      const sets = [...(prev[exName] ?? [])];
      sets[idx] = { ...sets[idx], completed: !sets[idx].completed };
      return { ...prev, [exName]: sets };
    });
  }

  function removeSet(exName: string, idx: number) {
    setExerciseData(prev => {
      const sets = (prev[exName] ?? []).filter((_, i) => i !== idx);
      return { ...prev, [exName]: sets.length ? sets : [{ weight: "", reps: "", notes: "", completed: false }] };
    });
  }

  function handleSave() {
    if (!selectedDay) return;
    setSaving(true);
    const dayDef = days.find(d => d.label === selectedDay);
    const exercises = (dayDef?.exercises ?? []).map(ex => {
      const subName = substitutions[ex.name];
      const nameToUse = subName ?? ex.name;
      return {
        name: nameToUse,
        substitutedFor: subName ? ex.name : undefined,
        equipmentDetails: equipmentDetails[nameToUse] || null,
        machinePreset: machinePreset[nameToUse] || null,
        presetId: machinePresetId[nameToUse] || null,
        machineSettings: machineSettings[nameToUse] || null,
        exerciseNotes: exerciseNotes[nameToUse] || null,
        sets: (exerciseData[nameToUse] ?? []).map(s => ({
          weight: s.weight !== "" ? parseFloat(s.weight) : null,
          reps: s.reps !== "" ? parseInt(s.reps) : null,
          notes: s.notes || null,
          completed: s.completed || s.weight !== "" || s.reps !== "",
        })),
      };
    });
    saveMutation.mutate({ sessionDate, dayLabel: selectedDay, exercises, notes: sessionNotes || null });
  }

  const inputCls = "bg-secondary border border-border rounded-lg px-2 py-3 text-base text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary w-full";

  return (
    <div className="space-y-4">
      {/* ── Compact session starter ─────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-4 border-l-4 border-l-primary">
        {/* Row 1: date button + day pills */}
        <div className="flex items-center gap-2 mb-3">
          <div className="relative flex-shrink-0">
            <button
              onClick={() => (document.getElementById('log-date-input') as HTMLInputElement)?.showPicker?.()}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
            >
              <Calendar size={14} />
              <span>{(() => { const d = new Date(sessionDate + 'T12:00:00Z'); return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }); })()}</span>
            </button>
            <input
              id="log-date-input"
              type="date"
              value={sessionDate}
              onChange={v => { setSessionDate(v.target.value); setSelectedDay(null); }}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            />
          </div>
          {days.length === 0 ? (
            <p className="text-xs text-muted-foreground">No program assigned</p>
          ) : (
            <div className="flex gap-1.5 flex-wrap">
              {days.map(d => (
                <button
                  key={d.label}
                  onClick={() => selectDay(d.label)}
                  className={`w-9 h-9 rounded-lg text-sm font-semibold transition-colors ${
                    selectedDay === d.label
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Row 2: Start Session CTA (only when day selected) */}
        {selectedDay && (
          <button
            onClick={() => { window.scrollTo({ top: 200, behavior: 'smooth' }); }}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Session {selectedDay} ↓
          </button>
        )}
      </div>

      {selectedDay && (() => {
        const dayDef = days.find(d => d.label === selectedDay);

        // All past sessions for this day, newest first
        const pastSessions = [...sessions]
          .filter(s => s.dayLabel === selectedDay && toLocalDateStr(s.sessionDate) < sessionDate)
          .sort((a, b) => toLocalDateStr(b.sessionDate).localeCompare(toLocalDateStr(a.sessionDate)));
        // For last-performance we look up per exercise name across all past sessions.
        // A substitution's sets should NOT count as last performance for the original exercise
        // (different movement / load range). We only record an entry for the name under which
        // the exercise was actually performed (ex.name), never under ex.substitutedFor.
        const prevExMap: Record<string, Array<{ weight: number | null; reps: number | null }>> = {};
        const prevMachinePresetMap: Record<string, string> = {};
        for (const s of pastSessions) {
          for (const ex of (s.exercises as any[])) {
            // Only record the first (most recent) occurrence that has actual set data.
            // Skip sessions where the exercise was present but no sets were logged,
            // so the lookback continues to find the last session with real numbers.
            if (!(ex.name in prevExMap)) {
              const filteredSets = (ex.sets ?? []).filter((set: any) => set.weight != null || set.reps != null);
              if (filteredSets.length > 0) {
                prevExMap[ex.name] = filteredSets;
                // Record the preset from the SAME session as the performance data
                const preset = ex.machinePreset || ex.equipmentDetails || null;
                if (preset) prevMachinePresetMap[ex.name] = preset;
              }
            }
          }
        }
        // Keep a reference to the single most recent session for prev-note lookups
        const prevSession = pastSessions[0] ?? null;

        const totalExercises = (dayDef?.exercises ?? []).length;
        const completedExercises = (dayDef?.exercises ?? []).filter(ex => {
          const subName = substitutions[ex.name];
          const displayName = subName ?? ex.name;
          const sets = exerciseData[displayName] ?? [];
          return sets.length > 0 && sets.every(s => s.completed);
        }).length;
        const progressPct = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0;

        return (
          <div className="space-y-3 pb-24">
            {/* Session progress bar */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground flex-shrink-0">{completedExercises}/{totalExercises}</span>
            </div>
            {(dayDef?.exercises ?? []).map((ex, i) => {
              const subName = substitutions[ex.name];
              const displayName = subName ?? ex.name;
              const sets = exerciseData[displayName] ?? [{ weight: "", reps: "", notes: "" }];
              const isCollapsed = collapsedExercises[displayName] ?? false;
              // When a substitution is active, only look up by the sub name.
              // Never fall back to the original exercise's last performance — different movement.
              const prevSets = subName
                ? (prevExMap[displayName] ?? [])
                : (prevExMap[ex.name] ?? []);
              const exVideoUrl = videoMap[displayName] ?? videoMap[ex.name];
              const exEmbedUrl = exVideoUrl ? getYouTubeEmbedUrl(exVideoUrl) : null;
              const currentPreset = machinePreset[displayName] ?? "";
              const currentSettings = machineSettings[displayName] ?? "";
              const hasEquipment = !!(equipmentDetails[displayName]?.trim()) || !!currentPreset;
              // Field is open if: has preset/text (always show) OR explicitly opened via button
              const isEquipmentOpen = hasEquipment || (!!equipmentOpen[displayName] && !isCollapsed);
              return (
                <Card key={displayName}>
                  <div
                    onClick={() => toggleExerciseCollapse(displayName)}
                    className="w-full mb-3 text-left cursor-pointer"
                  >
                    {/* Header row: name + chevron */}
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-base font-semibold text-foreground leading-snug">{displayName}</p>
                          {subName && (
                            <span className="text-[10px] font-semibold bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded">SUB</span>
                          )}
                          {exEmbedUrl && (
                            <button
                              onClick={e => { e.stopPropagation(); setVideoModal({ name: displayName, embedUrl: exEmbedUrl }); }}
                              title="Demo video"
                              className="flex items-center gap-1 text-[10px] font-semibold text-red-400 hover:text-red-300 transition-colors bg-red-400/10 px-1.5 py-0.5 rounded"
                            >
                              <Play size={10} fill="currentColor" /> Demo
                            </button>
                          )}
                        </div>
                        {/* Machine preset chip */}
                        {currentPreset ? (
                          <button
                            onClick={e => { e.stopPropagation(); setEquipmentOpen(prev => ({ ...prev, [displayName]: !prev[displayName] })); }}
                            className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[11px] text-primary/80 hover:bg-primary/20 transition-colors"
                          >
                            {currentPreset}
                          </button>
                        ) : (
                          !isCollapsed && (
                            <button
                              onClick={e => { e.stopPropagation(); setEquipmentOpen(prev => ({ ...prev, [displayName]: true })); }}
                              className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-secondary border border-border text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Add machine
                            </button>
                          )
                        )}
                        {subName && (
                          <p className="text-xs text-muted-foreground mt-0.5">Substituting: {ex.name}</p>
                        )}
                      </div>
                      <ChevronDown size={16} className={`text-muted-foreground transition-transform flex-shrink-0 mt-1 ${isCollapsed ? '' : 'rotate-180'}`} />
                    </div>
                    {/* Meta row: sets×reps target + action buttons */}
                    {!isCollapsed && (
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <div className="min-w-0">
                          {ex.notes && !subName && <p className="text-xs text-muted-foreground mb-0.5">{ex.notes}</p>}
                          <p className="text-sm font-medium text-foreground/70">{ex.sets} sets × {ex.reps}</p>
                          {(() => {
                            const prevNote = prevSession?.exercises && (prevSession.exercises as any[]).find((e: any) => e.name === displayName || e.name === ex.name)?.exerciseNotes;
                            if (!prevNote) return null;
                            const isNoteOpen = !!prevNoteOpen[displayName];
                            return (
                              <>
                                <button
                                  onClick={e => { e.stopPropagation(); setPrevNoteOpen(prev => ({ ...prev, [displayName]: !prev[displayName] })); }}
                                  className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                >
                                  Prev note {isNoteOpen ? '↑' : '↓'}
                                </button>
                                {isNoteOpen && (
                                  <p className="text-xs text-muted-foreground/70 italic mt-0.5">{prevNote}</p>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <button
                            onClick={e => { e.stopPropagation(); setHistorySheet(displayName); }}
                            title="Exercise history"
                            className="flex items-center justify-center w-9 h-9 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <History size={15} />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setSubPicker({ originalName: ex.name }); setSubSearch(""); }}
                            title="Substitute exercise"
                            className="flex items-center justify-center w-9 h-9 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Shuffle size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {isCollapsed && sets.length > 0 && sets.every(s => s.completed) && (
                    <p className="text-xs font-semibold tracking-widest text-green-500 text-left pt-0 pb-1">COMPLETE</p>
                  )}
                  {isCollapsed && sets.length > 0 && !sets.every(s => s.completed) && (() => {
                    const completedCount = sets.filter(s => s.completed).length;
                    return (
                      <p className="text-xs font-semibold tracking-widest text-amber-400/80 text-left pt-0 pb-1">
                        {completedCount === 0 ? 'INCOMPLETE' : `${completedCount}/${sets.length} SETS`}
                      </p>
                    );
                  })()}

                  {!isCollapsed && (<>
                    {isEquipmentOpen && (
                      <PresetSelector
                        exerciseName={displayName}
                        currentPreset={currentPreset}
                        currentSettings={currentSettings}
                        isAddingNew={newPresetInput[displayName] !== undefined}
                        newPresetValue={newPresetInput[displayName] ?? ""}
                        onSelectPreset={(presetName, lastSettings, presetId) => {
                          setMachinePreset(prev => ({ ...prev, [displayName]: presetName }));
                          if (presetId) setMachinePresetId(prev => ({ ...prev, [displayName]: presetId }));
                          if (lastSettings != null) setMachineSettings(prev => ({ ...prev, [displayName]: lastSettings }));
                        }}
                        onStartAddNew={() => setNewPresetInput(prev => ({ ...prev, [displayName]: "" }))}
                        onNewPresetChange={val => setNewPresetInput(prev => ({ ...prev, [displayName]: val }))}
                        onSaveNewPreset={name => {
                          // upsert is called inside PresetSelector; here we just update local state
                          setMachinePreset(prev => ({ ...prev, [displayName]: name }));
                          setMachineSettings(prev => ({ ...prev, [displayName]: "" }));
                          setNewPresetInput(prev => { const n = { ...prev }; delete n[displayName]; return n; });
                        }}
                        onCancelAddNew={() => setNewPresetInput(prev => { const n = { ...prev }; delete n[displayName]; return n; })}
                        onSettingsChange={val => setMachineSettings(prev => ({ ...prev, [displayName]: val }))}
                        onSettingsBlur={_val => { /* upsert handled inside PresetSelector */ }}
                        onDeletePreset={(_id, presetName) => {
                          // If the deleted preset was selected, clear it
                          if (machinePreset[displayName] === presetName) {
                            setMachinePreset(prev => { const n = { ...prev }; delete n[displayName]; return n; });
                            setMachineSettings(prev => { const n = { ...prev }; delete n[displayName]; return n; });
                          }
                        }}
                      />
                    )}

                    {sets.length > 0 && (
                      <div className="mb-2">
                        {/* Column headers + Last session hint */}
                        {(() => {
                          const firstPrevW = prevSets[0]?.weight;
                          const firstPrevR = prevSets[0]?.reps;
                          return (
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-9 flex-shrink-0" />
                              <div className="flex-1 text-center">
                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Weight</p>
                                {firstPrevW != null && <p className="text-[10px] text-muted-foreground/50">Last: {firstPrevW}</p>}
                              </div>
                              <div className="flex-1 text-center">
                                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">reps</p>
                                {firstPrevR != null && <p className="text-[10px] text-muted-foreground/50">Last: {firstPrevR}</p>}
                              </div>
                              <div className="w-6 flex-shrink-0" />
                            </div>
                          );
                        })()}
                        <div className="space-y-2.5">
                          {sets.map((s, idx) => {
                            const prevW = prevSets[idx]?.weight;
                            const prevR = prevSets[idx]?.reps;
                            return (
                              <div key={idx} className="space-y-1">
                                <div className="flex items-center gap-2">
                                  {/* Tick button — large */}
                                  <button
                                    onClick={() => toggleSetCompleted(displayName, idx)}
                                    className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg border-2 transition-all ${
                                      s.completed
                                        ? "border-green-500 bg-green-500/20 text-green-400"
                                        : "border-border text-transparent hover:border-primary/60"
                                    }`}
                                  >
                                    <Check size={15} />
                                  </button>
                                  {/* Weight input */}
                                  <div className="flex-1">
                                    <input
                                      type="number" inputMode="decimal"
                                      value={s.weight ?? ""}
                                      onChange={e => setSet(displayName, idx, "weight", e.target.value)}
                                      onWheel={e => (e.target as HTMLInputElement).blur()}
                                      placeholder={prevW != null ? String(prevW) : ""}
                                      className={`w-full bg-input border border-border rounded-lg px-2 py-2 text-base font-semibold text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
                                        s.completed ? "opacity-50" : ""
                                      }`}
                                    />
                                  </div>
                                  {/* Reps input */}
                                  <div className="flex-1">
                                    <input
                                      type="number" inputMode="numeric"
                                      value={s.reps ?? ""}
                                      onChange={e => setSet(displayName, idx, "reps", e.target.value)}
                                      onWheel={e => (e.target as HTMLInputElement).blur()}
                                      placeholder={prevR != null ? String(prevR) : ""}
                                      className={`w-full bg-input border border-border rounded-lg px-2 py-2 text-base font-semibold text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
                                        s.completed ? "opacity-50" : ""
                                      }`}
                                    />
                                  </div>
                                  {/* Remove set */}
                                  {sets.length > 1 ? (
                                    <button onClick={() => removeSet(displayName, idx)} className="w-6 flex-shrink-0 flex items-center justify-center text-muted-foreground/50 hover:text-destructive transition-colors">
                                      <Minus size={14} />
                                    </button>
                                  ) : (
                                    <div className="w-6 flex-shrink-0" />
                                  )}
                                </div>

                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => addSet(displayName)}
                      className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors mt-1"
                    >
                      <Plus size={13} /> Add Set
                    </button>

                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1.5">Exercise notes</p>
                      <input
                        type="text"
                        value={exerciseNotes[displayName] ?? ""}
                        onChange={e => setExerciseNotes(prev => ({ ...prev, [displayName]: e.target.value }))}
                        className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  </>)}
                </Card>
              );
            })}

            <Card>
              <SectionLabel>Session Notes</SectionLabel>
              <textarea
                value={sessionNotes}
                onChange={e => setSessionNotes(e.target.value)}
                rows={3}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-3 text-base text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </Card>

            {/* Sticky save button rendered via portal-like fixed positioning */}
            {!viewAsUserId && (
              <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2 pointer-events-none">
                <div className="max-w-lg mx-auto pointer-events-auto">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-4 bg-primary text-primary-foreground font-bold text-base rounded-2xl shadow-2xl hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {saving ? "Saving..." : `Save Session ${selectedDay}`}
                  </button>
                  {lastSaved && (
                    <p className="text-center text-xs text-muted-foreground mt-1">
                      Last saved: {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Substitution picker modal */}
      {subPicker && (() => {
        const similar = getSimilarExercises(subPicker.originalName);
        const filtered = subSearch.trim()
          ? similar.filter(e => e.name.toLowerCase().includes(subSearch.toLowerCase()))
          : similar;
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70" onClick={() => setSubPicker(null)}>
            <div className="bg-card rounded-t-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">Substitute Exercise</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Replacing: {subPicker.originalName}</p>
                </div>
                <button onClick={() => setSubPicker(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
              </div>
              <div className="px-4 pb-2">
                <input
                  type="text"
                  value={subSearch}
                  onChange={e => setSubSearch(e.target.value)}
                  placeholder="Search exercises..."
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-1">
                {filtered.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">No exercises found</p>
                )}
                {filtered.map((e: any) => {
                  const primaryMuscle = ([
                    ["chest","Chest"],["frontDelts","Front Delts"],["sideDelts","Side Delts"],["triceps","Triceps"],
                    ["lats","Lats"],["upperBack","Upper Back"],["rearDelts","Rear Delts"],["biceps","Biceps"],
                    ["quads","Quads"],["hams","Hamstrings"],["glutes","Glute Max"],["gluteMed","Glute Med"],["calves","Calves"],["abs","Abs"]
                  ] as [string, string][]).reduce<[number, string]>((best, [k, label]) =>
                    (e[k] ?? 0) > best[0] ? [(e[k] ?? 0) as number, label] : best, [0, ""]
                  )[1];
                  const isCurrentSub = substitutions[subPicker.originalName] === e.name;
                  return (
                    <button
                      key={e.id}
                      onClick={() => applySubstitution(subPicker.originalName, e.name)}
                      className={`w-full flex items-center justify-between px-3 py-3 rounded-lg text-left transition-colors ${
                        isCurrentSub ? "bg-primary/15 border border-primary/30" : "bg-secondary hover:bg-secondary/70"
                      }`}
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{e.name}</p>
                        {primaryMuscle && <p className="text-xs text-muted-foreground mt-0.5">{primaryMuscle}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {e._score >= 1 && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-500/15 text-green-400">
                            Recommended
                          </span>
                        )}
                        {isCurrentSub && <Check size={14} className="text-primary" />}
                      </div>
                    </button>
                  );
                })}
              </div>
              {substitutions[subPicker.originalName] && (
                <div className="px-4 pb-4 border-t border-border pt-3">
                  <button
                    onClick={() => {
                      const origName = subPicker.originalName;
                      const subName = substitutions[origName];
                      if (subName) {
                        setSubstitutions(prev => { const n = { ...prev }; delete n[origName]; return n; });
                        setExerciseData(prev => {
                          const existing = prev[subName] ?? [{ weight: "", reps: "", notes: "", completed: false }];
                          const next = { ...prev };
                          delete next[subName];
                          next[origName] = existing;
                          return next;
                        });
                      }
                      setSubPicker(null);
                    }}
                    className="w-full py-2.5 text-sm text-muted-foreground hover:text-destructive transition-colors"
                  >
                    Remove substitution (use original)
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Exercise history sheet */}
      <Sheet open={!!historySheet} onOpenChange={open => { if (!open) setHistorySheet(null); }}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base">{historySheet} — History</SheetTitle>
          </SheetHeader>
          {(() => {
            if (!historySheet) return null;
            const exName = historySheet;
            const pastSessions = [...sessions]
              .filter(s => (s.exercises as any[]).some((e: any) => e.name === exName))
              .sort((a, b) => toLocalDateStr(b.sessionDate).localeCompare(toLocalDateStr(a.sessionDate)));
            if (pastSessions.length === 0) return (
              <p className="text-sm text-muted-foreground text-center py-8">No history yet for this exercise.</p>
            );
            return (
              <div className="space-y-3 pb-4">
                {pastSessions.map(s => {
                  const exEntry = (s.exercises as any[]).find((e: any) => e.name === exName);
                  if (!exEntry) return null;
                  const completedSets = (exEntry.sets ?? []).filter((st: any) => st.weight != null || st.reps != null);
                  const dateStr = (() => { const d = new Date(toLocalDateStr(s.sessionDate) + 'T12:00:00Z'); return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); })();
                  return (
                    <div key={s.id} className="bg-secondary rounded-xl px-4 py-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-foreground">{dateStr}</p>
                        <span className="text-[10px] font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded flex-shrink-0">Day {s.dayLabel}</span>
                      </div>
                      {(exEntry.machinePreset || exEntry.equipmentDetails) && (
                        <p className="text-xs text-muted-foreground">{exEntry.machinePreset ?? exEntry.equipmentDetails}</p>
                      )}
                      {exEntry.machineSettings && (
                        <p className="text-xs text-muted-foreground"><span className="text-foreground/60">Settings:</span> {exEntry.machineSettings}</p>
                      )}
                      {completedSets.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {completedSets.map((st: any, idx: number) => (
                            <span key={idx} className="text-xs bg-card border border-border rounded-lg px-2 py-1 text-foreground">
                              {st.weight != null ? `${st.weight}kg` : '—'} × {st.reps != null ? st.reps : '—'}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">No sets recorded</p>
                      )}
                      {exEntry.exerciseNotes && (
                        <p className="text-xs text-muted-foreground italic mt-1">"{exEntry.exerciseNotes}"</p>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Video modal */}
      {videoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setVideoModal(null)}>
          <div className="bg-card rounded-xl overflow-hidden w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground">{videoModal.name}</p>
              <button onClick={() => setVideoModal(null)} className="text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div className="aspect-video">
              <iframe
                src={videoModal.embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={videoModal.name}
              />
            </div>
          </div>
        </div>
      )}

      {/* Past sessions ─ accordion timeline */}
      {sessions.length > 0 && (
        <PastSessionsList
          sessions={sessions}
          viewAsUserId={viewAsUserId}
          deleting={deleting}
          changingDateId={changingDateId}
          newDateVal={newDateVal}
          updateDatePending={updateDateMutation.isPending}
          onEdit={(s) => { setSessionDate(toLocalDateStr(s.sessionDate)); selectDay(s.dayLabel); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          onChangeDate={(id, val) => { setChangingDateId(id); setNewDateVal(val); }}
          onSaveDate={(id) => { if (newDateVal) updateDateMutation.mutate({ id, sessionDate: newDateVal }); }}
          onCancelDate={() => setChangingDateId(null)}
          onNewDateVal={setNewDateVal}
          onDelete={(id) => { if (confirm('Delete this session?')) { setDeleting(id); deleteMutation.mutate({ id }); } }}
        />
      )}
    </div>
  );
}

// ─── CombinedTrainingTab ──────────────────────────────────────────────────────
export default function CombinedTrainingTab({ defaultSub = "program" }: { defaultSub?: "program" | "log" }) {
  const [sub, setSub] = useState<"program" | "log">(() => {
    try {
      const stored = sessionStorage.getItem('trainingTab:sub') as "program" | "log" | null;
      return stored ?? defaultSub;
    } catch { return defaultSub; }
  });
  useEffect(() => {
    try { sessionStorage.setItem('trainingTab:sub', sub); } catch {}
  }, [sub]);
  return (
    <div>
      <div className="flex gap-1 mb-6 bg-secondary rounded-lg p-1 w-fit">
        {(["program", "log"] as const).map(s => (
          <button
            key={s}
            onClick={() => setSub(s)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              sub === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "program" ? "Program" : "Log"}
          </button>
        ))}
      </div>
      {sub === "program" ? <TrainingTab /> : <WorkoutLogTab />}
    </div>
  );
}
