"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { approveManyB3, decideRequestB3, reopenRequestB3 } from "@/app/actionsB3";
import Ic from "@/components/B3Icons";
import ConfirmDialog from "@/components/ConfirmDialog";
import { useSnackbar } from "@/components/Snackbar";
import { COMMUNITY_MEMBER_CAP, initials } from "@/lib/validation";
import "./b3.css";

export type RequestItem = { userId: string; name: string; asked: string };

/** "What happens next" and the places left. Shown beside the list on a wide screen and below it on a phone. */
export function WhatHappensNext({ members, className }: { members: number; className?: string }) {
  const left = Math.max(0, COMMUNITY_MEMBER_CAP - members);
  return (
    <section className={`card rq-next ${className ?? ""}`} aria-label="What happens next">
      <b>What happens next</b>
      <ol>
        <li>Approve: they choose their own player number (1 to {COMMUNITY_MEMBER_CAP}) before they get in.</li>
        <li>Reject: they can ask again later.</li>
      </ol>
      <dl>
        <dt>Members now</dt><dd>{members} of {COMMUNITY_MEMBER_CAP}</dd>
        <dt>Places left</dt><dd>{left}</dd>
      </dl>
    </section>
  );
}

/**
 * The people waiting, oldest first. Approve is the main button, Reject the quiet one. Every decision says what happened in
 * a message at the bottom, and a rejection can be taken back from it. With two or more waiting the Admin can tick people
 * (or take everybody) and approve them together.
 */
