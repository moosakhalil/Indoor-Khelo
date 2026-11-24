"use client";

import { useEffect, useId, useRef, useState } from "react";

// A confirm box for actions that cannot be undone. Two kinds:
//   plain         : a title, a sentence, Cancel and a confirm button
//   typed name    : pass `typeToConfirm` and the confirm button stays off until that exact name is typed
// It never closes by itself on a tap outside, so a stray tap cannot confirm or lose what you typed.

export type ConfirmProps = {
  open: boolean;
  title: string;
  /** What will happen, in plain words. */
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Red confirm button for deletes. */
  danger?: boolean;
  /** If given, the person must type this (case and extra spaces ignored) before the confirm button works. */
  typeToConfirm?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
};

export function matchesTyped(typed: string, expected: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return norm(expected).length > 0 && norm(typed) === norm(expected);
}

export default function ConfirmDialog({ open, title, body, confirmLabel, cancelLabel = "Cancel", danger, typeToConfirm, onConfirm, onClose }: ConfirmProps) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();
  const fieldId = useId();
  const fieldNote = useId();

  // Forget what was typed every time the box opens again.
  useEffect(() => {
    if (open) {
      setTyped("");
      setBusy(false);
    }
  }, [open]);

  // Focus goes to the name field (typed) or to Cancel (plain, so Enter cannot delete by accident).
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    first.current = typeToConfirm ? (dialog.current?.querySelector("input") as HTMLElement | null) : (dialog.current?.querySelector("[data-cancel]") as HTMLElement | null);
    first.current?.focus();
    return () => before?.focus?.();
  }, [open, typeToConfirm]);

  if (!open) return null;

  const ready = !typeToConfirm || matchesTyped(typed, typeToConfirm);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (!busy) onClose();
      return;
    }
    // Keep Tab inside the box.
    if (e.key === "Tab") {
      const nodes = Array.from(dialog.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input") ?? []);
      if (!nodes.length) return;
      const at = nodes.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey && at <= 0) {
        e.preventDefault();
        nodes[nodes.length - 1]!.focus();
      } else if (!e.shiftKey && at === nodes.length - 1) {
        e.preventDefault();
        nodes[0]!.focus();
      }
    }
  };

  const go = async () => {
    if (!ready || busy) return;
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dlg-wrap" onKeyDown={onKey}>
      <div className="dlg-bg" aria-hidden="true" />
      <div ref={dialog} className="dlg" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={bodyId}>
        <h2 id={titleId}>{title}</h2>
        <div id={bodyId} className="muted dlg-body">{body}</div>
        {typeToConfirm && (
          <div>
            <label className="lb" htmlFor={fieldId}>Type <b className="dlg-name">{typeToConfirm}</b> to confirm</label>
            <div className="dlg-fieldwrap">
            <input
              id={fieldId}
              className={`field${ready ? " dlg-ok" : ""}`}
              aria-describedby={fieldNote}
              value={typed}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void go();
                }
              }}
            />
            {ready && (
              <svg className="dlg-tick" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            )}
            </div>
            <p id={fieldNote} className="dlg-match" role="status">{ready ? "The name matches." : ""}</p>
          </div>
        )}
        <div className="dlg-actions">
          <button type="button" className="btn ghost" data-cancel onClick={onClose} disabled={busy}>{cancelLabel}</button>
          <button type="button" className={`btn ${danger ? "red" : "gold"}`} onClick={() => void go()} disabled={!ready || busy}>
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
