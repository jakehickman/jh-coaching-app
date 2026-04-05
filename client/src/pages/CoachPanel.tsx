import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronUp, Save, Users, Dumbbell, Zap, ClipboardList, TrendingUp, GripVertical, BookOpen, Search, Pencil, X, Play, ExternalLink } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

// ─── Helpers ─────────────────────────────────────────────────────────────────
// Convert a DB date value (ISO timestamp or plain date string) to local yyyy-mm-dd
function toLocalDateStr(val: unknown): string {
  if (!val) return "";
  const s = String(val);
  if (s.includes('T') || s.includes('Z')) {
    const d = new Date(s);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return s.slice(0, 10);
}

// DD/MM/YYYY date picker — locale-independent
function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [dd, mm, yyyy] = value ? value.split('-').length === 3
    ? [value.split('-')[2], value.split('-')[1], value.split('-')[0]]
    : ['', '', '']
    : ['', '', ''];
  const update = (newDd: string, newMm: string, newYyyy: string) => {
    if (newDd.length <= 2 && newMm.length <= 2 && newYyyy.length === 4) {
      const d = newDd.padStart(2, '0'), m = newMm.padStart(2, '0');
      onChange(`${newYyyy}-${m}-${d}`);
    } else {
      onChange('');
    }
  };
  return (
    <div className="flex items-center gap-1">
      <input type="number" min={1} max={31} placeholder="DD" value={dd}
        onChange={e => update(e.target.value, mm, yyyy)}
        className="w-14 bg-secondary border border-border rounded-lg px-2 py-2 text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary" />
      <span className="text-muted-foreground">/</span>
      <input type="number" min={1} max={12} placeholder="MM" value={mm}
        onChange={e => update(dd, e.target.value, yyyy)}
        className="w-14 bg-secondary border border-border rounded-lg px-2 py-2 text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary" />
      <span className="text-muted-foreground">/</span>
      <input type="number" min={2000} max={2100} placeholder="YYYY" value={yyyy}
        onChange={e => update(dd, mm, e.target.value)}
        className="w-20 bg-secondary border border-border rounded-lg px-2 py-2 text-sm text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary" />
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">{children}</p>;
}
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>{children}</div>;
}
function MuscleGroupSection({ group, children, forceOpen }: { group: string; children: React.ReactNode; forceOpen?: boolean }) {
  const [localOpen, setLocalOpen] = useState(true);
  const open = forceOpen !== undefined ? forceOpen : localOpen;
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setLocalOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/40 transition-colors"
      >
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{group}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 pt-3 space-y-3 bg-card">{children}</div>}
    </div>
  );
}

