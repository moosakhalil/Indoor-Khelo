"use client";

import { useState } from "react";
import Icon from "@/components/B2Icons";
import ConfirmDialog from "@/components/ConfirmDialog";
import CopyButton, { COPY_HINT, type CopyState } from "@/components/CopyButton";
import { useSnackbar } from "@/components/Snackbar";
import { replaceInviteAction } from "@/app/actions";
import "./b2.css";

export const REPLACED_MESSAGE = "Link and code replaced. The old link, code and QR code no longer work.";

/** The WhatsApp link used when the phone or browser has no share sheet. */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Opens the system share sheet; without one, opens WhatsApp with the message ready to send. */
export function ShareButton({ name, link, code }: { name: string; link: string; code: string }) {
  async function share() {
    const fallback = () => window.open(whatsappUrl(`Join ${name} on Indoor Khelo: ${link} (code ${code})`), "_blank", "noopener,noreferrer");
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `Join ${name}`, text: `Join ${name} on Indoor Khelo. Code: ${code}`, url: link });
      } catch (err) {
        // Closing the share sheet is not an error; any other failure falls back to WhatsApp.
        if (!(err instanceof Error && err.name === "AbortError")) fallback();
      }
      return;
    }
    fallback();
  }
  return (
    <button type="button" className="btn gold small iv-share" onClick={() => void share()}>
      <Icon name="share" size={18} /> Share
    </button>
  );
}

/** Link and code in field-style boxes, each with a labelled Copy button, and the Share button. */
export function InviteFields({ name, link, code }: { name: string; link: string; code: string }) {
  const [linkState, setLinkState] = useState<CopyState>("idle");
  const [codeState, setCodeState] = useState<CopyState>("idle");
  return (
    <section className="card iv-fields">
      <span className="iv-lb" aria-hidden="true">Invite link</span>
      <div id="iv-link" tabIndex={0} role="textbox" aria-readonly="true" aria-label="Invite link" className={`iv-box iv-link${linkState === "failed" ? " bad" : ""}`}>{link}</div>
      <div className="iv-btns">
        <CopyButton text={link} label="Copy link" targetId="iv-link" onState={setLinkState} />
        <ShareButton name={name} link={link} code={code} />
      </div>
      {linkState === "failed" && <p className="iv-hint" role="status">{COPY_HINT}</p>}

      <span className="iv-lb" aria-hidden="true">Code</span>
      <div className="iv-coderow">
        <div id="iv-code" tabIndex={0} role="textbox" aria-readonly="true" aria-label="Invite code" className={`iv-box iv-code${codeState === "failed" ? " bad" : ""}`}>{code}</div>
        <CopyButton text={code} label="Copy code" targetId="iv-code" onState={setCodeState} />
      </div>
      {codeState === "failed" && <p className="iv-hint" role="status">{COPY_HINT.replace("the link", "the code")}</p>}
    </section>
  );
}

/** "Replace link and code": asks first, says what stops working, then confirms in a message. No Undo (it cannot be undone). */
export function ReplaceInvite({ communityId }: { communityId: string }) {
  const [open, setOpen] = useState(false);
  const snack = useSnackbar();
  async function replace() {
    try {
      const fd = new FormData();
      fd.set("communityId", communityId);
      await replaceInviteAction(fd);
      setOpen(false);
      snack.show({ message: REPLACED_MESSAGE, tone: "success", ms: 6000 });
    } catch {
      setOpen(false);
      snack.show({ message: "Could not replace the link. Please try again.", tone: "error" });
    }
  }
  return (
    <>
      <button type="button" className="btn red small" onClick={() => setOpen(true)}>
        <Icon name="refresh" size={18} /> Replace link and code
      </button>
      <ConfirmDialog
        open={open}
        title="Replace the invite link?"
        body="The old link, the old code and the old QR code stop working straight away. Anyone who has not joined yet will need the new ones. People who are already in the community stay."
        confirmLabel="Replace link"
        danger
        onConfirm={replace}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
