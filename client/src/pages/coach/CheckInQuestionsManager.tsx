import { useState, useMemo } from "react";
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
    // Append any questions not in localOrder (e.g. newly added)
    const inOrder = new Set(localOrder);
    (questions as Question[]).forEach((q) => { if (!inOrder.has(q.id)) ordered.push(q); });
    return ordered;
  }, [questions, localOrder]);

  const upsertMutation = trpc.questions.upsert.useMutation({
    onSuccess: () => {
      utils.questions.list.invalidate();
      utils.questions.listActive.invalidate();
      setLocalOrder(null); // reset optimistic order after server sync
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
      setLocalOrder(null); // revert optimistic update on error
    },
  });

  // ── State ──────────────────────────────────────────────────────────────────
  const [editOpen, setEditOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [newOption, setNewOption] = useState("");

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

  // ── Drag-to-reorder (active questions only) ────────────────────────────────
  function handleDragStart(id: number) {
    setDragId(id);
  }
  function handleDragOver(e: React.DragEvent, id: number) {
    e.preventDefault();
    setDragOverId(id);
  }
  function handleDrop(targetId: number) {
    if (dragId === null || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      return;
    }
    const active = [...activeQuestions];
    const fromIdx = active.findIndex((q) => q.id === dragId);
    const toIdx = active.findIndex((q) => q.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = active.splice(fromIdx, 1);
    active.splice(toIdx, 0, moved);

    // Optimistic update: rebuild full order (active reordered + hidden appended)
    const newOrder = [...active.map((q) => q.id), ...hiddenQuestions.map((q) => q.id)];
    setLocalOrder(newOrder);

    reorderMutation.mutate({ orderedIds: active.map((q) => q.id) });
    setDragId(null);
    setDragOverId(null);
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
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Active ({activeQuestions.length})
          </p>
          {activeQuestions.map((q) => (
            <div
              key={q.id}
              draggable
              onDragStart={() => handleDragStart(q.id)}
              onDragOver={(e) => handleDragOver(e, q.id)}
              onDrop={() => handleDrop(q.id)}
              onDragEnd={() => { setDragId(null); setDragOverId(null); }}
              className={`flex items-center gap-3 bg-card border rounded-lg px-4 py-4 transition-all ${
                dragOverId === q.id ? "border-primary/50 bg-primary/5" : "border-border"
              } ${dragId === q.id ? "opacity-40" : ""}`}
            >
              <GripVertical size={14} className="text-muted-foreground/40 cursor-grab flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug">{q.questionText}</p>
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded mt-0.5 inline-block ${
                  q.type === "single_choice"
                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                    : "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                }`}>
                  {q.type === "single_choice" ? "Single choice" : "Free text"}
                </span>
              </div>
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
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                onClick={() => setDeleteId(q.id)}
              >
                <Trash2 size={12} />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Hidden questions */}
      {hiddenQuestions.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Hidden ({hiddenQuestions.length})
          </p>
          {hiddenQuestions.map((q) => (
            <div
              key={q.id}
              className="flex items-center gap-3 bg-card border border-border rounded-lg px-4 py-4 opacity-50"
            >
              <GripVertical size={14} className="text-muted-foreground/30 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-snug">{q.questionText}</p>
                <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded mt-0.5 inline-block bg-secondary text-muted-foreground border border-border">
                  {q.type === "single_choice" ? "Single choice" : "Free text"}
                </span>
              </div>
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
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                onClick={() => setDeleteId(q.id)}
              >
                <Trash2 size={12} />
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
            {/* Question text */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Question text</label>
              <Input
                value={form.questionText}
                onChange={(e) => {
                  const text = e.target.value;
                  setForm((f) => ({
                    ...f,
                    questionText: text,
                    // Only auto-update slug for new questions
                    slug: f.id ? f.slug : slugify(text),
                  }));
                }}
                placeholder="e.g. How was your motivation this week?"
              />
            </div>

            {/* Type */}
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

            {/* Options (single_choice only) */}
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
          <DialogFooter>
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