export default function RequestsList({ communityId, requests, members }: { communityId: string; requests: RequestItem[]; members: number }) {
  const router = useRouter();
  const { show, undoable } = useSnackbar();
  const [gone, setGone] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [confirm, setConfirm] = useState(false);

  const list = requests.filter((r) => !gone.includes(r.userId));
  const left = Math.max(0, COMMUNITY_MEMBER_CAP - members);
  const full = left <= 0;
  const many = list.length >= 2;
  const batch = selecting ? list.filter((r) => picked.includes(r.userId)) : list;
  const tooMany = batch.length > left;

  async function decide(r: RequestItem, decision: "approve" | "reject") {
    setBusy(r.userId);
    const out = await decideRequestB3(communityId, r.userId, decision).catch(() => "error" as const);
    setBusy(null);
    if (out === "full") { show({ message: `${COMMUNITY_MEMBER_CAP} members is the limit, so ${r.name} cannot be approved yet.`, tone: "warn" }); router.refresh(); return; }
    if (out === "not_pending") { show({ message: `${r.name} was already decided by someone else.`, tone: "info" }); setGone((g) => [...g, r.userId]); router.refresh(); return; }
    if (out !== "ok") { show({ message: "That did not work. Please try again.", tone: "error" }); return; }
    setGone((g) => [...g, r.userId]);
    setPicked((p) => p.filter((x) => x !== r.userId));
    if (decision === "approve") {
      show({ message: `${r.name} approved. They choose a player number next.`, tone: "success" });
    } else {
      // A rejection is not final: they can ask again, and Undo puts the request back where it was.
      undoable({
        message: `${r.name} rejected`,
        commit: () => {},
        onUndo: () => {
          void (async () => {
            const back = await reopenRequestB3(communityId, r.userId).catch(() => "error" as const);
            if (back === "ok") { setGone((g) => g.filter((x) => x !== r.userId)); show({ message: `${r.name} is waiting again`, tone: "success" }); }
            else show({ message: `${r.name} could not be put back. They may have asked again already.`, tone: "warn" });
            router.refresh();
          })();
        },
      });
    }
    router.refresh();
  }

  async function approveBatch() {
    const ids = batch.map((r) => r.userId);
    const res = await approveManyB3(communityId, ids).catch(() => null);
    setConfirm(false);
    if (!res) { show({ message: "That did not work. Please try again.", tone: "error" }); return; }
    setGone((g) => [...g, ...res.approved]);
    setPicked([]);
    setSelecting(false);
    const n = res.approved.length;
    if (res.failed.length) show({ message: `${n} approved, ${res.failed.length} could not be approved (full or already decided).`, tone: "warn" });
    else show({ message: `${n} ${n === 1 ? "person" : "people"} approved. They choose their player numbers next.`, tone: "success" });
    router.refresh();
  }

  if (list.length === 0) {
    return (
      <div className="stack">
        <section className="card mb-empty">
          <span className="mb-eic" aria-hidden="true"><Ic name="userPlus" /></span>
          <h2>No one is waiting</h2>
          <p className="muted small" style={{ margin: 0 }}>New requests appear here and in your Home banner. Share the invite link to bring people in.</p>
          <Link href={`/c/${communityId}/invite`} className="btn gold"><Ic name="share" />Invite friends</Link>
        </section>
        <WhatHappensNext members={members} className="rq-inline" />
      </div>
    );
  }

  return (
    <div className="stack">
      <p className="muted small rq-note">People you approve choose their own player number before they get in.</p>
      <div className="rq-bar">
        <span className="rq-count" role="status" aria-live="polite">{selecting ? `${batch.length} selected` : `${list.length} waiting`}</span>
        {many && (
          <>
            <button type="button" className="btn ghost small" aria-pressed={selecting} onClick={() => { setSelecting((s) => !s); setPicked([]); }}>{selecting ? "Cancel" : "Select"}</button>
            <button type="button" className="btn small rq-solid" disabled={batch.length === 0 || tooMany || full} onClick={() => setConfirm(true)}>
              <Ic name="check" />{selecting ? `Approve ${batch.length}` : `Approve all ${list.length}`}
            </button>
          </>
        )}
      </div>
      {many && tooMany && !full && <div className="mb-banner gold" role="status"><Ic name="info" /><div className="mb-bt"><b>Not enough places</b><span>Only {left} {left === 1 ? "place is" : "places are"} left. {selecting ? "Tick fewer people." : "Approve people one at a time."}</span></div></div>}
      {full && <div className="mb-banner red" role="alert"><Ic name="warn" /><div className="mb-bt"><b>The community is full</b><span>{COMMUNITY_MEMBER_CAP} members is the limit. Remove someone before approving more people.</span></div></div>}

      {list.map((r) => {
        const on = picked.includes(r.userId);
        const work = busy === r.userId;
        return (
          <section key={r.userId} className={`card rq-card${on ? " picked" : ""}`}>
            <div className="rq-who">
              {selecting && (
                <label className="rq-tick">
                  <input type="checkbox" checked={on} onChange={() => setPicked((p) => (on ? p.filter((x) => x !== r.userId) : [...p, r.userId]))} aria-label={`Select ${r.name}`} />
                </label>
              )}
              <span className="b3-avatar" aria-hidden="true">{initials(r.name)}</span>
              <span className="t"><b>{r.name}</b><small>Asked {r.asked}</small></span>
            </div>
            <div className="rq-acts">
              <button type="button" className="rq-approve" disabled={work || full} aria-label={`Approve ${r.name}`} onClick={() => void decide(r, "approve")}><Ic name="check" />Approve</button>
              <button type="button" className="rq-reject" disabled={work} aria-label={`Reject ${r.name}`} onClick={() => void decide(r, "reject")}><Ic name="close" />Reject</button>
            </div>
          </section>
        );
      })}

      <WhatHappensNext members={members} className="rq-inline" />

      <ConfirmDialog
        open={confirm}
        title={selecting ? `Approve ${batch.length} ${batch.length === 1 ? "person" : "people"}?` : `Approve all ${list.length} people?`}
        body={<>They each choose their own player number before they get in. {Math.max(0, left - batch.length)} {left - batch.length === 1 ? "place" : "places"} will be left.</>}
        confirmLabel={`Approve ${batch.length}`}
        onConfirm={approveBatch}
        onClose={() => setConfirm(false)}
      />
    </div>
  );
}
