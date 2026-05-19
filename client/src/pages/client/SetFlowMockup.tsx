import { useState } from "react";
import { Check, Plus } from "lucide-react";

// ─── Reusable set row ─────────────────────────────────────────────────────────
function SetRow({
  setNum,
  reps,
  done,
  onRepsChange,
  onDone,
}: {
  setNum: number;
  reps: string;
  done: boolean;
  onRepsChange?: (v: string) => void;
  onDone?: () => void;
}) {
  return (
    <div className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${done ? "bg-primary/5" : "bg-secondary/40"}`}>
      <span className="text-xs text-muted-foreground w-10 shrink-0">Set {setNum}</span>
      {done ? (
        <span className="flex-1 text-sm font-medium text-foreground">{reps} reps</span>
      ) : (
        <input
          type="number"
          value={reps}
          onChange={e => onRepsChange?.(e.target.value)}
          placeholder="reps"
          className="flex-1 bg-background border border-border rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary"
        />
      )}
      <button
        onClick={onDone}
        disabled={done || !reps}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 ${
          done
            ? "bg-primary text-primary-foreground"
            : reps
            ? "bg-primary/20 text-primary hover:bg-primary hover:text-primary-foreground"
            : "bg-secondary text-muted-foreground/30 cursor-not-allowed"
        }`}
      >
        <Check size={14} />
      </button>
    </div>
  );
}

// ─── State 1: Initial (min sets shown) ───────────────────────────────────────
function State1() {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-1">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-sm text-foreground">Bench Press</p>
          <p className="text-xs text-muted-foreground">2–4 sets · 7–9 reps</p>
        </div>
        <span className="text-xs text-muted-foreground/50 bg-secondary px-2 py-0.5 rounded-full">0/2 min</span>
      </div>
      <SetRow setNum={1} reps="" done={false} />
      <SetRow setNum={2} reps="" done={false} />
    </div>
  );
}

// ─── State 2: In progress ─────────────────────────────────────────────────────
function State2() {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-1">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-sm text-foreground">Bench Press</p>
          <p className="text-xs text-muted-foreground">2–4 sets · 7–9 reps</p>
        </div>
        <span className="text-xs text-muted-foreground/50 bg-secondary px-2 py-0.5 rounded-full">1/2 min</span>
      </div>
      <SetRow setNum={1} reps="8" done={true} />
      <SetRow setNum={2} reps="" done={false} />
    </div>
  );
}

// ─── State 3: Min complete — offer add or done ────────────────────────────────
function State3() {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-1">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-sm text-foreground">Bench Press</p>
          <p className="text-xs text-muted-foreground">2–4 sets · 7–9 reps</p>
        </div>
        <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">2/2 min</span>
      </div>
      <SetRow setNum={1} reps="8" done={true} />
      <SetRow setNum={2} reps="8" done={true} />
      <div className="flex items-center gap-2 pt-2">
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors">
          <Plus size={13} />
          Add set
        </button>
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors">
          <Check size={13} />
          Done
        </button>
      </div>
    </div>
  );
}

// ─── State 4: Extra set added ─────────────────────────────────────────────────
function State4() {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-1">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-sm text-foreground">Bench Press</p>
          <p className="text-xs text-muted-foreground">2–4 sets · 7–9 reps</p>
        </div>
        <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">2/2 min</span>
      </div>
      <SetRow setNum={1} reps="8" done={true} />
      <SetRow setNum={2} reps="8" done={true} />
      <SetRow setNum={3} reps="" done={false} />
      <div className="flex items-center gap-2 pt-2">
        <div className="flex-1" />
        <button className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors">
          <Check size={13} />
          Done
        </button>
      </div>
    </div>
  );
}

// ─── State 5: Max reached — auto-complete ─────────────────────────────────────
function State5() {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-1">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-sm text-foreground">Bench Press</p>
          <p className="text-xs text-muted-foreground">2–4 sets · 7–9 reps</p>
        </div>
        <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">4/4 max</span>
      </div>
      <SetRow setNum={1} reps="8" done={true} />
      <SetRow setNum={2} reps="8" done={true} />
      <SetRow setNum={3} reps="7" done={true} />
      <SetRow setNum={4} reps="7" done={true} />
      <div className="mt-2 py-2 rounded-xl bg-primary/10 text-center">
        <span className="text-xs font-bold text-primary tracking-widest uppercase">Complete</span>
      </div>
    </div>
  );
}

