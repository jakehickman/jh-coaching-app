import React, { useState, useRef } from "react";
import { Plus, Trash2, GripVertical, ChevronDown } from "lucide-react";
import { MUSCLE_GROUPS } from "./ExerciseLibrarySection";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Exercise {
  name: string;
  sets: string;
  reps: string;
  notes?: string;
}
interface Day {
  name: string;
  exercises: Exercise[];
}

interface Props {
  days: Day[];
  updateDay: (i: number, field: string, value: string) => void;
  removeDay: (i: number) => void;
  addDay: () => void;
  addExercise: (dayIdx: number) => void;
  removeExercise: (dayIdx: number, exIdx: number) => void;
  updateExercise: (dayIdx: number, exIdx: number, field: string, value: string) => void;
  setDays: (days: Day[]) => void;
  exerciseNames: string[];
  exerciseLib: Array<Record<string, unknown>>;
  schedule: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function parseExId(id: UniqueIdentifier): { dayIdx: number; exIdx: number } | null {
  const m = String(id).match(/^ex-(\d+)-(\d+)$/);
  if (!m) return null;
  return { dayIdx: parseInt(m[1]), exIdx: parseInt(m[2]) };
}

// ─── Kanban Exercise Card ─────────────────────────────────────────────────────
function KanbanExCard({
  id, ex, dayIdx, exIdx, updateExercise, removeExercise, exerciseNames, isGhost,
}: {
  id: string;
  ex: Exercise;
  dayIdx: number;
  exIdx: number;
  updateExercise: (d: number, e: number, f: string, v: string) => void;
  removeExercise: (d: number, e: number) => void;
  exerciseNames: string[];
  isGhost?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const [expanded, setExpanded] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const setsRef = useRef<HTMLInputElement>(null);
  const repsRef = useRef<HTMLInputElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isGhost ? 0.3 : isDragging ? 0 : 1,
    pointerEvents: (isGhost ? "none" : undefined) as React.CSSProperties["pointerEvents"],
  };

  const filtered = searchTerm.length > 0
    ? exerciseNames.filter(n => n.toLowerCase().includes(searchTerm.toLowerCase())).slice(0, 8)
    : exerciseNames.slice(0, 8);

  const handleExKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (dropdownOpen && filtered.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setHighlightedIdx(i => Math.min(i + 1, filtered.length - 1)); }
      else if (e.key === "ArrowUp") { e.preventDefault(); setHighlightedIdx(i => Math.max(i - 1, 0)); }
      else if (e.key === "Enter") {
        e.preventDefault();
        const idx = highlightedIdx >= 0 ? highlightedIdx : 0;
        updateExercise(dayIdx, exIdx, "name", filtered[idx]);
        setSearchTerm(""); setDropdownOpen(false); setHighlightedIdx(-1);
        setTimeout(() => setsRef.current?.focus(), 0);
      } else if (e.key === "Escape" || e.key === "Tab") {
        setDropdownOpen(false); setHighlightedIdx(-1);
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      setsRef.current?.focus();
    }
  };