// ─── Sortable Exercise Row ───────────────────────────────────────────────────
function SortableExerciseRow({
  id, ex, dayIdx, exIdx, updateExercise, removeExercise, exerciseNames
}: {
  id: string;
  ex: any;
  dayIdx: number;
  exIdx: number;
  updateExercise: (d: number, e: number, f: string, v: string) => void;
  removeExercise: (d: number, e: number) => void;
  exerciseNames: string[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [showNotes, setShowNotes] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const filtered = searchTerm.length > 0
    ? exerciseNames.filter(n => n.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 8)
    : exerciseNames.slice(0, 8);
  return (
    <div ref={setNodeRef} style={style} className="space-y-1">
      <div className="grid grid-cols-12 gap-1 items-center">
        <div
          {...attributes}
          {...listeners}
          className="col-span-1 flex justify-center text-muted-foreground cursor-grab active:cursor-grabbing hover:text-foreground touch-none"
        >
          <GripVertical size={13} />
        </div>
        {/* Searchable exercise dropdown */}
        <div className="col-span-6 relative">
          <input
            type="text"
            value={dropdownOpen ? searchTerm : ex.name}
            onChange={e => { setSearchTerm(e.target.value); setDropdownOpen(true); }}
            onFocus={() => { setSearchTerm(""); setDropdownOpen(true); }}
            onBlur={() => setTimeout(() => setDropdownOpen(false), 150)}
            placeholder="Exercise name"
            className="w-full bg-secondary border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {dropdownOpen && filtered.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-card border border-border rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
              {filtered.map(name => (
                <button
                  key={name}
                  type="button"
                  onMouseDown={() => {
                    updateExercise(dayIdx, exIdx, "name", name);
                    setSearchTerm("");
                    setDropdownOpen(false);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
        <input type="text" value={ex.sets} onChange={e => updateExercise(dayIdx, exIdx, "sets", e.target.value)}
          placeholder="4"
          className="col-span-2 bg-secondary border border-border rounded px-2 py-1.5 text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary" />
        <input type="text" value={ex.reps} onChange={e => updateExercise(dayIdx, exIdx, "reps", e.target.value)}
          placeholder="8-12"
          className="col-span-2 bg-secondary border border-border rounded px-2 py-1.5 text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary" />
        <div className="col-span-1 flex items-center gap-0.5">
          <button
            onClick={() => setShowNotes(n => !n)}
            title="Toggle notes"
            className={`flex justify-center transition-colors ${showNotes || ex.notes ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <ChevronDown size={12} className={`transition-transform ${showNotes ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={() => removeExercise(dayIdx, exIdx)} className="flex justify-center text-destructive hover:opacity-80">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
      {showNotes && (
        <div className="pl-6">
          <input
            type="text"
            value={ex.notes ?? ""}
            onChange={e => updateExercise(dayIdx, exIdx, "notes", e.target.value)}
            placeholder="Coaching notes (e.g. tempo 3-1-1, pause at bottom)"
            className="w-full bg-secondary/50 border border-border/50 rounded px-2 py-1 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:text-foreground"
          />
        </div>
      )}
    </div>
  );
}

// ─── Food Combobox ──────────────────────────────────────────────────────────
function FoodCombobox({ value, onChange, foodNames }: { value: string; onChange: (v: string) => void; foodNames: string[] }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const filtered = search.length > 0
    ? foodNames.filter(n => n.toLowerCase().includes(search.toLowerCase())).slice(0, 10)
    : foodNames.slice(0, 10);
  return (
    <div className="relative w-full">
      <input
        type="text"
        value={open ? search : value}
        onChange={e => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => { setSearch(""); setOpen(true); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search food…"
        className="w-full bg-secondary border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-card border border-border rounded-lg shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map(name => (
            <button
              key={name}
              type="button"
              onMouseDown={() => { onChange(name); setSearch(""); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-primary/10 hover:text-primary transition-colors"
            >
              {name}
            </button>
          ))}
        </div>
      )}
      {open && search.length > 0 && filtered.length === 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-card border border-border rounded-lg shadow-xl px-3 py-2">
          <p className="text-xs text-muted-foreground">No foods match "{search}"</p>
        </div>
      )}
    </div>
  );
}

// ─── Client Selector ──────────────────────────────────────────────────────────
function useClientSelector() {
  const { data: allUsers } = trpc.users.list.useQuery();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const clients = allUsers ?? [];

  useEffect(() => {
    if (clients.length > 0 && !selectedUserId) {
      setSelectedUserId(clients[0].id);
    }
  }, [clients]);

  return { clients, selectedUserId, setSelectedUserId };
}

// ─── Section: Clients ─────────────────────────────────────────────────────────
function ClientsSection() {
  const { data: allUsers, refetch } = trpc.users.list.useQuery();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data: profile } = trpc.profile.getById.useQuery(
    { userId: selectedId! },
    { enabled: !!selectedId }
  );
  const utils = trpc.useUtils();
  const upsertProfile = trpc.profile.upsertForClient.useMutation({
    onSuccess: () => {
      toast.success("Profile updated");
      utils.profile.getById.invalidate({ userId: selectedId! });
    }
  });

  const [form, setForm] = useState({
    startDate: "", goalWeight: "", startWeight: "", notes: ""
  });

  useEffect(() => {
    if (profile) {
      setForm({
        startDate: profile.startDate ? toLocalDateStr(profile.startDate) : "",
        goalWeight: profile.goalWeight?.toString() ?? "",
        startWeight: profile.startWeight?.toString() ?? "",
        notes: profile.notes ?? "",
      });
    } else {
      setForm({ startDate: "", goalWeight: "", startWeight: "", notes: "" });
    }
  }, [profile, selectedId]);

  const clients = allUsers ?? [];

  return (
    <div className="space-y-6">
      <div className="max-w-xs mb-2">
        <Card><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Clients</p><p className="text-2xl font-bold text-foreground mt-1">{clients.length}</p></Card>
      </div>

      <div>
        <SectionLabel>All Users</SectionLabel>
        <div className="space-y-2">
          {(allUsers ?? []).map(user => (
            <div
              key={user.id}
              onClick={() => setSelectedId(user.id === selectedId ? null : user.id)}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                selectedId === user.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-border/80"
              }`}
            >
              <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                {user.name?.charAt(0)?.toUpperCase() ?? "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user.name ?? "Unnamed"}</p>
                <p className="text-xs text-muted-foreground">{user.email ?? "No email"}</p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${user.role === "admin" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
                {user.role}
              </span>
            </div>
          ))}
        </div>
      </div>

      {selectedId && (
        <div>
          <SectionLabel>Client Profile</SectionLabel>
          <Card className="space-y-3">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Start Date</label>
                <DateInput value={form.startDate} onChange={v => setForm(p => ({ ...p, startDate: v }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { key: "startWeight", label: "Start Weight (kg)", type: "number" },
                  { key: "goalWeight", label: "Goal Weight (kg)", type: "number" },
                ] as const).map(({ key, label, type }) => (
                  <div key={key}>
                    <label className="text-xs text-muted-foreground block mb-1">{label}</label>
                    <input
                      type={type}
                      value={(form as any)[key]}
                      onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                rows={2}
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
              />
            </div>
            <button
              onClick={() => upsertProfile.mutate({
                userId: selectedId,
                startDate: form.startDate || undefined,
                goalWeight: form.goalWeight ? parseFloat(form.goalWeight) : undefined,
                startWeight: form.startWeight ? parseFloat(form.startWeight) : undefined,
                notes: form.notes || null,
              })}
              disabled={upsertProfile.isPending}
              className="w-full py-2.5 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {upsertProfile.isPending ? "Saving..." : "Save Profile"}
            </button>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Section: Training Programs ───────────────────────────────────────────────
function SortableDayCard({
  id, day, dayIdx, sensors, updateDay, removeDay, addExercise, removeExercise, updateExercise, handleExDragEnd, exerciseNames
}: {
  id: string; day: any; dayIdx: number; sensors: any;
  updateDay: (i: number, f: string, v: string) => void;
  removeDay: (i: number) => void;
  addExercise: (i: number) => void;
  removeExercise: (d: number, e: number) => void;
  updateExercise: (d: number, e: number, f: string, v: string) => void;
  handleExDragEnd: (dayIdx: number) => (event: DragEndEvent) => void;
  exerciseNames: string[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style}>
      <Card>
        <div className="flex items-center gap-2 mb-3">
          <div {...attributes} {...listeners} className="text-muted-foreground cursor-grab active:cursor-grabbing hover:text-foreground touch-none flex-shrink-0">
            <GripVertical size={15} />
          </div>
          <input type="text" value={day.name} onChange={e => updateDay(dayIdx, "name", e.target.value)}
            placeholder="Session"
            className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium" />
          <button onClick={() => removeDay(dayIdx)} className="text-destructive hover:opacity-80 flex-shrink-0">
            <Trash2 size={15} />
          </button>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-1 px-1">
            <p className="col-span-1"></p>
            <p className="col-span-6 text-[10px] text-muted-foreground">Exercise</p>
            <p className="col-span-2 text-[10px] text-muted-foreground text-center">Sets</p>
            <p className="col-span-2 text-[10px] text-muted-foreground text-center">Reps</p>
            <p className="col-span-1"></p>
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleExDragEnd(dayIdx)}>
            <SortableContext
              items={(day.exercises ?? []).map((_: any, j: number) => `ex-${dayIdx}-${j}`)}
              strategy={verticalListSortingStrategy}
            >
              {(day.exercises ?? []).map((ex: any, j: number) => (
                <SortableExerciseRow
                  key={`ex-${dayIdx}-${j}`}
                  id={`ex-${dayIdx}-${j}`}
                  ex={ex}
                  dayIdx={dayIdx}
                  exIdx={j}
                  updateExercise={updateExercise}
                  removeExercise={removeExercise}
                  exerciseNames={exerciseNames}
                />
              ))}
            </SortableContext>
          </DndContext>
          <button onClick={() => addExercise(dayIdx)}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-1">
            <Plus size={12} /> Add Exercise
          </button>
        </div>
      </Card>
    </div>
  );
}

function TrainingSection() {
  const { clients, selectedUserId, setSelectedUserId } = useClientSelector();
  const { data: program, refetch } = trpc.training.getForClient.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );
  const upsert = trpc.training.upsert.useMutation({
    onSuccess: () => { toast.success("Training program saved"); refetch(); }
  });
   const [programName, setProgramName] = useState("");
  const [notes, setNotes] = useState("");
  const [days, setDays] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<string[]>([]);
  const { data: exerciseLib = [] } = trpc.exerciseLibrary.list.useQuery();

  // ── Volume calculation ──────────────────────────────────────────────────────
  const volumeTable = (() => {
    if (!days.length) return null;
    // Frequency multiplier: 7 / number of slots in the rotation (Off counts as a slot)
    const cycleLengthDays = schedule.length > 0 ? schedule.length : days.length;
    const multiplier = 7 / cycleLengthDays;

    // Build a map of exercise name -> muscle contributions from the library
    const libMap = new Map<string, Record<string, number>>();
    for (const ex of exerciseLib) {
      const contributions: Record<string, number> = {};
      for (const mg of MUSCLE_GROUPS) {
        const val = (ex as any)[mg.key] as number ?? 0;
        if (val > 0) contributions[mg.key] = val;
      }
      libMap.set(ex.name.toLowerCase(), contributions);
    }

    // Per-day totals
    const dayTotals: Record<string, Record<string, number>> = {};
    for (const day of days) {
      const dayName = day.name || "Unnamed";
      dayTotals[dayName] = {};
      for (const ex of (day.exercises ?? [])) {
        const sets = parseFloat(ex.sets) || 0;
        const contrib = libMap.get((ex.name ?? "").toLowerCase());
        if (!contrib || sets === 0) continue;
        for (const [mgKey, val] of Object.entries(contrib)) {
          dayTotals[dayName][mgKey] = (dayTotals[dayName][mgKey] ?? 0) + sets * val;
        }
      }
    }

    // Weekly totals
    const weeklyTotals: Record<string, number> = {};
    for (const day of days) {
      const dayName = day.name || "Unnamed";
      // How many times does this day appear in the schedule?
      const occurrences = schedule.length > 0
        ? schedule.filter(s => s === dayName).length
        : 1;
      for (const [mgKey, val] of Object.entries(dayTotals[dayName] ?? {})) {
        weeklyTotals[mgKey] = (weeklyTotals[mgKey] ?? 0) + val * occurrences;
      }
    }
    // Apply multiplier to weekly totals
    for (const key of Object.keys(weeklyTotals)) {
      weeklyTotals[key] = Math.round(weeklyTotals[key] * multiplier);
    }

    return { dayTotals, weeklyTotals, multiplier };
  })();
  useEffect(() => {
    if (program) {
      setProgramName(program.programName ?? "");
      setNotes(program.notes ?? "");
      setDays((program.days as any[]) ?? []);
      setSchedule((program.schedule as string[]) ?? []);
    } else {
      setProgramName(""); setNotes(""); setDays([]); setSchedule([]);
    }
  }, [program]);

  const addDay = () => setDays(d => [...d, { name: `Day ${d.length + 1}`, focus: "", exercises: [] }]);
  const removeDay = (i: number) => setDays(d => d.filter((_, idx) => idx !== i));
  const updateDay = (i: number, field: string, value: string) =>
    setDays(d => d.map((day, idx) => idx === i ? { ...day, [field]: value } : day));
  const addExercise = (dayIdx: number) =>
    setDays(d => d.map((day, idx) => idx === dayIdx
      ? { ...day, exercises: [...(day.exercises ?? []), { name: "", sets: "", reps: "", notes: "" }] }
      : day));
  const removeExercise = (dayIdx: number, exIdx: number) =>
    setDays(d => d.map((day, idx) => idx === dayIdx
      ? { ...day, exercises: day.exercises.filter((_: any, i: number) => i !== exIdx) }
      : day));
  const updateExercise = (dayIdx: number, exIdx: number, field: string, value: string) =>
    setDays(d => d.map((day, idx) => idx === dayIdx
      ? { ...day, exercises: day.exercises.map((ex: any, i: number) => i === exIdx ? { ...ex, [field]: value } : ex) }
      : day));
  const reorderExercises = (dayIdx: number, oldIndex: number, newIndex: number) =>
    setDays(d => d.map((day, idx) => idx === dayIdx
      ? { ...day, exercises: arrayMove(day.exercises, oldIndex, newIndex) }
      : day));
  const reorderDays = (oldIndex: number, newIndex: number) =>
    setDays(d => arrayMove(d, oldIndex, newIndex));

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const handleExDragEnd = (dayIdx: number) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const exercises = days[dayIdx]?.exercises ?? [];
      const oldIndex = exercises.findIndex((_: any, i: number) => `ex-${dayIdx}-${i}` === active.id);
      const newIndex = exercises.findIndex((_: any, i: number) => `ex-${dayIdx}-${i}` === over.id);
      if (oldIndex !== -1 && newIndex !== -1) reorderExercises(dayIdx, oldIndex, newIndex);
    }
  };
  const handleDayDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = days.findIndex((_: any, i: number) => `day-${i}` === active.id);
      const newIndex = days.findIndex((_: any, i: number) => `day-${i}` === over.id);
      if (oldIndex !== -1 && newIndex !== -1) reorderDays(oldIndex, newIndex);
    }
  };
  // Schedule helpers
  const dayOptions = ["Off", ...days.map(d => d.name || `Day ${days.indexOf(d) + 1}`)];
  const addScheduleSlot = () => setSchedule(s => [...s, days[0]?.name || "Day 1"]);
  const removeScheduleSlot = (i: number) => setSchedule(s => s.filter((_, idx) => idx !== i));
  const updateScheduleSlot = (i: number, val: string) => setSchedule(s => s.map((v, idx) => idx === i ? val : v));

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>Select Client</SectionLabel>
        <div className="flex gap-2 flex-wrap">
          {clients.map(c => (
            <button key={c.id} onClick={() => setSelectedUserId(c.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedUserId === c.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}>
              {c.name ?? `User ${c.id}`}
            </button>
          ))}
        </div>
      </div>
      {selectedUserId && (
        <>
          {/* ── Training Schedule ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-muted-foreground">Training Schedule</label>
              <span className="text-[10px] text-muted-foreground/60">defines the rotation for this client</span>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {schedule.map((slot, i) => (
                <div key={i} className="flex items-center gap-1">
                  <select
                    value={slot}
                    onChange={e => updateScheduleSlot(i, e.target.value)}
                    className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    {dayOptions.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <button onClick={() => removeScheduleSlot(i)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 size={12} />
                  </button>
                  {i < schedule.length - 1 && (
                    <span className="text-muted-foreground/40 text-xs select-none">/</span>
                  )}
                </div>
              ))}
              <button
                onClick={addScheduleSlot}
                className="flex items-center gap-1 px-2 py-1.5 border border-dashed border-border rounded-lg text-xs text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
              >
                <Plus size={11} /> Add
              </button>
              {schedule.length > 0 && (
                <span className="text-[10px] text-primary/70 ml-1">→ repeat</span>
              )}
            </div>
            {schedule.length > 0 && (
              <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                {schedule.join(" / ")} / repeat
              </p>
            )}
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDayDragEnd}>
            <SortableContext items={days.map((_: any, i: number) => `day-${i}`)} strategy={verticalListSortingStrategy}>
              <div className="space-y-4">
                {days.map((day, i) => (
                  <SortableDayCard
                    key={`day-${i}`}
                    id={`day-${i}`}
                    day={day}
                    dayIdx={i}
                    sensors={sensors}
                    updateDay={updateDay}
                    removeDay={removeDay}
                    addExercise={addExercise}
                    removeExercise={removeExercise}
                    updateExercise={updateExercise}
                    handleExDragEnd={handleExDragEnd}
                    exerciseNames={(exerciseLib as any[]).map((e: any) => e.name).sort()}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
          <button onClick={addDay}
            className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors w-full justify-center">
            <Plus size={14} /> Add Training Day
          </button>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Coach Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>
           <button
            onClick={() => upsert.mutate({ userId: selectedUserId, programName: programName || null, days, schedule: schedule.length > 0 ? schedule : undefined, notes: notes || null })}
            disabled={upsert.isPending}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save size={15} />
            {upsert.isPending ? "Saving..." : "Save Training Program"}
          </button>

          {/* ── Weekly Volume Table ── */}
          {volumeTable && (
            <div className="mt-6">
              <SectionLabel>Weekly Volume Summary</SectionLabel>
              <p className="text-xs text-muted-foreground mb-3">
                Cycle: {schedule.length > 0 ? schedule.length : days.length} days · Multiplier: ×{volumeTable.multiplier.toFixed(3)} · Values = sets per week
              </p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold sticky left-0 bg-secondary/50 min-w-[120px]">Muscle</th>
                      {days.map(d => (
                        <th key={d.name} className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-center min-w-[80px]">{d.name || "Unnamed"}</th>
                      ))}
                      <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-primary font-semibold text-center min-w-[80px]">Weekly</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...MUSCLE_GROUPS]
                      .sort((a, b) => (volumeTable.weeklyTotals[b.key] ?? 0) - (volumeTable.weeklyTotals[a.key] ?? 0))
                      .map(mg => {
                      const weekly = volumeTable.weeklyTotals[mg.key] ?? 0;
                      if (weekly === 0) return null;
                      return (
                        <tr key={mg.key} className="border-b border-border/50 hover:bg-secondary/20">
                          <td className="px-4 py-2 font-medium text-foreground text-sm sticky left-0 bg-card">{mg.label}</td>
                          {days.map(d => {
                            const val = volumeTable.dayTotals[d.name || "Unnamed"]?.[mg.key] ?? 0;
                            return (
                              <td key={d.name} className="px-3 py-2 text-center">
                                {val > 0 ? (
                                  <span className="text-sm text-foreground/80">{Math.round(val * 10) / 10}</span>
                                ) : (
                                  <span className="text-muted-foreground/30">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${
                              weekly >= 10 ? "bg-primary/20 text-primary" :
                              weekly >= 6 ? "bg-primary/10 text-primary/80" :
                              "bg-secondary text-muted-foreground"
                            }`}>{weekly}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Only muscle groups with &gt;0 weekly sets are shown. Match exercise names exactly to the Exercise Library for accurate tracking.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
// ─── Section: Meal Plans ──────────────────────────────────────────────────────
// Helper: compute macros for a single item given food db and grams (or servings)
// item.grams stores either grams (per-100g foods) or servings count (unit-based foods)
function calcItemMacros(foodDb: any[], foodName: string, amount: number) {
  const food = foodDb.find(f => f.name === foodName);
  if (!food || !amount) return { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 };
  // If food has a serving unit, amount = number of servings; convert to grams
  const grams = food.servingUnit && food.servingGrams ? amount * food.servingGrams : amount;
  const factor = grams / 100;
  return {
    calories: Math.round(food.calories * factor),
    protein: Math.round(food.protein * factor * 10) / 10,
    carbs: Math.round(food.carbs * factor * 10) / 10,
    fiber: Math.round(food.fiber * factor * 10) / 10,
    fat: Math.round(food.fat * factor * 10) / 10,
  };
}
// Helper: get the effective grams for a food item (for display)
function getItemGrams(foodDb: any[], foodName: string, amount: number): number | null {
  const food = foodDb.find(f => f.name === foodName);
  if (!food || !amount) return null;
  return food.servingUnit && food.servingGrams ? Math.round(amount * food.servingGrams) : amount;
}

function MacroChip({ label, value, unit = "g", highlight = false }: { label: string; value: number; unit?: string; highlight?: boolean }) {
  return (
    <div className={`flex flex-col items-center px-2 py-1 rounded-lg ${highlight ? "bg-primary/15 border border-primary/30" : "bg-secondary/60"}` }>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-xs font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{value}{unit === "kcal" ? " kcal" : `g`}</span>
    </div>
  );
}

function MealPlansSection() {
  const { clients, selectedUserId, setSelectedUserId } = useClientSelector();
  const [dayType, setDayType] = useState<"training" | "rest">("training");
  const { data: plan, refetch } = trpc.mealPlan.getForClient.useQuery(
    { userId: selectedUserId!, dayType },
    { enabled: !!selectedUserId }
  );
  const { data: foodDb = [] } = trpc.nutritionFoods.list.useQuery();
  const upsert = trpc.mealPlan.upsert.useMutation({
    onSuccess: () => { toast.success("Meal plan saved"); refetch(); }
  });

  const [planNotes, setPlanNotes] = useState("");
  const [meals, setMeals] = useState<any[]>([]);

  useEffect(() => {
    if (plan) {
      setPlanNotes(plan.notes ?? "");
      setMeals((plan.meals as any[]) ?? []);
    } else {
      setPlanNotes(""); setMeals([]);
    }
  }, [plan, dayType]);

  // Auto-calculate macros from food db
  const mealMacros = meals.map(meal =>
    (meal.items ?? []).reduce((acc: any, item: any) => {
      const m = calcItemMacros(foodDb, item.food, parseFloat(item.grams) || 0);
      return {
        calories: acc.calories + m.calories,
        protein: Math.round((acc.protein + m.protein) * 10) / 10,
        carbs: Math.round((acc.carbs + m.carbs) * 10) / 10,
        fiber: Math.round((acc.fiber + m.fiber) * 10) / 10,
        fat: Math.round((acc.fat + m.fat) * 10) / 10,
      };
    }, { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 })
  );
  const dailyTotals = mealMacros.reduce((acc, m) => ({
    calories: acc.calories + m.calories,
    protein: Math.round((acc.protein + m.protein) * 10) / 10,
    carbs: Math.round((acc.carbs + m.carbs) * 10) / 10,
    fiber: Math.round((acc.fiber + m.fiber) * 10) / 10,
    fat: Math.round((acc.fat + m.fat) * 10) / 10,
  }), { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0 });

  const addMeal = () => setMeals(m => [...m, { name: `Meal ${m.length + 1}`, time: "", items: [] }]);
  const removeMeal = (i: number) => setMeals(m => m.filter((_, idx) => idx !== i));
  const updateMealName = (i: number, name: string) => setMeals(m => m.map((meal, idx) => idx === i ? { ...meal, name } : meal));
  const updateMealTime = (i: number, time: string) => setMeals(m => m.map((meal, idx) => idx === i ? { ...meal, time } : meal));
  const addItem = (mealIdx: number) => setMeals(m => m.map((meal, idx) => idx === mealIdx
    ? { ...meal, items: [...(meal.items ?? []), { food: "", grams: "" }] }
    : meal));
  const removeItem = (mealIdx: number, itemIdx: number) => setMeals(m => m.map((meal, idx) => idx === mealIdx
    ? { ...meal, items: meal.items.filter((_: any, i: number) => i !== itemIdx) }
    : meal));
  const updateItem = (mealIdx: number, itemIdx: number, field: string, value: string) =>
    setMeals(m => m.map((meal, idx) => idx === mealIdx
      ? { ...meal, items: meal.items.map((item: any, i: number) => i === itemIdx ? { ...item, [field]: value } : item) }
      : meal));

  const foodNames = foodDb.map(f => f.name).sort();

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>Select Client</SectionLabel>
        <div className="flex gap-2 flex-wrap">
          {clients.map(c => (
            <button key={c.id} onClick={() => setSelectedUserId(c.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedUserId === c.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}>
              {c.name ?? `User ${c.id}`}
            </button>
          ))}
        </div>
      </div>

      {selectedUserId && (
        <>
          <div className="flex gap-2">
            {(["training", "rest"] as const).map(t => (
              <button key={t} onClick={() => setDayType(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                  dayType === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}>
                {t === "training" ? "Training Day" : "Rest Day"}
              </button>
            ))}
          </div>

          {/* Daily totals summary */}
          {meals.length > 0 && (
            <Card>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2 font-semibold">Daily Totals</p>
              <div className="flex gap-2 flex-wrap">
                <MacroChip label="Calories" value={dailyTotals.calories} unit="kcal" highlight />
                <MacroChip label="Protein" value={dailyTotals.protein} />
                <MacroChip label="Carbs" value={dailyTotals.carbs} />
                <MacroChip label="Fiber" value={dailyTotals.fiber} />
                <MacroChip label="Fat" value={dailyTotals.fat} />
              </div>
            </Card>
          )}

          <div className="space-y-4">
            {meals.map((meal, i) => (
              <Card key={i}>
                <div className="flex items-center gap-2 mb-3">
                  <input type="text" value={meal.name} onChange={e => updateMealName(i, e.target.value)}
                    placeholder="Meal name"
                    className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary" />
                  <input type="time" value={meal.time ?? ""} onChange={e => updateMealTime(i, e.target.value)}
                    className="w-28 bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                  <button onClick={() => removeMeal(i)} className="text-destructive hover:opacity-80">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-1 px-1">
                    <p className="col-span-6 text-[10px] text-muted-foreground">Food</p>
                    <p className="col-span-2 text-[10px] text-muted-foreground">Amount</p>
                    <p className="col-span-3 text-[10px] text-muted-foreground">Macros</p>
                    <p className="col-span-1"></p>
                  </div>
                  {(meal.items ?? []).map((item: any, j: number) => {
                    const selectedFood = foodDb.find(f => f.name === item.food);
                    const isServingBased = !!(selectedFood?.servingUnit && selectedFood?.servingGrams);
                    const amount = parseFloat(item.grams) || 0;
                    const m = calcItemMacros(foodDb, item.food, amount);
                    const hasData = item.food && amount > 0;
                    const effectiveGrams = isServingBased ? getItemGrams(foodDb, item.food, amount) : null;
                    return (
                      <div key={j} className="grid grid-cols-12 gap-1 items-center">
                        <div className="col-span-6">
                          <FoodCombobox
                            value={item.food}
                            onChange={v => updateItem(i, j, "food", v)}
                            foodNames={foodNames}
                          />
                        </div>
                        <div className="col-span-2 flex flex-col">
                          <input
                            type="number" min="0" step={isServingBased ? "0.5" : "1"}
                            value={item.grams}
                            onChange={e => updateItem(i, j, "grams", e.target.value)}
                            placeholder={isServingBased ? "qty" : "g"}
                            className="w-full bg-secondary border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          {isServingBased && (
                            <span className="text-[9px] text-muted-foreground text-center mt-0.5">{selectedFood.servingUnit}{effectiveGrams ? ` (${effectiveGrams}g)` : ""}</span>
                          )}
                          {!isServingBased && <span className="text-[9px] text-muted-foreground text-center mt-0.5">g</span>}
                        </div>
                        <div className="col-span-3 text-[10px] text-muted-foreground leading-tight">
                          {hasData ? (
                            <span className="text-foreground font-medium">{m.calories} kcal</span>
                          ) : <span className="text-muted-foreground/40">—</span>}
                          {hasData && <div className="text-[9px] text-muted-foreground">P{m.protein} C{m.carbs} F{m.fat}</div>}
                        </div>
                        <button onClick={() => removeItem(i, j)} className="col-span-1 flex justify-center text-destructive hover:opacity-80">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })}
                  <button onClick={() => addItem(i)} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-1">
                    <Plus size={12} /> Add Item
                  </button>
                </div>
                {/* Meal subtotal */}
                {(meal.items ?? []).some((it: any) => it.food && parseFloat(it.grams) > 0) && (
                  <div className="mt-3 pt-3 border-t border-border/50">
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1.5">Meal Total</p>
                    <div className="flex gap-2 flex-wrap">
                      <MacroChip label="Calories" value={mealMacros[i].calories} unit="kcal" highlight />
                      <MacroChip label="Protein" value={mealMacros[i].protein} />
                      <MacroChip label="Carbs" value={mealMacros[i].carbs} />
                      <MacroChip label="Fiber" value={mealMacros[i].fiber} />
                      <MacroChip label="Fat" value={mealMacros[i].fat} />
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>

          <button onClick={addMeal}
            className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors w-full justify-center">
            <Plus size={14} /> Add Meal
          </button>

          <div>
            <label className="text-xs text-muted-foreground block mb-1">Notes</label>
            <textarea value={planNotes} onChange={e => setPlanNotes(e.target.value)} rows={2}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
          </div>

          <button
            onClick={() => upsert.mutate({
              userId: selectedUserId, dayType, meals,
              totalCalories: dailyTotals.calories || undefined,
              totalProtein: dailyTotals.protein ? Math.round(dailyTotals.protein) : undefined,
              totalCarbs: dailyTotals.carbs ? Math.round(dailyTotals.carbs) : undefined,
              totalFat: dailyTotals.fat ? Math.round(dailyTotals.fat) : undefined,
              notes: planNotes || null,
            })}
            disabled={upsert.isPending}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save size={15} />
            {upsert.isPending ? "Saving..." : "Save Meal Plan"}
          </button>
        </>
      )}
    </div>
  );
}


// ─── Section: Client Progress ─────────────────────────────────────────────────
function ProgressSection() {
  const { clients, selectedUserId, setSelectedUserId } = useClientSelector();
  const { data: logs } = trpc.dailyLog.listForClient.useQuery(
    { userId: selectedUserId!, limit: 60 },
    { enabled: !!selectedUserId }
  );
  const { data: measurements } = trpc.measurements.listForClient.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );
  const { data: checkIns } = trpc.checkIn.listForClient.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );
  const { data: trainingProgram } = trpc.training.getForClient.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );
  const { data: workoutSessions = [] } = trpc.workoutSessions.listForClient.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );
  const { data: exerciseLib = [] } = trpc.exerciseLibrary.list.useQuery();
  const [allExpanded, setAllExpanded] = useState(true);

  // ── Calendar-day helpers ────────────────────────────────────────────────────
  const DAY = 86400000;
  function localDateStr(offsetDays: number): string {
    const d = new Date(Date.now() - offsetDays * DAY);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  const today = localDateStr(0);
  const day7 = localDateStr(7);   // start of current 7-day window
  const day14 = localDateStr(14); // start of previous 7-day window

  const allLogs = logs ?? [];
  // Current 7 calendar days (today - 6 days)
  const cur7 = allLogs.filter(l => { const d = toLocalDateStr(l.logDate); return d >= day7 && d <= today; });
  // Previous 7 calendar days (today - 13 days to today - 7 days)
  const prev7 = allLogs.filter(l => { const d = toLocalDateStr(l.logDate); return d >= day14 && d < day7; });

  // ── Metric helpers ──────────────────────────────────────────────────────────
  function avgOf(arr: (number | null | undefined)[]): number | null {
    const nums = arr.filter((v): v is number => v != null);
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  }
  function pctChange(cur: number | null, prev: number | null): string | null {
    if (cur == null || prev == null || prev === 0) return null;
    const pct = ((cur - prev) / prev) * 100;
    return (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%";
  }

  // ── 7-day averages ──────────────────────────────────────────────────────────
  const curAvgWeight = avgOf(cur7.map(l => l.weight as number | null));
  const prevAvgWeight = avgOf(prev7.map(l => l.weight as number | null));
  const weightPct = pctChange(curAvgWeight, prevAvgWeight);

  const curAvgHunger = avgOf(cur7.map(l => l.hungerLevel as number | null));
  const prevAvgHunger = avgOf(prev7.map(l => l.hungerLevel as number | null));

  const curAvgSleep = avgOf(cur7.map(l => l.sleepQuality as number | null));
  const prevAvgSleep = avgOf(prev7.map(l => l.sleepQuality as number | null));

  const curAvgSteps = avgOf(cur7.map(l => l.stepsCount as number | null));
  const prevAvgSteps = avgOf(prev7.map(l => l.stepsCount as number | null));

  // ── Meal adherence: on-plan days / total logged days in window ──────────────
  const isOffPlan = (v: unknown) => v === true || v === 1 || v === '1';
  const curOnPlan = cur7.filter(l => !isOffPlan(l.offPlanMeal)).length;
  const mealAdherence = cur7.length > 0 ? Math.round((curOnPlan / cur7.length) * 100) : null;
  const prevOnPlan = prev7.filter(l => !isOffPlan(l.offPlanMeal)).length;
  const prevMealAdherence = prev7.length > 0 ? Math.round((prevOnPlan / prev7.length) * 100) : null;

  // ── Training adherence: calendar-day window vs rotation length ──────────────
  const schedule = (trainingProgram?.schedule as string[] | null) ?? null;
  const programDays = (trainingProgram?.days as any[] | null) ?? null;
  const rotationLen = schedule?.length ?? programDays?.length ?? 7;
  const prescribedPerRotation = schedule
    ? schedule.filter((s: string) => s && s.toLowerCase() !== "off").length
    : programDays
      ? programDays.filter((d: any) => !String(d.name ?? d.label ?? "").toLowerCase().includes("off")).length
      : null;
  const rotationStart = localDateStr(rotationLen - 1);
  const rotationLogs = allLogs.filter(l => { const d = toLocalDateStr(l.logDate); return d >= rotationStart && d <= today; });
  const trainedInRotation = rotationLogs.filter(l => l.trainingCompleted).length;
  const trainingAdherence = prescribedPerRotation != null && prescribedPerRotation > 0
    ? Math.min(100, Math.round((trainedInRotation / prescribedPerRotation) * 100))
    : null;
  const trainingAdherenceLabel = prescribedPerRotation != null
    ? `${trainedInRotation}/${prescribedPerRotation} prescribed (${rotationLen}-day rotation)`
    : `${trainedInRotation} trained days`;

  // ── Weight trend chart: last 14 days ────────────────────────────────────────
  const weightData = allLogs
    .filter(l => l.weight != null)
    .slice(0, 14)
    .reverse()
    .map(l => {
      const d = toLocalDateStr(l.logDate);
      const [y, mo, dy] = d.split("-");
      return { date: `${dy} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][parseInt(mo)-1]}`, weight: l.weight };
    });

  // ── Measurements comparison ─────────────────────────────────────────────────
  const sortedMeasurements = [...(measurements ?? [])].sort((a, b) =>
    toLocalDateStr(b.measureDate).localeCompare(toLocalDateStr(a.measureDate))
  );
  const latestM = sortedMeasurements[0] ?? null;
  const prevM = sortedMeasurements[1] ?? null;
  function skinfoldTotal(m: typeof latestM): number | null {
    if (!m) return null;
    const avg = (vals: (number | null | undefined)[]) => {
      const nums = vals.filter((v): v is number => v != null);
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
    };
    const sites = [
      avg([m.umbilical1, m.umbilical2, m.umbilical3, m.umbilical4, m.umbilical5]),
      avg([m.suprailiac1, m.suprailiac2, m.suprailiac3, m.suprailiac4, m.suprailiac5]),
    ];
    const withData = sites.filter(v => v != null);
    return withData.length > 0 ? parseFloat(withData.reduce((a, b) => a! + b!, 0)!.toFixed(1)) : null;
  }
  const latestSkinfold = skinfoldTotal(latestM);
  const prevSkinfold = skinfoldTotal(prevM);
  const skinfoldDiff = latestSkinfold != null && prevSkinfold != null
    ? parseFloat((latestSkinfold - prevSkinfold).toFixed(1))
    : null;
  const waistDiff = latestM?.waist != null && prevM?.waist != null
    ? parseFloat(((latestM.waist as number) - (prevM.waist as number)).toFixed(1))
    : null;

  // ── Metric card helper ──────────────────────────────────────────────────────
  function ProgCard({ label, value, sub, change, changeColor }: {
    label: string; value: string; sub?: string;
    change?: string | null; changeColor?: "green" | "red" | "amber" | "neutral";
  }) {
    const colorMap = { green: "text-green-400", red: "text-red-400", amber: "text-amber-400", neutral: "text-muted-foreground" };
    return (
      <div className="bg-secondary rounded-xl p-3">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
        {change && <p className={`text-xs font-medium mt-1 ${colorMap[changeColor ?? "neutral"]}`}>{change} vs prev 7d</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>Select Client</SectionLabel>
        <div className="flex gap-2 flex-wrap">
          {clients.map(c => (
            <button key={c.id} onClick={() => setSelectedUserId(c.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectedUserId === c.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}>
              {c.name ?? `User ${c.id}`}
            </button>
          ))}
        </div>
      </div>

      {selectedUserId && (
        <>
          {/* ── 7-Day Metric Averages ─────────────────────────────────── */}
          <div>
            <SectionLabel>7-Day Averages (vs previous 7 days)</SectionLabel>
            <div className="grid grid-cols-2 gap-3">
              <ProgCard
                label="Avg Weight"
                value={curAvgWeight != null ? `${curAvgWeight.toFixed(1)} kg` : "—"}
                sub={prevAvgWeight != null ? `Prev: ${prevAvgWeight.toFixed(1)} kg` : undefined}
                change={weightPct ?? undefined}
                changeColor={weightPct ? (parseFloat(weightPct) < 0 ? "green" : "red") : "neutral"}
              />
              <ProgCard
                label="Training Adherence"
                value={trainingAdherence != null ? `${trainingAdherence}%` : "—"}
                sub={trainingAdherenceLabel}
              />
              <ProgCard
                label="Meal Adherence"
                value={mealAdherence != null ? `${mealAdherence}%` : "—"}
                sub={`${curOnPlan}/${cur7.length} on-plan days`}
                change={prevMealAdherence != null && mealAdherence != null
                  ? `${mealAdherence >= prevMealAdherence ? "+" : ""}${mealAdherence - prevMealAdherence}%`
                  : undefined}
                changeColor={mealAdherence != null && prevMealAdherence != null
                  ? (mealAdherence >= prevMealAdherence ? "green" : "red")
                  : "neutral"}
              />
              <ProgCard
                label="Avg Hunger"
                value={curAvgHunger != null ? `${curAvgHunger.toFixed(1)}/5` : "—"}
                sub={prevAvgHunger != null ? `Prev: ${prevAvgHunger.toFixed(1)}/5` : undefined}
                change={curAvgHunger != null && prevAvgHunger != null
                  ? `${(curAvgHunger - prevAvgHunger) >= 0 ? "+" : ""}${(curAvgHunger - prevAvgHunger).toFixed(1)}`
                  : undefined}
                changeColor={curAvgHunger != null && prevAvgHunger != null
                  ? (curAvgHunger <= prevAvgHunger ? "green" : "amber")
                  : "neutral"}
              />
              <ProgCard
                label="Avg Sleep Quality"
                value={curAvgSleep != null ? `${curAvgSleep.toFixed(1)}/5` : "—"}
                sub={prevAvgSleep != null ? `Prev: ${prevAvgSleep.toFixed(1)}/5` : undefined}
                change={curAvgSleep != null && prevAvgSleep != null
                  ? `${(curAvgSleep - prevAvgSleep) >= 0 ? "+" : ""}${(curAvgSleep - prevAvgSleep).toFixed(1)}`
                  : undefined}
                changeColor={curAvgSleep != null && prevAvgSleep != null
                  ? (curAvgSleep >= prevAvgSleep ? "green" : "red")
                  : "neutral"}
              />
              {(curAvgSteps != null || prevAvgSteps != null) && (
                <ProgCard
                  label="Avg Steps"
                  value={curAvgSteps != null ? Math.round(curAvgSteps).toLocaleString() : "—"}
                  sub={prevAvgSteps != null ? `Prev: ${Math.round(prevAvgSteps).toLocaleString()}` : undefined}
                  change={curAvgSteps != null && prevAvgSteps != null
                    ? `${(curAvgSteps - prevAvgSteps) >= 0 ? "+" : ""}${Math.round(curAvgSteps - prevAvgSteps).toLocaleString()}`
                    : undefined}
                  changeColor={curAvgSteps != null && prevAvgSteps != null
                    ? (curAvgSteps >= prevAvgSteps ? "green" : "amber")
                    : "neutral"}
                />
              )}
            </div>
          </div>

          {/* ── Weight Trend Chart ────────────────────────────────────── */}
          {weightData.length > 1 && (
            <div>
              <SectionLabel>Weight Trend (last 14 entries)</SectionLabel>
              <Card>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={weightData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                    <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis domain={["auto", "auto"]} tick={{ fill: "#666", fontSize: 10 }} width={36} />
                    <Tooltip contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8 }} labelStyle={{ color: "#fff" }} itemStyle={{ color: "#22c55e" }} formatter={(v: number) => [`${v} kg`, "Weight"]} />
                    <Line type="monotone" dataKey="weight" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: "#22c55e" }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}

          {/* ── Measurements Comparison ───────────────────────────────── */}
          {latestM && (
            <>
              <div>
                <SectionLabel>Waist Circumference</SectionLabel>
                <Card>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Latest · {toLocalDateStr(latestM.measureDate).split("-").reverse().join("/")}</p>
                      {latestM.waist != null ? (
                        <p className="text-2xl font-bold text-foreground">{latestM.waist} <span className="text-sm font-normal text-muted-foreground">cm</span></p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Not recorded</p>
                      )}
                    </div>
                    {waistDiff != null && prevM && (
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${waistDiff < 0 ? "text-green-400" : waistDiff > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                          {waistDiff > 0 ? "+" : ""}{waistDiff} cm
                        </p>
                        <p className="text-xs text-muted-foreground">vs {toLocalDateStr(prevM.measureDate).split("-").reverse().join("/")}</p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
              <div>
                <SectionLabel>Skinfold Thickness</SectionLabel>
                <Card className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-foreground">Latest · {toLocalDateStr(latestM.measureDate).split("-").reverse().join("/")}</p>
                      <p className="text-[11px] text-muted-foreground">avg of 5 readings per site</p>
                    </div>
                    {skinfoldDiff != null && prevM && (
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${skinfoldDiff < 0 ? "text-green-400" : skinfoldDiff > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                          {skinfoldDiff > 0 ? "+" : ""}{skinfoldDiff} mm
                        </p>
                        <p className="text-xs text-muted-foreground">vs {toLocalDateStr(prevM.measureDate).split("-").reverse().join("/")}</p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { label: "Umbilical", vals: [latestM.umbilical1, latestM.umbilical2, latestM.umbilical3, latestM.umbilical4, latestM.umbilical5] },
                      { label: "Suprailiac", vals: [latestM.suprailiac1, latestM.suprailiac2, latestM.suprailiac3, latestM.suprailiac4, latestM.suprailiac5] },

                    ] as { label: string; vals: (number | null | undefined)[] }[]).map(({ label, vals }) => {
                      const nums = vals.filter((v): v is number => v != null);
                      const siteAvg = nums.length ? parseFloat((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1)) : null;
                      return (
                        <div key={label} className="bg-secondary rounded-lg p-3">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
                          <p className="text-lg font-bold text-foreground mt-0.5">{siteAvg !== null ? <>{siteAvg} <span className="text-xs font-normal text-muted-foreground">mm</span></> : "—"}</p>
                        </div>
                      );
                    })}
                  </div>
                  {latestSkinfold !== null && (
                    <div className="border-t border-border pt-3 flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">Total</p>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">{latestSkinfold} mm</p>

                      </div>
                    </div>
                  )}
                </Card>
              </div>
            </>
          )}

          {/* Exercise Progress Cards */}
          {workoutSessions.length > 0 && (() => {
            // Muscle group label map
            const MUSCLE_LABELS: Record<string, string> = {
              chest: 'Chest', frontDelts: 'Front Delts', sideDelts: 'Side Delts',
              triceps: 'Triceps', lats: 'Lats', upperBack: 'Upper Back',
              rearDelts: 'Rear Delts', biceps: 'Biceps', quads: 'Quads',
              hams: 'Hamstrings', glutes: 'Glutes', calves: 'Calves', abs: 'Abs',
            };
            const MUSCLE_KEYS = Object.keys(MUSCLE_LABELS);

            // Build lookup: exerciseName -> primary muscle label
            const exToMuscle: Record<string, string> = {};
            for (const ex of (exerciseLib as any[])) {
              let best = 'Other', bestVal = 0;
              for (const m of MUSCLE_KEYS) {
                if ((ex[m] ?? 0) > bestVal) { bestVal = ex[m]; best = m; }
              }
              exToMuscle[ex.name] = MUSCLE_LABELS[best] ?? 'Other';
            }

            // Build per-exercise history
            const exerciseHistory: Record<string, Array<{ date: string; sets: Array<{ weight: number | null; reps: number | null }> }>> = {};
            for (const session of [...workoutSessions].reverse()) {
              const dateStr = toLocalDateStr(session.sessionDate);
              for (const ex of (session.exercises as any[])) {
                if (!exerciseHistory[ex.name]) exerciseHistory[ex.name] = [];
                exerciseHistory[ex.name].push({ date: dateStr, sets: ex.sets ?? [] });
              }
            }

            // Group exercises by muscle
            const byMuscle: Record<string, string[]> = {};
            for (const name of Object.keys(exerciseHistory)) {
              const group = exToMuscle[name] ?? 'Other';
              if (!byMuscle[group]) byMuscle[group] = [];
              byMuscle[group].push(name);
            }
            const muscleGroups = Object.keys(byMuscle).sort();

            return (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <SectionLabel>Exercise Progress</SectionLabel>
                  <button
                    onClick={() => setAllExpanded(v => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    {allExpanded ? <><ChevronUp className="w-3 h-3" /> Collapse All</> : <><ChevronDown className="w-3 h-3" /> Expand All</>}
                  </button>
                </div>
                <div className="space-y-3">
                  {muscleGroups.map(group => (
                    <MuscleGroupSection key={group} group={group} forceOpen={allExpanded}>
                      <div className="space-y-3">
                        {byMuscle[group].map(name => {
                          const history = exerciseHistory[name];
                          return (
                            <Card key={name}>
                              <p className="text-sm font-semibold text-foreground mb-2">{name}</p>
                              <div className="space-y-2">
                                {history.slice(-8).map((entry, i) => {
                                  const [y, m, d] = entry.date.split("-");
                                  const dateLabel = y && m && d ? `${d}/${m}/${y}` : entry.date;
                                  const set1 = entry.sets.find((s: any) => s.weight != null || s.reps != null) ?? null;
                                  return (
                                    <div key={i} className="flex items-center justify-between border-t border-border pt-2 first:border-0 first:pt-0">
                                      <p className="text-xs text-muted-foreground w-20 flex-shrink-0">{dateLabel}</p>
                                      {set1 ? (
                                        <p className="text-xs font-medium text-foreground">
                                          {(set1 as any).weight != null ? `${(set1 as any).weight}kg` : "—"} × {(set1 as any).reps != null ? (set1 as any).reps : "—"}
                                        </p>
                                      ) : (
                                        <p className="text-xs text-muted-foreground">No data</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </Card>
                          );
                        })}
                      </div>
                    </MuscleGroupSection>
                  ))}
                </div>
              </div>
            );
          })()}

          {(logs ?? []).length > 0 && (
            <div>
              <SectionLabel>Recent Daily Logs</SectionLabel>
              <Card>
                <div className="space-y-2">
                  {(logs ?? []).slice(0, 7).map(log => (
                    <div key={log.id} className="py-2 border-b border-border last:border-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">{String(log.logDate).slice(0, 10)}</p>
                          <p className="text-xs text-muted-foreground">{log.trainingType ?? (log.trainingCompleted ? "Training" : "Rest")}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {log.weight && <div className="text-right"><p className="text-sm font-semibold text-foreground">{log.weight} kg</p></div>}
                          {log.hungerLevel && <div className="text-right"><p className="text-[10px] text-muted-foreground">Hunger</p><p className="text-sm font-semibold text-foreground">{log.hungerLevel}/5</p></div>}
                          {log.sleepQuality && <div className="text-right"><p className="text-[10px] text-muted-foreground">Sleep</p><p className="text-sm font-semibold text-foreground">{log.sleepQuality}/5</p></div>}
                          {log.offPlanMeal && <span className="text-[10px] font-medium bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">Off Plan</span>}
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${log.trainingCompleted ? "bg-primary" : "bg-muted"}`} />
                        </div>
                      </div>
                      {log.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic pl-1 border-l-2 border-border">{log.notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Section: Exercise Library ───────────────────────────────────────────────
const MUSCLE_GROUPS = [
  { key: "chest", label: "Chest" },
  { key: "frontDelts", label: "Front Delts" },
  { key: "sideDelts", label: "Side Delts" },
  { key: "triceps", label: "Triceps" },
  { key: "lats", label: "Lats" },
  { key: "upperBack", label: "Upper Back" },
  { key: "rearDelts", label: "Rear Delts" },
  { key: "biceps", label: "Biceps" },
  { key: "quads", label: "Quads" },
  { key: "hams", label: "Hams" },
  { key: "glutes", label: "Glutes" },
  { key: "calves", label: "Calves" },
  { key: "abs", label: "Abs" },
] as const;

type MuscleKey = typeof MUSCLE_GROUPS[number]["key"];

type ExerciseRow = {
  id?: number;
  name: string;
  chest: number; frontDelts: number; sideDelts: number; triceps: number;
  lats: number; upperBack: number; rearDelts: number; biceps: number;
  quads: number; hams: number; glutes: number; calves: number; abs: number;
  videoUrl?: string;
};
const EMPTY_EXERCISE: ExerciseRow = {
  name: "", chest: 0, frontDelts: 0, sideDelts: 0, triceps: 0,
  lats: 0, upperBack: 0, rearDelts: 0, biceps: 0,
  quads: 0, hams: 0, glutes: 0, calves: 0, abs: 0,
  videoUrl: "",
};

function ExerciseLibrarySection() {
  const { data: exercises = [], refetch } = trpc.exerciseLibrary.list.useQuery();
  const upsert = trpc.exerciseLibrary.upsert.useMutation({ onSuccess: () => { refetch(); setEditing(null); toast.success("Saved"); } });
  const del = trpc.exerciseLibrary.delete.useMutation({ onSuccess: () => { refetch(); toast.success("Deleted"); } });

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ExerciseRow | null>(null);
  const [isNew, setIsNew] = useState(false);

  const filtered = exercises.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  function startNew() {
    setEditing({ ...EMPTY_EXERCISE });
    setIsNew(true);
  }

  function startEdit(ex: ExerciseRow) {
    setEditing({ ...ex });
    setIsNew(false);
  }

  function saveEditing() {
    if (!editing || !editing.name.trim()) { toast.error("Exercise name is required"); return; }
    upsert.mutate(editing as any);
  }

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search exercises…"
            className="w-full pl-8 pr-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus size={14} /> Add Exercise
        </button>
      </div>

      {/* Edit / Add form */}
      {editing && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{isNew ? "Add New Exercise" : `Edit: ${editing.name}`}</p>
            <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
          </div>
          <input
            value={editing.name}
            onChange={e => setEditing(prev => prev ? { ...prev, name: e.target.value } : prev)}
            placeholder="Exercise name"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div>
            <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Demo Video URL (YouTube)</label>
            <input
              value={editing.videoUrl ?? ""}
              onChange={e => setEditing(prev => prev ? { ...prev, videoUrl: e.target.value } : prev)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {MUSCLE_GROUPS.map(mg => (
              <div key={mg.key}>
                <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">{mg.label}</label>
                <input
                  type="number" step="0.25" min="0" max="2"
                  value={(editing as any)[mg.key] ?? 0}
                  onChange={e => setEditing(prev => prev ? { ...prev, [mg.key]: parseFloat(e.target.value) || 0 } : prev)}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg">Cancel</button>
            <button onClick={saveEditing} disabled={upsert.isPending} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
              <Save size={13} /> {upsert.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </Card>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold sticky left-0 bg-secondary/50 min-w-[180px]">Exercise</th>
              {MUSCLE_GROUPS.map(mg => (
                <th key={mg.key} className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-center min-w-[70px]">{mg.label}</th>
              ))}
              <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-center min-w-[80px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={MUSCLE_GROUPS.length + 2} className="text-center py-8 text-muted-foreground text-sm">No exercises found</td></tr>
            )}
            {filtered.map((ex, i) => (
              <tr key={ex.id} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? "" : "bg-secondary/10"}`}>
                <td className="px-4 py-2.5 font-medium text-foreground sticky left-0 bg-card">
                  <div className="flex items-center gap-2">
                    <span>{ex.name}</span>
                    {(ex as any).videoUrl && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/20 text-red-400"><Play size={8} />Video</span>}
                  </div>
                </td>
                {MUSCLE_GROUPS.map(mg => {
                  const val = (ex as any)[mg.key] as number ?? 0;
                  return (
                    <td key={mg.key} className="px-3 py-2.5 text-center">
                      {val > 0 ? (
                        <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${
                          val >= 1 ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary/70"
                        }`}>{val}</span>
                      ) : (
                        <span className="text-muted-foreground/30">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => startEdit(ex as ExerciseRow)} className="text-muted-foreground hover:text-primary transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => del.mutate({ id: ex.id! })} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} exercise{filtered.length !== 1 ? "s" : ""} · Values represent sets contributed per set performed (e.g. 0.5 = half a set)</p>
    </div>
  );
}

// ─── Section: Nutrition Data ────────────────────────────────────────────────
type FoodRow = {
  id?: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fiber: number;
  fat: number;
  servingUnit?: string | null;
  servingGrams?: number | null;
};
const EMPTY_FOOD: FoodRow = { name: "", calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0, servingUnit: null, servingGrams: null };
const MACRO_FIELDS = [
  { key: "calories" as const, label: "Calories", unit: "kcal", step: 1 },
  { key: "protein" as const, label: "Protein", unit: "g", step: 0.1 },
  { key: "carbs" as const, label: "Carbs", unit: "g", step: 0.1 },
  { key: "fiber" as const, label: "Fiber", unit: "g", step: 0.1 },
  { key: "fat" as const, label: "Fat", unit: "g", step: 0.1 },
];

function NutritionDataSection() {
  const { data: foods = [], refetch } = trpc.nutritionFoods.list.useQuery();
  const upsert = trpc.nutritionFoods.upsert.useMutation({ onSuccess: () => { refetch(); setEditing(null); toast.success("Saved"); } });
  const del = trpc.nutritionFoods.delete.useMutation({ onSuccess: () => { refetch(); toast.success("Deleted"); } });

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<FoodRow | null>(null);
  const [isNew, setIsNew] = useState(false);

  const filtered = foods.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  function startNew() { setEditing({ ...EMPTY_FOOD }); setIsNew(true); }
  function startEdit(f: FoodRow) { setEditing({ ...f }); setIsNew(false); }
  function saveEditing() {
    if (!editing || !editing.name.trim()) { toast.error("Food name is required"); return; }
    upsert.mutate(editing as any);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search foods…"
            className="w-full pl-8 pr-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={startNew}
          className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus size={14} /> Add Food
        </button>
      </div>

      {editing && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{isNew ? "Add New Food" : `Edit: ${editing.name}`}</p>
            <button onClick={() => setEditing(null)} className="text-muted-foreground hover:text-foreground"><X size={15} /></button>
          </div>
          <input
            value={editing.name}
            onChange={e => setEditing(prev => prev ? { ...prev, name: e.target.value } : prev)}
            placeholder="Food name"
            className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {MACRO_FIELDS.map(f => (
              <div key={f.key}>
                <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">{f.label} ({f.unit})</label>
                <input
                  type="number" step={f.step} min="0"
                  value={(editing as any)[f.key] ?? 0}
                  onChange={e => setEditing(prev => prev ? { ...prev, [f.key]: parseFloat(e.target.value) || 0 } : prev)}
                  className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            ))}
          </div>
          {/* Serving size fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Serving Unit <span className="normal-case font-normal">(e.g. egg, slice, tbsp)</span></label>
              <input
                type="text"
                value={(editing as any).servingUnit ?? ""}
                onChange={e => setEditing(prev => prev ? { ...prev, servingUnit: e.target.value || null } : prev)}
                placeholder="Leave blank for per 100g only"
                className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Grams per serving</label>
              <input
                type="number" step="0.1" min="0"
                value={(editing as any).servingGrams ?? ""}
                onChange={e => setEditing(prev => prev ? { ...prev, servingGrams: e.target.value ? parseFloat(e.target.value) : null } : prev)}
                placeholder="e.g. 50"
                className="w-full bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">All macro values are per 100g. Serving unit is optional — used in meal plans for unit-based foods.</p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditing(null)} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg">Cancel</button>
            <button onClick={saveEditing} disabled={upsert.isPending} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
              <Save size={13} /> {upsert.isPending ? "Saving…" : "Save"}
            </button>
          </div>
        </Card>
      )}

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="text-left px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold sticky left-0 bg-secondary/50 min-w-[200px]">Food</th>
              {MACRO_FIELDS.map(f => (
                <th key={f.key} className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-right min-w-[80px]">{f.label}<br /><span className="text-[9px] normal-case font-normal">(per 100g)</span></th>
              ))}
              <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-left min-w-[100px]">Serving</th>
              <th className="px-3 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-center min-w-[80px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="text-center py-8 text-muted-foreground text-sm">No foods found</td></tr>
            )}
            {filtered.map((food, i) => (
              <tr key={food.id} className={`border-b border-border/50 hover:bg-secondary/30 transition-colors ${i % 2 === 0 ? "" : "bg-secondary/10"}`}>
                <td className="px-4 py-2.5 font-medium text-foreground sticky left-0 bg-card">{food.name}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{food.calories}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{food.protein}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{food.carbs}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{food.fiber}</td>
                <td className="px-3 py-2.5 text-right text-foreground">{food.fat}</td>
                <td className="px-3 py-2.5 text-left text-foreground text-xs">
                  {(food as any).servingUnit ? <span className="text-muted-foreground">1 {(food as any).servingUnit} = {(food as any).servingGrams}g</span> : <span className="text-muted-foreground/40">—</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => startEdit(food as FoodRow)} className="text-muted-foreground hover:text-primary transition-colors"><Pencil size={13} /></button>
                    <button onClick={() => del.mutate({ id: food.id! })} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={13} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">{filtered.length} food{filtered.length !== 1 ? "s" : ""} · All nutritional values sourced from USDA FoodData Central (per 100g)</p>
    </div>
  );
}

// ─── Main CoachPanel ──────────────────────────────────────────────────────────
const SECTION_MAP: Record<string, React.ReactNode> = {
  clients: <ClientsSection />,
  training: <TrainingSection />,
  "meal-plans": <MealPlansSection />,
  progress: <ProgressSection />,
  "exercise-library": <ExerciseLibrarySection />,
  "nutrition-data": <NutritionDataSection />,
};
const SECTION_TITLES: Record<string, string> = {
  clients: "Clients",
  training: "Training Programs",
  "meal-plans": "Meal Plans",
  progress: "Client Progress",
  "exercise-library": "Exercise Library",
  "nutrition-data": "Nutrition Data",
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
      {SECTION_MAP[section] ?? <ClientsSection />}
    </DashboardShell>
  );
}
