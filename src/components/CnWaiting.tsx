"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { leaveAction } from "@/app/actions2";
import CnIc from "@/components/CnIcons";
import CommunityLogo from "@/components/CommunityLogo";
import ConfirmDialog from "@/components/ConfirmDialog";
import Shirt from "@/components/Shirt";
import "./cn.css";

/**
 * Waiting for approval. A status timeline (request sent, Admin approves, pick your number), the Admin who will decide,
 * one big primary button (Check again) and a quieter Cancel that asks first. Cancel still uses the existing `leaveAction`.
 */
export function WaitingCard({
  communityId, communityName, adminName, adminNumber,
}: {
  communityId: string;
  communityName: string;
  adminName: string | null;
  /** The Admin's player number when known, otherwise a grey shirt. */
  adminNumber: number | null;
}) {
  const [asking, setAsking] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const who = adminName ?? "The Admin";
  return (
    <div className="cn-wrap">
      <section className="cn-card cn-wait" aria-labelledby="cn-wait-h">
        <div className="cn-id">
          <CommunityLogo name={communityName} big />
          <div className="cn-idt">
            <small className="cn-eyebrow">Request sent to</small>
            <h1 id="cn-wait-h">{communityName}</h1>
            <span className="cn-badge gold"><CnIc name="clock" />Pending</span>
          </div>
        </div>
        <p className="muted cn-lead">{who} will approve you soon. Come back and check, or we will show it here as soon as you are in.</p>
        <ol className="cn-steps" aria-label="Where your request is">
          <li className="done">
            <i aria-hidden="true"><CnIc name="check" /></i>
            <span><b>Request sent</b><small>Your name was sent to the Admin.</small></span>
          </li>
          <li className="now" aria-current="step">
            <i aria-hidden="true"><CnIc name="clock" /></i>
            <span><b>Admin approves</b><small>Waiting for {who}</small></span>
          </li>
          <li className="later">
            <i aria-hidden="true"><CnIc name="user" /></i>
            <span><b>Pick your player number</b><small>From 1 to 99, after you are approved.</small></span>
          </li>
        </ol>
        <div className="cn-admin">
          <Shirt number={adminNumber} size="small" />
          <span className="cn-admin-t"><b>{adminName ?? "Admin"}</b><small>Admin</small></span>
          <span className="cn-badge gold"><i className="cn-dot" aria-hidden="true" />Waiting</span>
        </div>
      </section>

      <Link className="btn gold cn-big" href={`/c/${communityId}/waiting`}><CnIc name="refresh" />Check again</Link>
      <div className="cn-pair">
        <button type="button" className="btn cn-quiet-red" onClick={() => setAsking(true)}>Cancel my request</button>
        <Link className="btn ghost" href="/choose">Back</Link>
      </div>

      <form ref={form} action={leaveAction} hidden>
        <input type="hidden" name="communityId" value={communityId} />
      </form>
      <ConfirmDialog
        open={asking}
        danger
        title="Cancel your request?"
        body={<>{who} will no longer see it. You can ask again any time with the invite link or code.</>}
        cancelLabel="Keep request"
        confirmLabel="Cancel request"
        onConfirm={() => { form.current?.requestSubmit(); }}
        onClose={() => setAsking(false)}
      />
    </div>
  );
}

/** The request was not approved: a clear red outcome, with Ask again as the main action (it links back to the invite). */
export function RejectedCard({ communityName, inviteCode }: { communityName: string; inviteCode: string }) {
  return (
    <div className="cn-wrap">
      <section className="cn-card cn-rej" aria-labelledby="cn-rej-h">
        <span className="cn-rej-x" aria-hidden="true"><CnIc name="close" /></span>
        <CommunityLogo name={communityName} big />
        <h1 id="cn-rej-h">Your request was not approved</h1>
        <p className="muted">The Admin of {communityName} did not approve this request. You can ask again later.</p>
        <Link className="btn gold cn-big" href={`/join/${inviteCode}`}><CnIc name="refresh" />Ask again</Link>
        <Link className="btn ghost" href="/choose">Back</Link>
      </section>
    </div>
  );
}
