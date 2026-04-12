/**
 * ConfirmDialog — a reusable confirmation modal built on the existing Dialog primitives.
 *
 * Usage:
 *   const [confirm, ConfirmDialogNode] = useConfirm();
 *   // in JSX: {ConfirmDialogNode}
 *   // to trigger: await confirm({ title: "Delete?", description: "Cannot be undone." })
 */
import { useState, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default";
}

type ResolveFunc = (confirmed: boolean) => void;

interface ConfirmState extends ConfirmOptions {
  open: boolean;
}

/**
 * Returns a [confirm, DialogNode] tuple.
 * Call `confirm(options)` — it returns a Promise<boolean>.
 * Render `DialogNode` somewhere in the component tree.
 */
export function useConfirm(): [
  (options: ConfirmOptions) => Promise<boolean>,
  React.ReactNode,
] {
  const [state, setState] = useState<ConfirmState>({
    open: false,
    title: "",
  });
  const resolveRef = useRef<ResolveFunc | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState({ ...options, open: true });
    });
  }, []);

  const handleConfirm = () => {
    setState((s) => ({ ...s, open: false }));
    resolveRef.current?.(true);
  };

  const handleCancel = () => {
    setState((s) => ({ ...s, open: false }));
    resolveRef.current?.(false);
  };

  const node = (
    <Dialog open={state.open} onOpenChange={(open) => { if (!open) handleCancel(); }}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          {state.description && (
            <DialogDescription>{state.description}</DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            {state.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            variant={state.variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
          >
            {state.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return [confirm, node];
}
