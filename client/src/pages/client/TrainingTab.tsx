import { trpc } from "@/lib/trpc";
import { useState, useEffect, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useViewAs } from "@/contexts/ViewAsContext";
import { Check, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Play, X, Plus, Minus, Trash2, Shuffle, Settings, History, Pencil, CalendarIcon, BarChart2 } from "lucide-react";
import { MdBolt } from "react-icons/md";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";
import { toUTCDateStr as toLocalDateStr } from "@/lib/dates";
import { SectionLabel, Card, DateInput } from "./shared";

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Parse a sets string like "3", "2-4", "2–4" into {min, max}. */
function parseSetsRange(s: string): { min: number; max: number } {
  if (!s) return { min: 0, max: 0 };
  const norm = s.replace(/–/g, "-").trim();
  const parts = norm.split("-").map(p => parseFloat(p.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return { min: parts[0], max: parts[1] };
  const single = parseFloat(norm);
  if (!isNaN(single)) return { min: single, max: single };
  return { min: 0, max: 0 };
}
function formatSetsRange(s: string): string {
  const { min, max } = parseSetsRange(s);
  if (max === 0) return s || "—";
  return min === max ? String(max) : `${min}–${max}`;
}
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
  const days = (program?.days as any[]) ?? [];
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());
  // Expand all days once program loads
  useEffect(() => {
    if (days.length > 0) setExpandedDays(new Set(days.map((_: any, i: number) => i)));
  }, [days.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [videoModal, setVideoModal] = useState<{ name: string; embedUrl: string } | null>(null);
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
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3">Training Schedule</p>
          <div className="flex flex-wrap gap-1.5 items-center">
            {schedule.map((slot: string, i: number) => {
              const isOff = slot === "Off";
              const label = isOff ? "OFF" : slot;
              const isLong = label.length > 3;
              return (
                <span
                  key={i}
                  className={`inline-flex items-center justify-center rounded-lg font-semibold ${
                    isLong ? "text-[10px] px-2 py-1.5" : "text-sm px-3 py-1.5"
                  } ${
                    isOff
                      ? "bg-secondary text-muted-foreground"
                      : "bg-primary/10 text-primary border border-primary/20"
                  }`}
                >
                  {label}
                </span>
              );
            })}
            <span className="text-xs text-muted-foreground/40 ml-0.5">→ repeat</span>
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
            onClick={() => setExpandedDays(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; })}
            className="w-full flex items-center justify-between"
          >
            <div className="text-left">
              <p className="text-sm font-semibold text-foreground">{day.name ?? `Day ${i + 1}`}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{(day.exercises ?? []).length} exercises</span>
              {expandedDays.has(i) ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
            </div>
          </button>

          {expandedDays.has(i) && (
            <div className="mt-4">
              {/* Header row */}
              <div className="flex items-center px-1 mb-1">
                <p className="flex-1 text-[10px] text-muted-foreground uppercase tracking-wider">Exercise</p>
                <p className="w-10 text-[10px] text-muted-foreground uppercase tracking-wider text-center">Sets</p>
                <p className="w-14 text-[10px] text-muted-foreground uppercase tracking-wider text-center">Reps</p>
              </div>
              {(day.exercises ?? []).map((ex: any, j: number) => {
                const videoUrl = videoMap[ex.name];
                const embedUrl = videoUrl ? getYouTubeEmbedUrl(videoUrl) : null;
                return (
                  <div key={j} className="border-t border-border">
                    <div className="flex items-center py-2.5 gap-2">
                      {/* Exercise name + optional video button */}
                      <div className="flex-1 flex items-center gap-1.5 min-w-0">
                        <p className="text-sm text-foreground leading-snug">{ex.name}</p>
                        {embedUrl && (
                          <button
                            onClick={() => setVideoModal({ name: ex.name, embedUrl })}
                            className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                            title="Watch demo"
                          >
                            <Play size={9} />
                          </button>
                        )}
                      </div>
                      {/* Sets */}
                      <p className="w-10 text-sm text-foreground text-center flex-shrink-0">{ex.sets}</p>
                      {/* Reps */}
                      <p className="w-14 text-sm text-foreground text-center flex-shrink-0">{ex.reps}</p>
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
            className="relative bg-card rounded-xl overflow-hidden shadow-2xl w-full max-w-xs"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground truncate pr-2">{videoModal.name}</p>
              <button onClick={() => setVideoModal(null)} className="flex-shrink-0 text-muted-foreground hover:text-foreground"><X size={16} /></button>
            </div>
            <div style={{ aspectRatio: '9/16' }} className="w-full">
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
  popoverOpen: boolean;
  onPopoverOpenChange: (open: boolean) => void;
  onSelectPreset: (presetName: string, lastSettings: string | null, presetId?: number) => void;
  onDeletePreset: (id: number, presetName: string) => void;
  onSettingsChange: (val: string) => void;
  onSettingsBlur: (val: string) => void;
}

function PresetSelector({
  exerciseName, currentPreset, currentSettings,
  popoverOpen, onPopoverOpenChange,
  onSelectPreset, onDeletePreset, onSettingsChange, onSettingsBlur,
}: PresetSelectorProps) {
  const utils = trpc.useUtils();
  const { data: presetList = [] } = trpc.equipmentPresets.list.useQuery(
    { exerciseName },
    { staleTime: 30_000, enabled: popoverOpen }
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
      if (currentPreset === renamingFrom) onSelectPreset(vars.newName, currentSettings || null);
      setRenamingId(null); setRenamingFrom(""); setRenameValue("");
    },
  });

  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renamingFrom, setRenamingFrom] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  const handleSettingsBlur = (val: string) => {
    if (currentPreset) upsertMutation.mutate({ exerciseName, presetName: currentPreset, lastSettings: val });
    onSettingsBlur(val);
  };

  const handlePickPreset = (preset: any) => {
    onSelectPreset(preset.presetName, preset.lastSettings ?? null, preset.id);
  };

  const handleDeletePreset = (preset: any) => {
    if (confirm(`Delete "${preset.presetName}"?`)) {
      onDeletePreset(preset.id, preset.presetName);
      deleteMutation.mutate({ id: preset.id });
    }
  };

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (!trimmed || !renamingId) { setRenamingId(null); return; }
    renameMutation.mutate({ id: renamingId, newName: trimmed });
  };

  const saveNewPreset = () => {
    const name = newName.trim();
    if (!name) return;
    upsertMutation.mutate({ exerciseName, presetName: name });
    onSelectPreset(name, null);
    setAddingNew(false);
    setNewName("");
  };

  const closeSheet = () => { onPopoverOpenChange(false); setAddingNew(false); setNewName(""); setRenamingId(null); };

  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); onPopoverOpenChange(true); }}
        className={`inline-flex items-center px-3 py-1 rounded-full border text-xs transition-colors ${
          currentPreset
            ? "bg-primary/10 border-primary/20 text-primary/80 hover:bg-primary/20"
            : "bg-secondary border-border text-muted-foreground hover:text-foreground"
        }`}
      >
        {currentPreset || "Add machine"}
      </button>

      <Sheet open={popoverOpen} onOpenChange={open => { if (!open) closeSheet(); }}>
        <SheetContent
          side="bottom"
          className="h-[85vh] p-0 flex flex-col rounded-t-2xl bg-[#141414] border-t border-border"
          onClick={e => e.stopPropagation()}
          hideCloseButton
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <div>
              <SheetTitle className="text-base font-semibold text-foreground">Machine Setup</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{exerciseName}</p>
            </div>
            <button onClick={closeSheet} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Machine list */}
          <div className="flex-1 overflow-y-auto">
            {(presetList as any[]).length === 0 && !addingNew && (
              <p className="px-5 py-8 text-sm text-muted-foreground text-center">No machines saved yet.<br/><span className="text-xs">Tap "Add machine" below to get started.</span></p>
            )}
            {(presetList as any[]).map((p: any) => (
              <div key={p.id}>
                {renamingId === p.id ? (
                  <div className="flex items-center gap-3 px-5 py-4 border-b border-border/40">
                    <input
                      autoFocus
                      type="text"
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingId(null); }}
                      className="flex-1 bg-secondary border border-border rounded-lg px-4 py-3 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <button onClick={commitRename} className="p-3 text-primary"><Check size={18} /></button>
                    <button onClick={() => setRenamingId(null)} className="p-3 text-muted-foreground"><X size={18} /></button>
                  </div>
                ) : (
                  <div
                    className={`flex items-center gap-3 px-5 py-4 border-b border-border/40 cursor-pointer transition-colors active:bg-white/5 ${
                      currentPreset === p.presetName ? "bg-primary/10" : ""
                    }`}
                    onClick={() => { handlePickPreset(p); closeSheet(); }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className={`text-base ${ currentPreset === p.presetName ? "text-primary font-semibold" : "text-foreground" }`}>{p.presetName}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {currentPreset === p.presetName && <Check size={16} className="text-primary mr-1" />}
                      <button
                        onClick={e => { e.stopPropagation(); setRenamingId(p.id); setRenamingFrom(p.presetName); setRenameValue(p.presetName); }}
                        className="p-3 rounded-lg text-muted-foreground hover:text-foreground active:bg-white/10 transition-colors"
                        title="Rename"
                      ><Pencil size={17} /></button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDeletePreset(p); }}
                        className="p-3 rounded-lg text-muted-foreground hover:text-red-400 active:bg-white/10 transition-colors"
                        title="Delete"
                      ><Trash2 size={17} /></button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Setup field for selected preset */}
          {currentPreset && (
            <div className="px-5 py-4 border-t border-border/40 flex-shrink-0">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Setup notes</p>
              <input
                type="text"
                value={currentSettings}
                onChange={e => onSettingsChange(e.target.value)}
                onBlur={e => handleSettingsBlur(e.target.value)}
                placeholder="e.g. Seat 3, pin 8"
                className="w-full bg-secondary border border-border rounded-xl px-4 py-3.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          )}

          {/* Add new machine */}
          <div className="border-t border-border/40 flex-shrink-0 pb-safe">
            {addingNew ? (
              <div className="flex items-center gap-3 px-5 py-4">
                <input
                  ref={addInputRef}
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveNewPreset(); if (e.key === "Escape") { setAddingNew(false); setNewName(""); } }}
                  placeholder="Machine name…"
                  className="flex-1 bg-secondary border border-border rounded-xl px-4 py-3.5 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button onClick={saveNewPreset} className="p-3 text-primary"><Check size={18} /></button>
                <button onClick={() => { setAddingNew(false); setNewName(""); }} className="p-3 text-muted-foreground"><X size={18} /></button>
              </div>
            ) : (
              <button
                className="w-full flex items-center justify-center gap-2 px-5 py-5 text-primary text-base font-medium active:bg-white/5 transition-colors"
                onClick={() => { setAddingNew(true); setTimeout(() => addInputRef.current?.focus(), 100); }}
              >
                <Plus size={18} />
                Add machine
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

// ─── MonthlyVolumePanel ─────────────────────────────────────────────────────
const MUSCLE_KEYS_ORDERED = [
  { key: "quads",      label: "Quads" },
  { key: "hams",       label: "Hams" },
  { key: "glutes",     label: "Glute Max" },
  { key: "gluteMed",   label: "Glute Med" },
  { key: "chest",      label: "Chest" },
  { key: "lats",       label: "Lats" },
  { key: "upperBack",  label: "Upper Back" },
  { key: "frontDelts", label: "Front Delts" },
  { key: "sideDelts",  label: "Side Delts" },
  { key: "rearDelts",  label: "Rear Delts" },
  { key: "biceps",     label: "Biceps" },
  { key: "triceps",    label: "Triceps" },
  { key: "calves",     label: "Calves" },
  { key: "abs",        label: "Abs" },
] as const;

type MKey = typeof MUSCLE_KEYS_ORDERED[number]["key"];

function computeMonthlyVolume(
  sessions: any[],
  exerciseLib: any[],
  year: number,
  month: number // 0-based
): { totals: Record<MKey, number>; weeklyAvg: Record<MKey, number>; sessionCount: number } {
  const exMap: Record<string, any> = {};
  for (const ex of exerciseLib) exMap[ex.name] = ex;

  const totals: Record<string, number> = {};
  for (const mg of MUSCLE_KEYS_ORDERED) totals[mg.key] = 0;

  // Filter sessions to the selected month
  const monthSessions = sessions.filter(s => {
    const d = new Date(String(s.sessionDate).slice(0, 10) + 'T12:00:00Z');
    return d.getFullYear() === year && d.getMonth() === month;
  });

  for (const session of monthSessions) {
    for (const ex of (session.exercises as any[])) {
      const libEx = exMap[ex.name];
      if (!libEx) continue;
      // Count only completed/logged sets
      const completedSets = (ex.sets ?? []).filter(
        (st: any) => st.completed || st.weight != null || st.reps != null
      );
      // For rest-pause: activation set counts as 1, then every 2 mini-sets = 1 extra set
      let setCount = 0;
      for (const st of completedSets) {
        if (st.myoReps) {
          const mini = parseInt(st.miniSets || '0') || 0;
          setCount += 1 + Math.floor(mini / 2);
        } else {
          setCount += 1;
        }
      }
      if (setCount === 0) continue;
      // Distribute sets across muscle groups by contribution
      for (const mg of MUSCLE_KEYS_ORDERED) {
        const contrib = (libEx[mg.key] ?? 0) as number;
        if (contrib > 0) {
          totals[mg.key] = (totals[mg.key] ?? 0) + setCount * contrib;
        }
      }
    }
  }

  // Round totals
  for (const mg of MUSCLE_KEYS_ORDERED) {
    totals[mg.key] = Math.round(totals[mg.key]);
  }

  // Weekly average: number of weeks that had at least one session
  const weekNums = new Set<number>();
  for (const s of monthSessions) {
    const d = new Date(String(s.sessionDate).slice(0, 10) + 'T12:00:00Z');
    // ISO week within the month — use day-of-month / 7 bucket
    weekNums.add(Math.floor((d.getDate() - 1) / 7));
  }
  const weeksWithSessions = Math.max(weekNums.size, 1);

  const weeklyAvg: Record<string, number> = {};
  for (const mg of MUSCLE_KEYS_ORDERED) {
    weeklyAvg[mg.key] = Math.round((totals[mg.key] / weeksWithSessions) * 10) / 10;
  }

  return { totals: totals as Record<MKey, number>, weeklyAvg: weeklyAvg as Record<MKey, number>, sessionCount: monthSessions.length };
}

function MonthlyVolumePanel({ sessions, exerciseLib }: { sessions: any[]; exerciseLib: any[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [open, setOpen] = useState(true);

  const { totals, weeklyAvg, sessionCount } = computeMonthlyVolume(sessions, exerciseLib, year, month);

  const activeRows = MUSCLE_KEYS_ORDERED.filter(mg => totals[mg.key] > 0);
  const maxTotal = Math.max(...activeRows.map(mg => totals[mg.key]), 1);

  const monthLabel = new Date(year, month, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' });

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    const nextIsAfterNow = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth());
    if (nextIsAfterNow) return;
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth();

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 select-none"
        onClick={() => setOpen(o => !o)}
      >
        <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
          <BarChart2 size={16} className="text-primary" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-foreground">Monthly Volume</p>
          <p className="text-xs text-muted-foreground">{monthLabel} &middot; {sessionCount} session{sessionCount !== 1 ? 's' : ''}</p>
        </div>
        <ChevronDown size={15} className={`text-muted-foreground transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-border">
          {/* Month navigator */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
            <button onClick={prevMonth} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft size={14} />
            </button>
            <span className="text-xs font-medium text-foreground">{monthLabel}</span>
            <button onClick={nextMonth} disabled={isCurrentMonth} className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30">
              <ChevronRight size={14} />
            </button>
          </div>

          {activeRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No sessions logged this month.</p>
          ) : (
            <div className="px-4 py-3 space-y-2">
              {/* Column headers */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 w-20 flex-shrink-0">Muscle</span>
                <span className="flex-1" />
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 w-10 text-right flex-shrink-0">Total</span>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground/60 w-12 text-right flex-shrink-0">Wk avg</span>
              </div>
              {activeRows
                .sort((a, b) => totals[b.key] - totals[a.key])
                .map(mg => {
                  const total = totals[mg.key];
                  const avg = weeklyAvg[mg.key];
                  const pct = Math.round((total / maxTotal) * 100);
                  const barColor = total >= 10 ? 'bg-primary' : total >= 6 ? 'bg-primary/70' : 'bg-primary/40';
                  return (
                    <div key={mg.key} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-20 flex-shrink-0 truncate">{mg.label}</span>
                      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-semibold text-foreground w-10 text-right flex-shrink-0 tabular-nums">{total}</span>
                      <span className="text-xs text-muted-foreground w-12 text-right flex-shrink-0 tabular-nums">{avg}/wk</span>
                    </div>
                  );
                })}
              <p className="text-[10px] text-muted-foreground/50 pt-1">Sets weighted by muscle contribution. Rest-pause: activation set + 1 per 2 mini-sets.</p>
            </div>
          )}
        </div>
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
  viewAsUserId: number | null | undefined;
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
  const exerciseUnits = (() => {
    try { return JSON.parse(localStorage.getItem('workout:exerciseUnits') ?? '{}') as Record<string, 'kg' | 'lbs'>; }
    catch { return {} as Record<string, 'kg' | 'lbs'>; }
  })();

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
                    <CalendarIcon size={15} />
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
                  const isMyoEx = firstSet?.myoReps === true;
                  const miniCount = isMyoEx ? (parseInt(firstSet?.miniSets || '0') || 0) : 0;
                  // For myo-reps: 1 activation + miniCount mini-sets; otherwise normal set count
                  const displaySetCount = isMyoEx ? 1 + miniCount : completedSets.length;
                  const setLabel = isMyoEx
                    ? `1 + ${miniCount} sets`
                    : `${displaySetCount} ${displaySetCount === 1 ? 'set' : 'sets'}`;
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
                          {firstSet?.weight != null ? `${firstSet.weight}${exerciseUnits[ex.name] ?? 'kg'}` : '—'} × {firstSet?.reps != null ? firstSet.reps : '—'}
                        </p>
                        <p className="text-[11px] text-muted-foreground/60">{setLabel}</p>
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

/** Convert a local Date to yyyy-mm-dd using LOCAL timezone parts (not UTC). */
function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ─── WorkoutMiniCalendar ─────────────────────────────────────────────────────
// Identical approach to NutritionTab's MiniCalendar — proven to work on mobile.
function WorkoutMiniCalendar({
  selectedDate,
  onSelect,
  datesWithSessions,
  onMonthChange,
}: {
  selectedDate: Date;
  onSelect: (d: Date) => void;
  datesWithSessions: Set<string>;
  onMonthChange: (month: string) => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(selectedDate);
    d.setDate(1);
    return d;
  });

  const today = new Date();
  const todayStr = localDateStr(today);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7; // Mon=0
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  function prevMonth() {
    const next = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
    setViewMonth(next);
    onMonthChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
  }
  function nextMonth() {
    const now = new Date();
    const next = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
    if (next <= new Date(now.getFullYear(), now.getMonth(), 1)) {
      setViewMonth(next);
      onMonthChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`);
    }
  }

  const canGoNext = (() => {
    const next = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
    const now = new Date();
    return next <= new Date(now.getFullYear(), now.getMonth(), 1);
  })();

  const selectedStr = localDateStr(selectedDate);

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary">
          <ChevronLeft size={18} />
        </button>
        <p className="text-sm font-semibold text-foreground">
          {viewMonth.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}
        </p>
        <button
          onClick={nextMonth}
          disabled={!canGoNext}
          className={cn('p-1.5 rounded-lg transition-colors', canGoNext ? 'text-muted-foreground hover:text-foreground hover:bg-secondary' : 'text-muted-foreground/20 cursor-not-allowed')}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(d => (
          <div key={d} className="text-center text-xs text-muted-foreground/60 font-medium py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - startOffset + 1;
          if (dayNum < 1 || dayNum > daysInMonth) return <div key={i} />;
          const cellDate = new Date(year, month, dayNum);
          const cellStr = localDateStr(cellDate);
          const isSelected = cellStr === selectedStr;
          const isT = cellStr === todayStr;
          const hasSession = datesWithSessions.has(cellStr);
          const isFuture = cellDate > today;
          return (
            <button
              key={i}
              type="button"
              disabled={isFuture}
              onClick={() => onSelect(cellDate)}
              className={cn(
                'relative flex flex-col items-center justify-center h-9 rounded-lg text-sm transition-all',
                isFuture ? 'text-muted-foreground/20 cursor-not-allowed' :
                isSelected ? 'bg-primary text-primary-foreground font-bold' :
                isT ? 'border border-primary text-primary font-semibold' :
                'text-foreground hover:bg-secondary'
              )}
            >
              {dayNum}
              {hasSession && !isSelected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary/70" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── SessionCard ────────────────────────────────────────────────────────────
interface SessionCardProps {
  s: any;
  viewAsUserId: number | null | undefined;
  deleteConfirmId: number | null;
  deleting: number | null;
  setDeleteConfirmId: (id: number | null) => void;
  setDeleting: (id: number | null) => void;
  deleteMutation: { mutate: (args: { id: number }) => void };
  clearDraft: (dateStr: string, dayLabel: string) => void;
  setSessionDate: (date: string) => void;
  selectDay: (day: string) => void;
}
function SessionCard({ s, viewAsUserId, deleteConfirmId, deleting, setDeleteConfirmId, setDeleting, deleteMutation, clearDraft, setSessionDate, selectDay }: SessionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const dateStr = toLocalDateStr(s.sessionDate);
  const allExercises = (s.exercises as any[]).filter((ex: any) => {
    const sets = (ex.sets ?? []).filter((st: any) => st.completed || st.weight != null || st.reps != null);
    return sets.length > 0;
  });
  const totalSets = allExercises.reduce((sum: number, ex: any) =>
    sum + (ex.sets ?? []).filter((st: any) => st.completed || st.weight != null || st.reps != null).length, 0);
  const isConfirmingDelete = deleteConfirmId === s.id;
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div>
          <p className="text-sm font-semibold text-foreground">{s.dayLabel}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {allExercises.length} exercise{allExercises.length !== 1 ? 's' : ''} &middot; {totalSets} set{totalSets !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {!viewAsUserId && (
            <>
              <button type="button" onClick={e => { e.stopPropagation(); clearDraft(dateStr, s.dayLabel); setSessionDate(dateStr); selectDay(s.dayLabel); }}
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary text-muted-foreground active:bg-secondary/70 transition-colors">
                <Pencil size={15} />
              </button>
              <button type="button" onClick={e => { e.stopPropagation(); setDeleteConfirmId(s.id); }} disabled={deleting === s.id}
                className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary text-muted-foreground active:text-red-400 active:bg-red-400/10 transition-colors">
                <Trash2 size={15} />
              </button>
            </>
          )}
          <ChevronDown size={16} className={`text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </div>
      {expanded && allExercises.length > 0 && (
        <div className="mt-3 space-y-2.5">
          {allExercises.map((ex: any, exIdx: number) => {
            const completedSets = (ex.sets ?? []).filter((st: any) => st.completed || st.weight != null || st.reps != null);
            type TopSetAcc = { weight: number | null; reps: number | null } | null;
            const topSet = (completedSets as any[]).reduce((best: TopSetAcc, st: any): TopSetAcc => {
              if (!best) return { weight: st.weight ?? null, reps: st.reps ?? null };
              const bw = best.weight ?? 0, sw = st.weight ?? 0;
              if (sw > bw) return { weight: st.weight ?? null, reps: st.reps ?? null };
              if (sw === bw && (st.reps ?? 0) > (best.reps ?? 0)) return { weight: st.weight ?? null, reps: st.reps ?? null };
              return best;
            }, null);
            const topSetStr = topSet
              ? `${topSet.weight != null ? topSet.weight + 'kg' : 'BW'}${topSet.reps != null ? ' × ' + topSet.reps : ''} (${completedSets.length} set${completedSets.length !== 1 ? 's' : ''})`
              : `${completedSets.length} set${completedSets.length !== 1 ? 's' : ''}`;
            return (
              <div key={exIdx} className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{ex.name}</p>
                  <p className="text-[10px] text-muted-foreground/60 italic truncate">{ex.machinePreset ?? '\u00a0'}</p>
                </div>
                <p className="text-xs text-muted-foreground whitespace-nowrap">{topSetStr}</p>
              </div>
            );
          })}
          {s.notes && <p className="text-xs text-muted-foreground/70 italic border-t border-border pt-2 mt-1">{s.notes}</p>}
        </div>
      )}
      {isConfirmingDelete && (
        <div className="mt-3 flex items-center gap-3">
          <p className="flex-1 text-sm text-foreground">Delete this session?</p>
          <button type="button" onClick={() => { setDeleting(s.id); setDeleteConfirmId(null); deleteMutation.mutate({ id: s.id }); }}
            className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium">Delete</button>
          <button type="button" onClick={() => setDeleteConfirmId(null)}
            className="px-4 py-2 rounded-lg bg-secondary text-foreground text-sm font-medium">Cancel</button>
        </div>
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
  const [exerciseData, setExerciseData] = useState<Record<string, Array<{ weight: string; reps: string; notes: string; completed: boolean; myoReps?: boolean; miniSets?: string }>>>({});
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

  // ── Per-exercise unit preference (kg / lbs) ─────────────────────────────
  const [exerciseUnits, setExerciseUnits] = useState<Record<string, 'kg' | 'lbs'>>(() => {
    try {
      const raw = localStorage.getItem('workout:exerciseUnits');
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  function toggleExerciseUnit(exName: string) {
    setExerciseUnits(prev => {
      const current = prev[exName] ?? 'kg';
      const next = { ...prev, [exName]: current === 'kg' ? 'lbs' as const : 'kg' as const };
      try { localStorage.setItem('workout:exerciseUnits', JSON.stringify(next)); } catch {}
      return next;
    });
  }

  // ── History / day picker state ───────────────────────────────────────────
  const [dayPickerOpen, setDayPickerOpen] = useState(false);

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
  // null = auto (open if preset exists), true = forced open, false = forced closed
  const [equipmentOpen, setEquipmentOpen] = useState<Record<string, boolean | null>>({});
  const [editingSettingsEx, setEditingSettingsEx] = useState<string | null>(null);
  const [prevNoteOpen, setPrevNoteOpen] = useState<Record<string, boolean>>({}); 
  const [noteOpen, setNoteOpen] = useState<Record<string, boolean>>({});
  const [collapsedExercises, setCollapsedExercisesRaw] = useState<Record<string, boolean>>({});
  // Tracks exercises the user has manually marked as done (before max sets reached)
  const [exerciseDone, setExerciseDone] = useState<Record<string, boolean>>({});

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
        setEquipmentOpen(p => ({ ...p, [exName]: null }));
      }
      return next;
    });
  }

  const autoCollapsedRef = useRef<Set<string>>(new Set());
  // Auto-collapse only when exerciseDone is explicitly set (Done pressed or max sets reached)
  // Do NOT auto-collapse just because all current set rows are ticked — the Add/Done flow
  // needs to remain visible so the user can add more sets up to the max.
  useEffect(() => {
    setCollapsedExercisesRaw(prev => {
      let changed = false;
      const next = { ...prev };
      for (const [exName, isDone] of Object.entries(exerciseDone)) {
        if (isDone && !autoCollapsedRef.current.has(exName) && !prev[exName]) {
          next[exName] = true;
          autoCollapsedRef.current.add(exName);
          changed = true;
        }
      }
      // Reset auto-collapse tracking when exercise is un-done
      for (const exName of autoCollapsedRef.current) {
        if (!exerciseDone[exName]) autoCollapsedRef.current.delete(exName);
      }
      if (!changed) return prev;
      if (selectedDay) saveCollapsed(sessionDate, selectedDay, next);
      return next;
    });
  }, [exerciseDone]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // Returns the set of muscles that contribute >= threshold of the exercise's total volume
  function primaryMuscles(ex: any, threshold = 0.5): Set<string> {
    const total = MUSCLE_KEYS.reduce((s, k) => s + (ex[k] ?? 0), 0);
    if (total === 0) return new Set();
    return new Set(MUSCLE_KEYS.filter(k => (ex[k] ?? 0) / total >= threshold));
  }

  // Two exercises match if their primary muscle sets are identical
  function primaryMusclesMatch(a: any, b: any): boolean {
    const pa = primaryMuscles(a);
    const pb = primaryMuscles(b);
    if (pa.size === 0 || pb.size === 0) return false;
    if (pa.size !== pb.size) return false;
    for (const m of pa) if (!pb.has(m)) return false;
    return true;
  }

  // Secondary similarity score for sorting within matched results
  function muscleScore(a: any, b: any): number {
    return MUSCLE_KEYS.reduce((sum, k) => sum + (a[k] ?? 0) * (b[k] ?? 0), 0);
  }

  function getSimilarExercises(originalName: string): any[] {
    const original = (exerciseLib as any[]).find(e => e.name === originalName);
    if (!original) return (exerciseLib as any[]).filter(e => e.name !== originalName);
    // Exact primary muscle matches first, then everything else as fallback
    const exactMatches = (exerciseLib as any[])
      .filter(e => e.name !== originalName && primaryMusclesMatch(original, e))
      .map(e => ({ ...e, _score: muscleScore(original, e) }))
      .sort((a, b) => b._score - a._score);
    const fallback = (exerciseLib as any[])
      .filter(e => e.name !== originalName && !primaryMusclesMatch(original, e))
      .map(e => ({ ...e, _score: muscleScore(original, e) }))
      .sort((a, b) => b._score - a._score);
    return [...exactMatches, ...fallback];
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

  function revertSubstitution(originalName: string) {
    // displayName is the substituted exercise name; originalName is what it replaced
    const displayName = substitutions[originalName];
    if (!displayName) return;
    setSubstitutions(prev => { const n = { ...prev }; delete n[originalName]; return n; });
    setExerciseData(prev => {
      const existing = prev[displayName] ?? [{ weight: "", reps: "", notes: "" }];
      const next = { ...prev };
      delete next[displayName];
      next[originalName] = existing;
      return next;
    });
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
      setSelectedDay(null);
      sessionStorage.removeItem('workoutLog:selectedDay');
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
        migratedData[k] = (sets as any[]).map((s: any) => ({ ...s, completed: s.completed ?? (s.weight !== '' || s.reps !== ''), myoReps: s.myoReps ?? false, miniSets: s.miniSets ?? '' }));
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
      // Restore exerciseDone from draft
      const draftDone: Record<string, boolean> = {};
      for (const [exName, sets] of Object.entries(migratedData)) {
        const isMyoReps = !!sets[0]?.myoReps;
        const allDone = isMyoReps
          ? sets.length > 0 && !!sets[0]?.completed
          : sets.length > 0 && sets.every(s => s.completed);
        if (allDone) draftDone[exName] = true;
      }
      setExerciseDone(draftDone);
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
          myoReps: s.myoReps ?? false,
          miniSets: s.miniSets != null ? String(s.miniSets) : '',
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
      // Restore exerciseDone: any exercise where all sets are completed was previously marked done
      const restoredDone: Record<string, boolean> = {};
      for (const ex of (existing.exercises as any[])) {
        const sets = exData[ex.name] ?? [];
        const isMyoReps = !!sets[0]?.myoReps;
        const allDone = isMyoReps
          ? sets.length > 0 && !!sets[0]?.completed
          : sets.length > 0 && sets.every(s => s.completed);
        if (allDone) restoredDone[ex.name] = true;
      }
      setExerciseDone(restoredDone);
      setCollapsedExercisesRaw(defaultCollapsed);
      saveCollapsed(date, label, defaultCollapsed);
      return;
    }

    const blankEx: Record<string, Array<{ weight: string; reps: string; notes: string; completed: boolean }>> = {};
    for (const ex of (dayDef?.exercises ?? [])) {
      const setCount = Math.max(1, parseSetsRange(String(ex.sets ?? 1)).min || 1);
      blankEx[ex.name] = Array.from({ length: setCount }, () => ({ weight: '', reps: '', notes: '', completed: false }));
    }
    // Pre-populate equipment details from the most recent previous session for this day
    const prevForDay = [...sessions]
      .filter(s => s.dayLabel === label && toLocalDateStr(s.sessionDate) < date)
      .sort((a, b) => toLocalDateStr(b.sessionDate).localeCompare(toLocalDateStr(a.sessionDate)))[0];
    const prefillEquipment: Record<string, string> = {};
    const prefillMachinePreset: Record<string, string> = {};
    const prefillMachinePresetId: Record<string, number> = {};
    const prefillMachineSettings: Record<string, string> = {};
    if (prevForDay) {
      for (const ex of (prevForDay.exercises as any[])) {
        if (ex.equipmentDetails) prefillEquipment[ex.name] = ex.equipmentDetails;
        if (ex.machinePreset) prefillMachinePreset[ex.name] = ex.machinePreset;
        if (ex.presetId) prefillMachinePresetId[ex.name] = ex.presetId;
        if (ex.machineSettings) prefillMachineSettings[ex.name] = ex.machineSettings;
      }
    }
    setExerciseData(blankEx);
    setSessionNotes('');
    setEquipmentDetails(prefillEquipment);
    setMachinePreset(prefillMachinePreset);
    setMachinePresetId(prefillMachinePresetId);
    setMachineSettings(prefillMachineSettings);
    setExerciseNotes({});
    setSubstitutions({});
    setExerciseDone({});
    setCollapsedExercisesRaw(loadCollapsed(date, label));
  }

  function selectDay(label: string) {
    setSelectedDay(label);
    loadedRef.current = null;
    setExerciseDone({});
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
    setExerciseData(prev => {
      const existing = prev[exName] ?? [];
      return {
        ...prev,
        [exName]: [...existing, { weight: "", reps: "", notes: "", completed: false }],
      };
    });
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
          myoReps: s.myoReps || false,
          miniSets: s.miniSets !== "" && s.miniSets != null ? parseInt(s.miniSets) : null,
        })),
      };
    });
    saveMutation.mutate({ sessionDate, dayLabel: selectedDay, exercises, notes: sessionNotes || null });
  }

  const inputCls = "bg-secondary border border-border rounded-lg px-2 py-3 text-base text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary w-full";

  // ── Calendar history state ─────────────────────────────────────────────────────
  const [calSelectedDate, setCalSelectedDate] = useState(() => new Date());
  const datesWithSessions = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions as any[]) set.add(toLocalDateStr(s.sessionDate));
    return set;
  }, [sessions]);

  const calSelectedDateStr = localDateStr(calSelectedDate);
  const sessionsForCalDay = useMemo(() => {
    return (sessions as any[]).filter(s => toLocalDateStr(s.sessionDate) === calSelectedDateStr)
      .sort((a, b) => toLocalDateStr(b.sessionDate).localeCompare(toLocalDateStr(a.sessionDate)));
  }, [sessions, calSelectedDateStr]);

  // ── Delete confirmation state ─────────────────────────────────────────────
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  if (!selectedDay) {
    return (
      <div className="relative space-y-4 pb-28">

        {/* ── Mini Calendar (same component/approach as NutritionTab) ── */}
        <WorkoutMiniCalendar
          selectedDate={calSelectedDate}
          onSelect={setCalSelectedDate}
          datesWithSessions={datesWithSessions}
          onMonthChange={() => {}}
        />

        {/* ── Selected day label ── */}
        <p className="text-xs text-muted-foreground font-medium px-1">
          {calSelectedDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>

        {/* ── Sessions for selected day ── */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {sessionsForCalDay.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center gap-2">
              <MdBolt size={28} className="text-muted-foreground/30 mb-1" />
              <p className="text-muted-foreground text-sm">No session logged on this day</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {sessionsForCalDay.map((s: any) => (
                <SessionCard
                  key={s.id}
                  s={s}
                  viewAsUserId={viewAsUserId}
                  deleteConfirmId={deleteConfirmId}
                  deleting={deleting}
                  setDeleteConfirmId={setDeleteConfirmId}
                  setDeleting={setDeleting}
                  deleteMutation={deleteMutation}
                  clearDraft={clearDraft}
                  setSessionDate={setSessionDate}
                  selectDay={selectDay}
                />
              ))}

            </div>
          )}
        </div>

        {/* ── Floating Start Session button ── */}
        <button
          type="button"
          onClick={() => setDayPickerOpen(true)}
          className="fixed bottom-24 right-4 z-30 flex items-center gap-2 px-5 py-3.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold shadow-lg active:scale-95 transition-all"
        >
          <Plus size={18} />
          Start Session
        </button>

        {/* ── Day picker sheet ── */}
        <Sheet open={dayPickerOpen} onOpenChange={setDayPickerOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[70vh] overflow-y-auto" hideCloseButton>
            <SheetHeader className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-base font-semibold">Choose a session</SheetTitle>
                <button onClick={() => setDayPickerOpen(false)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                  <X size={18} />
                </button>
              </div>
            </SheetHeader>
            {days.length === 0 ? (
              <p className="px-5 pb-6 text-sm text-muted-foreground">No program assigned yet.</p>
            ) : (
              <div className="px-5 pb-6 space-y-2">
                {days.map((d: any) => (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => {
                      setDayPickerOpen(false);
                      setSessionDate(today);
                      selectDay(d.label);
                    }}
                    className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl bg-secondary active:bg-secondary/80 active:scale-[0.98] transition-all text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-foreground">{d.label}</p>
                      {d.name && d.name !== d.label && <p className="text-xs text-muted-foreground mt-0.5">{d.name}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">{(d.exercises ?? []).length} exercises</p>
                    </div>
                    <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Active session header ─────────────────────────────────── */}
      <div className="flex items-center gap-3 -mb-1">
        <button
          onClick={() => {
            // Check if there's any actual data worth saving as a draft
            const hasData = Object.values(exerciseData).some(sets =>
              sets.some(s => s.weight !== '' || s.reps !== '' || s.completed)
            );
            if (hasData) {
              if (confirm('Exit session? Your progress will be saved as a draft.')) {
                if (selectedDay) writeDraft(sessionDate, selectedDay);
                setSelectedDay(null);
              }
            } else {
              // Nothing to save — just exit silently
              if (selectedDay) clearDraft(sessionDate, selectedDay);
              setSelectedDay(null);
            }
          }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft size={16} />
          Back
        </button>
        <div className="flex-1" />
        <p className="text-sm font-semibold text-foreground">{selectedDay}</p>
        <div className="flex-1" />
      </div>
      {selectedDay && (() => {
        const dayDef = days.find(d => d.label === selectedDay);

        // All past sessions (any day label), newest first — so Last performance shows
        // the most recent time each exercise was performed, regardless of which session it was in.
        const pastSessions = [...sessions]
          .filter(s => toLocalDateStr(s.sessionDate) < sessionDate)
          .sort((a, b) => toLocalDateStr(b.sessionDate).localeCompare(toLocalDateStr(a.sessionDate)));
        // For last-performance we need to find, per exercise, the most recent session
        // where the same machine preset was used (so switching machines shows the last
        // numbers on THAT machine, not the last numbers on any machine).
        //
        // Build a flat list of all past exercise entries with set data, newest first.
        // At render time we scan this list to find the best match for each exercise.
        type PastExEntry = {
          name: string;
          sets: Array<{ weight: number | null; reps: number | null }>;
          presetId: number | null;
          presetName: string;
        };
        const allPastEntries: PastExEntry[] = [];
        for (const s of pastSessions) {
          for (const ex of (s.exercises as any[])) {
            const filteredSets = (ex.sets ?? []).filter((set: any) => set.weight != null || set.reps != null);
            if (filteredSets.length > 0) {
              allPastEntries.push({
                name: ex.name,
                sets: filteredSets,
                presetId: ex.presetId ?? null,
                presetName: ex.machinePreset || ex.equipmentDetails || "",
              });
            }
          }
        }
        // Keep a reference to the single most recent session for prev-note lookups
        const prevSession = pastSessions[0] ?? null;

        const totalExercises = (dayDef?.exercises ?? []).length;
        const completedExercises = (dayDef?.exercises ?? []).filter(ex => {
          const subName = substitutions[ex.name];
          const displayName = subName ?? ex.name;
          // Only count exercises where the user explicitly pressed "Complete"
          return !!exerciseDone[displayName];
        }).length;
        const progressPct = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0;

        return (
          <div className="space-y-3 pb-24">
            {/* Session progress bar — sticky at top */}
            <div className="sticky top-14 z-10 bg-background/95 backdrop-blur-sm py-2 -mx-4 px-4 border-b border-border/50">
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-muted-foreground flex-shrink-0">{completedExercises}/{totalExercises}</span>
              </div>
            </div>
            {(dayDef?.exercises ?? []).map((ex, i) => {
              const subName = substitutions[ex.name];
              const displayName = subName ?? ex.name;
              const sets = exerciseData[displayName] ?? [{ weight: "", reps: "", notes: "" }];
              const isCollapsed = collapsedExercises[displayName] ?? false;
              const exVideoUrl = videoMap[displayName] ?? videoMap[ex.name];
              const exEmbedUrl = exVideoUrl ? getYouTubeEmbedUrl(exVideoUrl) : null;
              const currentPreset = machinePreset[displayName] ?? "";
              const currentPresetId = machinePresetId[displayName] ?? null;
              const currentSettings = machineSettings[displayName] ?? "";
              const hasEquipment = !!(equipmentDetails[displayName]?.trim()) || !!currentPreset;
              // Find the most recent past entry for this exercise whose preset matches the
              // currently selected preset. Matching uses presetId (stable FK) when both sides
              // have one; falls back to name string for legacy sessions.
              // If no preset is selected, use the most recent entry regardless of preset.
              const lookupName = subName ? displayName : ex.name;
              const prevSets = (() => {
                const candidates = allPastEntries.filter(e => e.name === lookupName);
                if (candidates.length === 0) return [];
                // No preset selected on current exercise → show most recent regardless
                if (!currentPreset) return candidates[0].sets;
                // Preset selected → find most recent entry with same preset
                for (const entry of candidates) {
                  // Both sides have IDs: use stable ID comparison
                  if (currentPresetId && entry.presetId) {
                    if (currentPresetId === entry.presetId) return entry.sets;
                  } else {
                    // One or both sides lack an ID: fall back to name comparison
                    if (currentPreset && currentPreset === entry.presetName) return entry.sets;
                  }
                }
                // No matching preset found in history
                return [];
              })();
              const isSheetOpen = !!equipmentOpen[displayName];
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

                        {subName && (
                          <p className="text-xs text-muted-foreground mt-0.5">Substituting: {ex.name}</p>
                        )}
                        {/* Machine badge row — always visible when expanded */}
                        {!isCollapsed && (
                          <div className="mt-2 mb-0.5 flex items-center gap-2 flex-wrap">
                            <PresetSelector
                              exerciseName={displayName}
                              currentPreset={currentPreset}
                              currentSettings={currentSettings}
                              popoverOpen={isSheetOpen}
                              onPopoverOpenChange={open => setEquipmentOpen(prev => ({ ...prev, [displayName]: open }))}
                              onSelectPreset={(presetName, lastSettings, presetId) => {
                                setMachinePreset(prev => ({ ...prev, [displayName]: presetName }));
                                if (presetId) setMachinePresetId(prev => ({ ...prev, [displayName]: presetId }));
                                if (lastSettings != null) setMachineSettings(prev => ({ ...prev, [displayName]: lastSettings }));
                              }}
                              onSettingsChange={val => setMachineSettings(prev => ({ ...prev, [displayName]: val }))}
                              onSettingsBlur={_val => {}}
                              onDeletePreset={(_id, presetName) => {
                                if (machinePreset[displayName] === presetName) {
                                  setMachinePreset(prev => { const n = { ...prev }; delete n[displayName]; return n; });
                                  setMachineSettings(prev => { const n = { ...prev }; delete n[displayName]; return n; });
                                }
                              }}
                            />

                          </div>
                        )}

                      </div>
                      <ChevronDown size={16} className={`text-muted-foreground transition-transform flex-shrink-0 mt-1 ${isCollapsed ? '' : 'rotate-180'}`} />
                    </div>
                    {/* Meta row: sets×reps target + action buttons */}
                    {!isCollapsed && (
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <div className="min-w-0">
                          {ex.notes && !subName && <p className="text-xs text-muted-foreground mb-0.5">{ex.notes}</p>}
                          <p className="text-sm font-medium text-foreground/70">
                            {formatSetsRange(String(ex.sets))} sets × {ex.reps}
                            {(() => {
                              const pw = prevSets[0]?.weight;
                              const pr = prevSets[0]?.reps;
                              if (pw == null && pr == null) return null;
                              const unit = exerciseUnits[displayName] ?? 'kg';
                              const parts = [pw != null ? `${pw}${unit}` : null, pr != null ? pr : null].filter(Boolean);
                              return <span className="text-muted-foreground/50 font-normal"> · Last: {parts.join(' × ')}</span>;
                            })()}
                          </p>
                          {(() => {
                            // When a substitution is active, only look up by the substitute name.
                            // Never fall back to the original exercise's note — different movement.
                            const prevNoteSearchName = subName ? displayName : ex.name;
                            const prevNote = prevSession?.exercises && (prevSession.exercises as any[]).find((e: any) => e.name === prevNoteSearchName)?.exerciseNotes;
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
                          {/* kg / lbs toggle */}
                          <button
                            onClick={e => { e.stopPropagation(); toggleExerciseUnit(displayName); }}
                            title="Toggle weight unit"
                            className="flex items-center justify-center h-7 px-2 rounded-lg bg-secondary text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
                          >
                            {exerciseUnits[displayName] ?? 'kg'}
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setHistorySheet(displayName); }}
                            title="Exercise history"
                            className="flex items-center justify-center w-9 h-9 rounded-lg bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <History size={15} />
                          </button>
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              if (subName) {
                                revertSubstitution(ex.name);
                              } else {
                                setSubPicker({ originalName: ex.name }); setSubSearch("");
                              }
                            }}
                            title={subName ? `Revert to ${ex.name}` : "Substitute exercise"}
                            className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
                              subName
                                ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                                : "bg-secondary text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            <Shuffle size={15} />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {isCollapsed && sets.length > 0 && (() => {
                    const isRestPause = !!sets[0]?.myoReps;
                    const isDone = isRestPause ? sets[0]?.completed : sets.every(s => s.completed);
                    if (isDone) {
                      // Find the set with the highest weight (or first completed set)
                      const completedSets = sets.filter(s => s.completed && s.weight !== '' && s.weight != null);
                      const topSet = completedSets.reduce<typeof sets[0] | null>((best, s) => {
                        if (!best) return s;
                        return parseFloat(String(s.weight)) >= parseFloat(String(best.weight)) ? s : best;
                      }, null);
                      const totalDone = sets.filter(s => s.completed).length;
                      return (
                        <div className="space-y-1.5 pb-1">
                          <div className="flex items-center gap-3">
                            <p className="text-xs font-semibold tracking-widest text-green-500">COMPLETE</p>
                            {topSet && (
                              <p className="text-xs text-muted-foreground">
                                {topSet.weight}{exerciseUnits[displayName] ?? 'kg'} × {topSet.reps}
                                {isRestPause && sets[0]?.miniSets && String(sets[0].miniSets) !== '' && (
                                  <span className="ml-2 text-muted-foreground/60">· 1 + {sets[0].miniSets} mini sets</span>
                                )}
                                {!isRestPause && totalDone > 0 && (
                                  <span className="ml-2 text-muted-foreground/60">· {totalDone} {totalDone === 1 ? 'set' : 'sets'}</span>
                                )}
                              </p>
                            )}
                          </div>
                          {currentPreset && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-primary/40 text-primary text-[11px] font-medium">
                              {currentPreset}
                            </span>
                          )}
                        </div>
                      );
                    }
                    if (isRestPause) {
                      return (
                        <div className="space-y-1.5 pb-1">
                          <p className="text-xs font-semibold tracking-widest text-amber-400/80 text-left flex items-center gap-1">
                            <MdBolt size={11} className="inline-block" /> MINI SETS
                          </p>
                          {currentPreset && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-primary/40 text-primary text-[11px] font-medium">
                              {currentPreset}
                            </span>
                          )}
                        </div>
                      );
                    }
                    const completedCount = sets.filter(s => s.completed).length;
                    return (
                      <div className="space-y-1.5 pb-1">
                        <p className="text-xs font-semibold tracking-widest text-amber-400/80 text-left">
                          {completedCount === 0 ? 'INCOMPLETE' : `${completedCount}/${sets.length} SETS`}
                        </p>
                        {currentPreset && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full border border-primary/40 text-primary text-[11px] font-medium">
                            {currentPreset}
                          </span>
                        )}
                      </div>
                    );
                  })()}

                  {!isCollapsed && (<>
                    {sets.length > 0 && (() => {
                      const isMyoReps = !!sets[0]?.myoReps;
                      return (
                        <div className="mb-2">
                          {/* Column headers */}
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-9 flex-shrink-0" />
                            <div className="flex-1 text-center">
                              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">{exerciseUnits[displayName] ?? 'kg'}</p>
                            </div>
                            <div className="flex-1 text-center">
                               <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Reps</p>
                            </div>
                            <div className="w-6 flex-shrink-0" />
                          </div>
                          <div className="space-y-2.5">
                            {/* First set row — always shown, has myo-reps checkbox */}
                            {(() => {
                              const s = sets[0];
                              const prevW = prevSets[0]?.weight;
                              const prevR = prevSets[0]?.reps;
                              return (
                                <div key={0} className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    {/* Tick button */}
                                    <button
                                      onClick={() => {
                                        const wasCompleted = s.completed;
                                        toggleSetCompleted(displayName, 0);
                                        if (wasCompleted && exerciseDone[displayName]) {
                                          setExerciseDone(prev => ({ ...prev, [displayName]: false }));
                                          setCollapsedExercisesRaw(prev => ({ ...prev, [displayName]: false }));
                                          autoCollapsedRef.current.delete(displayName);
                                        }
                                      }}
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
                                        onChange={e => setSet(displayName, 0, "weight", e.target.value)}
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
                                        onChange={e => setSet(displayName, 0, "reps", e.target.value)}
                                        onWheel={e => (e.target as HTMLInputElement).blur()}
                                        placeholder={s.weight === "" && prevR != null ? String(prevR) : ""}
                                        className={`w-full bg-input border border-border rounded-lg px-2 py-2 text-base font-semibold text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
                                          s.completed ? "opacity-50" : ""
                                        }`}
                                      />
                                    </div>
                                    {/* Rest-pause toggle — icon button */}
                                    <button
                                      onClick={() => setExerciseData(prev => {
                                        const updated = [...(prev[displayName] ?? [])];
                                        updated[0] = { ...updated[0], myoReps: !updated[0].myoReps, miniSets: '' };
                                        return { ...prev, [displayName]: updated };
                                      })}
                                      title={isMyoReps ? 'Disable mini sets' : 'Enable mini sets'}
                                      className={`w-6 flex-shrink-0 flex items-center justify-center rounded transition-colors ${
                                        isMyoReps ? 'text-primary' : 'text-muted-foreground/40 hover:text-muted-foreground'
                                      }`}
                                    >
                                      <MdBolt size={20} />
                                    </button>
                                  </div>
                                   {/* Mini-set count row — shown when myo-reps is on */}
                                   {isMyoReps && (
                                     <div className="mt-2 ml-11 mr-8 flex items-center justify-between px-1 py-1">
                                       <span className="text-xs text-muted-foreground">Mini sets</span>
                                       <div className="flex items-center gap-3">
                                         <button
                                           type="button"
                                           onClick={() => setExerciseData(prev => {
                                             const updated = [...(prev[displayName] ?? [])];
                                             const cur = parseInt(updated[0].miniSets || "0") || 0;
                                             updated[0] = { ...updated[0], miniSets: String(Math.max(0, cur - 1)) };
                                             return { ...prev, [displayName]: updated };
                                           })}
                                           className="w-7 h-7 rounded-full bg-secondary hover:bg-secondary/70 text-muted-foreground font-bold text-base flex items-center justify-center transition-colors"
                                         >−</button>
                                         <span className="w-6 text-center text-base font-bold text-primary tabular-nums">
                                           {s.miniSets && s.miniSets !== "" ? s.miniSets : "0"}
                                         </span>
                                         <button
                                           type="button"
                                           onClick={() => setExerciseData(prev => {
                                             const updated = [...(prev[displayName] ?? [])];
                                             const cur = parseInt(updated[0].miniSets || "0") || 0;
                                             updated[0] = { ...updated[0], miniSets: String(cur + 1) };
                                             return { ...prev, [displayName]: updated };
                                           })}
                                           className="w-7 h-7 rounded-full bg-secondary hover:bg-secondary/70 text-muted-foreground font-bold text-base flex items-center justify-center transition-colors"
                                         >+</button>
                                       </div>
                                     </div>
                                   )}
                                </div>
                              );
                            })()}
                            {/* Subsequent set rows — hidden when myo-reps is on */}
                            {!isMyoReps && sets.slice(1).map((s, i) => {
                              const idx = i + 1;
                              const prevW = prevSets[idx]?.weight;
                              const prevR = prevSets[idx]?.reps;
                              return (
                                <div key={idx} className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => {
                                        const wasCompleted = s.completed;
                                        toggleSetCompleted(displayName, idx);
                                        if (wasCompleted && exerciseDone[displayName]) {
                                          setExerciseDone(prev => ({ ...prev, [displayName]: false }));
                                          setCollapsedExercisesRaw(prev => ({ ...prev, [displayName]: false }));
                                          autoCollapsedRef.current.delete(displayName);
                                        }
                                      }}
                                      className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-lg border-2 transition-all ${
                                        s.completed
                                          ? "border-green-500 bg-green-500/20 text-green-400"
                                          : "border-border text-transparent hover:border-primary/60"
                                      }`}
                                    >
                                      <Check size={15} />
                                    </button>
                                    <div className="flex-1">
                                      <input
                                        type="number" inputMode="decimal"
                                        value={s.weight ?? ""}
                                        onChange={e => setSet(displayName, idx, "weight", e.target.value)}
                                        onWheel={e => (e.target as HTMLInputElement).blur()}
                                        placeholder=""
                                        className={`w-full bg-input border border-border rounded-lg px-2 py-2 text-base font-semibold text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
                                          s.completed ? "opacity-50" : ""
                                        }`}
                                      />
                                    </div>
                                    <div className="flex-1">
                                      <input
                                        type="number" inputMode="numeric"
                                        value={s.reps ?? ""}
                                        onChange={e => setSet(displayName, idx, "reps", e.target.value)}
                                        onWheel={e => (e.target as HTMLInputElement).blur()}
                                        placeholder=""
                                        className={`w-full bg-input border border-border rounded-lg px-2 py-2 text-base font-semibold text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
                                          s.completed ? "opacity-50" : ""
                                        }`}
                                      />
                                    </div>
                                    <button onClick={() => removeSet(displayName, idx)} className="w-6 flex-shrink-0 flex items-center justify-center text-muted-foreground/50 hover:text-destructive transition-colors">
                                      <Minus size={14} />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          {/* Add set / Complete buttons */}
                          {(() => {
                            const allTicked = isMyoReps
                              ? !!sets[0]?.completed
                              : sets.length > 0 && sets.every(s => s.completed);
                            if (allTicked) {
                              return (
                                <div className="flex items-center gap-2 mt-3">
                                  {!isMyoReps && (
                                    <button
                                      onClick={() => addSet(displayName)}
                                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                                    >
                                      <Plus size={13} /> Add set
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      setExerciseDone(prev => ({ ...prev, [displayName]: true }));
                                      setCollapsedExercisesRaw(prev => {
                                        const next = { ...prev, [displayName]: true };
                                        if (selectedDay) saveCollapsed(sessionDate, selectedDay, next);
                                        return next;
                                      });
                                      autoCollapsedRef.current.add(displayName);
                                    }}
                                    className={`${isMyoReps ? 'w-full' : 'flex-1'} flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors`}
                                  >
                                    <Check size={13} /> Complete
                                  </button>
                                </div>
                              );
                            }
                            if (!isMyoReps) {
                              return (
                                <button
                                  onClick={() => addSet(displayName)}
                                  className="mt-3 w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
                                >
                                  <Plus size={13} /> Add set
                                </button>
                              );
                            }
                            return null;
                          })()}
                        </div>
                      );
                    })()}

                    <div className="mt-3 pt-3 border-t border-border">
                      {!(noteOpen[displayName] || exerciseNotes[displayName]) ? (
                        <button
                          onClick={e => { e.stopPropagation(); setNoteOpen(prev => ({ ...prev, [displayName]: true })); }}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          + Add note
                        </button>
                      ) : (
                        <input
                          type="text"
                          autoFocus={noteOpen[displayName] && !exerciseNotes[displayName]}
                          value={exerciseNotes[displayName] ?? ""}
                          onChange={e => setExerciseNotes(prev => ({ ...prev, [displayName]: e.target.value }))}
                          onBlur={() => { if (!exerciseNotes[displayName]) setNoteOpen(prev => ({ ...prev, [displayName]: false })); }}
                          className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      )}
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
                    {saving ? "Saving..." : "Complete Session"}
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
            const histUnit = exerciseUnits[exName] ?? 'kg';
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
                        <span className="text-[10px] font-semibold bg-primary/15 text-primary px-1.5 py-0.5 rounded flex-shrink-0">{s.dayLabel}</span>
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
                            <span key={idx} className={`text-xs border rounded-lg px-2 py-1 ${st.myoReps ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-card border-border text-foreground'}`}>
                              {st.weight != null ? `${st.weight}${histUnit}` : '—'} × {st.reps != null ? st.reps : '—'}
                              {st.myoReps && st.miniSets != null && (
                                <span className="ml-1 text-[10px] opacity-70">+{st.miniSets} mini</span>
                              )}
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
          <div className="bg-card rounded-xl overflow-hidden w-full max-w-xs" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <p className="text-sm font-semibold text-foreground truncate pr-2">{videoModal.name}</p>
              <button onClick={() => setVideoModal(null)} className="flex-shrink-0 text-muted-foreground hover:text-foreground"><X size={18} /></button>
            </div>
            <div style={{ aspectRatio: '9/16' }} className="w-full">
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
 
