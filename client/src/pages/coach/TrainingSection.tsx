import React, { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { toUTCDateStr as toLocalDateStr } from "@/lib/dates";
import { Plus, Trash2, ChevronDown, ChevronUp, Save, GripVertical, Check, ChevronsUpDown, Users, ArrowUp, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, SectionLabel, DateInput, ClientCombobox, useClientSelector } from "./shared";
import { MUSCLE_GROUPS } from "./ExerciseLibrarySection";


function SortableScheduleSlot({
  id, slot, index, dayOptions, onUpdate, onRemove, isLast
}: {
  id: string;
  slot: string;
  index: number;
  dayOptions: string[];
  onUpdate: (i: number, val: string) => void;
  onRemove: (i: number) => void;
  isLast: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-1">
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground/40 hover:text-muted-foreground p-0.5 touch-none"
      >
        <GripVertical size={12} />
      </div>
      <select
        value={slot}
        onChange={e => onUpdate(index, e.target.value)}
        className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {dayOptions.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <button onClick={() => onRemove(index)} className="text-muted-foreground hover:text-destructive">
        <Trash2 size={12} />
      </button>
      {!isLast && (
        <span className="text-muted-foreground/40 text-xs select-none">/</span>
      )}
    </div>
  );
}

// ─── Sortable Exercise Row ───────────────────────────────────────────────────
function SortableExerciseRow({
  id, ex, dayIdx, exIdx, updateExercise, removeExercise, exerciseNames, addExercise, totalExercises
}: {
  id: string;
  ex: any;
  dayIdx: number;
  exIdx: number;
  updateExercise: (d: number, e: number, f: string, v: string) => void;
  removeExercise: (d: number, e: number) => void;
  exerciseNames: string[];
  addExercise: (dayIdx: number) => void;
  totalExercises: number;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [showNotes, setShowNotes] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const setsRef = useRef<HTMLInputElement>(null);
  const repsRef = useRef<HTMLInputElement>(null);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const filtered = searchTerm.length > 0
    ? exerciseNames.filter(n => n.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 8)
    : exerciseNames.slice(0, 8);

  // Focus the exercise input on the next row, or add a new row if this is the last one
  const focusNextRow = () => {
    const isLastRow = exIdx === totalExercises - 1;
    if (isLastRow) {
      addExercise(dayIdx);
      // After state update, focus will be handled by the new row mounting
      setTimeout(() => {
        const nextInput = document.querySelector<HTMLInputElement>(
          `[data-day="${dayIdx}"][data-ex="${exIdx + 1}"][data-field="exercise"]`
        );
        nextInput?.focus();
      }, 50);
    } else {
      const nextInput = document.querySelector<HTMLInputElement>(
        `[data-day="${dayIdx}"][data-ex="${exIdx + 1}"][data-field="exercise"]`
      );
      nextInput?.focus();
    }
  };

  const handleExerciseKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (dropdownOpen && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIdx(i => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIdx(i => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const idx = highlightedIdx >= 0 ? highlightedIdx : 0;
        updateExercise(dayIdx, exIdx, "name", filtered[idx]);
        setSearchTerm("");
        setDropdownOpen(false);
        setHighlightedIdx(-1);
        setTimeout(() => setsRef.current?.focus(), 0);
      } else if (e.key === "Escape") {
        setDropdownOpen(false);
        setHighlightedIdx(-1);
      } else if (e.key === "Tab") {
        // Let Tab close dropdown and move to sets naturally
        setDropdownOpen(false);
        setHighlightedIdx(-1);
      }
    } else if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      if (e.key === "Enter") e.preventDefault();
      setsRef.current?.focus();
    }
  };

  const handleSetsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || (e.key === "Tab" && !e.shiftKey)) {
      if (e.key === "Enter") { e.preventDefault(); repsRef.current?.focus(); }
    }
  };

  const handleRepsKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      focusNextRow();
    }
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
        {/* Searchable exercise dropdown */}
        <div className="col-span-6 relative">
          <input
            type="text"
            data-day={dayIdx}
            data-ex={exIdx}
            data-field="exercise"
            value={dropdownOpen ? searchTerm : ex.name}
            onChange={e => { setSearchTerm(e.target.value); setDropdownOpen(true); setHighlightedIdx(-1); }}
            onFocus={() => { setSearchTerm(""); setDropdownOpen(true); setHighlightedIdx(-1); }}
            onBlur={() => setTimeout(() => { setDropdownOpen(false); setHighlightedIdx(-1); }, 150)}
            onKeyDown={handleExerciseKeyDown}
            className="w-full bg-secondary border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {dropdownOpen && filtered.length > 0 && (
            <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-card border border-border rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto">
              {filtered.map((name, idx) => (
                <button
                  key={name}
                  type="button"
                  onMouseDown={() => {
                    updateExercise(dayIdx, exIdx, "name", name);
                    setSearchTerm("");
                    setDropdownOpen(false);
                    setHighlightedIdx(-1);
                    setTimeout(() => setsRef.current?.focus(), 0);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                    idx === highlightedIdx
                      ? "bg-primary/20 text-primary"
                      : "text-foreground hover:bg-primary/10 hover:text-primary"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          ref={setsRef}
          type="text"
          value={ex.sets}
          onChange={e => updateExercise(dayIdx, exIdx, "sets", e.target.value)}
          onKeyDown={handleSetsKeyDown}
          className="col-span-2 bg-secondary border border-border rounded px-2 py-1.5 text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary" />
        <input
          ref={repsRef}
          type="text"
          value={ex.reps}
          onChange={e => updateExercise(dayIdx, exIdx, "reps", e.target.value)}
          onKeyDown={handleRepsKeyDown}
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

            className="w-full bg-secondary/50 border border-border/50 rounded px-2 py-1 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:text-foreground"
          />
        </div>
      )}
    </div>
  );
}

// ─── Food Combobox ──────────────────────────────────────────────────────────
function FoodCombobox({
  value, onChange, foodNames, onSelectAdvance, mealIdx, itemIdx
}: {
  value: string;
  onChange: (v: string) => void;
  foodNames: string[];
  onSelectAdvance?: () => void;
  mealIdx?: number;
  itemIdx?: number;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const filtered = search.length > 0
    ? foodNames.filter(n => n.toLowerCase().includes(search.toLowerCase())).slice(0, 10)
    : foodNames.slice(0, 10);

  const selectItem = (name: string) => {
    onChange(name);
    setSearch("");
    setOpen(false);
    setHighlightedIdx(-1);
    setTimeout(() => onSelectAdvance?.(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (open && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIdx(i => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIdx(i => Math.max(i - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        selectItem(filtered[highlightedIdx >= 0 ? highlightedIdx : 0]);
      } else if (e.key === "Escape") {
        setOpen(false);
        setHighlightedIdx(-1);
      } else if (e.key === "Tab") {
        setOpen(false);
        setHighlightedIdx(-1);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      onSelectAdvance?.();
    }
  };

  return (
    <div className="relative w-full">
      <input
        type="text"
        data-meal={mealIdx}
        data-item={itemIdx}
        data-field="food"
        value={open ? search : value}
        onChange={e => { setSearch(e.target.value); setOpen(true); setHighlightedIdx(-1); }}
        onFocus={() => { setSearch(""); setOpen(true); setHighlightedIdx(-1); }}
        onBlur={() => setTimeout(() => { setOpen(false); setHighlightedIdx(-1); }, 150)}
        onKeyDown={handleKeyDown}
        placeholder="Search food…"
        className="w-full bg-secondary border border-border rounded px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-card border border-border rounded-lg shadow-xl overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map((name, idx) => (
            <button
              key={name}
              type="button"
              onMouseDown={() => selectItem(name)}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                idx === highlightedIdx
                  ? "bg-primary/20 text-primary"
                  : "text-foreground hover:bg-primary/10 hover:text-primary"
              }`}
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

// ─── Section: Clients ─────────────────────────────────────────────────────────
function ClientsSection() {
  const { data: allUsers, refetch } = trpc.users.list.useQuery();
  const { data: latestCheckIns = [] } = trpc.checkIn.latestPerClient.useQuery();
  const [seenKeys, setSeenKeys] = useState<Record<number, number>>(() => {
    const out: Record<number, number> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('coach:seen:checkin:')) {
        const id = parseInt(k.replace('coach:seen:checkin:', ''), 10);
        out[id] = parseInt(localStorage.getItem(k) ?? '0', 10);
      }
    }
    return out;
  });
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key?.startsWith('coach:seen:checkin:')) {
        const id = parseInt(e.key.replace('coach:seen:checkin:', ''), 10);
        setSeenKeys(prev => ({ ...prev, [id]: parseInt(e.newValue ?? '0', 10) }));
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);
  const utils = trpc.useUtils();
  const setApproved = trpc.users.setApproved.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      toast.success("Access updated");
    },
  });
  const deleteUser = trpc.users.delete.useMutation({
    onSuccess: () => {
      utils.users.list.invalidate();
      setSelectedId(null);
      toast.success("User deleted");
    },
    onError: (e) => toast.error(e.message),
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data: profile } = trpc.profile.getById.useQuery(
    { userId: selectedId! },
    { enabled: !!selectedId }
  );
  const upsertProfile = trpc.profile.upsertForClient.useMutation({
    onSuccess: () => {
      toast.success("Profile updated");
      utils.profile.getById.invalidate({ userId: selectedId! });
    }
  });

  const updateClientConfig = trpc.clientConfig.update.useMutation({
    onSuccess: () => {
      toast.success("Config updated");
      utils.profile.getById.invalidate({ userId: selectedId! });
    }
  });

  const [form, setForm] = useState({
    displayName: "",
    startDate: "", notes: "",
    checkInDay: "" as "" | "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday",
    stepGoal: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        displayName: (profile as any).displayName ?? "",
        startDate: profile.startDate ? toLocalDateStr(profile.startDate) : "",
        notes: profile.notes ?? "",
        checkInDay: ((profile as any).checkInDay ?? "") as any,
        stepGoal: (profile as any).stepGoal?.toString() ?? "",
      });
    } else {
      setForm({ displayName: "", startDate: "", notes: "", checkInDay: "", stepGoal: "" });
    }
  }, [profile, selectedId]);

  const clients = allUsers ?? [];

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="flex items-center gap-4">
        <div className="bg-card border border-border rounded-lg px-5 py-3 flex items-center gap-3">
          <Users size={16} className="text-muted-foreground" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Clients</p>
            <p className="text-xl font-bold text-foreground">{clients.length}</p>
          </div>
        </div>
      </div>

      {/* Two-column desktop layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
        {/* Left: client list */}
        <div>
          <SectionLabel>All Users</SectionLabel>
          <div className="space-y-1.5">
            {(allUsers ?? []).map(user => (
              <div
                key={user.id}
                onClick={() => setSelectedId(user.id === selectedId ? null : user.id)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                  selectedId === user.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-border/80"
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                    {user.name?.charAt(0)?.toUpperCase() ?? "?"}
                  </div>
                  {null}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{user.name ?? "Unnamed"}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email ?? "No email"}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${user.role === "admin" ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground"}`}>
                    {user.role}
                  </span>
                  {user.role !== "admin" && (
                    <>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setApproved.mutate({ userId: user.id, approved: !(user as any).approved });
                        }}
                        className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                          (user as any).approved
                            ? "border-primary/40 text-primary bg-primary/10 hover:bg-primary/20"
                            : "border-border text-muted-foreground bg-secondary hover:border-primary/40 hover:text-primary"
                        }`}
                      >
                        {(user as any).approved ? "Approved" : "Approve"}
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (window.confirm(`Delete ${user.name ?? 'this user'}? This cannot be undone.`)) {
                            deleteUser.mutate({ userId: user.id });
                          }
                        }}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        title="Delete user"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: profile form */}
        {selectedId ? (
          <div className="space-y-4">
            {(
              <Card className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Client Name</label>
                  <input
                    type="text"
                    value={form.displayName}
                    onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-xs text-muted-foreground block mb-1">Start Date</label>
                    <DateInput value={form.startDate} onChange={v => setForm(p => ({ ...p, startDate: v }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Check-in Day</label>
                    <select
                      value={form.checkInDay}
                      onChange={e => setForm(p => ({ ...p, checkInDay: e.target.value as any }))}
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Not set</option>
                      {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => (
                        <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Daily Step Goal</label>
                    <input
                      type="number"
                      value={form.stepGoal}
                      onChange={e => setForm(p => ({ ...p, stepGoal: e.target.value }))}
                      placeholder="e.g. 10000"
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                  />
                </div>
                <button
                  onClick={() => {
                    upsertProfile.mutate({
                      userId: selectedId,
                      displayName: form.displayName || undefined,
                      startDate: form.startDate || undefined,
                      notes: form.notes || null,
                    });
                    updateClientConfig.mutate({
                      userId: selectedId,
                      checkInDay: form.checkInDay || null,
                      stepGoal: form.stepGoal ? parseInt(form.stepGoal) : null,
                    });
                  }}
                  disabled={upsertProfile.isPending || updateClientConfig.isPending}
                  className="w-full py-2 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {(upsertProfile.isPending || updateClientConfig.isPending) ? 'Saving...' : 'Save Profile'}
                </button>
              </Card>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-40 text-sm text-muted-foreground border border-dashed border-border rounded-xl">
            Select a client to view their profile
          </div>
        )}
      </div>
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
                  addExercise={addExercise}
                  totalExercises={(day.exercises ?? []).length}
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

export default function TrainingSection() {
  const { clients, selectedUserId, setSelectedUserId } = useClientSelector();
  const { data: latestCheckIns = [] } = trpc.checkIn.latestPerClient.useQuery();
  const { data: program, refetch } = trpc.training.getForClient.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );
  const trainingDraftKey = selectedUserId ? `draft:training:${selectedUserId}` : null;

  const [programName, setProgramName] = useState("");
  const [notes, setNotes] = useState("");
  const [days, setDays] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<string[]>([]);

  // Snapshot of the last server-saved state — used to detect genuine changes
  const trainingSavedSnapshot = useRef<{ programName: string; notes: string; days: any[]; schedule: string[] } | null>(null);

  const upsert = trpc.training.upsert.useMutation({
    onSuccess: () => {
      // Update snapshot to current state and clear draft
      trainingSavedSnapshot.current = { programName, notes, days, schedule };
      if (trainingDraftKey) { try { localStorage.removeItem(trainingDraftKey); } catch {} }
      toast.success("Training program saved"); refetch();
    }
  });

  // Write draft only when state genuinely differs from the saved snapshot
  useEffect(() => {
    if (!trainingDraftKey || !trainingSavedSnapshot.current) return;
    const snap = trainingSavedSnapshot.current;
    const isDirty =
      programName !== snap.programName ||
      notes !== snap.notes ||
      JSON.stringify(days) !== JSON.stringify(snap.days) ||
      JSON.stringify(schedule) !== JSON.stringify(snap.schedule);
    if (isDirty) {
      try { localStorage.setItem(trainingDraftKey, JSON.stringify({ programName, notes, days, schedule })); window.dispatchEvent(new Event("draft-changed")); } catch {}
    } else {
      try { localStorage.removeItem(trainingDraftKey); } catch {}
    }
  }, [trainingDraftKey, programName, notes, days, schedule]);
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
  const trainingServerLoadedRef = useRef<number | null>(null);
  useEffect(() => {
    if (!selectedUserId) return;
    if (trainingServerLoadedRef.current === selectedUserId) return; // already loaded
    if (program === undefined) return; // still fetching
    const serverName = program?.programName ?? "";
    const serverNotes = program?.notes ?? "";
    const serverDays = (program?.days as any[]) ?? [];
    const serverSchedule = (program?.schedule as string[]) ?? [];
    setProgramName(serverName);
    setNotes(serverNotes);
    setDays(serverDays);
    setSchedule(serverSchedule);
    trainingSavedSnapshot.current = { programName: serverName, notes: serverNotes, days: serverDays, schedule: serverSchedule };
    // Clear any stale draft since we just loaded fresh server data
    if (trainingDraftKey) { try { localStorage.removeItem(trainingDraftKey); } catch {} }
    trainingServerLoadedRef.current = selectedUserId;
  }, [program, selectedUserId]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const reorderSchedule = (oldIndex: number, newIndex: number) =>
    setSchedule(s => arrayMove(s, oldIndex, newIndex));
  const handleScheduleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = parseInt(String(active.id).replace('slot-', ''));
      const newIndex = parseInt(String(over.id).replace('slot-', ''));
      if (!isNaN(oldIndex) && !isNaN(newIndex)) reorderSchedule(oldIndex, newIndex);
    }
  };

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
        <ClientCombobox clients={clients} selectedUserId={selectedUserId} onSelect={setSelectedUserId} latestCheckIns={latestCheckIns} />
      </div>
      {selectedUserId && (
        <div className="space-y-6">
          {/* ── Training Schedule ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs text-muted-foreground">Training Schedule</label>
              <span className="text-[10px] text-muted-foreground/60">defines the rotation for this client</span>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleScheduleDragEnd}>
              <SortableContext items={schedule.map((_, i) => `slot-${i}`)} strategy={horizontalListSortingStrategy}>
                <div className="flex flex-wrap gap-2 items-center">
                  {schedule.map((slot, i) => (
                    <SortableScheduleSlot
                      key={`slot-${i}`}
                      id={`slot-${i}`}
                      slot={slot}
                      index={i}
                      dayOptions={dayOptions}
                      onUpdate={updateScheduleSlot}
                      onRemove={removeScheduleSlot}
                      isLast={i === schedule.length - 1}
                    />
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
              </SortableContext>
            </DndContext>
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
            <div>
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
        </div>
      )}
    </div>
  );
}
