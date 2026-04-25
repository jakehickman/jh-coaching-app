import { useState, useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { GripVertical, Pencil, Trash2, Plus, X } from "lucide-react";
import { toast } from "sonner";

type QuestionType = "single_choice" | "free_text";

interface Question {
  id: number;
  slug: string;
  questionText: string;
  type: QuestionType;
  options: string[] | null;
  displayOrder: number;
  active: boolean;
}

interface EditForm {
  id?: number;
  slug: string;
  questionText: string;
  type: QuestionType;
  options: string[];
  active: boolean;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 64);
}

export default function CheckInQuestionsManager() {
  const utils = trpc.useUtils();

  // ── Server query — seeds local array once ───────────────────────────────────
  const { data: serverQuestions, isLoading } = trpc.questions.list.useQuery();
  const [items, setItems] = useState<Question[]>([]);
  const seeded = useRef(false);

  useEffect(() => {
    if (serverQuestions && !seeded.current) {
      setItems(serverQuestions as Question[]);
      seeded.current = true;
    }
  }, [serverQuestions]);

  // ── Mutations ───────────────────────────────────────────────────────────────
  const upsertMutation = trpc.questions.upsert.useMutation({
    onSuccess: () => {
      utils.questions.list.invalidate().then(() => { seeded.current = false; });
      utils.questions.listActive.invalidate();
      setEditOpen(false);
      toast.success("Question saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleMutation = trpc.questions.toggle.useMutation({
    onSuccess: (_data, variables) => {
      setItems((prev) =>
        prev.map((q) => (q.id === variables.id ? { ...q, active: variables.active } : q))
      );
      utils.questions.listActive.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.questions.delete.useMutation({
    onSuccess: (_data, variables) => {
      setItems((prev) => prev.filter((q) => q.id !== variables.id));
      utils.questions.listActive.invalidate();
      setDeleteId(null);
      setEditOpen(false);
      toast.success("Question deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const reorderMutation = trpc.questions.reorder.useMutation({
    onError: (e) => {
      toast.error("Reorder failed — refreshing");
      seeded.current = false;
      utils.questions.list.invalidate();
    },
  });

  useEffect(() => {
    if (serverQuestions && !seeded.current) {
      setItems(serverQuestions as Question[]);
      seeded.current = true;
    }
  }, [serverQuestions]);

  // ── UI state ────────────────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [newOption, setNewOption] = useState("");

  const emptyForm: EditForm = {
    slug: "", questionText: "", type: "single_choice", options: [], active: true,
  };
  const [form, setForm] = useState<EditForm>(emptyForm);

  // ── Pointer-based drag state ─────────────────────────────────────────────────
  // dragId: which question is being dragged
  // dropIndex: insertion position in the "without" array (activeItems minus dragId)
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // Store card heights for the ghost placeholder
  const cardHeightRef = useRef<number>(60);

  // ── Derived lists ───────────────────────────────────────────────────────────
  const activeItems = items.filter((q) => q.active);
  const hiddenItems = items.filter((q) => !q.active);

  // ── Compute drop index from cursor Y ────────────────────────────────────────
  // Scans [data-card-id] elements in the list container, skipping the dragged one.
  const computeDropIndex = useCallback((cursorY: number, excludeId: number): number => {
    if (!listRef.current) return 0;
    const cards = Array.from(
      listRef.current.querySelectorAll<HTMLElement>("[data-card-id]")
    ).filter((el) => Number(el.dataset.cardId) !== excludeId);

    for (let i = 0; i < cards.length; i++) {
      const rect = cards[i].getBoundingClientRect();
      if (cursorY < rect.top + rect.height / 2) return i;
    }
    return cards.length;
  }, []);

  // ── Pointer event handlers ───────────────────────────────────────────────────
  const onGripPointerDown = useCallback((e: React.PointerEvent, id: number) => {
    // Only left button
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    // Capture pointer so we get events even outside the element
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

    // Measure card height
    const card = (e.currentTarget as HTMLElement).closest("[data-card-id]") as HTMLElement;
    if (card) cardHeightRef.current = card.getBoundingClientRect().height;

    setDragId(id);
    setDropIndex(computeDropIndex(e.clientY, id));
  }, [computeDropIndex]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragId === null) return;
    e.preventDefault();
    setDropIndex(computeDropIndex(e.clientY, dragId));
  }, [dragId, computeDropIndex]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (dragId === null) return;
    e.preventDefault();

    const finalIndex = computeDropIndex(e.clientY, dragId);

    // Commit the reorder
    const without = activeItems.filter((q) => q.id !== dragId);
    const dragged = activeItems.find((q) => q.id === dragId);
    if (dragged) {
      const targetIdx = Math.max(0, Math.min(finalIndex, without.length));
      without.splice(targetIdx, 0, dragged);
      const newItems = [...without, ...hiddenItems];
      setItems(newItems);
      reorderMutation.mutate({ orderedIds: newItems.map((q) => q.id) });
    }

    setDragId(null);
    setDropIndex(null);
  }, [dragId, activeItems, hiddenItems, computeDropIndex, reorderMutation]);

  const onPointerCancel = useCallback(() => {
    setDragId(null);
    setDropIndex(null);
  }, []);

  // ── Edit helpers ────────────────────────────────────────────────────────────
  function openAdd() {
    setForm(emptyForm);
    setNewOption("");
    setEditOpen(true);
  }

  function openEdit(q: Question) {
    setForm({
      id: q.id, slug: q.slug, questionText: q.questionText,
      type: q.type, options: q.options ?? [], active: q.active,
    });
    setNewOption("");
    setEditOpen(true);
  }

  function handleSave() {
    if (!form.questionText.trim()) { toast.error("Question text is required"); return; }
    if (form.type === "single_choice" && form.options.filter((o) => o.trim()).length < 2) {
      toast.error("Single choice questions need at least 2 options"); return;
    }
    const slug = form.slug.trim() || slugify(form.questionText);
    upsertMutation.mutate({
      id: form.id, slug,
      questionText: form.questionText.trim(),
      type: form.type,
      options: form.type === "single_choice" ? form.options.filter((o) => o.trim()) : null,
      displayOrder: form.id
        ? (items.find((q) => q.id === form.id)?.displayOrder ?? 99)
        : items.length + 1,
      active: form.active,
    });
  }

  function addOption() {
    const val = newOption.trim();
    if (!val) return;
    setForm((f) => ({ ...f, options: [...f.options, val] }));
    setNewOption("");
  }

  function removeOption(idx: number) {
    setForm((f) => ({ ...f, options: f.options.filter((_, i) => i !== idx) }));
  }

  // ── Build preview list ───────────────────────────────────────────────────────
  // While dragging, show the list with the dragged card removed and a ghost
  // placeholder inserted at dropIndex.
  function buildPreview(): Array<{ kind: "question"; q: Question }> {
    if (dragId === null || dropIndex === null) {
      return activeItems.map((q) => ({ kind: "question", q }));
    }
    const dragged = activeItems.find((q) => q.id === dragId);
    if (!dragged) return activeItems.map((q) => ({ kind: "question", q }));
    const without = activeItems.filter((q) => q.id !== dragId);
    const clamp = Math.max(0, Math.min(dropIndex, without.length));
    without.splice(clamp, 0, dragged);
    return without.map((q) => ({ kind: "question", q }));
  }

  const preview = buildPreview();

  // ── Render ──────────────────────────────────────────────────────────────────
  if (isLoading && items.length === 0) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Loading questions…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Drag the grip to reorder · toggle to show/hide · changes apply to all future check-ins
        </p>
        <Button size="sm" variant="outline" onClick={openAdd} className="gap-1.5 flex-shrink-0 ml-3">
          <Plus size={13} />
          Add question
        </Button>
      </div>

      {/* Active questions */}
      {activeItems.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Active ({activeItems.length})
          </p>
          {/* Container captures pointer events during drag */}
          <div
            ref={listRef}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
            className={dragId !== null ? "select-none" : ""}
          >
            {preview.map((slot) => {
              const { q } = slot;
              const isDragging = dragId === q.id;

              return (
                <div
                  key={q.id}
                  data-card-id={q.id}
                  className={`flex items-center gap-3 bg-card border rounded-lg px-4 py-4 mb-2 transition-all duration-100 ${
                    isDragging
                      ? "border-primary ring-1 ring-primary shadow-lg scale-[1.01]"
                      : "border-border"
                  }`}
                >
                  {/* Grip — this is the drag handle */}
                  <div
                    onPointerDown={(e) => onGripPointerDown(e, q.id)}
                    className="cursor-grab active:cursor-grabbing text-muted-foreground/60 flex-shrink-0 touch-none"
                  >
                    <GripVertical size={15} />
                  </div>
                  <p className="flex-1 text-sm font-medium text-foreground leading-snug min-w-0">
                    {q.questionText}
                  </p>
                  <Switch
                    checked={q.active}
                    onCheckedChange={(v) => toggleMutation.mutate({ id: q.id, active: v })}
                    className="flex-shrink-0"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground flex-shrink-0"
                    onClick={() => openEdit(q)}
                  >
                    <Pencil size={12} />
                  </Button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hidden questions */}
      {hiddenItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Hidden ({hiddenItems.length})
          </p>
          {hiddenItems.map((q) => (
            <div
              key={q.id}
              className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-4 opacity-50"
            >
              <GripVertical size={15} className="text-muted-foreground/60 flex-shrink-0" />
              <p className="flex-1 text-sm font-medium text-foreground leading-snug min-w-0">
                {q.questionText}
              </p>
              <Switch
                checked={q.active}
                onCheckedChange={(v) => toggleMutation.mutate({ id: q.id, active: v })}
                className="flex-shrink-0"
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-foreground flex-shrink-0"
                onClick={() => openEdit(q)}
              >
                <Pencil size={12} />
              </Button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg px-3 py-2">
        <strong className="text-muted-foreground">Note:</strong> Hiding a question removes it from
        future check-ins but preserves all past answers. Deleting a question is permanent and cannot
        be undone.
      </p>

      {/* Edit / Add dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit question" : "Add question"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Question text</label>
              <Input
                value={form.questionText}
                onChange={(e) => {
                  const text = e.target.value;
                  setForm((f) => ({ ...f, questionText: text, slug: f.id ? f.slug : slugify(text) }));
                }}
                placeholder="e.g. How was your motivation this week?"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Select
                value={form.type}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, type: v as QuestionType, options: v === "free_text" ? [] : f.options }))
                }
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single_choice">Single choice</SelectItem>
                  <SelectItem value="free_text">Free text</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.type === "single_choice" && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Options</label>
                <div className="space-y-1.5">
                  {form.options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <Input
                        value={opt}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, options: f.options.map((o, i) => (i === idx ? e.target.value : o)) }))
                        }
                        className="flex-1 text-sm"
                        placeholder={`Option ${idx + 1}`}
                      />
                      <Button size="icon" variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeOption(idx)}>
                        <X size={12} />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={newOption}
                      onChange={(e) => setNewOption(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }}
                      placeholder="Add an option…"
                      className="flex-1"
                    />
                    <Button size="sm" variant="outline" onClick={addOption} disabled={!newOption.trim()}>
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            {form.id && (
              <Button variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 sm:mr-auto"
                onClick={() => setDeleteId(form.id!)}>
                <Trash2 size={14} className="mr-1.5" />
                Delete question
              </Button>
            )}
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? "Saving…" : "Save question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete question?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the question and all answers associated with it. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId !== null && deleteMutation.mutate({ id: deleteId })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
