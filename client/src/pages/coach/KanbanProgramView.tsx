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

// ─── Helper ───────────────────────────────────────────────────────────────────
function parseExId(id: string): { dayIdx: number; exIdx: number } | null {
  const m = String(id).match(/^ex-(\d+)-(\d+)$/);
  if (!m) return null;
  return { dayIdx: parseInt(m[1]), exIdx: parseInt(m[2]) };
}

// ─── Kanban Exercise Card ─────────────────────────────────────────────────────
function KanbanExCard({
  id, ex, dayIdx, exIdx, updateExercise, removeExercise, exerciseNames,
}: {
  id: string;
  ex: Exercise;
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
  const [highlightedIdx, setHighlightedIdx] = useState(-1);
  const setsRef = useRef<HTMLInputElement>(null);
  const repsRef = useRef<HTMLInputElement>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 999 : undefined,
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
      <div className="flex items-center gap-1.5 bg-secondary/60 border border-border/60 rounded-lg px-2 py-1.5 group hover:border-border transition-colors">
        {/* Grip */}
        <div
          {...attributes}
          {...listeners}
          className="text-muted-foreground/40 cursor-grab active:cursor-grabbing hover:text-muted-foreground touch-none flex-shrink-0"
        >
          <GripVertical size={13} />
        </div>

        {/* Exercise name — searchable */}
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

        {/* Sets */}
        <input
          ref={setsRef}
          type="text"
          value={ex.sets}
          onChange={e => updateExercise(dayIdx, exIdx, "sets", e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); repsRef.current?.focus(); } }}
          placeholder="—"
          className="w-8 bg-transparent text-[12px] text-foreground text-center focus:outline-none focus:bg-secondary rounded px-0.5 placeholder:text-muted-foreground/40"
        />
        <span className="text-muted-foreground/30 text-[11px]">×</span>
        {/* Reps */}
        <input
          ref={repsRef}
          type="text"
          value={ex.reps}
          onChange={e => updateExercise(dayIdx, exIdx, "reps", e.target.value)}
          placeholder="—"
          className="w-12 bg-transparent text-[12px] text-foreground text-center focus:outline-none focus:bg-secondary rounded px-0.5 placeholder:text-muted-foreground/40"
        />

        {/* Actions */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={() => setShowNotes(n => !n)}
            title="Toggle notes"
            className={`p-1 rounded hover:bg-secondary transition-colors ${showNotes || ex.notes ? 'text-primary' : 'text-muted-foreground'}`}
          >
            <ChevronDown size={12} className={`transition-transform ${showNotes ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={() => removeExercise(dayIdx, exIdx)}
            title="Remove exercise"
            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Notes */}
      {(showNotes || ex.notes) && (
        <input
          type="text"
          value={ex.notes ?? ""}
          onChange={e => updateExercise(dayIdx, exIdx, "notes", e.target.value)}
          placeholder="Add note..."
          className="w-full bg-secondary/30 border border-border/40 rounded px-2 py-1 text-[11px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 focus:text-foreground ml-5"
        />
      )}
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────
function KanbanColumn({
  day, dayIdx, isDragTarget, updateDay, removeDay, addExercise, removeExercise, updateExercise, exerciseNames,
}: {
  day: Day;
  dayIdx: number;
  isDragTarget: boolean;
  updateDay: (i: number, f: string, v: string) => void;
  removeDay: (i: number) => void;
  addExercise: (i: number) => void;
  removeExercise: (d: number, e: number) => void;
  updateExercise: (d: number, e: number, f: string, v: string) => void;
  exerciseNames: string[];
}) {
  const totalSets = (day.exercises ?? []).reduce((s, ex) => s + (parseInt(ex.sets) || 0), 0);
  const exIds = (day.exercises ?? []).map((_, j) => `ex-${dayIdx}-${j}`);

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

      {/* Column sub-header */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border/30 flex-shrink-0">
        <span className="flex-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60">Exercise</span>
        <span className="w-8 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 text-center">Sets</span>
        <span className="text-muted-foreground/20 text-[10px]">×</span>
        <span className="w-12 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 text-center">Reps</span>
        <span className="w-10" />
      </div>

      {/* Exercise list — scrollable */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1 min-h-[48px]">
        <SortableContext items={exIds} strategy={verticalListSortingStrategy}>
          {(day.exercises ?? []).map((ex, j) => (
            <KanbanExCard
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
        {(day.exercises ?? []).length === 0 && (
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
  const [activeExId, setActiveExId] = useState<string | null>(null);
  const [dragTargetDayIdx, setDragTargetDayIdx] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function handleDragStart({ active }: { active: { id: any } }) {
    const id = String(active.id);
    if (id.startsWith("ex-")) setActiveExId(id);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);
    if (!activeId.startsWith("ex-")) return;

    const src = parseExId(activeId);
    if (!src) return;

    // Determine target day from over id
    let targetDayIdx: number | null = null;
    if (overId.startsWith("ex-")) {
      const tgt = parseExId(overId);
      if (tgt) targetDayIdx = tgt.dayIdx;
    }
    setDragTargetDayIdx(targetDayIdx);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveExId(null);
    setDragTargetDayIdx(null);

    if (!over) return;
    const activeId = String(active.id);
    const overId = String(over.id);

    if (!activeId.startsWith("ex-")) return;

    const src = parseExId(activeId);
    const tgt = parseExId(overId);
    if (!src || !tgt) return;

    const newDays = days.map(d => ({ ...d, exercises: [...(d.exercises ?? [])] }));

    if (src.dayIdx === tgt.dayIdx) {
      // Same column — reorder
      newDays[src.dayIdx].exercises = arrayMove(newDays[src.dayIdx].exercises, src.exIdx, tgt.exIdx);
    } else {
      // Cross-column move
      const [moved] = newDays[src.dayIdx].exercises.splice(src.exIdx, 1);
      newDays[tgt.dayIdx].exercises.splice(tgt.exIdx, 0, moved);
    }

    setDays(newDays);
  }

  const activeEx = activeExId ? (() => {
    const p = parseExId(activeExId);
    return p ? days[p.dayIdx]?.exercises?.[p.exIdx] : null;
  })() : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* Horizontal scroll board */}
      <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: "300px" }}>
        {days.map((day, i) => (
          <KanbanColumn
            key={`col-${i}`}
            day={day}
            dayIdx={i}
            isDragTarget={dragTargetDayIdx === i && activeExId !== null && parseExId(activeExId!)?.dayIdx !== i}
            updateDay={updateDay}
            removeDay={removeDay}
            addExercise={addExercise}
            removeExercise={removeExercise}
            updateExercise={updateExercise}
            exerciseNames={exerciseNames}
          />
        ))}

        {/* Add day column */}
        <button
          onClick={addDay}
          className="flex-shrink-0 w-44 flex flex-col items-center justify-center gap-2 border border-dashed border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors px-4 py-6 self-start"
        >
          <Plus size={16} />
          Add Training Day
        </button>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeEx ? (
          <div className="flex items-center gap-1.5 bg-card border border-primary/50 rounded-lg px-2 py-1.5 shadow-xl w-52 opacity-95">
            <GripVertical size={13} className="text-muted-foreground flex-shrink-0" />
            <span className="flex-1 text-[12px] text-foreground truncate">{activeEx.name || "Exercise"}</span>
            <span className="text-[12px] text-foreground/70 tabular-nums">{activeEx.sets}</span>
            <span className="text-muted-foreground/40 text-[11px]">×</span>
            <span className="text-[12px] text-foreground/70 tabular-nums">{activeEx.reps}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
