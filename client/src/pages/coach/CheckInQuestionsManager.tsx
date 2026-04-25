import { useState, useMemo, useRef } from "react";
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

  const { data: questions = [], isLoading } = trpc.questions.list.useQuery();

  // Local ordered copy for optimistic reorder
  const [localOrder, setLocalOrder] = useState<number[] | null>(null);

  const orderedQuestions = useMemo(() => {
    if (!localOrder) return questions as Question[];
    const map = new Map((questions as Question[]).map((q) => [q.id, q]));
    const ordered = localOrder.map((id) => map.get(id)).filter(Boolean) as Question[];
    const inOrder = new Set(localOrder);
    (questions as Question[]).forEach((q) => { if (!inOrder.has(q.id)) ordered.push(q); });
    return ordered;
  }, [questions, localOrder]);

  const upsertMutation = trpc.questions.upsert.useMutation({
    onSuccess: () => {
      utils.questions.list.invalidate();
      utils.questions.listActive.invalidate();
      setLocalOrder(null);
      setEditOpen(false);
      toast.success("Question saved");
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleMutation = trpc.questions.toggle.useMutation({
    onSuccess: () => {
      utils.questions.list.invalidate();
      utils.questions.listActive.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.questions.delete.useMutation({
    onSuccess: () => {
      utils.questions.list.invalidate();
      utils.questions.listActive.invalidate();
      setDeleteId(null);
      setEditOpen(false);
      toast.success("Question deleted");
    },
    onError: (e) => toast.error(e.message),
  });

  const reorderMutation = trpc.questions.reorder.useMutation({
    onSuccess: () => {
      utils.questions.list.invalidate();
      utils.questions.listActive.invalidate();
    },
    onError: (e) => {
      toast.error("Reorder failed: " + e.message);
      setLocalOrder(null);
    },
  });

  // ── State ──────────────────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  // dropIndex: the index in activeQuestions where the dragged item will be inserted
  // e.g. 0 = before first card, 1 = between card 0 and 1, etc.
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [newOption, setNewOption] = useState("");
  const dragCounter = useRef(0);

  const emptyForm: EditForm = {
    slug: "",
    questionText: "",
    type: "single_choice",
    options: [],
    active: true,
  };
  const [form, setForm] = useState<EditForm>(emptyForm);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const activeQuestions = orderedQuestions.filter((q) => q.active);
  const hiddenQuestions = orderedQuestions.filter((q) => !q.active);

  function openAdd() {
    setForm(emptyForm);
    setNewOption("");
    setEditOpen(true);
  }

  function openEdit(q: Question) {
    setForm({
      id: q.id,
      slug: q.slug,
      questionText: q.questionText,
      type: q.type,
      options: q.options ?? [],
      active: q.active,
    });
    setNewOption("");
    setEditOpen(true);
  }

  function handleSave() {
    if (!form.questionText.trim()) {
      toast.error("Question text is required");
      return;
    }
    if (form.type === "single_choice" && form.options.filter(o => o.trim()).length < 2) {
      toast.error("Single choice questions need at least 2 options");
      return;
    }
    const slug = form.slug.trim() || slugify(form.questionText);
    upsertMutation.mutate({
      id: form.id,
      slug,
      questionText: form.questionText.trim(),
      type: form.type,
      options: form.type === "single_choice" ? form.options.filter(o => o.trim()) : null,
      displayOrder: form.id
        ? ((questions as Question[]).find((q) => q.id === form.id)?.displayOrder ?? 99)
        : ((questions as Question[]).length + 1),
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

  // ── Drag-to-reorder with insertion line ────────────────────────────────────
  function handleDragStart(e: React.DragEvent, id: number) {
    setDragId(id);
    dragCounter.current = 0;
    e.dataTransfer.effectAllowed = "move";
  }

  // Calculate drop index based on mouse position relative to the card
  function getDropIndex(e: React.DragEvent, cardIndex: number): number {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    return e.clientY < midY ? cardIndex : cardIndex + 1;
  }

  function handleDragOver(e: React.DragEvent, cardIndex: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropIndex(getDropIndex(e, cardIndex));
  }

  function handleDrop(e: React.DragEvent, cardIndex: number) {
    e.preventDefault();
    if (dragId === null) return;

    const insertAt = getDropIndex(e, cardIndex);
    const active = [...activeQuestions];
    const fromIdx = active.findIndex((q) => q.id === dragId);
    if (fromIdx === -1) return;

    const [moved] = active.splice(fromIdx, 1);
    // Adjust insertAt after removal
    const adjustedInsert = insertAt > fromIdx ? insertAt - 1 : insertAt;
    active.splice(adjustedInsert, 0, moved);

    const newOrder = [...active.map((q) => q.id), ...hiddenQuestions.map((q) => q.id)];
    setLocalOrder(newOrder);
    reorderMutation.mutate({ orderedIds: active.map((q) => q.id) });

    setDragId(null);
    setDropIndex(null);
    dragCounter.current = 0;
  }

  function handleDragEnd() {
    setDragId(null);
    setDropIndex(null);
    dragCounter.current = 0;
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Loading questions…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Drag to reorder · toggle to show/hide · changes apply to all future check-ins
        </p>
        <Button size="sm" variant="outline" onClick={openAdd} className="gap-1.5 flex-shrink-0 ml-3">
          <Plus size={13} />
          Add question
        </Button>
      </div>

      {/* Active questions */}
      {activeQuestions.length > 0 && (
        <div className="space-y-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Active ({activeQuestions.length})
          </p>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              // Handle drop on the container (after last card)
              if (dragId === null) return;
              e.preventDefault();
              const active = [...activeQuestions];
              const fromIdx = active.findIndex((q) => q.id === dragId);
              if (fromIdx === -1) return;
              const [moved] = active.splice(fromIdx, 1);
              active.push(moved);
              const newOrder = [...active.map((q) => q.id), ...hiddenQuestions.map((q) => q.id)];
              setLocalOrder(newOrder);
              reorderMutation.mutate({ orderedIds: active.map((q) => q.id) });
              setDragId(null);
              setDropIndex(null);
            }}
          >
            {activeQuestions.map((q, idx) => (
              <div key={q.id}>
                {/* Insertion line BEFORE this card */}
                <div
                  className={`h-0.5 rounded-full mx-1 transition-all duration-100 ${
                    dropIndex === idx && dragId !== null && dragId !== q.id
                      ? "bg-primary my-1"
                      : "bg-transparent my-0"
                  }`}
                />

                {/* Card */}
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, q.id)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDrop={(e) => handleDrop(e, idx)}
                  onDragEnd={handleDragEnd}
                  className={`flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-4 mb-2 transition-opacity ${
                    dragId === q.id ? "opacity-30" : "opacity-100"
                  }`}
                >
                  <GripVertical size={15} className="text-muted-foreground/60 cursor-grab flex-shrink-0" />
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
              </div>
            ))}

            {/* Insertion line AFTER last card */}
            <div
              className={`h-0.5 rounded-full mx-1 transition-all duration-100 ${
                dropIndex === activeQuestions.length && dragId !== null
                  ? "bg-primary my-1"
                  : "bg-transparent my-0"
              }`}
            />
          </div>
        </div>
      )}

      {/* Hidden questions */}
      {hiddenQuestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Hidden ({hiddenQuestions.length})
          </p>
          {hiddenQuestions.map((q) => (
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
        <strong className="text-muted-foreground">Note:</strong> Hiding a question removes it from future check-ins but preserves all past answers. Deleting a question is permanent and cannot be undone.
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
                  setForm((f) => ({
                    ...f,
                    questionText: text,
                    slug: f.id ? f.slug : slugify(text),
                  }));
                }}
                placeholder="e.g. How was your motivation this week?"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Type</label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as QuestionType, options: v === "free_text" ? [] : f.options }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
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
                          setForm((f) => ({
                            ...f,
                            options: f.options.map((o, i) => (i === idx ? e.target.value : o)),
                          }))
                        }
                        className="flex-1 text-sm"
                        placeholder={`Option ${idx + 1}`}
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeOption(idx)}
                      >
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
              <Button
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 sm:mr-auto"
                onClick={() => setDeleteId(form.id!)}
              >
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
      <AlertDialog open={deleteId !== null} onOpenChange={(open: boolean) => !open && setDeleteId(null)}>
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
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
