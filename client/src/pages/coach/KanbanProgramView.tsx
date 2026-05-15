import React, { useState, useRef } from "react";
import { Plus, Trash2, GripVertical, ChevronDown } from "lucide-react";
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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const PLACEHOLDER_PREFIX = "__placeholder__";

function parseExId(id: UniqueIdentifier): { dayIdx: number; exIdx: number } | null {
  const m = String(id).match(/^ex-(\d+)-(\d+)$/);
  if (!m) return null;
  return { dayIdx: parseInt(m[1]), exIdx: parseInt(m[2]) };
}

function isPlaceholder(id: UniqueIdentifier) {
  return String(id).startsWith(PLACEHOLDER_PREFIX);
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
  const [showNotes, setShowNotes] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const setsRef = useRef<HTMLInputElement>(null);
  const repsRef = useRef<HTMLInputElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Ghost: faded in source column. isDragging: being actively dragged (hidden, overlay takes over).
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

          {/* Exercise name */}
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

          {/* Actions */}
          <div className="flex items-center gap-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              onClick={() => setShowNotes(n => !n)}
              title="Toggle notes"
              className={`p-1 rounded hover:bg-secondary transition-colors ${showNotes || ex.notes ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <ChevronDown size={11} className={`transition-transform ${showNotes ? 'rotate-180' : ''}`} />
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

        {/* Row 2: sets × reps */}
        <div className="flex items-center gap-1 pl-4 mt-0.5">
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
        </div>
      </div>

      {/* Notes */}
      {(showNotes || ex.notes) && (
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

// ─── Placeholder slot (shown in target column during cross-column drag) ───────
function PlaceholderSlot({ id }: { id: string }) {
  const { setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style}>
      <div className="h-[38px] border-2 border-dashed border-primary/40 rounded-lg bg-primary/5" />
    </div>
  );
}

// ─── Drag overlay card ────────────────────────────────────────────────────────
function DragCard({ ex }: { ex: Exercise }) {
  return (
    <div className="flex items-center gap-1 bg-card border border-primary/60 rounded-lg px-1.5 py-1.5 shadow-xl w-56 xl:w-64 cursor-grabbing">
      <GripVertical size={12} className="text-muted-foreground/40 flex-shrink-0" />
      <span className="flex-1 min-w-0 text-[12px] text-foreground truncate">{ex.name || "Exercise"}</span>
      <span className="text-[12px] text-muted-foreground flex-shrink-0">{ex.sets} × {ex.reps}</span>
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────
function KanbanColumn({
  day, dayIdx, isDragTarget, ghostExIdx, placeholderIdx,
  updateDay, removeDay, addExercise, removeExercise, updateExercise, exerciseNames,
}: {
  day: Day;
  dayIdx: number;
  isDragTarget: boolean;
  ghostExIdx: number | null;    // index in this column that should appear as ghost (source col)
  placeholderIdx: number | null; // index in this column where placeholder slot should appear (target col)
  updateDay: (i: number, f: string, v: string) => void;
  removeDay: (i: number) => void;
  addExercise: (i: number) => void;
  removeExercise: (d: number, e: number) => void;
  updateExercise: (d: number, e: number, f: string, v: string) => void;
  exerciseNames: string[];
}) {
  const totalSets = (day.exercises ?? []).reduce((s, ex) => s + (parseInt(ex.sets) || 0), 0);

  // Build the items list for SortableContext — insert placeholder at target position
  const items: string[] = [];
  (day.exercises ?? []).forEach((_, j) => {
    if (placeholderIdx === j) items.push(`${PLACEHOLDER_PREFIX}${dayIdx}`);
    items.push(`ex-${dayIdx}-${j}`);
  });
  if (placeholderIdx === (day.exercises ?? []).length) {
    items.push(`${PLACEHOLDER_PREFIX}${dayIdx}`);
  }

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
          {(() => {
            const rows: React.ReactNode[] = [];
            (day.exercises ?? []).forEach((ex, j) => {
              if (placeholderIdx === j) {
                rows.push(
                  <PlaceholderSlot key={`placeholder-${dayIdx}`} id={`${PLACEHOLDER_PREFIX}${dayIdx}`} />
                );
              }
              rows.push(
                <KanbanExCard
                  key={`ex-${dayIdx}-${j}`}
                  id={`ex-${dayIdx}-${j}`}
                  ex={ex}
                  dayIdx={dayIdx}
                  exIdx={j}
                  updateExercise={updateExercise}
                  removeExercise={removeExercise}
                  exerciseNames={exerciseNames}
                  isGhost={ghostExIdx === j}
                />
              );
            });
            if (placeholderIdx === (day.exercises ?? []).length) {
              rows.push(
                <PlaceholderSlot key={`placeholder-${dayIdx}`} id={`${PLACEHOLDER_PREFIX}${dayIdx}`} />
              );
            }
            return rows;
          })()}
        </SortableContext>
        {(day.exercises ?? []).length === 0 && placeholderIdx === null && (
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

// ─── Main Kanban View ─────────────────────────────────────────────────────────
export default function KanbanProgramView({
  days, updateDay, removeDay, addDay, addExercise, removeExercise, updateExercise, setDays, exerciseNames,
}: Props) {
  // Track active drag
  const [activeExId, setActiveExId] = useState<string | null>(null);
  // Track where the placeholder should appear: { dayIdx, insertBeforeIdx }
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

    // Determine target day and insert position from the over element
    if (overId.startsWith("ex-")) {
      const tgt = parseExId(overId);
      if (!tgt) return;
      if (tgt.dayIdx === src.dayIdx) {
        // Same column — no cross-column placeholder needed
        setDropTarget(null);
      } else {
        setDropTarget({ dayIdx: tgt.dayIdx, insertIdx: tgt.exIdx });
      }
    } else if (isPlaceholder(overId)) {
      // Hovering over the placeholder itself — keep current dropTarget
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
      // Cross-column move — use the tracked drop target
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Horizontal scroll board */}
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
              // Ghost: show the dragged exercise faded in its source column
              ghostExIdx={isSrcCol && isTgtCol === false ? srcParsed!.exIdx : null}
              // Placeholder: show insertion slot in the target column
              placeholderIdx={isTgtCol ? dropTarget!.insertIdx : null}
              updateDay={updateDay}
              removeDay={removeDay}
              addExercise={addExercise}
              removeExercise={removeExercise}
              updateExercise={updateExercise}
              exerciseNames={exerciseNames}
            />
          );
        })}

        {/* Add Training Day */}
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

      {/* Drag overlay — follows cursor */}
      <DragOverlay dropAnimation={null}>
        {activeEx ? <DragCard ex={activeEx} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
