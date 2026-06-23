import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Camera,
  Image as ImageIcon,
  X,
  HelpCircle,
  Plus,
  Pencil,
  Trash2,
  UtensilsCrossed,
  Cookie,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

// ─── Scale ────────────────────────────────────────────────────────────────────

const SCALE: { label: string; desc: string }[] = [
  { label: "Ravenous", desc: "painfully hungry, weak, need to eat now" },
  { label: "Very hungry", desc: "food focused, irritable, low energy" },
  { label: "Hungry", desc: "empty, definitely hungry" },
  { label: "Mild hunger", desc: "starting to feel empty, could eat" },
  { label: "Neutral", desc: "neither hungry nor full" },
  { label: "Satisfied", desc: "starting to feel full, could stop here" },
  { label: "Full", desc: "comfortably full, feeling good" },
  { label: "Overfull", desc: "ate a bit too much, slightly uncomfortable" },
  { label: "Stuffed", desc: "very full, bloated and uncomfortable" },
  { label: "Painfully full", desc: "sick or nauseous" },
];

function isIdealHunger(r: number) { return r >= 3 && r <= 4; }
function isIdealFullness(r: number) { return r >= 6 && r <= 7; }
function isIdealZone(h?: number | null, f?: number | null) {
  return h != null && f != null && isIdealHunger(h) && isIdealFullness(f);
}

function ratingColor(r: number, type: "hunger" | "fullness") {
  if (type === "hunger") return isIdealHunger(r) ? "text-green-400" : "text-amber-400";
  return isIdealFullness(r) ? "text-green-400" : "text-amber-400";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(d: Date) {
  const h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${ampm}`;
}

function formatDate(d: Date) {
  return d.toLocaleDateString("en-AU", { weekday: "long", day: "numeric", month: "long" });
}

function toLocalDateStr(d: Date) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function timeAgo(d: Date) {
  const diff = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff} min ago`;
  const hrs = Math.floor(diff / 60);
  return `${hrs}h ago`;
}

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [header, base64] = result.split(",");
      const mimeType = header.match(/:(.*?);/)?.[1] ?? "image/jpeg";
      resolve({ base64, mimeType });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Scale Reference Modal ────────────────────────────────────────────────────

function ScaleModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm mx-auto flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Hunger &amp; Fullness Scale</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-1">Aim to start eating at 3–4 and stop at 6–7.</p>
        <div className="space-y-0.5 text-sm overflow-y-auto flex-1 mt-2">
          {SCALE.map((s, i) => {
            const n = i + 1;
            const isIdeal = (n >= 3 && n <= 4) || (n >= 6 && n <= 7);
            return (
              <div key={n} className={cn("flex gap-3 py-2 px-2 rounded-md border-b border-border/40 last:border-0", isIdeal && "bg-green-500/10")}>
                <span className={cn("font-bold w-6 shrink-0 text-center", isIdeal ? "text-green-400" : "text-muted-foreground")}>{n}</span>
                <div>
                  <span className={cn("font-medium", isIdeal ? "text-green-400" : "text-foreground")}>{s.label}</span>
                  <span className="text-muted-foreground"> — {s.desc}</span>
                </div>
              </div>
            );
          })}
        </div>
        <Button className="w-full mt-4" onClick={onClose}>Got it</Button>
      </DialogContent>
    </Dialog>
  );
}

// ─── Rating Stepper ───────────────────────────────────────────────────────────

