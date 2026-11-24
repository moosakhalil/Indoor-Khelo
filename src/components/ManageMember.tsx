"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { removeMemberB3, resetNumberB3, setRoleB3 } from "@/app/actionsB3";
import Ic from "@/components/B3Icons";
import ConfirmDialog from "@/components/ConfirmDialog";
import Shirt from "@/components/Shirt";
import { useSnackbar } from "@/components/Snackbar";
import { firstName, manageNotice, type ManageNotice } from "@/lib/b3";
import "./b3.css";

type Dialog = null | "number" | "remove" | "self_demote";
type Local = undefined | null | { code: string } | { done: true };

/**
 * Admin tools for one member: person first, then three cards (Admin role, Player number, Remove).
 * Actions that cannot work are switched off up front with the reason. Remove and a new number ask first, in a box that
 * names the person; Make Admin and Take Admin away happen at once and can be undone from the message at the bottom.
 */
export default function ManageMember({
  communityId, communityName, userId, name, role, number, isSelf, adminCount, initialError, initialDone, autoOpen,
}: {
  communityId: string;
  communityName: string;
  userId: string;
  name: string;
  role: "admin" | "member";
  number: number | null;
  isSelf: boolean;
  adminCount: number;
  initialError?: string;
  initialDone?: boolean;
  autoOpen?: "role" | "number" | "remove";
}) {
  const router = useRouter();
  const { show, undoable } = useSnackbar();
  const first = firstName(name);
  const isAdmin = role === "admin";
  const lastAdmin = isAdmin && adminCount <= 1;
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<Local>(undefined);
  const canRemove = !isSelf && !isAdmin;
  const canReset = number !== null;
  const [dialog, setDialog] = useState<Dialog>(autoOpen === "remove" && canRemove ? "remove" : autoOpen === "number" && canReset ? "number" : null);
  const roleCard = useRef<HTMLElement>(null);
  const ids = { role: useId(), num: useId(), rem: useId() };

  useEffect(() => {
    if (autoOpen === "role") roleCard.current?.scrollIntoView?.({ block: "center" });
  }, [autoOpen]);

  const freed: ManageNotice = { tone: "green", headline: "Number freed", body: `${name} must choose a new number before using the community again.` };
  const notice: ManageNotice | null = local === undefined
    ? initialError ? manageNotice(initialError, name) : initialDone ? freed : null
    : local === null ? null
    : "done" in local ? freed
    : manageNotice(local.code, name);

  async function changeRole(to: "admin" | "member") {
    setBusy(true);
    const out = await setRoleB3(communityId, userId, to).catch(() => "error" as const);
    setBusy(false);
    if (out !== "ok") {
      setLocal({ code: out });
      return;
    }
    setLocal(null);
    if (isSelf) {
      // Your own Admin tools are gone now, so there is nothing here to undo from.
      show({ message: "You are no longer an Admin", tone: "success" });
      router.push(`/c/${communityId}/members`);
      return;
    }
    undoable({
      message: to === "admin" ? `${name} is now an Admin` : `Admin taken away from ${name}`,
      commit: () => {},
      onUndo: () => {
        void (async () => {
          const back = await setRoleB3(communityId, userId, to === "admin" ? "member" : "admin").catch(() => "error" as const);
          if (back === "ok") show({ message: to === "admin" ? `${name} is a member again` : `${name} is an Admin again`, tone: "success" });
          else setLocal({ code: back });
          router.refresh();
        })();
      },
    });
    router.refresh();
  }

  async function remove() {
    const out = await removeMemberB3(communityId, userId).catch(() => "error" as const);
    setDialog(null);
    if (out !== "ok") {
      setLocal({ code: out });
      return;
    }
    show({ message: `${name} was removed from ${communityName}`, tone: "success" });
    router.push(`/c/${communityId}/members`);
  }

  async function reset() {
    const out = await resetNumberB3(communityId, userId).catch(() => "error" as const);
    setDialog(null);
    if (out !== "ok") {
      setLocal({ code: out });
      return;
    }
    setLocal({ done: true });
    router.refresh();
  }

  const banner = notice && (
    <div className={`mb-banner ${notice.tone}${notice.action ? " has-btn" : ""}`} role={notice.tone === "red" ? "alert" : "status"}>
      <Ic name={notice.tone === "green" ? "check" : notice.tone === "mute" ? "info" : "warn"} />
      <div className="mb-bt"><b>{notice.headline}</b><span>{notice.body}</span></div>
      {notice.action === "take_admin" && isAdmin && (
        <button type="button" className="btn ghost small" disabled={busy} onClick={() => void changeRole("member")}>Take Admin away</button>
      )}
      {notice.action === "choose_admin" && (
        <Link href={`/c/${communityId}/members`} className="btn ghost small">Choose an Admin</Link>
      )}
    </div>
  );

  return (
    <div className="stack">
      {banner}

      <section className="card mb-head">
        {number === null ? <span className="mb-shirt-none"><Shirt number={null} size="big" name={name} /></span> : <Shirt number={number} size="big" name={name} />}
        <h2>{name}{isSelf && <span className="mb-tag you">YOU</span>}</h2>
        <div className="mb-tags">
          <span className={`mb-tag${isAdmin ? " admin" : ""}`}>{isAdmin ? "ADMIN" : "MEMBER"}</span>
          {number === null ? <span className="mb-tag dashed">Choosing a new number</span> : <span className="mb-tag">Number {number}</span>}
        </div>
        <Link href={`/c/${communityId}/players/${userId}`} className="btn ghost small"><Ic name="user" />View player profile</Link>
      </section>

      <section id="role" ref={roleCard} className={`card mb-card${autoOpen === "role" ? " mb-focus" : ""}`} aria-labelledby={ids.role}>
        <div className="mb-ct"><b id={ids.role}>Admin role</b>{isAdmin && <span className="mb-tag admin">ADMIN</span>}</div>
        <p className="muted small">Admins can approve people, change settings and manage members. There must always be one.</p>
        {isAdmin ? (
          <button type="button" className="mb-btn" disabled={lastAdmin || busy} aria-describedby={lastAdmin ? `${ids.role}-why` : undefined} onClick={() => (isSelf ? setDialog("self_demote") : void changeRole("member"))}>
            <Ic name="shield" />Take Admin away
          </button>
        ) : (
          <button type="button" className="mb-btn gold" disabled={busy} onClick={() => void changeRole("admin")}><Ic name="shield" />Make Admin</button>
        )}
        {lastAdmin && <p id={`${ids.role}-why`} className="mb-hint"><Ic name="info" />{isSelf ? "You are the only Admin. Make someone else Admin first." : `${first} is the only Admin. Make someone else Admin first.`}</p>}
      </section>

      <section id="number" className="card mb-card" aria-labelledby={ids.num}>
        <div className="mb-ct"><b id={ids.num}>Player number</b>{number === null ? <span className="mb-num none" aria-label="No number">–</span> : <span className="mb-num" aria-label={`Number ${number}`}>{number}</span>}</div>
        {number === null ? (
          <p className="muted small">{first} has not chosen a number yet. Nothing to reset.</p>
        ) : (
          <>
            <p className="muted small">Use this to settle a dispute. The number is freed and {first} must pick a new one.</p>
            <button type="button" className="mb-btn" disabled={busy} onClick={() => setDialog("number")}><Ic name="grid" />Ask {first} to choose a new number</button>
          </>
        )}
      </section>

      {isSelf ? (
        <section className="card mb-card" aria-label="Leaving">
          <div className="mb-ct"><b>Leaving</b></div>
          <p className="muted small">You cannot remove yourself here. Use Leave community on the Community page.</p>
          <Link href={`/c/${communityId}/community`} className="mb-btn"><Ic name="exit" />Go to Community</Link>
        </section>
      ) : (
        <section id="remove" className="card mb-card danger" aria-labelledby={ids.rem}>
          <div className="mb-ct"><b id={ids.rem}>Remove from community</b></div>
          <p className="muted small">Their number is freed. Their stats stay with them and past scorecards keep their name. They can ask to join again.</p>
          <button type="button" className="mb-btn red" disabled={!canRemove || busy} aria-describedby={!canRemove ? `${ids.rem}-why` : undefined} onClick={() => setDialog("remove")}>
            <Ic name="trash" />Remove {first}…
          </button>
          {!canRemove && <p id={`${ids.rem}-why`} className="mb-hint"><Ic name="info" />{first} is an Admin. Take Admin away first.</p>}
        </section>
      )}

      <ConfirmDialog
        open={dialog === "remove"}
        danger
        title={`Remove ${name}?`}
        body={<>{first} is removed from {communityName}.{number !== null && <> Their number <b>{number}</b> is freed.</>} Their career stats stay with them and past scorecards keep their name. They can ask to join again.</>}
        confirmLabel={`Remove ${first}`}
        onConfirm={remove}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "number"}
        danger
        title={`Ask ${first} for a new number?`}
        body={<>Number <b>{number}</b> is freed straight away. {first} is blocked from {communityName} until they choose a new number.</>}
        confirmLabel="Ask for a new number"
        onConfirm={reset}
        onClose={() => setDialog(null)}
      />
      <ConfirmDialog
        open={dialog === "self_demote"}
        title="Take your own Admin away?"
        body={<>You will no longer be able to approve people, change settings or manage members in {communityName}. Another Admin has to give it back.</>}
        confirmLabel="Take my Admin away"
        onConfirm={async () => { setDialog(null); await changeRole("member"); }}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
