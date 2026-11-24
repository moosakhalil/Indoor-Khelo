"use client";
// Phase D1: on very wide screens (1360 px and up) the page frame has a side column. The Match details page puts Toss, Rules,
// Match link and Manage match there (hero, replies and lineups stay on the left). The server renders an empty slot in the frame;
// below 1360 px, and before the page has loaded, the same blocks sit under the lineups in the page itself. Never both.
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export const MD_PANEL = "md-panel-slot";
export const MD_WIDE = "(min-width: 1360px)";

export function MdPanelSlot() {
  return <div id={MD_PANEL} className="md-panel" />;
}

export default function MdSide({ children }: { children: React.ReactNode }) {
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(MD_WIDE);
    const update = () => setSlot(mq.matches ? document.getElementById(MD_PANEL) : null);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return slot ? createPortal(children, slot) : <div className="md-side">{children}</div>;
}
