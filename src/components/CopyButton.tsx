"use client";

import { useState } from "react";

/** Copies text. If the browser refuses, the text is shown so it can be selected by hand. */
export default function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("failed");
    }
    setTimeout(() => setState("idle"), 1800);
  }
  return (
    <button type="button" className="chip" onClick={copy} aria-live="polite">
      {state === "done" ? "Copied" : state === "failed" ? "Select and copy" : label}
    </button>
  );
}
