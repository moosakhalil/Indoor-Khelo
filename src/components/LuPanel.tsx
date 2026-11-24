"use client";
// Phase C3: on very wide screens (1360 px and up) the page frame has a side column. The picked lineups (Pick lineups) and the
// "What this changes" box (Correct a ball) live inside client components, so they are drawn into that column from here.
// The server renders an empty slot; below 1360 px the column is hidden by the shell and the same content shows in the page.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export const LU_SLOT = "lu-panel-slot";

export function PanelSlot() {
  return <div id={LU_SLOT} />;
}

/** Draws its children into the side column when the column exists. */
export function InPanel({ children }: { children: React.ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setSlot(document.getElementById(LU_SLOT)); }, []);
  return slot ? createPortal(children, slot) : null;
}