  return (
    <div ref={setNodeRef} style={style} className="space-y-1">
      <div className="bg-secondary/60 border border-border/60 rounded-lg px-1.5 py-1.5 group hover:border-border transition-colors">
        {/* Row 1: grip + exercise name + actions */}
        <div className="flex items-center gap-1">
          <div
            {...attributes}
            {...listeners}
            className="text-muted-foreground/40 cursor-grab active:cursor-grabbing hover:text-muted-foreground touch-none flex-shrink-0"
          >
            <GripVertical size={12} />
          </div>

          <div className="flex-1 min-w-0 relative">
            <input
              type="text"
              value={dropdownOpen ? searchTerm : ex.name}
              onChange={e => { setSearchTerm(e.target.value); setDropdownOpen(true); setHighlightedIdx(-1); }}
              onFocus={() => { setSearchTerm(""); setDropdownOpen(true); setHighlightedIdx(-1); }}
              onBlur={() => setTimeout(() => { setDropdownOpen(false); setHighlightedIdx(-1); }, 150)}
              onKeyDown={handleExKeyDown}
              placeholder="Exercise name"
              className="w-full bg-transparent text-[12px] text-foreground focus:outline-none truncate placeholder:text-muted-foreground/40"
            />
            {dropdownOpen && filtered.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-card border border-border rounded-lg shadow-xl overflow-hidden max-h-40 overflow-y-auto">
                {filtered.map((name, idx) => (
                  <button
                    key={name}
                    type="button"
                    onMouseDown={() => {
                      updateExercise(dayIdx, exIdx, "name", name);
                      setSearchTerm(""); setDropdownOpen(false); setHighlightedIdx(-1);
                      setTimeout(() => setsRef.current?.focus(), 0);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-[12px] transition-colors ${
                      idx === highlightedIdx ? "bg-primary/20 text-primary" : "text-foreground hover:bg-primary/10 hover:text-primary"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              onClick={() => setExpanded(n => !n)}
              title="Toggle notes"
              className={`p-1 rounded hover:bg-secondary transition-colors ${expanded || ex.notes ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <ChevronDown size={11} className={`transition-transform ${expanded ? 'rotate-180' : ''}`} />
            </button>
            <button
              onClick={() => removeExercise(dayIdx, exIdx)}
              title="Remove exercise"
              className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>

        {/* Row 2: sets × reps + notes (shown when expanded) */}
        {expanded && <div className="flex items-center gap-1 pl-4 mt-0.5">
          <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wide w-8">Sets</span>
          <input
            ref={setsRef}
            type="text"
            value={ex.sets}
            onChange={e => updateExercise(dayIdx, exIdx, "sets", e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); repsRef.current?.focus(); } }}
            placeholder="—"
            className="w-8 bg-secondary/60 border border-border/40 rounded text-[12px] text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary/40 px-1 py-0.5 placeholder:text-muted-foreground/40"
          />
          <span className="text-muted-foreground/30 text-[10px]">×</span>
          <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wide w-8">Reps</span>
          <input
            ref={repsRef}
            type="text"
            value={ex.reps}
            onChange={e => updateExercise(dayIdx, exIdx, "reps", e.target.value)}
            placeholder="—"
            className="w-14 bg-secondary/60 border border-border/40 rounded text-[12px] text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary/40 px-1 py-0.5 placeholder:text-muted-foreground/40"
          />
        </div>}
      </div>

      {expanded && (
        <input
          type="text"
          value={ex.notes ?? ""}
          onChange={e => updateExercise(dayIdx, exIdx, "notes", e.target.value)}
          placeholder="Add note..."
          className="w-full bg-secondary/30 border border-border/40 rounded px-2 py-1 text-[11px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:text-foreground ml-4"
        />
      )}
    </div>
  );
}

// ─── Drag overlay card ────────────────────────────────────────────────────────
function DragCard({ ex }: { ex: Exercise }) {
  return (
    <div className="bg-card border border-primary/60 rounded-lg px-1.5 py-1.5 shadow-xl w-56 xl:w-64 cursor-grabbing">
      <div className="flex items-center gap-1">
        <GripVertical size={12} className="text-muted-foreground/40 flex-shrink-0" />
        <span className="flex-1 min-w-0 text-[12px] text-foreground truncate">{ex.name || "Exercise"}</span>
      </div>
      <div className="flex items-center gap-1 pl-4 mt-0.5">
        <span className="text-[10px] text-muted-foreground/50 w-8">Sets</span>
        <span className="text-[12px] text-foreground">{ex.sets || "—"}</span>
        <span className="text-muted-foreground/30 text-[10px]">×</span>
        <span className="text-[10px] text-muted-foreground/50 w-8">Reps</span>
        <span className="text-[12px] text-foreground">{ex.reps || "—"}</span>
      </div>
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────
// The key insight: we always include a stable placeholder ID in the SortableContext
// items list for every column, but only show it visually when this column is the drop target.
// This keeps the hook count stable across renders (no conditional useSortable calls).
function KanbanColumn({
  day, dayIdx, isDragTarget, ghostExIdx, placeholderInsertIdx,
  updateDay, removeDay, addExercise, removeExercise, updateExercise, exerciseNames,
}: {
  day: Day;
  dayIdx: number;
  isDragTarget: boolean;
  ghostExIdx: number | null;
  placeholderInsertIdx: number | null;
  updateDay: (i: number, f: string, v: string) => void;
  removeDay: (i: number) => void;
  addExercise: (i: number) => void;
  removeExercise: (d: number, e: number) => void;
  updateExercise: (d: number, e: number, f: string, v: string) => void;
  exerciseNames: string[];
}) {
  const exercises = day.exercises ?? [];
  const totalSets = exercises.reduce((s, ex) => s + (parseInt(ex.sets) || 0), 0);

  // Build stable items list: always include the placeholder ID for this column.
  // Its position in the list determines where the drop slot appears.
  const placeholderId = `placeholder-col-${dayIdx}`;
  const insertAt = placeholderInsertIdx ?? exercises.length; // default: end (hidden)

  const items: string[] = [];
  exercises.forEach((_, j) => {
    if (j === insertAt) items.push(placeholderId);
    items.push(`ex-${dayIdx}-${j}`);
  });
  if (insertAt >= exercises.length) items.push(placeholderId);

  return (
    <div
      className={`flex flex-col bg-card border rounded-xl transition-all flex-shrink-0 w-56 xl:w-64 ${
        isDragTarget ? "border-primary/60 ring-1 ring-primary/30" : "border-border"
      }`}
      style={{ maxHeight: "calc(100vh - 260px)" }}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b border-border/50 flex-shrink-0">
        <input
          type="text"
          value={day.name}
          onChange={e => updateDay(dayIdx, "name", e.target.value)}
          className="w-20 bg-secondary border border-border rounded px-2 py-1 text-[13px] text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
        />
        <div className="flex-1" />
        {totalSets > 0 && (
          <span className="text-[11px] text-muted-foreground tabular-nums">{totalSets} sets</span>
        )}
        <button
          onClick={() => removeDay(dayIdx)}
          title="Remove day"
          className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* Exercise list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 min-h-[48px]">
        <SortableContext items={items} strategy={verticalListSortingStrategy}>
          {items.map((itemId) => {
            if (itemId === placeholderId) {
              // Always render the placeholder component (stable hook count),
              // but only show it visually when this column is the drop target.
              return (
                <PlaceholderSlot
                  key={placeholderId}
                  id={placeholderId}
                  visible={isDragTarget && placeholderInsertIdx !== null}
                />
              );
            }
            const parsed = parseExId(itemId);
            if (!parsed) return null;
            const { exIdx } = parsed;
            const ex = exercises[exIdx];
            if (!ex) return null;
            return (
              <KanbanExCard
                key={itemId}
                id={itemId}
                ex={ex}
                dayIdx={dayIdx}
                exIdx={exIdx}
                updateExercise={updateExercise}
                removeExercise={removeExercise}
                exerciseNames={exerciseNames}
                isGhost={ghostExIdx === exIdx}
              />
            );
          })}
        </SortableContext>
        {exercises.length === 0 && !isDragTarget && (
          <div className="flex items-center justify-center h-10 text-[11px] text-muted-foreground/40 border border-dashed border-border/30 rounded-lg">
            Drop exercises here
          </div>
        )}
      </div>

      {/* Add exercise */}
      <div className="px-3 py-2 border-t border-border/30 flex-shrink-0">
        <button
          onClick={() => addExercise(dayIdx)}
          className="flex items-center gap-1 text-[12px] text-primary hover:text-primary/80 transition-colors"
        >
          <Plus size={11} /> Add Exercise
        </button>
      </div>
    </div>
  );
}

// ─── Placeholder slot — always rendered, visibility controlled by prop ────────
function PlaceholderSlot({ id, visible }: { id: string; visible: boolean }) {
  const { setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  if (!visible) return <div ref={setNodeRef} style={style} className="h-0 overflow-hidden" />;
  return (
    <div ref={setNodeRef} style={style}>
      <div className="h-[52px] border-2 border-dashed border-primary/40 rounded-lg bg-primary/5" />
    </div>
  );
}

// ─── Main Kanban View ─────────────────────────────────────────────────────────
export default function KanbanProgramView({
  days, updateDay, removeDay, addDay, addExercise, removeExercise, updateExercise, setDays, exerciseNames, exerciseLib, schedule,
}: Props) {
  const [activeExId, setActiveExId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ dayIdx: number; insertIdx: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart({ active }: { active: { id: UniqueIdentifier } }) {
    const id = String(active.id);
    if (id.startsWith("ex-")) setActiveExId(id);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) { setDropTarget(null); return; }
    const activeId = String(active.id);
    const overId = String(over.id);
    if (!activeId.startsWith("ex-")) return;

    const src = parseExId(activeId);
    if (!src) return;

    if (overId.startsWith("ex-")) {
      const tgt = parseExId(overId);
      if (!tgt) return;
      if (tgt.dayIdx !== src.dayIdx) {
        setDropTarget({ dayIdx: tgt.dayIdx, insertIdx: tgt.exIdx });
      } else {
        setDropTarget(null);
      }
    } else if (overId.startsWith("placeholder-col-")) {
      // Hovering over the placeholder itself — keep current or set to end of that column
      const colMatch = overId.match(/^placeholder-col-(\d+)$/);
      if (colMatch) {
        const tgtDayIdx = parseInt(colMatch[1]);
        if (tgtDayIdx !== src.dayIdx) {
          setDropTarget(prev => prev?.dayIdx === tgtDayIdx ? prev : {
            dayIdx: tgtDayIdx,
            insertIdx: days[tgtDayIdx]?.exercises?.length ?? 0,
          });
        }
      }
    } else {
      setDropTarget(null);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const prevActiveId = activeExId;
    const prevDropTarget = dropTarget;

    setActiveExId(null);
    setDropTarget(null);

    if (!over || !prevActiveId) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (!activeId.startsWith("ex-")) return;

    const src = parseExId(activeId);
    if (!src) return;

    const newDays = days.map(d => ({ ...d, exercises: [...(d.exercises ?? [])] }));

    if (prevDropTarget && prevDropTarget.dayIdx !== src.dayIdx) {
      // Cross-column move
      const [moved] = newDays[src.dayIdx].exercises.splice(src.exIdx, 1);
      const insertIdx = Math.min(prevDropTarget.insertIdx, newDays[prevDropTarget.dayIdx].exercises.length);
      newDays[prevDropTarget.dayIdx].exercises.splice(insertIdx, 0, moved);
      setDays(newDays);
    } else if (overId.startsWith("ex-")) {
      const tgt = parseExId(overId);
      if (!tgt) return;
      if (tgt.dayIdx === src.dayIdx) {
        // Same column reorder
        newDays[src.dayIdx].exercises = arrayMove(newDays[src.dayIdx].exercises, src.exIdx, tgt.exIdx);
        setDays(newDays);
      }
    }
  }

  function handleDragCancel() {
    setActiveExId(null);
    setDropTarget(null);
  }

  const srcParsed = activeExId ? parseExId(activeExId) : null;
  const activeEx = srcParsed ? days[srcParsed.dayIdx]?.exercises?.[srcParsed.exIdx] ?? null : null;

  // Compute weekly volume for the chip bar
  const volumeEntries = (() => {
    if (!days.length) return [];
    const cycleLengthDays = schedule.length > 0 ? schedule.length : days.length;
    const multiplier = 7 / cycleLengthDays;
    const libMap = new Map<string, Record<string, number>>();
    for (const ex of exerciseLib) {
      const contributions: Record<string, number> = {};
      for (const mg of MUSCLE_GROUPS) {
        const val = (ex as any)[mg.key] as number ?? 0;
        if (val > 0) contributions[mg.key] = val;
      }
      libMap.set(String(ex.name ?? "").toLowerCase(), contributions);
    }
    const weeklyTotals: Record<string, number> = {};
    for (const day of days) {
      const dayName = day.name || "Unnamed";
      const occurrences = schedule.length > 0 ? schedule.filter(s => s === dayName).length : 1;
      for (const ex of (day.exercises ?? [])) {
        const sets = parseFloat(ex.sets) || 0;
        const contrib = libMap.get((ex.name ?? "").toLowerCase());
        if (!contrib || sets === 0) continue;
        for (const [mgKey, val] of Object.entries(contrib)) {
          weeklyTotals[mgKey] = (weeklyTotals[mgKey] ?? 0) + sets * val * occurrences;
        }
      }
    }
    for (const key of Object.keys(weeklyTotals)) {
      weeklyTotals[key] = Math.round(weeklyTotals[key] * multiplier);
    }
    return MUSCLE_GROUPS
      .map(mg => ({ label: mg.label, key: mg.key, total: weeklyTotals[mg.key] ?? 0 }))
      .filter(e => e.total > 0)
      .sort((a, b) => b.total - a.total);
  })();

  return (
    <>
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "300px" }}>
        {days.map((day, i) => {
          const isSrcCol = srcParsed?.dayIdx === i;
          const isTgtCol = dropTarget?.dayIdx === i;
          return (
            <KanbanColumn
              key={`col-${i}`}
              day={day}
              dayIdx={i}
              isDragTarget={isTgtCol}
              ghostExIdx={isSrcCol && !isTgtCol ? srcParsed!.exIdx : null}
              placeholderInsertIdx={isTgtCol ? dropTarget!.insertIdx : null}
              updateDay={updateDay}
              removeDay={removeDay}
              addExercise={addExercise}
              removeExercise={removeExercise}
              updateExercise={updateExercise}
              exerciseNames={exerciseNames}
            />
          );
        })}

        <div className="flex-shrink-0 w-44 flex items-start pt-3">
          <button
            onClick={addDay}
            className="w-full flex flex-col items-center justify-center gap-2 py-6 border border-dashed border-border/50 rounded-xl text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <Plus size={16} />
            <span className="text-[12px]">Add Training Day</span>
          </button>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activeEx ? <DragCard ex={activeEx} /> : null}
      </DragOverlay>
    </DndContext>

    {/* Weekly Volume chip bar */}
    {volumeEntries.length > 0 && (
      <div className="mt-4 pt-4 border-t border-border/40">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Weekly Volume</p>
        <div className="flex flex-wrap gap-1.5">
          {volumeEntries.map(e => (
            <div key={e.key} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-secondary/60 text-[12px]">
              <span className="text-foreground/80">{e.label}</span>
              <span className="font-semibold text-primary">{e.total}</span>
            </div>
          ))}
        </div>
      </div>
    )}
    </>
  );
}
