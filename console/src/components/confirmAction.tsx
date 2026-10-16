import { useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";

interface ConfirmOptions {
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "danger" | "default";
}

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

let show: ((p: Pending) => void) | null = null;

// Promise-based stand-in for window.confirm: `if (!(await confirmAction({...}))) return;`.
// Renders through <ConfirmHost /> (mounted once in App) so every confirmation
// uses the same dialog, with Escape/backdrop cancelling.
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    if (!show) {
      resolve(false);
      return;
    }
    show({ ...options, resolve });
  });
}

export function ConfirmHost() {
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    show = (p) => setPending((prev) => {
      prev?.resolve(false);
      return p;
    });
    return () => { show = null; };
  }, []);

  const settle = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <ConfirmDialog
      open={!!pending}
      title={pending?.title ?? ""}
      description={pending?.description}
      confirmLabel={pending?.confirmLabel ?? "Confirm"}
      cancelLabel={pending?.cancelLabel}
      tone={pending?.tone}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  );
}
