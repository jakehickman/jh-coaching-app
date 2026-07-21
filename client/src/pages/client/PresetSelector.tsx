import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { X, Plus, Trash2, Pencil } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

interface PresetSelectorProps {
  exerciseName: string;
  currentPreset: string;
  currentSettings: string;
  popoverOpen: boolean;
  onPopoverOpenChange: (open: boolean) => void;
  onSelectPreset: (presetName: string, lastSettings: string | null, presetId?: number) => void;
  onDeletePreset: (id: number, presetName: string) => void;
  onSettingsChange: (val: string) => void;
  onSettingsBlur: (val: string) => void;
}

export function PresetSelector({
  exerciseName, currentPreset, currentSettings,
  popoverOpen, onPopoverOpenChange,
  onSelectPreset, onDeletePreset, onSettingsChange, onSettingsBlur,
}: PresetSelectorProps) {
  const utils = trpc.useUtils();
  const { data: presetList = [] } = trpc.equipmentPresets.list.useQuery(
    { exerciseName },
    { staleTime: 30_000, enabled: popoverOpen }
  );
  const upsertMutation = trpc.equipmentPresets.upsert.useMutation({
    onSuccess: () => utils.equipmentPresets.list.invalidate({ exerciseName }),
  });
  const deleteMutation = trpc.equipmentPresets.delete.useMutation({
    onSuccess: () => utils.equipmentPresets.list.invalidate({ exerciseName }),
  });
  const renameMutation = trpc.equipmentPresets.rename.useMutation({
    onSuccess: (_data, vars) => {
      void utils.equipmentPresets.list.invalidate({ exerciseName });
      // If the renamed preset was the active one, update the selection
      const editingPreset = (presetList as any[]).find(p => p.id === editingId);
      if (editingPreset && currentPreset === editingPreset.presetName && editNameVal.trim()) {
        onSelectPreset(vars.newName, currentSettings || null);
      }
      setEditingId(null);
    },
  });

  // Which row is in edit mode (by preset id), null = none
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editNameVal, setEditNameVal] = useState('');
  const [editNotesVal, setEditNotesVal] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  // Add-new inline form
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const addNameRef = useRef<HTMLInputElement>(null);
  const addNotesRef = useRef<HTMLInputElement>(null);

  const closeSheet = () => {
    onPopoverOpenChange(false);
    setEditingId(null);
    setAddingNew(false);
    setNewName('');
    setNewNotes('');
    setDeleteConfirmId(null);
  };

  const startEdit = (p: any) => {
    setEditingId(p.id);
    setEditNameVal(p.presetName);
    setEditNotesVal(p.lastSettings ?? '');
    setAddingNew(false);
  };

  const cancelEdit = () => { setEditingId(null); setDeleteConfirmId(null); };

  const saveEdit = (p: any) => {
    const name = editNameVal.trim();
    const notes = editNotesVal.trim();
    if (!name) return;
    const nameChanged = name !== p.presetName;
    const notesChanged = notes !== (p.lastSettings ?? '');
    if (nameChanged) {
      // Rename updates the row by ID — do NOT also upsert or it inserts a duplicate
      renameMutation.mutate({ id: p.id, newName: name });
    } else if (notesChanged) {
      // Only settings changed — safe to upsert by (exerciseName, presetName)
      upsertMutation.mutate({ exerciseName, presetName: name, lastSettings: notes || null });
    }
    // Update selection if this is the active preset
    if (currentPreset === p.presetName) {
      onSelectPreset(name, notes || null, p.id);
      onSettingsChange(notes);
      onSettingsBlur(notes);
    }
    setEditingId(null);
  };

  const saveNewPreset = () => {
    const name = newName.trim();
    if (!name) return;
    upsertMutation.mutate({ exerciseName, presetName: name, lastSettings: newNotes.trim() || null });
    onSelectPreset(name, newNotes.trim() || null);
    setNewName('');
    setNewNotes('');
    setAddingNew(false);
    closeSheet();
  };

  const confirmDelete = (p: any) => {
    onDeletePreset(p.id, p.presetName);
    deleteMutation.mutate({ id: p.id });
    setDeleteConfirmId(null);
    setEditingId(null);
  };

  return (
    <>
      {/* Trigger pill */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={e => { e.stopPropagation(); onPopoverOpenChange(true); }}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs transition-colors ${
            currentPreset
              ? 'bg-primary/10 border-primary/20 text-primary/80 hover:bg-primary/20'
              : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          {currentPreset || 'Add machine'}
        </button>
        {currentPreset && currentSettings && (
          <span className="text-xs text-muted-foreground/70">{currentSettings}</span>
        )}
      </div>

      <Sheet open={popoverOpen} onOpenChange={open => { if (!open) closeSheet(); }}>
        <SheetContent
          side="bottom"
          className="h-[80vh] p-0 flex flex-col rounded-t-2xl bg-[#141414] border-t border-border"
          onClick={e => e.stopPropagation()}
          hideCloseButton
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
            <div>
              <SheetTitle className="text-base font-semibold text-foreground">Machine</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{exerciseName}</p>
            </div>
            <button onClick={closeSheet} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Machine list */}
          <div className="flex-1 overflow-y-auto">
            {(presetList as any[]).length === 0 && !addingNew && (
              <p className="px-5 py-10 text-sm text-muted-foreground text-center">No machines saved yet</p>
            )}

            {(presetList as any[]).map((p: any) => {
              const isSelected = currentPreset === p.presetName;
              const isEditing = editingId === p.id;
              const isDeleteConfirm = deleteConfirmId === p.id;

              if (isDeleteConfirm) {
                return (
                  <div key={p.id} className="px-5 py-4 border-b border-border/30 bg-red-950/20">
                    <p className="text-sm text-foreground mb-3">Remove <span className="font-semibold">{p.presetName}</span>?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => confirmDelete(p)}
                        className="flex-1 py-2.5 bg-destructive text-destructive-foreground rounded-lg text-sm font-medium active:opacity-80"
                      >Remove</button>
                      <button
                        onClick={() => setDeleteConfirmId(null)}
                        className="flex-1 py-2.5 bg-secondary text-foreground rounded-lg text-sm font-medium active:opacity-80"
                      >Cancel</button>
                    </div>
                  </div>
                );
              }

              if (isEditing) {
                return (
                  <div key={p.id} className="px-5 py-4 border-b border-border/30 bg-secondary/30">
                    <input
                      autoFocus
                      type="text"
                      value={editNameVal}
                      onChange={e => setEditNameVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Escape') cancelEdit(); }}
                      placeholder="Machine name"
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-2"
                    />
                    <input
                      type="text"
                      value={editNotesVal}
                      onChange={e => setEditNotesVal(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(p); if (e.key === 'Escape') cancelEdit(); }}
                      placeholder="Setup notes (e.g. Seat 3, pin 8)"
                      className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-3"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(p)}
                        disabled={!editNameVal.trim()}
                        className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-40 active:opacity-80"
                      >Save</button>
                      <button
                        onClick={cancelEdit}
                        className="px-4 py-2.5 bg-secondary text-muted-foreground rounded-lg text-sm active:opacity-80"
                      >Cancel</button>
                      <button
                        onClick={() => { setDeleteConfirmId(p.id); }}
                        className="px-3 py-2.5 rounded-lg text-muted-foreground hover:text-red-400 active:opacity-80"
                      ><Trash2 size={16} /></button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={p.id}
                  className={`flex items-center px-5 py-4 border-b border-border/30 cursor-pointer active:bg-white/5 transition-colors ${
                    isSelected ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => { onSelectPreset(p.presetName, p.lastSettings ?? null, p.id); closeSheet(); }}
                >
                  {/* Radio dot */}
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-4 flex-shrink-0 transition-colors ${
                    isSelected ? 'border-primary' : 'border-border'
                  }`}>
                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                  </div>

                  {/* Name + notes */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${ isSelected ? 'text-primary font-medium' : 'text-foreground' }`}>{p.presetName}</p>
                    {p.lastSettings && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.lastSettings}</p>
                    )}
                  </div>

                  {/* Edit button */}
                  <button
                    onClick={e => { e.stopPropagation(); startEdit(p); }}
                    className="p-2.5 ml-1 rounded-lg text-muted-foreground hover:text-foreground active:bg-white/10 transition-colors flex-shrink-0"
                  >
                    <Pencil size={15} />
                  </button>
                </div>
              );
            })}

            {/* Add new inline form */}
            {addingNew && (
              <div className="px-5 py-4 border-b border-border/30 bg-secondary/20">
                <input
                  ref={addNameRef}
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addNotesRef.current?.focus(); if (e.key === 'Escape') { setAddingNew(false); setNewName(''); setNewNotes(''); } }}
                  placeholder="Machine name"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-2"
                />
                <input
                  ref={addNotesRef}
                  type="text"
                  value={newNotes}
                  onChange={e => setNewNotes(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveNewPreset(); if (e.key === 'Escape') { setAddingNew(false); setNewName(''); setNewNotes(''); } }}
                  placeholder="Setup notes (e.g. Seat 3, pin 8)"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary mb-3"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveNewPreset}
                    disabled={!newName.trim()}
                    className="flex-1 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-40 active:opacity-80"
                  >Save</button>
                  <button
                    onClick={() => { setAddingNew(false); setNewName(''); setNewNotes(''); }}
                    className="px-4 py-2.5 bg-secondary text-muted-foreground rounded-lg text-sm active:opacity-80"
                  >Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Add machine footer */}
          {!addingNew && (
            <div className="border-t border-border/40 flex-shrink-0 pb-safe">
              <button
                className="w-full flex items-center justify-center gap-2 px-5 py-5 text-primary text-sm font-medium active:bg-white/5 transition-colors"
                onClick={() => { setEditingId(null); setAddingNew(true); setTimeout(() => addNameRef.current?.focus(), 100); }}
              >
                <Plus size={17} />
                Add machine
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
