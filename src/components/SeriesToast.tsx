"use client";
// After an action the address can carry ?saved, ?added, ?removed or ?status. They are said once as a short message and then taken out of the address,
// so a refresh does not say them again. (The "created" message is a banner with the next step, drawn by the page.)
import { useEffect, useRef } from "react";
import { useSnackbar } from "@/components/Snackbar";
import { toastFor } from "@/lib/seriesView";

export default function SeriesToast({ saved, added, removed, status, open, clean }: { saved?: string; added?: string; removed?: string; status?: string; open: boolean; clean?: boolean }) {
  const snack = useSnackbar();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    const t = toastFor({ saved, added, removed, status }, open);
    if (t) { done.current = true; snack.show({ message: t.message, tone: t.tone }); }
    if (clean && typeof window !== "undefined") {
      try { window.history.replaceState(window.history.state, "", window.location.pathname); } catch { /* the address stays as it is */ }
    }
  }, [saved, added, removed, status, open, clean, snack]);
  return null;
}
