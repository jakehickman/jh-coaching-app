import DashboardShell from "@/components/DashboardShell";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { Plus, Trash2, ChevronDown, ChevronUp, Save, Users, Dumbbell, Zap, ClipboardList, TrendingUp, GripVertical } from "lucide-react";
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
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">{children}</p>;
}
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-card border border-border rounded-xl p-4 ${className}`}>{children}</div>;
}

// ─── Sortable Exercise Row ───────────────────────────────────────────────────
function SortableExerciseRow({
  id, ex, dayIdx, exIdx, updateExercise, removeExercise
}: {
  id: string;
  ex: any;
  dayIdx: number;
  exIdx: number;
  updateExercise: (d: number, e: number, f: string, v: string) => void;
  removeExercise: (d: number, e: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [showNotes, setShowNotes] = useState(false);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
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
        <input type="text" value={ex.name} onChange={e => updateExercise(dayIdx, exIdx, "name", e.target.value)}
          placeholder="Exercise name"
          className="col-span-6 bg-secondary border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
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
  const upsertProfile = trpc.profile.upsertForClient.useMutation({
    onSuccess: () => { toast.success("Profile updated"); }
  });

  const [form, setForm] = useState({
    displayName: "", startDate: "", goalWeight: "", startWeight: "", showDate: "", notes: ""
  });

  useEffect(() => {
    if (profile) {
      setForm({
        displayName: profile.displayName ?? "",
        startDate: profile.startDate ? String(profile.startDate).slice(0, 10) : "",
        goalWeight: profile.goalWeight?.toString() ?? "",
        startWeight: profile.startWeight?.toString() ?? "",
        showDate: profile.showDate ? String(profile.showDate).slice(0, 10) : "",
        notes: profile.notes ?? "",
      });
    } else {
      setForm({ displayName: "", startDate: "", goalWeight: "", startWeight: "", showDate: "", notes: "" });
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
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "displayName", label: "Display Name", type: "text" },
                { key: "startDate", label: "Start Date", type: "date" },
                { key: "startWeight", label: "Start Weight (kg)", type: "number" },
                { key: "goalWeight", label: "Goal Weight (kg)", type: "number" },
                { key: "showDate", label: "Show Date", type: "date" },
              ].map(({ key, label, type }) => (
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
                displayName: form.displayName || undefined,
                startDate: form.startDate || undefined,
                goalWeight: form.goalWeight ? parseFloat(form.goalWeight) : undefined,
                startWeight: form.startWeight ? parseFloat(form.startWeight) : undefined,
                showDate: form.showDate || undefined,
                notes: form.notes || undefined,
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
  id, day, dayIdx, sensors, updateDay, removeDay, addExercise, removeExercise, updateExercise, handleExDragEnd
}: {
  id: string; day: any; dayIdx: number; sensors: any;
  updateDay: (i: number, f: string, v: string) => void;
  removeDay: (i: number) => void;
  addExercise: (i: number) => void;
  removeExercise: (d: number, e: number) => void;
  updateExercise: (d: number, e: number, f: string, v: string) => void;
  handleExDragEnd: (dayIdx: number) => (event: DragEndEvent) => void;
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
            className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-medium" />
          <input type="text" value={day.focus} onChange={e => updateDay(dayIdx, "focus", e.target.value)}
            placeholder="Focus (e.g. Upper Body)"
            className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
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
  const [copyFromId, setCopyFromId] = useState<string>("");
  const { data: allPrograms } = trpc.training.listAll.useQuery();

  useEffect(() => {
    if (program) {
      setProgramName(program.programName ?? "");
      setNotes(program.notes ?? "");
      setDays((program.days as any[]) ?? []);
    } else {
      setProgramName(""); setNotes(""); setDays([]);
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
  const handleCopyProgram = () => {
    if (!copyFromId) return;
    const source = allPrograms?.find((p: any) => p.userId === parseInt(copyFromId));
    if (source) {
      setProgramName(source.programName ?? "");
      setNotes(source.notes ?? "");
      setDays((source.days as any[]) ?? []);
      toast.success("Program copied — hit Save to apply");
    }
  };

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
          {allPrograms && allPrograms.filter((p: any) => p.userId !== selectedUserId).length > 0 && (
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground block mb-1">Copy program from</label>
                <select
                  value={copyFromId}
                  onChange={e => setCopyFromId(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">— select a client —</option>
                  {allPrograms
                    .filter((p: any) => p.userId !== selectedUserId)
                    .map((p: any) => (
                      <option key={p.userId} value={p.userId}>
                        {clients.find(c => c.id === p.userId)?.name ?? `User ${p.userId}`} — {p.programName ?? "Unnamed"}
                      </option>
                    ))}
                </select>
              </div>
              <button
                onClick={handleCopyProgram}
                disabled={!copyFromId}
                className="px-4 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground hover:border-primary/50 disabled:opacity-40 transition-colors"
              >
                Copy
              </button>
            </div>
          )}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Program Name</label>
            <input type="text" value={programName} onChange={e => setProgramName(e.target.value)}
              placeholder="e.g. 4-Day Upper/Lower"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
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
            onClick={() => upsert.mutate({ userId: selectedUserId, programName: programName || undefined, days, notes: notes || undefined })}
            disabled={upsert.isPending}
            className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save size={15} />
            {upsert.isPending ? "Saving..." : "Save Training Program"}
          </button>
        </>
      )}
    </div>
  );
}

// ─── Section: Meal Plans ──────────────────────────────────────────────────────
function MealPlansSection() {
  const { clients, selectedUserId, setSelectedUserId } = useClientSelector();
  const [dayType, setDayType] = useState<"training" | "rest">("training");
  const { data: plan, refetch } = trpc.mealPlan.getForClient.useQuery(
    { userId: selectedUserId!, dayType },
    { enabled: !!selectedUserId }
  );
  const upsert = trpc.mealPlan.upsert.useMutation({
    onSuccess: () => { toast.success("Meal plan saved"); refetch(); }
  });

  const [totals, setTotals] = useState({ calories: "", protein: "", carbs: "", fat: "" });
  const [planNotes, setPlanNotes] = useState("");
  const [meals, setMeals] = useState<any[]>([]);

  useEffect(() => {
    if (plan) {
      setTotals({
        calories: plan.totalCalories?.toString() ?? "",
        protein: plan.totalProtein?.toString() ?? "",
        carbs: plan.totalCarbs?.toString() ?? "",
        fat: plan.totalFat?.toString() ?? "",
      });
      setPlanNotes(plan.notes ?? "");
      setMeals((plan.meals as any[]) ?? []);
    } else {
      setTotals({ calories: "", protein: "", carbs: "", fat: "" });
      setPlanNotes(""); setMeals([]);
    }
  }, [plan, dayType]);

  const addMeal = () => setMeals(m => [...m, { name: `Meal ${m.length + 1}`, items: [], macros: {} }]);
  const removeMeal = (i: number) => setMeals(m => m.filter((_, idx) => idx !== i));
  const updateMealName = (i: number, name: string) => setMeals(m => m.map((meal, idx) => idx === i ? { ...meal, name } : meal));
  const addItem = (mealIdx: number) => setMeals(m => m.map((meal, idx) => idx === mealIdx
    ? { ...meal, items: [...(meal.items ?? []), { food: "", amount: "", calories: "" }] }
    : meal));
  const removeItem = (mealIdx: number, itemIdx: number) => setMeals(m => m.map((meal, idx) => idx === mealIdx
    ? { ...meal, items: meal.items.filter((_: any, i: number) => i !== itemIdx) }
    : meal));
  const updateItem = (mealIdx: number, itemIdx: number, field: string, value: string) =>
    setMeals(m => m.map((meal, idx) => idx === mealIdx
      ? { ...meal, items: meal.items.map((item: any, i: number) => i === itemIdx ? { ...item, [field]: value } : item) }
      : meal));

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

          <div className="grid grid-cols-4 gap-3">
            {[
              { key: "calories", label: "Calories" },
              { key: "protein", label: "Protein (g)" },
              { key: "carbs", label: "Carbs (g)" },
              { key: "fat", label: "Fat (g)" },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="text-xs text-muted-foreground block mb-1">{label}</label>
                <input type="number" value={(totals as any)[key]}
                  onChange={e => setTotals(t => ({ ...t, [key]: e.target.value }))}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {meals.map((meal, i) => (
              <Card key={i}>
                <div className="flex items-center gap-2 mb-3">
                  <input type="text" value={meal.name} onChange={e => updateMealName(i, e.target.value)}
                    className="flex-1 bg-secondary border border-border rounded-lg px-3 py-1.5 text-sm text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary" />
                  <button onClick={() => removeMeal(i)} className="text-destructive hover:opacity-80">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="space-y-2">
                  <div className="grid grid-cols-12 gap-1 px-1">
                    <p className="col-span-5 text-[10px] text-muted-foreground">Food</p>
                    <p className="col-span-3 text-[10px] text-muted-foreground">Amount</p>
                    <p className="col-span-3 text-[10px] text-muted-foreground">Calories</p>
                    <p className="col-span-1 text-[10px] text-muted-foreground"></p>
                  </div>
                  {(meal.items ?? []).map((item: any, j: number) => (
                    <div key={j} className="grid grid-cols-12 gap-1 items-center">
                      <input type="text" value={item.food} onChange={e => updateItem(i, j, "food", e.target.value)}
                        placeholder="Food item"
                        className="col-span-5 bg-secondary border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                      <input type="text" value={item.amount} onChange={e => updateItem(i, j, "amount", e.target.value)}
                        placeholder="200g"
                        className="col-span-3 bg-secondary border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                      <input type="text" value={item.calories} onChange={e => updateItem(i, j, "calories", e.target.value)}
                        placeholder="kcal"
                        className="col-span-3 bg-secondary border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                      <button onClick={() => removeItem(i, j)} className="col-span-1 flex justify-center text-destructive hover:opacity-80">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addItem(i)} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-1">
                    <Plus size={12} /> Add Item
                  </button>
                </div>
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
              totalCalories: totals.calories ? parseInt(totals.calories) : undefined,
              totalProtein: totals.protein ? parseInt(totals.protein) : undefined,
              totalCarbs: totals.carbs ? parseInt(totals.carbs) : undefined,
              totalFat: totals.fat ? parseInt(totals.fat) : undefined,
              notes: planNotes || undefined,
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

// ─── Section: Coaching Notes ──────────────────────────────────────────────────
function NotesSection() {
  const { clients, selectedUserId, setSelectedUserId } = useClientSelector();
  const { data: notes, refetch } = trpc.notes.list.useQuery(
    { clientId: selectedUserId! },
    { enabled: !!selectedUserId }
  );
  const addNote = trpc.notes.add.useMutation({
    onSuccess: () => { toast.success("Note added"); refetch(); setContent(""); }
  });

  const [content, setContent] = useState("");
  const [category, setCategory] = useState("General");
  const today = new Date().toISOString().slice(0, 10);

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
          <Card className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Add Note</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                  <option>General</option>
                  <option>Training</option>
                  <option>Nutrition</option>
                  <option>Progress</option>
                  <option>Mindset</option>
                  <option>Adjustment</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Note</label>
              <textarea value={content} onChange={e => setContent(e.target.value)} rows={4}
                placeholder="Write your coaching note here..."
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
            </div>
            <button
              onClick={() => addNote.mutate({ clientId: selectedUserId, noteDate: today, content, category })}
              disabled={!content.trim() || addNote.isPending}
              className="w-full py-2.5 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {addNote.isPending ? "Saving..." : "Add Note"}
            </button>
          </Card>

          <div>
            <SectionLabel>Note History</SectionLabel>
            {(notes ?? []).length === 0 && (
              <Card className="text-center py-8">
                <p className="text-muted-foreground text-sm">No notes yet for this client.</p>
              </Card>
            )}
            <div className="space-y-3">
              {(notes ?? []).map(note => (
                <Card key={note.id}>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{note.category ?? "General"}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">{String(note.noteDate).slice(0, 10)}</p>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed">{note.content}</p>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Section: Client Progress ─────────────────────────────────────────────────
function ProgressSection() {
  const { clients, selectedUserId, setSelectedUserId } = useClientSelector();
  const { data: logs } = trpc.dailyLog.listForClient.useQuery(
    { userId: selectedUserId!, limit: 30 },
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

  const weightData = (logs ?? []).filter(l => l.weight).slice(0, 14).reverse()
    .map(l => ({ date: String(l.logDate).slice(5), weight: l.weight }));

  const recentLogs = (logs ?? []).slice(0, 7);
  const trainedDays = recentLogs.filter(l => l.trainingCompleted).length;
  const adherence = recentLogs.length > 0 ? Math.round((trainedDays / recentLogs.length) * 100) : 0;
  const weights = recentLogs.filter(l => l.weight).map(l => l.weight as number);
  const avgWeight = weights.length > 0 ? (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1) : "—";

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
          <div className="grid grid-cols-3 gap-3">
            <Card><p className="text-[10px] text-muted-foreground uppercase tracking-wider">7-Day Avg</p><p className="text-xl font-bold text-foreground mt-1">{avgWeight} kg</p></Card>
            <Card><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Training</p><p className="text-xl font-bold text-foreground mt-1">{adherence}%</p></Card>
            <Card><p className="text-[10px] text-muted-foreground uppercase tracking-wider">Measurements</p><p className="text-xl font-bold text-foreground mt-1">{(measurements ?? []).length}</p></Card>
          </div>

          {weightData.length > 1 && (
            <div>
              <SectionLabel>Weight Trend</SectionLabel>
              <Card>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={weightData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                    <XAxis dataKey="date" tick={{ fill: "#666", fontSize: 11 }} />
                    <YAxis domain={["auto", "auto"]} tick={{ fill: "#666", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#111", border: "1px solid #222", borderRadius: 8 }} labelStyle={{ color: "#fff" }} itemStyle={{ color: "#22c55e" }} />
                    <Line type="monotone" dataKey="weight" stroke="#22c55e" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}

          {(measurements ?? []).length > 0 && (
            <div>
              <SectionLabel>Latest Measurements</SectionLabel>
              <Card>
                {(() => {
                  const m = measurements![0];
                  return (
                    <div>
                      <p className="text-xs text-muted-foreground mb-3">{String(m.measureDate).slice(0, 10)}</p>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: "Weight", value: m.weight, unit: "kg" },
                          { label: "Waist", value: m.waist, unit: "cm" },
                          { label: "Chest", value: m.chest, unit: "cm" },
                          { label: "Hips", value: m.hips, unit: "cm" },
                          { label: "L Arm", value: m.leftArm, unit: "cm" },
                          { label: "R Arm", value: m.rightArm, unit: "cm" },
                          { label: "L Thigh", value: m.leftThigh, unit: "cm" },
                          { label: "Body Fat", value: m.bodyFatPercent, unit: "%" },
                        ].filter(x => x.value).map(({ label, value, unit }) => (
                          <div key={label}>
                            <p className="text-[10px] text-muted-foreground">{label}</p>
                            <p className="text-sm font-semibold text-foreground">{value}{unit}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </Card>
            </div>
          )}

          {(logs ?? []).length > 0 && (
            <div>
              <SectionLabel>Recent Daily Logs</SectionLabel>
              <Card>
                <div className="space-y-2">
                  {(logs ?? []).slice(0, 7).map(log => (
                    <div key={log.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                      <div>
                        <p className="text-sm font-medium text-foreground">{String(log.logDate).slice(0, 10)}</p>
                        <p className="text-xs text-muted-foreground">{log.trainingType ?? (log.trainingCompleted ? "Training" : "Rest")}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        {log.weight && <div className="text-right"><p className="text-sm font-semibold text-foreground">{log.weight} kg</p></div>}
                        {log.energyLevel && <div className="text-right"><p className="text-xs text-muted-foreground">Energy</p><p className="text-sm font-semibold text-foreground">{log.energyLevel}/10</p></div>}
                        <div className={`w-2 h-2 rounded-full ${log.trainingCompleted ? "bg-primary" : "bg-muted"}`} />
                      </div>
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

// ─── Main CoachPanel ──────────────────────────────────────────────────────────
const SECTION_MAP: Record<string, React.ReactNode> = {
  clients: <ClientsSection />,
  training: <TrainingSection />,
  "meal-plans": <MealPlansSection />,
  notes: <NotesSection />,
  progress: <ProgressSection />,
};

const SECTION_TITLES: Record<string, string> = {
  clients: "Clients",
  training: "Training Programs",
  "meal-plans": "Meal Plans",
  notes: "Coaching Notes",
  progress: "Client Progress",
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