function RatingPicker({
  value,
  onChange,
  type,
  onOpenScale,
}: {
  value: number | null;
  onChange: (v: number) => void;
  type: "hunger" | "fullness";
  onOpenScale?: () => void;
}) {
  const idealFn = type === "hunger" ? isIdealHunger : isIdealFullness;
  const current = value ?? 5;
  const label = SCALE[current - 1];
  const isIdeal = idealFn(current);

  function decrement() { onChange(Math.max(1, current - 1)); }
  function increment() { onChange(Math.min(10, current + 1)); }

  return (
    <div className="space-y-3">
      {/* Label row */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
          {type === "hunger" ? "Hunger before eating" : "How full are you now?"}
        </p>
        {onOpenScale && (
          <button onClick={onOpenScale} className="text-muted-foreground hover:text-foreground transition-colors">
            <HelpCircle size={16} />
          </button>
        )}
      </div>
      {/* Stepper */}
      <div className="flex items-center justify-between gap-4">
        <button
          onClick={decrement}
          disabled={current <= 1}
          className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-2xl font-light text-foreground hover:bg-secondary/80 disabled:opacity-30 transition-all"
        >
          −
        </button>
        <div className="flex-1 text-center">
          <p className={cn("text-6xl font-bold leading-none", isIdeal ? "text-green-400" : "text-foreground")}>
            {current}
          </p>
          <p className={cn("text-sm mt-2 font-medium", isIdeal ? "text-green-400" : "text-muted-foreground")}>
            {label.label}
          </p>
        </div>
        <button
          onClick={increment}
          disabled={current >= 10}
          className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-2xl font-light text-foreground hover:bg-secondary/80 disabled:opacity-30 transition-all"
        >
          +
        </button>
      </div>
      {/* Dot progress bar */}
      <div className="flex items-center justify-between gap-1">
        <span className="text-xs text-muted-foreground">1</span>
        <div className="flex-1 flex gap-1 justify-between px-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => onChange(n)}
              className={cn(
                "flex-1 h-1.5 rounded-full transition-all",
                n <= current
                  ? idealFn(n) ? "bg-green-400" : "bg-foreground/40"
                  : "bg-secondary"
              )}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground">10</span>
      </div>
    </div>
  );
}

// ─── Log Sheet ────────────────────────────────────────────────────────────────

function LogSheet({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mealType, setMealType] = useState<"meal" | "treat">("meal");
  const [hunger, setHunger] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [portion, setPortion] = useState<"small" | "medium" | "large" | null>(null);
  const [notes, setNotes] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState<{ base64: string; mimeType: string } | null>(null);
  const [scaleOpen, setScaleOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const logMutation = trpc.mealLogs.log.useMutation({
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  function reset() {
    setMealType("meal");
    setHunger(null);
    setName("");
    setPortion(null);
    setNotes("");
    setPhotoPreview(null);
    setPhotoData(null);
    setScaleOpen(false);
  }

  function handleClose() { reset(); onClose(); }

  async function handlePhoto(file: File) {
    const data = await fileToBase64(file);
    setPhotoData(data);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function handleSave() {
    logMutation.mutate({
      loggedAt: Date.now(),
      mealType,
      name: name || undefined,
      imageBase64: photoData?.base64,
      mimeType: photoData?.mimeType as any,
      portionSize: portion ?? undefined,
      hungerRating: mealType === "meal" ? (hunger ?? undefined) : undefined,
      isOffPlan: false,
      notes: notes || undefined,
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 border-b border-border shrink-0">
        <h2 className="text-lg font-semibold text-foreground">Log {mealType === "treat" ? "Treat" : "Meal"}</h2>
        <button onClick={handleClose} className="text-muted-foreground hover:text-foreground p-1">
          <X size={22} />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
        {/* Meal / Treat toggle */}
        <div className="flex gap-2 p-1 bg-secondary rounded-xl">
          {(["meal", "treat"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setMealType(t); if (t === "treat") setHunger(null); }}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all capitalize",
                mealType === t ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Hunger scale — meals only */}
        {mealType === "meal" && (
          <RatingPicker value={hunger} onChange={setHunger} type="hunger" onOpenScale={() => setScaleOpen(true)} />
        )}

        {/* Portion — treats only */}
        {mealType === "treat" && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Portion size</p>
            <div className="flex gap-2">
              {(["small", "medium", "large"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPortion(portion === p ? null : p)}
                  className={cn(
                    "flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all capitalize",
                    portion === p ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            {/* Calorie range info card */}
            <div className="bg-secondary/60 rounded-xl p-3 text-xs space-y-1">
              <div className="flex gap-2"><span className="font-semibold w-14 shrink-0">Small</span><span className="text-muted-foreground">e.g. 1 square of chocolate (~50–150 cal)</span></div>
              <div className="flex gap-2"><span className="font-semibold w-14 shrink-0">Medium</span><span className="text-muted-foreground">e.g. 1 cup of ice cream (~150–350 cal)</span></div>
              <div className="flex gap-2"><span className="font-semibold w-14 shrink-0">Large</span><span className="text-muted-foreground">e.g. 1 large slice of cake (~350–600 cal)</span></div>
            </div>
          </div>
        )}

        {/* Photo */}
        <div>
          {photoPreview ? (
            <div className="relative">
              <img src={photoPreview} alt="Meal" className="w-full h-52 object-cover rounded-xl" />
              <button
                onClick={() => { setPhotoPreview(null); setPhotoData(null); }}
                className="absolute top-2 right-2 bg-black/60 rounded-full p-1.5"
              >
                <X size={14} className="text-white" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors text-sm"
              >
                <Camera size={16} /> Camera
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 flex items-center justify-center gap-2 py-4 rounded-xl border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors text-sm"
              >
                <ImageIcon size={16} /> Gallery
              </button>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }} />
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }} />
            </div>
          )}
        </div>

        {/* Name */}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="What are you eating?"
          className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
        />

        {/* Notes */}
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes"
          rows={3}
          className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
        />
      </div>

      {/* Sticky footer */}
      <div className="px-4 pb-8 pt-3 border-t border-border shrink-0">
        <Button onClick={handleSave} className="w-full h-12 text-base" disabled={logMutation.isPending}>
          {logMutation.isPending ? "Saving..." : mealType === "treat" ? "Save Treat" : "Save Meal"}
        </Button>
      </div>

      <ScaleModal open={scaleOpen} onClose={() => setScaleOpen(false)} />
    </div>
  );
}

// ─── Fullness Sheet ───────────────────────────────────────────────────────────

function FullnessSheet({
  open,
  mealId,
  onClose,
  onSaved,
}: {
  open: boolean;
  mealId: number | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullness, setFullness] = useState<number | null>(null);

  const rateMutation = trpc.mealLogs.rateFullness.useMutation({
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  function handleClose() {
    setFullness(null);
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && handleClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-8" hideCloseButton>
        <SheetHeader className="flex flex-row items-center justify-between mb-6">
          <SheetTitle>How are you feeling?</SheetTitle>
          <button onClick={handleClose} className="text-muted-foreground hover:text-foreground p-1">
            <X size={20} />
          </button>
        </SheetHeader>
        <div className="space-y-6">
          <RatingPicker value={fullness} onChange={setFullness} type="fullness" />
          <Button
            className="w-full"
            disabled={fullness == null || rateMutation.isPending || mealId == null}
            onClick={() => mealId != null && fullness != null && rateMutation.mutate({ id: mealId, fullnessRating: fullness })}
          >
            {rateMutation.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Edit Sheet ───────────────────────────────────────────────────────────────

function EditSheet({
  open,
  meal,
  onClose,
  onSaved,
}: {
  open: boolean;
  meal: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [portion, setPortion] = useState<"small" | "medium" | "large" | null>(null);
  const [hunger, setHunger] = useState<number | null>(null);
  const [fullness, setFullness] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoData, setPhotoData] = useState<{ base64: string; mimeType: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (meal) {
      setName(meal.name ?? "");
      setPortion(meal.portionSize ?? null);
      setHunger(meal.hungerRating ?? null);
      setFullness(meal.fullnessRating ?? null);
      setNotes(meal.notes ?? "");
      setPhotoPreview(meal.photoUrl ?? null);
      setPhotoData(null);
    }
  }, [meal]);

  const editMutation = trpc.mealLogs.edit.useMutation({
    onSuccess: () => { onSaved(); onClose(); },
    onError: (e) => toast.error(e.message),
  });

  async function handlePhoto(file: File) {
    const data = await fileToBase64(file);
    setPhotoData(data);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function handleSave() {
    if (!meal) return;
    editMutation.mutate({
      id: meal.id,
      name: name || undefined,
      portionSize: portion,
      hungerRating: meal.mealType === "meal" ? hunger : undefined,
      fullnessRating: meal.mealType === "meal" ? fullness : undefined,
      isOffPlan: false,
      notes: notes || null,
      imageBase64: photoData?.base64,
      mimeType: photoData?.mimeType as any,
    });
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-4 pb-8" hideCloseButton>
        <SheetHeader className="flex flex-row items-center justify-between mb-4">
          <SheetTitle>Edit {meal?.mealType === "treat" ? "Treat" : "Meal"}</SheetTitle>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X size={20} />
          </button>
        </SheetHeader>
        <div className="space-y-5">
          {/* Photo */}
          <div>
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="Meal" className="w-full h-40 object-cover rounded-xl" />
                <button
                  onClick={() => { setPhotoPreview(null); setPhotoData(null); }}
                  className="absolute top-2 right-2 bg-black/60 rounded-full p-1"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-foreground transition-colors text-sm"
              >
                <Camera size={16} /> Add photo
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhoto(f); }}
            />
          </div>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="What are you eating?"
            className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
          />

          {meal?.mealType === "treat" && (
            <div>
              <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wide">Portion size</p>
              <div className="flex gap-2">
                {(["small", "medium", "large"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPortion(portion === p ? null : p)}
                    className={cn(
                      "flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all capitalize",
                      portion === p ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {meal?.mealType === "meal" && (
            <>
              <div>
                <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">Hunger before</p>
                <RatingPicker value={hunger} onChange={setHunger} type="hunger" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wide">Fullness after</p>
                <RatingPicker value={fullness} onChange={setFullness} type="fullness" />
              </div>
            </>
          )}

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            rows={2}
            className="w-full bg-secondary border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />

          <Button className="w-full" onClick={handleSave} disabled={editMutation.isPending}>
            {editMutation.isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Meal Row ─────────────────────────────────────────────────────────────────

function MealRow({
  meal,
  onEdit,
  onDelete,
  onRateFullness,
}: {
  meal: any;
  onEdit: (m: any) => void;
  onDelete: (m: any) => void;
  onRateFullness: (m: any) => void;
}) {
  const time = formatTime(new Date(meal.loggedAt));
  const isMeal = meal.mealType === "meal";
  const h = meal.hungerRating;
  const f = meal.fullnessRating;
  const ideal = isIdealZone(h, f);

  return (
    <div className="flex items-center gap-3 py-3 border-b border-border last:border-0">
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-secondary flex items-center justify-center">
        {meal.photoUrl ? (
          <img src={meal.photoUrl} alt="Meal" className="w-full h-full object-cover" />
        ) : isMeal ? (
          <UtensilsCrossed size={22} className="text-muted-foreground/50" />
        ) : (
          <Cookie size={22} className="text-muted-foreground/50" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs text-muted-foreground">{time}</span>
            {false && (
              <span className="hidden">Off Plan</span>
          )}
        </div>
        {meal.name && <p className="text-sm font-medium text-foreground truncate">{meal.name}</p>}
        {meal.portionSize && <p className="text-xs text-muted-foreground capitalize">{meal.portionSize} portion</p>}
        {isMeal ? (
          <div className="flex items-center gap-2 mt-0.5">
            {h != null ? (
              <span className={cn("text-xs font-semibold", ratingColor(h, "hunger"))}>H{h}</span>
            ) : null}
            {h != null && <span className="text-muted-foreground text-xs">·</span>}
            {f != null ? (
              <span className={cn("text-xs font-semibold", ratingColor(f, "fullness"))}>F{f}</span>
            ) : (
              <button
                onClick={() => onRateFullness(meal)}
                className="text-xs text-primary underline underline-offset-2"
              >
                Rate fullness
              </button>
            )}
            {ideal && <span className="text-[10px] text-green-400 font-medium">Ideal zone</span>}
          </div>
        ) : (
          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">Treat</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={() => onEdit(meal)} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
          <Pencil size={15} />
        </button>
        <button onClick={() => onDelete(meal)} className="p-2 text-muted-foreground hover:text-red-400 transition-colors">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

// ─── Today Screen ─────────────────────────────────────────────────────────────

function TodayScreen() {
  const [logOpen, setLogOpen] = useState(false);
  const [fullnessOpen, setFullnessOpen] = useState(false);
  const [fullnessMealId, setFullnessMealId] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editMeal, setEditMeal] = useState<any | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any | null>(null);
  const [scaleOpen, setScaleOpen] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState<number | null>(null);

  const todayStr = toLocalDateStr(new Date());
  const { data: meals = [], refetch } = trpc.mealLogs.listByDay.useQuery(
    { date: todayStr },
    { refetchInterval: 60_000 }
  );

  const deleteMutation = trpc.mealLogs.delete.useMutation({
    onSuccess: () => { refetch(); setDeleteConfirm(null); },
    onError: (e) => toast.error(e.message),
  });

  // Filter to today's meals only (server returns ±1 day window)
  const todayMeals = (meals as any[]).filter((m) => {
    const d = new Date(m.loggedAt);
    return toLocalDateStr(d) === todayStr;
  }).sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());

  const mealCount = todayMeals.filter((m) => m.mealType === "meal").length;
  const treatCount = todayMeals.filter((m) => m.mealType === "treat").length;

  // Fullness banner: most recent meal with no fullness rating, logged within 2 hours
  const bannerMeal = (() => {
    const now = Date.now();
    const unrated = todayMeals
      .filter((m) => m.mealType === "meal" && m.fullnessRating == null)
      .sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
    const candidate = unrated[0];
    if (!candidate) return null;
    const age = now - new Date(candidate.loggedAt).getTime();
    if (age > 2 * 60 * 60 * 1000) return null;
    if (bannerDismissed === candidate.id) return null;
    return candidate;
  })();

  return (
    <div className="space-y-4">
      {/* Fullness banner */}
      {bannerMeal && (
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 bg-primary/10 border border-primary/30 rounded-xl text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-muted-foreground shrink-0">
              {bannerMeal.name || "Meal"} · {formatTime(new Date(bannerMeal.loggedAt))}
            </span>
            <span className="text-xs text-muted-foreground shrink-0">{timeAgo(new Date(bannerMeal.loggedAt))}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => { setFullnessMealId(bannerMeal.id); setFullnessOpen(true); }}
              className="text-primary text-xs font-semibold hover:underline"
            >
              Rate fullness
            </button>
            <button onClick={() => setBannerDismissed(bannerMeal.id)} className="text-muted-foreground hover:text-foreground">
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted-foreground text-sm">{greeting()}</p>
          <p className="text-lg font-bold text-foreground">{formatDate(new Date())}</p>
        </div>
        <button onClick={() => setScaleOpen(true)} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
          <HelpCircle size={18} />
        </button>
      </div>

      {/* Stat chips */}
      <div className="flex gap-2">
        <div className="flex-1 bg-secondary rounded-xl px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-foreground">{mealCount}</p>
          <p className="text-xs text-muted-foreground">Meals</p>
        </div>
        <div className="flex-1 bg-secondary rounded-xl px-3 py-2.5 text-center">
          <p className="text-lg font-bold text-foreground">{treatCount}</p>
          <p className="text-xs text-muted-foreground">Treats</p>
        </div>
      </div>

      {/* Meal list */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {todayMeals.length === 0 ? (
          <div className="py-14 text-center flex flex-col items-center gap-2">
            <UtensilsCrossed size={36} className="text-muted-foreground/30 mb-1" />
            <p className="text-foreground font-medium text-sm">No meals logged today</p>
            <p className="text-xs text-muted-foreground">Tap + Log to record your first meal</p>
          </div>
        ) : (
          <div className="px-4">
            {todayMeals.map((m) => (
              <MealRow
                key={m.id}
                meal={m}
                onEdit={(meal) => { setEditMeal(meal); setEditOpen(true); }}
                onDelete={(meal) => setDeleteConfirm(meal)}
                onRateFullness={(meal) => { setFullnessMealId(meal.id); setFullnessOpen(true); }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Log FAB */}
      <button
        onClick={() => setLogOpen(true)}
        className="fixed bottom-24 right-4 flex items-center gap-2 px-5 py-3.5 bg-primary text-primary-foreground rounded-full shadow-lg font-semibold text-sm hover:opacity-90 transition-opacity z-20"
      >
        <Plus size={18} /> Log
      </button>

      {/* Sheets & Modals */}
      <LogSheet open={logOpen} onClose={() => setLogOpen(false)} onSaved={() => refetch()} />
      <FullnessSheet
        open={fullnessOpen}
        mealId={fullnessMealId}
        onClose={() => { setFullnessOpen(false); setFullnessMealId(null); }}
        onSaved={() => refetch()}
      />
      <EditSheet
        open={editOpen}
        meal={editMeal}
        onClose={() => { setEditOpen(false); setEditMeal(null); }}
        onSaved={() => refetch()}
      />
      <ScaleModal open={scaleOpen} onClose={() => setScaleOpen(false)} />

      {/* Delete confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
        <DialogContent className="max-w-xs mx-auto">
          <DialogHeader>
            <DialogTitle>Delete meal?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => deleteConfirm && deleteMutation.mutate({ id: deleteConfirm.id })}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Mini Calendar ───────────────────────────────────────────────────────────

function MiniCalendar({
  selectedDate,
  onSelect,
  datesWithMeals,
  onMonthChange,
}: {
  selectedDate: Date;
  onSelect: (d: Date) => void;
  datesWithMeals: Set<string>;
  onMonthChange: (month: string) => void;
}) {
  const [viewMonth, setViewMonth] = useState(() => {
    const d = new Date(selectedDate);
    d.setDate(1);
    return d;
  });

  const today = new Date();
  const todayStr = toLocalDateStr(today);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7; // Mon=0
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

  function prevMonth() {
    const next = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
    setViewMonth(next);
    onMonthChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
  }
  function nextMonth() {
    const now = new Date();
    const next = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
    if (next <= new Date(now.getFullYear(), now.getMonth(), 1)) {
      setViewMonth(next);
      onMonthChange(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`);
    }
  }

  const canGoNext = (() => {
    const next = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
    const now = new Date();
    return next <= new Date(now.getFullYear(), now.getMonth(), 1);
  })();

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary">
          <ChevronLeft size={18} />
        </button>
        <p className="text-sm font-semibold text-foreground">
          {viewMonth.toLocaleDateString("en-AU", { month: "long", year: "numeric" })}
        </p>
        <button
          onClick={nextMonth}
          disabled={!canGoNext}
          className={cn("p-1.5 rounded-lg transition-colors", canGoNext ? "text-muted-foreground hover:text-foreground hover:bg-secondary" : "text-muted-foreground/20 cursor-not-allowed")}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => (
          <div key={d} className="text-center text-xs text-muted-foreground/60 font-medium py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: totalCells }, (_, i) => {
          const dayNum = i - startOffset + 1;
          if (dayNum < 1 || dayNum > daysInMonth) return <div key={i} />;
          const cellDate = new Date(year, month, dayNum);
          const cellStr = toLocalDateStr(cellDate);
          const isSelected = cellStr === toLocalDateStr(selectedDate);
          const isT = cellStr === todayStr;
          const hasMeals = datesWithMeals.has(cellStr);
          const isFuture = cellDate > today;
          return (
            <button
              key={i}
              disabled={isFuture}
              onClick={() => onSelect(cellDate)}
              className={cn(
                "relative flex flex-col items-center justify-center h-9 rounded-lg text-sm transition-all",
                isFuture ? "text-muted-foreground/20 cursor-not-allowed" :
                isSelected ? "bg-primary text-primary-foreground font-bold" :
                isT ? "border border-primary text-primary font-semibold" :
                "text-foreground hover:bg-secondary"
              )}
            >
              {dayNum}
              {hasMeals && !isSelected && (
                <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary/70" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── History Screen ───────────────────────────────────────────────────────────

function HistoryScreen() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [editOpen, setEditOpen] = useState(false);
  const [editMeal, setEditMeal] = useState<any | null>(null);
  const [fullnessOpen, setFullnessOpen] = useState(false);
  const [fullnessMealId, setFullnessMealId] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<any | null>(null);

  const dateStr = toLocalDateStr(selectedDate);
  const { data: meals = [], refetch } = trpc.mealLogs.listByDay.useQuery({ date: dateStr });

  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const { data: monthDates = [] } = trpc.mealLogs.listDatesWithMeals.useQuery({ month: calMonth });
  const datesWithMeals = useMemo(() => new Set(monthDates as string[]), [monthDates]);

  const deleteMutation = trpc.mealLogs.delete.useMutation({
    onSuccess: () => { refetch(); setDeleteConfirm(null); },
    onError: (e) => toast.error(e.message),
  });

  const dayMeals = (meals as any[]).filter((m) => toLocalDateStr(new Date(m.loggedAt)) === dateStr)
    .sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());

  return (
    <div className="space-y-4">
      {/* Calendar */}
      <MiniCalendar
        selectedDate={selectedDate}
        onSelect={setSelectedDate}
        datesWithMeals={datesWithMeals}
        onMonthChange={setCalMonth}
      />

      {/* Meal list */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        {dayMeals.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted-foreground text-sm">No meals logged on this day</p>
          </div>
        ) : (
          <div className="px-4">
            {dayMeals.map((m) => (
              <MealRow
                key={m.id}
                meal={m}
                onEdit={(meal) => { setEditMeal(meal); setEditOpen(true); }}
                onDelete={(meal) => setDeleteConfirm(meal)}
                onRateFullness={(meal) => { setFullnessMealId(meal.id); setFullnessOpen(true); }}
              />
            ))}
          </div>
        )}
      </div>

      <EditSheet
        open={editOpen}
        meal={editMeal}
        onClose={() => { setEditOpen(false); setEditMeal(null); }}
        onSaved={() => refetch()}
      />
      <FullnessSheet
        open={fullnessOpen}
        mealId={fullnessMealId}
        onClose={() => { setFullnessOpen(false); setFullnessMealId(null); }}
        onSaved={() => refetch()}
      />
      <Dialog open={!!deleteConfirm} onOpenChange={(v) => !v && setDeleteConfirm(null)}>
        <DialogContent className="max-w-xs mx-auto">
          <DialogHeader><DialogTitle>Delete meal?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={() => deleteConfirm && deleteMutation.mutate({ id: deleteConfirm.id })} disabled={deleteMutation.isPending}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Insights Screen ──────────────────────────────────────────────────────────

function InsightsScreen() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const { data: insights, isLoading } = trpc.mealLogs.insights.useQuery({ days });

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (!insights) return null;

  const hasSufficientData = insights.totalMeals >= 5;

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1 w-fit">
        {([7, 30, 90] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={cn(
              "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
              days === d ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {d}d
          </button>
        ))}
      </div>

      {!hasSufficientData && (
        <div className="bg-secondary rounded-xl px-4 py-3 text-sm text-muted-foreground">
          Log at least 5 meals to see insights. You have {insights.totalMeals} so far.
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{insights.totalMeals}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Meals</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className={cn("text-2xl font-bold", insights.avgHunger != null && isIdealHunger(Math.round(insights.avgHunger)) ? "text-green-400" : "text-foreground")}>
            {insights.avgHunger ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Avg Hunger</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <p className={cn("text-2xl font-bold", insights.avgFullness != null && isIdealFullness(Math.round(insights.avgFullness)) ? "text-green-400" : "text-foreground")}>
            {insights.avgFullness ?? "—"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Avg Fullness</p>
        </div>
      </div>

      {/* Ideal zone bar */}
      {insights.idealZonePct != null && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">Meals in ideal zone</span>
            <span className={cn("font-bold", insights.idealZonePct >= 50 ? "text-green-400" : "text-amber-400")}>
              {insights.idealZonePct}%
            </span>
          </div>
          <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", insights.idealZonePct >= 50 ? "bg-green-500" : "bg-amber-500")}
              style={{ width: `${insights.idealZonePct}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {insights.idealZoneCount} of {insights.mealsWithBothRatings} rated meals started at hunger 3–4 and ended at fullness 6–7
          </p>
        </div>
      )}

      {/* Hunger distribution */}
      {hasSufficientData && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Hunger at start of meal</p>
          <DistributionChart dist={insights.hungerDist} idealFn={isIdealHunger} />
        </div>
      )}

      {/* Fullness distribution */}
      {hasSufficientData && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Fullness after meal</p>
          <DistributionChart dist={insights.fullnessDist} idealFn={isIdealFullness} />
        </div>
      )}

      {/* Meal timing */}
      {(insights.avgFirstMeal || insights.avgLastMeal || insights.avgGapHours) && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-foreground">Meal timing</p>
          {insights.avgFirstMeal && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">First meal</span>
              <span className="font-medium text-foreground">{insights.avgFirstMeal}</span>
            </div>
          )}
          {insights.avgLastMeal && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last meal</span>
              <span className="font-medium text-foreground">{insights.avgLastMeal}</span>
            </div>
          )}
          {insights.avgGapHours != null && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Avg gap between meals</span>
              <span className="font-medium text-foreground">{insights.avgGapHours}h</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DistributionChart({
  dist,
  idealFn,
}: {
  dist: Record<number, number>;
  idealFn: (n: number) => boolean;
}) {
  const max = Math.max(...Object.values(dist), 1);
  return (
    <div className="space-y-1.5">
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const count = dist[n] ?? 0;
        const pct = (count / max) * 100;
        const ideal = idealFn(n);
        return (
          <div key={n} className="flex items-center gap-2">
            <span className={cn("text-xs w-4 shrink-0 text-right font-medium", ideal ? "text-green-400" : "text-muted-foreground")}>{n}</span>
            <div className="flex-1 h-5 bg-secondary rounded-sm overflow-hidden">
              <div
                className={cn("h-full rounded-sm transition-all", ideal ? "bg-green-500" : "bg-primary/60")}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-5 shrink-0">{count}</span>
          </div>
        );
      })}
    </div>
  );
}

/// ─── Combined Nutrition Tab ─────────────────────────────────────────────────

type NutritionSub = "today" | "history";

export function CombinedNutritionTab({ defaultSub = "today" }: { defaultSub?: NutritionSub }) {
  const [sub, setSub] = useState<NutritionSub>(() => {
    try {
      const stored = sessionStorage.getItem("nutritionTab:sub") as NutritionSub | null;
      return (stored === "today" || stored === "history") ? stored : defaultSub;
    } catch { return defaultSub; }
  });

  useEffect(() => {
    try { sessionStorage.setItem("nutritionTab:sub", sub); } catch {}
  }, [sub]);

  return (
    <div>
      <div className="flex gap-1 mb-6 bg-secondary rounded-lg p-1">
        {(["today", "history"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSub(s)}
            className={cn(
              "flex-1 py-1.5 rounded-md text-sm font-medium transition-colors capitalize",
              sub === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s === "today" ? "Today" : "History"}
          </button>
        ))}
      </div>
      {sub === "today" && <TodayScreen />}
      {sub === "history" && <HistoryScreen />}
    </div>
  );
}

export default CombinedNutritionTab;
