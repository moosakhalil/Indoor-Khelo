"use client";

// Phase F5: the "Share my profile" card on My profile. Off by default. Switching on creates a brand-new link every time;
// "Stop sharing" now asks first, because everyone who already has the link loses access. Same server action as before.
import { useEffect, useRef, useState } from "react";
import { shareProfileAction } from "@/app/actions8";
import ConfirmDialog from "@/components/ConfirmDialog";
import PfIcon from "@/components/PfIcons";
import { useSnackbar } from "@/components/Snackbar";
import "./pf.css";

export const COPIED_MS = 1800;

export default function PfShare({ communityId, token, origin }: { communityId: string; token: string | null; origin: string }) {
  const url = token ? `${origin}/p/${token}` : "";
  const [confirm, setConfirm] = useState(false);
  const [copy, setCopy] = useState<"idle" | "done" | "failed">("idle");
  const [canShare, setCanShare] = useState(false);
  const stopForm = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prev = useRef<string | null>(token);
  const snack = useSnackbar();

  useEffect(() => { setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"); }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // After the page reloads from the server action, say what happened (today the page just reloads with no feedback).
  useEffect(() => {
    if (prev.current && !token) snack.show({ message: "Sharing is off. The old link no longer works.", tone: "success" });
    else if (!prev.current && token) snack.show({ message: "Public link created.", tone: "success" });
    prev.current = token;
  }, [token, snack]);

  async function doCopy() {
    if (timer.current) clearTimeout(timer.current);
    let next: "done" | "failed" = "done";
    try { await navigator.clipboard.writeText(url); } catch { next = "failed"; }
    setCopy(next);
    snack.show(next === "done" ? { message: "Link copied. Anyone you send it to can see your profile.", tone: "success" } : { message: "Could not copy. Press and hold the link, then choose Copy.", tone: "warn" });
    timer.current = setTimeout(() => setCopy("idle"), next === "done" ? COPIED_MS : 6000);
  }

  async function doShare() {
    try { await navigator.share({ title: "My Indoor Khelo profile", url }); } catch { /* cancelled */ }
  }

  if (!token) {
    return (
      <section className="pf-box pf-share" id="share" aria-label="Share my profile">
        <div className="pf-box-head"><h2>Share my profile</h2><span className="pf-state off">Off</span></div>
        <p className="muted small" style={{ margin: "4px 0 10px" }}>Off. Nobody outside the app can see your profile. If you switch it on, you get a link that shows your profile and career totals (no community names, no match list). You can switch it off at any time.</p>
        <div className="pf-switch" aria-hidden="true"><span className="pf-switch-track"><span /></span><span>Public link is off</span></div>
        <form action={shareProfileAction}>
          <input type="hidden" name="communityId" value={communityId} /><input type="hidden" name="on" value="1" />
          <button className="btn gold"><PfIcon name="link" size={18} /> Create a public link</button>
        </form>
        <ul className="pf-says" aria-label="What a public link shows">
          <li className="yes"><PfIcon name="check" size={16} /><span>Name, playing role, batting and bowling details</span></li>
          <li className="yes"><PfIcon name="check" size={16} /><span>Career totals and last innings</span></li>
          <li className="no"><PfIcon name="x" size={16} /><span>No community names, number or match list</span></li>
          <li className="no"><PfIcon name="x" size={16} /><span>Nothing about payments. Only you can switch it off.</span></li>
        </ul>
      </section>
    );
  }

  return (
    <section className="pf-box pf-share on" id="share" aria-label="Share my profile">
      <div className="pf-box-head"><h2>Share my profile</h2><span className="pf-state on">On</span></div>
      <p className="muted small" style={{ margin: "4px 0 10px" }}>Anyone who has this link can see your profile and career totals without signing in. It shows no community names, no match list and nothing about payments. Only you can switch it off.</p>
      <div className="pf-linkbox">
        <span id="pf-link" className="mono pf-link-text">{url}</span>
        <button type="button" className={`btn pf-copy${copy === "done" ? " done" : copy === "failed" ? " failed" : " gold"}`} onClick={doCopy} aria-live="polite">
          <PfIcon name={copy === "done" ? "check" : "copy"} size={18} />
          {copy === "done" ? "Copied" : copy === "failed" ? "Select and copy" : "Copy"}
        </button>
      </div>
      <div className={canShare ? "two" : undefined} style={{ marginTop: 10 }}>
        {canShare && <button type="button" className="btn ghost" onClick={doShare}><PfIcon name="share" size={18} /> Share link</button>}
        <button type="button" className="btn red" onClick={() => setConfirm(true)}><PfIcon name="x" size={18} /> Stop sharing</button>
      </div>
      <form ref={stopForm} action={shareProfileAction} hidden>
        <input type="hidden" name="communityId" value={communityId} /><input type="hidden" name="on" value="0" />
      </form>
      <ConfirmDialog
        open={confirm}
        title="Stop sharing your profile?"
        body={<>The link <span className="pf-break">{url}</span> stops working straight away for everyone who has it. If you switch sharing on again you get a brand-new link.</>}
        confirmLabel="Stop sharing"
        cancelLabel="Keep sharing"
        danger
        onClose={() => setConfirm(false)}
        onConfirm={() => { setConfirm(false); stopForm.current?.requestSubmit(); }}
      />
    </section>
  );
}
