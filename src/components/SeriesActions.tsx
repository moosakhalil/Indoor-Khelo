"use client";
// Phase F1: the actions of a series (edit, add matches, close or reopen, delete) in one place for the Series list cards,
// the Series page and the Add matches page. Close and reopen can be undone by doing the other one, so they just happen and say so.
// Delete asks for the series name, because a deleted series cannot come back (its matches always stay).
import "./sr.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteSeriesAction } from "@/app/actionsSeries";
import { seriesStatusQuietAction } from "@/app/actionsF1";
import ActionMenu, { type ActionItem } from "@/components/ActionMenu";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSnackbar } from "@/components/Snackbar";
import { IconInfo, IconLock, IconPencil, IconTrash, IconTrophy } from "@/components/SrIcons";
import { ownerReason } from "@/lib/ownerRule";

/** `canDelete` false: only the person who added the series, or an Admin, may delete it (lib/ownerRule.ts), so no Delete button is shown. Missing means yes. */
export type SeriesRef = { id: string; name: string; open: boolean; matchCount: number; canDelete?: boolean; addedBy?: string | null };

export function SeriesDeleteDialog({ open, onClose, communityId, series }: { open: boolean; onClose: () => void; communityId: string; series: SeriesRef }) {
  return (
    <ConfirmDialog
      open={open}
      title={`Delete ${series.name}?`}
      body={`Deletes the series only. Every match in it${series.matchCount ? ` (${series.matchCount})` : ""} is kept, with all its stats.`}
      confirmLabel="Delete series"
      danger
      typeToConfirm={series.name}
      onConfirm={async () => {
        const fd = new FormData();
        fd.set("communityId", communityId);
        fd.set("seriesId", series.id);
        await deleteSeriesAction(fd);
      }}
      onClose={onClose}
    />
  );
}

/** Close or reopen without leaving the page. */
export function useSeriesStatus(communityId: string, series: SeriesRef) {
  const router = useRouter();
  const snack = useSnackbar();
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("communityId", communityId);
      fd.set("seriesId", series.id);
      fd.set("to", series.open ? "closed" : "open");
      const r = await seriesStatusQuietAction(fd);
      if (r.ok) snack.show({ message: series.open ? "Series closed. Its record is kept." : "Series reopened.", tone: "success" });
      else snack.show({ message: r.error, tone: "error" });
      router.refresh();
    } finally { setBusy(false); }
  };
  return { busy, toggle };
}

/** The three dots of a series: every action is a word, none needs hover. */
export function SeriesMenu({ communityId, series, className }: { communityId: string; series: SeriesRef; className?: string }) {
  const [ask, setAsk] = useState(false);
  const { toggle } = useSeriesStatus(communityId, series);
  const base = `/c/${communityId}/series/${series.id}`;
  const items: ActionItem[] = [
    { label: "Edit series", href: `${base}/edit` },
    { label: "Add matches", href: `${base}/add` },
    { label: series.open ? "Close the series" : "Reopen the series", onSelect: () => void toggle() },
    ...(series.canDelete === false ? [] : [{ label: "Delete series…", danger: true, onSelect: () => setAsk(true) }]),
  ];
  return (
    <span className={className}>
      <ActionMenu items={items} label={`Actions for ${series.name}`} />
      <SeriesDeleteDialog open={ask} onClose={() => setAsk(false)} communityId={communityId} series={series} />
    </span>
  );
}

/** Pencil and bin as visible buttons for wide screens (the three dots stay for everyone). */
export function SeriesQuickTools({ communityId, series }: { communityId: string; series: SeriesRef }) {
  const [ask, setAsk] = useState(false);
  return (
    <span className="sr-quick">
      <Link href={`/c/${communityId}/series/${series.id}/edit`} className="sr-iconbtn" aria-label={`Edit ${series.name}`}><IconPencil /></Link>
      {series.canDelete !== false && <button type="button" className="sr-iconbtn danger" aria-label={`Delete ${series.name}`} onClick={() => setAsk(true)}><IconTrash /></button>}
      <SeriesDeleteDialog open={ask} onClose={() => setAsk(false)} communityId={communityId} series={series} />
    </span>
  );
}

/** "Finished with this series?" card with Close or Reopen. */
export function CloseCard({ communityId, series }: { communityId: string; series: SeriesRef }) {
  const { busy, toggle } = useSeriesStatus(communityId, series);
  return (
    <section className="card sr-side-card">
      <h2>{series.open ? "Finished with this series?" : "This series is closed"}</h2>
      <p className="muted small">{series.open ? "Closing keeps the record. You can reopen it any time and keep playing." : "Its record is kept. Reopen it to add matches or play another."}</p>
      <button type="button" className="btn ghost sr-wide" onClick={() => void toggle()} disabled={busy}><IconLock />{series.open ? "Close the series" : "Reopen the series"}</button>
    </section>
  );
}

export function DeleteCard({ communityId, series }: { communityId: string; series: SeriesRef }) {
  const [ask, setAsk] = useState(false);
  if (series.canDelete === false) {
    return (
      <section className="card sr-side-card">
        <h2>Delete series</h2>
        <p className="muted small"><IconLock />{" "}{ownerReason("delete", series.addedBy && series.addedBy !== "—" ? series.addedBy : null)}</p>
      </section>
    );
  }
  return (
    <section className="card sr-side-card sr-danger">
      <h2>Delete series</h2>
      <p className="muted small">Deletes the series only. Every match in it is kept, with all its stats.</p>
      <button type="button" className="btn red sr-wide" onClick={() => setAsk(true)}><IconTrash />Delete series…</button>
      <SeriesDeleteDialog open={ask} onClose={() => setAsk(false)} communityId={communityId} series={series} />
    </section>
  );
}

/** The banner on the Add matches page for a closed series: a Reopen button so the person is not stuck. */
export function ReopenBanner({ communityId, series }: { communityId: string; series: SeriesRef }) {
  const { busy, toggle } = useSeriesStatus(communityId, series);
  return (
    <div className="banner mute sr-reopen" role="status">
      <IconLock />
      <span className="grow"><b>This series is closed.</b> Reopen it to add matches.</span>
      <button type="button" className="btn ghost small" onClick={() => void toggle()} disabled={busy}>{busy ? "Reopening…" : "Reopen"}</button>
    </div>
  );
}

/**
 * Two calm banners with the next step on the Series page:
 *  clinched: a best-of series is decided but still open, so it offers to close it now;
 *  drawn: a closed level series stays drawn (no tie-break, no manual winner), and Reopen is offered.
 */
export function StatusBanner({ communityId, series, kind, winner }: { communityId: string; series: SeriesRef; kind: "clinched" | "drawn"; winner?: string }) {
  const { busy, toggle } = useSeriesStatus(communityId, series);
  if (kind === "clinched") {
    return (
      <div className="sr-callout gold" role="status">
        <IconTrophy />
        <span className="grow"><b>{winner} has clinched it</b><br />The series is still open, so more matches can be played. Close it to lock the record.</span>
        <button type="button" className="btn ghost small" onClick={() => void toggle()} disabled={busy}>{busy ? "Closing…" : "Close series"}</button>
      </div>
    );
  }
  return (
    <div className="sr-callout orange" role="status">
      <IconInfo />
      <span className="grow"><b>A drawn series stays drawn</b><br />There is no tie-break and no manual winner. Reopen the series to play more matches.</span>
      <button type="button" className="btn ghost small" onClick={() => void toggle()} disabled={busy}>{busy ? "Reopening…" : "Reopen"}</button>
    </div>
  );
}
