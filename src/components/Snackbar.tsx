"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// A short message at the bottom of the screen, with an optional button.
// "Undo" messages are for deletes that can be taken back: the real delete waits a few seconds in the browser
// and only happens if the person does not press Undo. No database change is needed for that.

export type Tone = "info" | "success" | "warn" | "error";

type Plain = { message: string; tone?: Tone; ms?: number };
type Undoable = {
  message: string;
  /** Runs after the wait, unless Undo was pressed. Do the real delete here. */
  commit: () => void | Promise<void>;
  /** Runs when Undo is pressed (optional, for putting a row back on screen). */
  onUndo?: () => void;
  undoLabel?: string;
  ms?: number;
};

type Api = {
  show: (m: Plain) => void;
  undoable: (m: Undoable) => void;
};

const Ctx = createContext<Api | null>(null);

export const SNACK_MS = 4000;
export const UNDO_MS = 6000;

type Active = { id: number; message: string; tone: Tone; undo?: Undoable };

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<Active | null>(null);
  const idRef = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Undoable | null>(null);

  const clearTimer = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  // Finish a waiting delete now (a new message arrived, or the page is being closed).
  const flush = useCallback(() => {
    const p = pending.current;
    pending.current = null;
    if (p) void Promise.resolve(p.commit()).catch(() => {});
  }, []);

  const show = useCallback((m: Plain) => {
    clearTimer();
    flush();
    const id = ++idRef.current;
    setActive({ id, message: m.message, tone: m.tone ?? "info" });
    timer.current = setTimeout(() => setActive((a) => (a && a.id === id ? null : a)), m.ms ?? SNACK_MS);
  }, [flush]);

  const undoable = useCallback((m: Undoable) => {
    clearTimer();
    flush();
    const id = ++idRef.current;
    pending.current = m;
    setActive({ id, message: m.message, tone: "info", undo: m });
    timer.current = setTimeout(() => {
      if (pending.current === m) flush();
      setActive((a) => (a && a.id === id ? null : a));
    }, m.ms ?? UNDO_MS);
  }, [flush]);

  const undo = () => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    clearTimer();
    setActive(null);
    p.onUndo?.();
  };

  // Closing or leaving the page must not lose a delete the person already accepted.
  useEffect(() => {
    const leave = () => flush();
    window.addEventListener("pagehide", leave);
    return () => {
      window.removeEventListener("pagehide", leave);
      clearTimer();
      flush();
    };
  }, [flush]);

  const api = useMemo<Api>(() => ({ show, undoable }), [show, undoable]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="snack-zone" role="status" aria-live="polite">
        {active && (
          <div key={active.id} className={`snack ${active.tone}`}>
            <span className="grow">{active.message}</span>
            {active.undo && (
              <button type="button" className="snack-btn" onClick={undo}>{active.undo.undoLabel ?? "Undo"}</button>
            )}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

export function useSnackbar(): Api {
  const api = useContext(Ctx);
  if (!api) throw new Error("useSnackbar needs <SnackbarProvider> above it (it is in the root layout).");
  return api;
}
