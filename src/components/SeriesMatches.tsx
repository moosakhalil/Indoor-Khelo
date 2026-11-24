"use client";
// The Fixtures and Results of one series. Every row has both team badges, the match state, and a menu. "Remove from series" is not a form:
// it hides the row at once and waits a few seconds with an Undo button (the match itself is kept either way), then it is really removed.
import "./sr.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { removeMatchQuietAction } from "@/app/actionsF1";
import ActionMenu, { type ActionItem } from "@/components/ActionMenu";
import { useSnackbar } from "@/components/Snackbar";
import { IconPlus } from "@/components/SrIcons";
import { MatchStatusChip, SideBadge } from "@/components/SrParts";

export type SeriesRow = {
  id: string; href: string; n1: string; n2: string; mine1: boolean; mine2: boolean; when: string; overs: number; venue: string; status: string; resultText: string | null; reportHref: string | null;
};

function Row({ r, onRemove }: { r: SeriesRow; onRemove: (r: SeriesRow) => void }) {
  const title = `${r.n1} v ${r.n2}`;
  const items: ActionItem[] = [
    { label: r.reportHref ? "Open match report" : "Open match", href: r.reportHref ?? r.href },
    ...(r.reportHref ? [{ label: "Open match page", href: r.href }] : []),
    { label: "Remove from series", danger: true, onSelect: () => onRemove(r) },
  ];
  return (
    <article className="sr-row" data-status={r.status}>
      <div className="sr-row-badges"><SideBadge name={r.n1} mine={r.mine1} size="sm" /><SideBadge name={r.n2} mine={r.mine2} size="sm" /></div>
      <div className="sr-row-main">
        <Link href={r.reportHref ?? r.href} className="sr-row-title">{title}</Link>
        <small>{r.when} · {r.overs} overs{r.venue ? ` · ${r.venue}` : ""}</small>
        {r.resultText && <small className="sr-row-result">{r.resultText}</small>}
        <div><MatchStatusChip status={r.status} /></div>
      </div>
      <div className="sr-row-menu"><ActionMenu items={items} label={`Actions for ${title}`} /></div>
    </article>
  );
}

export default function SeriesMatches({ communityId, seriesId, fixtures, results }: { communityId: string; seriesId: string; fixtures: SeriesRow[]; results: SeriesRow[] }) {
  const router = useRouter();
  const snack = useSnackbar();
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());
  const hide = (id: string, on: boolean) => setHidden((h) => { const n = new Set(h); if (on) n.add(id); else n.delete(id); return n; });

  const remove = (r: SeriesRow) => {
    hide(r.id, true);
    snack.undoable({
      message: "Match removed from the series. The match itself is kept.",
      commit: async () => {
        const fd = new FormData();
        fd.set("communityId", communityId); fd.set("seriesId", seriesId); fd.set("matchId", r.id);
        const res = await removeMatchQuietAction(fd);
        if (!res.ok) { hide(r.id, false); snack.show({ message: res.error, tone: "error" }); }
        router.refresh();
      },
      onUndo: () => hide(r.id, false),
    });
  };

  const f = fixtures.filter((r) => !hidden.has(r.id));
  const d = results.filter((r) => !hidden.has(r.id));
  const add = `/c/${communityId}/series/${seriesId}/add`;
  return (
    <>
      <section className="card sr-sec" aria-labelledby="sr-fix-h">
        <div className="sr-sec-head"><h2 id="sr-fix-h">Fixtures <small>{f.length}</small></h2><Link href={add} className="sr-link">Add matches</Link></div>
        {f.length === 0 ? (
          <div className="sr-secempty"><b>Nothing to play right now</b><Link href={add} className="btn gold small"><IconPlus />Add or schedule a match</Link></div>
        ) : <div className="sr-rows">{f.map((r) => <Row key={r.id} r={r} onRemove={remove} />)}</div>}
      </section>
      <section className="card sr-sec" aria-labelledby="sr-res-h">
        <div className="sr-sec-head"><h2 id="sr-res-h">Results <small>{d.length}</small></h2></div>
        {d.length === 0 ? (
          <div className="sr-secempty"><b>No finished matches yet</b></div>
        ) : <div className="sr-rows">{d.map((r) => <Row key={r.id} r={r} onRemove={remove} />)}</div>}
      </section>
    </>
  );
}
