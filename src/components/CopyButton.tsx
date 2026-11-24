"use client";

import { useEffect, useRef, useState } from "react";
import Icon from "@/components/B2Icons";
import "./b2.css";

/** What to do when the browser refuses to copy (shown by the Invite screen under the link box). */
export const COPY_HINT = "Press and hold the link, choose Select all, then Copy";

export type CopyState = "idle" | "done" | "failed";

/** How long "Copied" stays before the button goes back to its label. */
export const COPIED_MS = 1800;
/** The failure text stays longer so the hint can be read. */
export const FAILED_MS = 6000;

/**
 * Copies text. On success the button turns green with a check and the word "Copied" for 1.8 seconds.
 * If the browser refuses, the button says "Select and copy" and, when `targetId` names the box that shows
 * the text, that text is selected so it can be copied by hand. `onState` lets the screen show the hint.
 */
export default function CopyButton({
  text, label = "Copy", targetId, onState,
}: { text: string; label?: string; targetId?: string; onState?: (s: CopyState) => void }) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function change(s: CopyState) {
    setState(s);
    onState?.(s);
  }

  async function copy() {
    if (timer.current) clearTimeout(timer.current);
    let next: CopyState = "done";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      next = "failed";
      selectTarget(targetId);
    }
    change(next);
    timer.current = setTimeout(() => change("idle"), next === "done" ? COPIED_MS : FAILED_MS);
  }

  const shown = state === "done" ? "Copied" : state === "failed" ? "Select and copy" : label;
  return (
    <button type="button" className={`chip cm-copy${state === "done" ? " green" : state === "failed" ? " gold" : ""}`} onClick={copy} aria-live="polite">
      <Icon name={state === "done" ? "check" : "copy"} size={16} />
      {shown}
      {state === "failed" && <span className="cm-sr">. {COPY_HINT}</span>}
    </button>
  );
}

/** Select everything inside an element, as if the person had dragged over it. */
function selectTarget(id?: string) {
  if (!id || typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (!el) return;
  try {
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  } catch {
    /* the hint under the box still explains what to do */
  }
}
