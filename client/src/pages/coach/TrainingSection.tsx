import React, { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { toUTCDateStr as toLocalDateStr } from "@/lib/dates";
import { Plus, Trash2, ChevronDown, ChevronUp, Save, GripVertical, Check, ChevronsUpDown, Users, ArrowUp, ArrowDown, LayoutList, LayoutGrid } from "lucide-react";
import KanbanProgramView from "./KanbanProgramView";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type UniqueIdentifier,
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

const REPS_OPTIONS = ["4–6", "7–9", "10–12", "12–15", "15–20", "AMRAP"];

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
        className="bg-secondary border border-border rounded-lg px-2 py-1.5 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
            className="w-full bg-secondary border border-border rounded px-2 py-1.5 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
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
                  className={`w-full text-left px-3 py-1.5 text-[13px] transition-colors ${
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
          className="col-span-2 bg-secondary border border-border rounded px-2 py-1.5 text-[13px] text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary" />
        <select
          ref={repsRef as any}
          value={REPS_OPTIONS.includes(ex.reps) ? ex.reps : "__custom__"}
          onChange={e => {
            if (e.target.value !== "__custom__") updateExercise(dayIdx, exIdx, "reps", e.target.value);
          }}
          className="col-span-2 bg-secondary border border-border rounded px-2 py-1.5 text-[13px] text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer">
          {REPS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          {!REPS_OPTIONS.includes(ex.reps) && ex.reps && <option value="__custom__">{ex.reps}</option>}
          {!ex.reps && <option value="__custom__">—</option>}
        </select>
        <div className="col-span-1 flex items-center justify-end gap-1">
          <button
            onClick={() => setShowNotes(n => !n)}
            title="Toggle notes"
            className={`p-1.5 rounded hover:bg-secondary transition-colors ${showNotes || ex.notes ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <ChevronDown size={14} className={`transition-transform ${showNotes ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={() => removeExercise(dayIdx, exIdx)} title="Remove exercise" className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      {showNotes && (
        <div className="grid grid-cols-12 gap-1">
          <div className="col-span-1" />
          <input
            type="text"
            value={ex.notes ?? ""}
            onChange={e => updateExercise(dayIdx, exIdx, "notes", e.target.value)}
            placeholder="Add note..."
            className="col-span-10 bg-secondary/50 border border-border/50 rounded px-2 py-1 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:text-foreground"
          />
          <div className="col-span-1" />
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
                      placeholder=""
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
  id, day, dayIdx, updateDay, removeDay, addExercise, removeExercise, updateExercise, exerciseNames, isDragTarget
}: {
  id: string; day: any; dayIdx: number;
  updateDay: (i: number, f: string, v: string) => void;
  removeDay: (i: number) => void;
  addExercise: (i: number) => void;
  removeExercise: (d: number, e: number) => void;
  updateExercise: (d: number, e: number, f: string, v: string) => void;
  exerciseNames: string[];
  isDragTarget?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const totalSets = (day.exercises ?? []).reduce((sum: number, ex: any) => {
    return sum + (parseSetsRange(ex.sets).max || 0);
  }, 0);

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={isDragTarget ? "ring-2 ring-primary/50 ring-offset-1" : ""}>
        <div className="flex items-center gap-2 mb-3">
          <div {...attributes} {...listeners} className="text-muted-foreground cursor-grab active:cursor-grabbing hover:text-foreground touch-none flex-shrink-0">
            <GripVertical size={15} />
          </div>
          <input type="text" value={day.name} onChange={e => updateDay(dayIdx, "name", e.target.value)}
            className="w-32 bg-secondary border border-border rounded px-2 py-1 text-[13px] text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary" />
          <div className="flex-1" />
          {totalSets > 0 && (
            <span className="text-[11px] text-muted-foreground tabular-nums flex-shrink-0">
              {totalSets} sets
            </span>
          )}
          <button onClick={() => removeDay(dayIdx)} title="Remove day" className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
            <Trash2 size={14} />
          </button>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-12 gap-1 px-1">
            <p className="col-span-1"></p>
            <p className="col-span-6 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Exercise</p>
            <p className="col-span-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground text-center">Sets</p>
            <p className="col-span-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground text-center">Reps</p>
            <p className="col-span-1"></p>
          </div>
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
          <button onClick={() => addExercise(dayIdx)}
            className="flex items-center gap-1 text-[13px] text-primary hover:text-primary/80 mt-1">
            <Plus size={12} /> Add Exercise
          </button>
        </div>
      </Card>
    </div>
  );
}

export default function TrainingSection({ fixedClientId }: { fixedClientId?: number } = {}) {
  const { clients, selectedUserId: selectorUserId, setSelectedUserId } = useClientSelector();
  const selectedUserId = fixedClientId ?? selectorUserId;
  const { data: latestCheckIns = [] } = trpc.checkIn.latestPerClient.useQuery();

  // Compute which client userIds have an unsaved training draft in localStorage
  const [trainingDraftUserIds, setTrainingDraftUserIds] = useState<Set<number>>(() => {
    const ids = new Set<number>();
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith("draft:training:")) {
        const uid = parseInt(k.replace("draft:training:", ""), 10);
        if (!isNaN(uid)) ids.add(uid);
      }
    }
    return ids;
  });
  useEffect(() => {
    function refreshDraftIds() {
      const ids = new Set<number>();
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith("draft:training:")) {
          const uid = parseInt(k.replace("draft:training:", ""), 10);
          if (!isNaN(uid)) ids.add(uid);
        }
      }
      setTrainingDraftUserIds(ids);
    }
    window.addEventListener("storage", refreshDraftIds);
    window.addEventListener("draft-changed", refreshDraftIds);
    return () => {
      window.removeEventListener("storage", refreshDraftIds);
      window.removeEventListener("draft-changed", refreshDraftIds);
    };
  }, []);

  const { data: program, refetch } = trpc.training.getForClient.useQuery(
    { userId: selectedUserId! },
    { enabled: !!selectedUserId }
  );
  const trainingDraftKey = selectedUserId ? `draft:training:${selectedUserId}` : null;

  const [programName, setProgramName] = useState("");
  const [notes, setNotes] = useState("");
  const [days, setDays] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<string[]>([]);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "board">("list");

  // Snapshot of the last server-saved state — used to detect genuine changes
  const trainingSavedSnapshot = useRef<{ programName: string; notes: string; days: any[]; schedule: string[] } | null>(null);

  const upsert = trpc.training.upsert.useMutation({
    onSuccess: () => {
      // Update snapshot to current state and clear draft
      trainingSavedSnapshot.current = { programName, notes, days, schedule };
      if (trainingDraftKey) { try { localStorage.removeItem(trainingDraftKey); window.dispatchEvent(new Event("draft-changed")); } catch {} }
      setLastSavedAt(new Date());
      toast.success("Training program saved"); refetch();
    }
  });

  // Cmd/Ctrl+S keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (!selectedUserId || upsert.isPending) return;
        upsert.mutate({ userId: selectedUserId, programName: programName || null, days, schedule: schedule.length > 0 ? schedule : undefined, notes: notes || null });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedUserId, upsert.isPending, programName, notes, days, schedule]); // eslint-disable-line react-hooks/exhaustive-deps

  // Route-leave guard when there are unsaved changes
  useEffect(() => {
    const snap = trainingSavedSnapshot.current;
    const isDirty = !!trainingDraftKey && !!snap && (
      programName !== snap.programName ||
      notes !== snap.notes ||
      JSON.stringify(days) !== JSON.stringify(snap.days) ||
      JSON.stringify(schedule) !== JSON.stringify(snap.schedule)
    );
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [trainingDraftKey, programName, notes, days, schedule]);

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
      try { localStorage.removeItem(trainingDraftKey); window.dispatchEvent(new Event("draft-changed")); } catch {}
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

    // Per-day totals (min/max ranges)
    const dayTotals: Record<string, Record<string, { min: number; max: number }>> = {};
    for (const day of days) {
      const dayName = day.name || "Unnamed";
      dayTotals[dayName] = {};
      for (const ex of (day.exercises ?? [])) {
        const { min: sMin, max: sMax } = parseSetsRange(ex.sets);
        const contrib = libMap.get((ex.name ?? "").toLowerCase());
        if (!contrib || sMax === 0) continue;
        for (const [mgKey, val] of Object.entries(contrib)) {
          const cur = dayTotals[dayName][mgKey] ?? { min: 0, max: 0 };
          dayTotals[dayName][mgKey] = { min: cur.min + sMin * (val as number), max: cur.max + sMax * (val as number) };
        }
      }
    }

    // Weekly totals
    const weeklyTotals: Record<string, { min: number; max: number }> = {};
    for (const day of days) {
      const dayName = day.name || "Unnamed";
      const occurrences = schedule.length > 0
        ? schedule.filter(s => s === dayName).length
        : 1;
      for (const [mgKey, range] of Object.entries(dayTotals[dayName] ?? {})) {
        const cur = weeklyTotals[mgKey] ?? { min: 0, max: 0 };
        weeklyTotals[mgKey] = { min: cur.min + range.min * occurrences, max: cur.max + range.max * occurrences };
      }
    }
    for (const key of Object.keys(weeklyTotals)) {
      weeklyTotals[key] = { min: Math.round(weeklyTotals[key].min * multiplier), max: Math.round(weeklyTotals[key].max * multiplier) };
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
    if (trainingDraftKey) { try { localStorage.removeItem(trainingDraftKey); window.dispatchEvent(new Event("draft-changed")); } catch {} }
    trainingServerLoadedRef.current = selectedUserId;
  }, [program, selectedUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  const DAY_LETTERS = ["A","B","C","D","E","F","G","H"];
  const addDay = () => {
    setDays(d => {
      const newName = DAY_LETTERS[d.length] ?? `Day ${d.length + 1}`;
      // Auto-add the new day name to the training schedule
      setSchedule(s => [...s, newName]);
      return [...d, { name: newName, focus: "", exercises: [] }];
    });
  };
  const removeDay = (i: number) => {
    setDays(d => {
      const removedName = d[i]?.name;
      // Remove all schedule slots that reference this day
      if (removedName) {
        setSchedule(s => s.filter(slot => slot !== removedName));
      }
      return d.filter((_, idx) => idx !== i);
    });
  };
  const updateDay = (i: number, field: string, value: string) => {
    setDays(d => {
      const oldDay = d[i];
      const updated = d.map((day, idx) => idx === i ? { ...day, [field]: value } : day);
      // If the day name changed, cascade the rename into schedule slots
      if (field === 'name' && oldDay) {
        const DAY_LETTERS_LOCAL = ["A","B","C","D","E","F","G","H"];
        const oldLabel = oldDay.name || (DAY_LETTERS_LOCAL[i] ?? `Day ${i + 1}`);
        const newLabel = value || (DAY_LETTERS_LOCAL[i] ?? `Day ${i + 1}`);
        if (oldLabel !== newLabel) {
          setSchedule(s => s.map(slot => slot === oldLabel ? newLabel : slot));
        }
      }
      return updated;
    });
  };
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
  // ── Global cross-day exercise drag state ──────────────────────────────────
  const [activeExId, setActiveExId] = useState<UniqueIdentifier | null>(null);
  const [dragTargetDayIdx, setDragTargetDayIdx] = useState<number | null>(null);

  // Parse "ex-{dayIdx}-{exIdx}" → { dayIdx, exIdx } or null
  const parseExId = (id: UniqueIdentifier): { dayIdx: number; exIdx: number } | null => {
    const parts = String(id).split("-");
    if (parts.length !== 3 || parts[0] !== "ex") return null;
    const d = parseInt(parts[1], 10);
    const e = parseInt(parts[2], 10);
    if (isNaN(d) || isNaN(e)) return null;
    return { dayIdx: d, exIdx: e };
  };

  const handleGlobalExDragStart = ({ active }: { active: { id: UniqueIdentifier } }) => {
    setActiveExId(active.id);
  };

  const handleGlobalExDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) { setDragTargetDayIdx(null); return; }
    const parsed = parseExId(over.id);
    setDragTargetDayIdx(parsed ? parsed.dayIdx : null);
  };

  const handleGlobalExDragEnd = (event: DragEndEvent) => {
    setActiveExId(null);
    setDragTargetDayIdx(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const src = parseExId(active.id);
    const dst = parseExId(over.id);
    if (!src || !dst) return;
    if (src.dayIdx === dst.dayIdx) {
      // Same day — simple reorder
      reorderExercises(src.dayIdx, src.exIdx, dst.exIdx);
    } else {
      // Cross-day move
      setDays(d => {
        const next = d.map(day => ({ ...day, exercises: [...(day.exercises ?? [])] }));
        const [moved] = next[src.dayIdx].exercises.splice(src.exIdx, 1);
        next[dst.dayIdx].exercises.splice(dst.exIdx, 0, moved);
        return next;
      });
    }
  };

  // Keep legacy per-day handler for backward compat (unused now but avoids TS errors)
  const handleExDragEnd = (_dayIdx: number) => (_event: DragEndEvent) => {};
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
  const addScheduleSlot = () => setSchedule(s => [...s, days[0]?.name || "A"]);
  const removeScheduleSlot = (i: number) => {
    setSchedule(s => {
      const removedSlot = s[i];
      const next = s.filter((_, idx) => idx !== i);
      // If this was the last occurrence of a day name in the schedule, also remove that day card
      if (removedSlot && removedSlot !== "Off" && !next.includes(removedSlot)) {
        setDays(d => d.filter(day => day.name !== removedSlot));
      }
      return next;
    });
  };
  const updateScheduleSlot = (i: number, val: string) => setSchedule(s => s.map((v, idx) => idx === i ? val : v));

  return (
    <div className="space-y-6">
      {!fixedClientId && (
        <div>
          <ClientCombobox clients={clients} selectedUserId={selectedUserId} onSelect={setSelectedUserId} latestCheckIns={latestCheckIns} draftUserIds={trainingDraftUserIds} />
        </div>
      )}
      {selectedUserId && (
        <div className="space-y-6">
          {/* ── View toggle ── */}
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={() => setViewMode("list")}
              title="List view"
              className={`p-1.5 rounded transition-colors ${
                viewMode === "list" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutList size={15} />
            </button>
            <button
              onClick={() => setViewMode("board")}
              title="Board view"
              className={`p-1.5 rounded transition-colors ${
                viewMode === "board" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid size={15} />
            </button>
          </div>

          {/* ── Training Schedule ── */}
          <div>
            <div className="mb-2">
              <label className="text-xs text-muted-foreground">Training Schedule</label>

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
              <p className="text-xs text-muted-foreground/70 mt-1.5">
                {schedule.join(" / ")} / repeat
              </p>
            )}
          </div>
          {/* ── Board view ── */}
          {viewMode === "board" && (
            <div className="space-y-4">
              <KanbanProgramView
                days={days}
                updateDay={updateDay}
                removeDay={removeDay}
                addDay={addDay}
                addExercise={addExercise}
                removeExercise={removeExercise}
                updateExercise={updateExercise}
                setDays={setDays}
                exerciseNames={(exerciseLib as any[]).map((e: any) => e.name).sort()}
                exerciseLib={exerciseLib as any[]}
                schedule={schedule}
              />
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Coach Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
              <div className="space-y-1.5">
                <button
                  onClick={() => upsert.mutate({ userId: selectedUserId, programName: programName || null, days, schedule: schedule.length > 0 ? schedule : undefined, notes: notes || null })}
                  disabled={upsert.isPending}
                  className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save size={15} />
                  {upsert.isPending ? "Saving..." : "Save Training Program"}
                </button>
                {lastSavedAt && (
                  <p className="text-center text-[11px] text-muted-foreground">
                    Saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── Two-column: sessions left, volume summary right ── */}
          {viewMode === "list" && <div className="flex flex-col lg:flex-row gap-6 items-start min-w-0">
            {/* Left: sessions + controls */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Single flat DndContext handles both day reorder (day-N) and exercise drag (ex-D-E) */}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={({ active }) => {
                  if (String(active.id).startsWith("ex-")) handleGlobalExDragStart({ active });
                }}
                onDragOver={(event) => {
                  if (activeExId !== null) handleGlobalExDragOver(event);
                }}
                onDragEnd={(event) => {
                  if (activeExId !== null || String(event.active.id).startsWith("ex-")) {
                    handleGlobalExDragEnd(event);
                  } else {
                    handleDayDragEnd(event);
                  }
                }}
              >
                <SortableContext items={days.map((_: any, i: number) => `day-${i}`)} strategy={verticalListSortingStrategy}>
                  <div className="grid grid-cols-1 gap-4">
                    {days.map((day, i) => (
                      <SortableDayCard
                        key={`day-${i}`}
                        id={`day-${i}`}
                        day={day}
                        dayIdx={i}
                        updateDay={updateDay}
                        removeDay={removeDay}
                        addExercise={addExercise}
                        removeExercise={removeExercise}
                        updateExercise={updateExercise}
                        exerciseNames={(exerciseLib as any[]).map((e: any) => e.name).sort()}
                        isDragTarget={dragTargetDayIdx === i && activeExId !== null && parseExId(activeExId)?.dayIdx !== i}
                      />
                    ))}
                  </div>
                </SortableContext>
                <DragOverlay>
                  {activeExId ? (() => {
                    const parsed = parseExId(activeExId);
                    if (!parsed) return null;
                    const ex = days[parsed.dayIdx]?.exercises?.[parsed.exIdx];
                    if (!ex) return null;
                    return (
                      <div className="grid grid-cols-12 gap-1 items-center bg-card border border-primary/40 rounded-lg px-2 py-1.5 shadow-xl opacity-95">
                        <div className="col-span-1 flex justify-center text-muted-foreground"><GripVertical size={13} /></div>
                        <div className="col-span-6 text-[13px] text-foreground truncate">{ex.name || "Exercise"}</div>
                        <div className="col-span-2 text-[13px] text-foreground text-center">{ex.sets}</div>
                        <div className="col-span-2 text-[13px] text-foreground text-center">{ex.reps}</div>
                        <div className="col-span-1" />
                      </div>
                    );
                  })() : null}
                </DragOverlay>
              </DndContext>
              <button onClick={addDay}
                className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors w-full justify-center">
                <Plus size={14} /> Add Training Day
              </button>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Coach Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-[13px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>
              <div className="space-y-1.5">
                <button
                  onClick={() => upsert.mutate({ userId: selectedUserId, programName: programName || null, days, schedule: schedule.length > 0 ? schedule : undefined, notes: notes || null })}
                  disabled={upsert.isPending}
                  className="w-full py-3 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Save size={15} />
                  {upsert.isPending ? "Saving..." : "Save Training Program"}
                </button>
                {lastSavedAt && (
                  <p className="text-center text-[11px] text-muted-foreground">
                    Saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
              </div>
            </div>
            {/* Right: sticky weekly volume summary */}
            {volumeTable && (
              <div className="w-72 xl:w-80 shrink-0 min-w-0 sticky top-4">
                <SectionLabel>Weekly Volume</SectionLabel>
                <p className="text-xs text-muted-foreground mb-3">
                  Cycle: {schedule.length > 0 ? schedule.length : days.length} days · ×{volumeTable.multiplier.toFixed(1)} · sets/wk
                </p>
                <div className="overflow-x-auto rounded-xl border border-border">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      {/* Row 1: session group headers */}
                      <tr className="border-b border-border bg-secondary/50">
                        <th className="text-left px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold" rowSpan={2}>Muscle</th>
                        {days.map(d => (
                          <th key={d.name} colSpan={2} className="px-1 py-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-center border-l border-border/40">
                            {(d.name || 'Day').slice(0, 4)}
                          </th>
                        ))}
                        <th colSpan={2} className="px-1 py-2 text-[10px] uppercase tracking-wider text-primary font-semibold text-center border-l border-border/40">Wk</th>
                      </tr>
                      {/* Row 2: Min / Max sub-headers */}
                      <tr className="border-b border-border bg-secondary/50">
                        {days.map(d => (
                          <>
                            <th key={`${d.name}-min`} className="px-2 py-1 text-[9px] text-muted-foreground/50 font-normal text-center border-l border-border/40">Min</th>
                            <th key={`${d.name}-max`} className="px-2 py-1 text-[9px] text-muted-foreground/50 font-normal text-center">Max</th>
                          </>
                        ))}
                        <th className="px-2 py-1 text-[9px] text-muted-foreground/50 font-normal text-center border-l border-border/40">Min</th>
                        <th className="px-2 py-1 text-[9px] text-muted-foreground/50 font-normal text-center">Max</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...MUSCLE_GROUPS]
                        .sort((a, b) => ((volumeTable.weeklyTotals[b.key]?.max) ?? 0) - ((volumeTable.weeklyTotals[a.key]?.max) ?? 0))
                        .map(mg => {
                        const wk = volumeTable.weeklyTotals[mg.key];
                        const wkMax = wk?.max ?? 0;
                        if (wkMax === 0) return null;
                        const wkMin = wk?.min ?? 0;
                        return (
                          <tr key={mg.key} className="border-b border-border/50 hover:bg-secondary/20">
                            <td className="px-3 py-2 font-medium text-foreground text-xs whitespace-nowrap">{mg.label}</td>
                            {days.map(d => {
                              const range = volumeTable.dayTotals[d.name || 'Unnamed']?.[mg.key];
                              const dMin = Math.round(range?.min ?? 0);
                              const dMax = Math.round(range?.max ?? 0);
                              const hasVal = dMax > 0;
                              return (
                                <>
                                  <td key={`${d.name}-min`} className="px-2 py-2 text-center border-l border-border/40">
                                    {hasVal ? <span className="text-xs text-foreground/60">{dMin}</span> : <span className="text-muted-foreground/20 text-xs">—</span>}
                                  </td>
                                  <td key={`${d.name}-max`} className="px-2 py-2 text-center">
                                    {hasVal ? <span className="text-xs text-foreground/80 font-medium">{dMax}</span> : <span className="text-muted-foreground/20 text-xs">—</span>}
                                  </td>
                                </>
                              );
                            })}
                            <td className="px-2 py-2 text-center border-l border-border/40">
                              <span className={`text-xs font-semibold ${
                                wkMax >= 10 ? "text-primary" :
                                wkMax >= 6 ? "text-primary/80" :
                                "text-muted-foreground"
                              }`}>{wkMin}</span>
                            </td>
                            <td className="px-2 py-2 text-center">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${
                                wkMax >= 10 ? "bg-primary/20 text-primary" :
                                wkMax >= 6 ? "bg-primary/10 text-primary/80" :
                                "bg-secondary text-muted-foreground"
                              }`}>{wkMax}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-2">Only muscle groups with &gt;0 weekly sets shown.</p>
              </div>
            )}
          </div>}
        </div>
      )}
    </div>
  );
}