// ─── State 6: Done early (tapped Done after 3 sets) ──────────────────────────
function State6() {
  return (
    <div className="bg-card border border-border/40 rounded-2xl p-4 space-y-1 opacity-80">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-sm text-foreground">Bench Press</p>
          <p className="text-xs text-muted-foreground">2–4 sets · 7–9 reps</p>
        </div>
        <span className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded-full">3 sets done</span>
      </div>
      <SetRow setNum={1} reps="8" done={true} />
      <SetRow setNum={2} reps="8" done={true} />
      <SetRow setNum={3} reps="7" done={true} />
      <div className="mt-2 py-2 rounded-xl bg-primary/10 text-center">
        <span className="text-xs font-bold text-primary tracking-widest uppercase">Complete</span>
      </div>
    </div>
  );
}

// ─── Interactive demo ─────────────────────────────────────────────────────────
function InteractiveDemo() {
  const [sets, setSets] = useState<{ reps: string; done: boolean }[]>([
    { reps: "", done: false },
    { reps: "", done: false },
  ]);
  const [exerciseDone, setExerciseDone] = useState(false);

  const minSets = 2;
  const maxSets = 4;
  const allCurrentDone = sets.every(s => s.done);
  const minMet = sets.filter(s => s.done).length >= minSets;
  const atMax = sets.length >= maxSets && allCurrentDone;
  const showControls = minMet && allCurrentDone && !exerciseDone && !atMax;

  const updateReps = (i: number, v: string) => {
    setSets(prev => prev.map((s, idx) => idx === i ? { ...s, reps: v } : s));
  };
  const markDone = (i: number) => {
    setSets(prev => prev.map((s, idx) => idx === i ? { ...s, done: true } : s));
    if (sets.length >= maxSets && sets.filter((s, idx) => s.done || idx === i).length >= maxSets) {
      setTimeout(() => setExerciseDone(true), 300);
    }
  };
  const addSet = () => {
    setSets(prev => [...prev, { reps: "", done: false }]);
  };
  const markExerciseDone = () => setExerciseDone(true);

  const doneSets = sets.filter(s => s.done).length;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-1">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="font-semibold text-sm text-foreground">Bench Press</p>
          <p className="text-xs text-muted-foreground">2–4 sets · 7–9 reps</p>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          exerciseDone ? "bg-primary/10 text-primary" :
          minMet ? "bg-primary/10 text-primary" :
          "bg-secondary text-muted-foreground/50"
        }`}>
          {exerciseDone ? `${doneSets} sets done` : `${doneSets}/${minSets} min`}
        </span>
      </div>

      {sets.map((s, i) => (
        <SetRow
          key={i}
          setNum={i + 1}
          reps={s.reps}
          done={s.done}
          onRepsChange={v => updateReps(i, v)}
          onDone={() => markDone(i)}
        />
      ))}

      {exerciseDone || atMax ? (
        <div className="mt-2 py-2 rounded-xl bg-primary/10 text-center">
          <span className="text-xs font-bold text-primary tracking-widest uppercase">Complete</span>
        </div>
      ) : showControls ? (
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={addSet}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border border-dashed border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <Plus size={13} />
            Add set
          </button>
          <button
            onClick={markExerciseDone}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
          >
            <Check size={13} />
            Done
          </button>
        </div>
      ) : minMet && !allCurrentDone ? (
        <div className="flex items-center gap-2 pt-2">
          <div className="flex-1" />
          <button
            onClick={markExerciseDone}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
          >
            <Check size={13} />
            Done
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SetFlowMockup() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-sm mx-auto space-y-8">
        <div>
          <h1 className="text-lg font-bold text-foreground mb-1">Set Flow Mockup</h1>
          <p className="text-xs text-muted-foreground">Exercise card states for autoregulation set protocol</p>
        </div>

        {/* Interactive demo first */}
        <div>
          <p className="text-[10px] uppercase tracking-widest text-primary mb-2">Interactive Demo — try it</p>
          <InteractiveDemo />
          <p className="text-xs text-muted-foreground mt-2">Enter reps and tick each set. After 2 sets, choose to add more or mark done. Max 4 sets.</p>
        </div>

        <div className="border-t border-border/40 pt-6 space-y-6">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Static States</p>

          <div>
            <p className="text-xs text-muted-foreground mb-2">State 1 — Initial (min sets pre-loaded)</p>
            <State1 />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">State 2 — Set 1 complete</p>
            <State2 />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">State 3 — Min sets complete (add or done)</p>
            <State3 />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">State 4 — Extra set added</p>
            <State4 />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">State 5 — Max sets reached (auto-complete)</p>
            <State5 />
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-2">State 6 — Done tapped early (3 of 4 sets)</p>
            <State6 />
          </div>
        </div>
      </div>
    </div>
  );
}
