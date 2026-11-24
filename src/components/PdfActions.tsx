"use client";
// View, download or share the match report as a PDF. Sharing the file itself (so WhatsApp can take it) works on phones whose
// browser supports it; otherwise we offer a WhatsApp message with the report link and say so plainly.
// Short or Full is a segmented control; View, Download and Share are one size; every message has an icon, plain words and the next step.
import { useEffect, useId, useRef, useState } from "react";
import PdIcon from "@/components/PdIcons";
import "./pd.css";

const withParams = (base: string, params: Record<string, string>) => `${base}${base.includes("?") ? "&" : "?"}${new URLSearchParams(params).toString()}`;

type Kind = "shared" | "nosupport" | "auth" | "server" | "offline" | "sharefail";
const WORDS: Record<Kind, string> = {
  shared: "Shared.",
  nosupport: "This browser cannot share a PDF file directly. You can send the report link on WhatsApp instead, or download the PDF and attach it.",
  auth: "Your sign-in ran out. Sign in again and try once more.",
  server: "The PDF could not be made right now. Check your signal and try again.",
  offline: "No connection. The PDF needs a signal. Try again when you are online.",
  sharefail: "Sharing did not work. You can download the PDF and send it yourself.",
};
const TONE: Record<Kind, "ok" | "quiet" | "red"> = { shared: "ok", nosupport: "quiet", auth: "red", server: "red", offline: "quiet", sharefail: "red" };
const ICON: Record<Kind, string> = { shared: "check", nosupport: "info", auth: "warn", server: "warn", offline: "wifioff", sharefail: "warn" };

export default function PdfActions({ pdfBase, shareUrl, title, fileName = "match-report.pdf" }: { pdfBase: string; shareUrl: string; title: string; fileName?: string }) {
  const [full, setFull] = useState(false);
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);
  const [note, setNote] = useState<Kind | null>(null);
  const [offline, setOffline] = useState(false);
  const live = useRef(true);
  const noteId = useId();
  const descId = useId();
  const f = full ? "1" : "0";
  const viewUrl = withParams(pdfBase, { full: f, download: "0" });
  const downloadUrl = withParams(pdfBase, { full: f, download: "1" });
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${title}\n${shareUrl}`)}`;

  useEffect(() => {
    live.current = true;
    if (typeof navigator !== "undefined" && navigator.onLine === false) setOffline(true);
    const on = () => { setOffline(false); setNote((n) => (n === "offline" ? null : n)); };
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { live.current = false; window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);
  // "Still preparing": only said when the wait is long, so a slow signal does not look frozen
  useEffect(() => {
    if (!busy) { setSlow(false); return; }
    const t = setTimeout(() => setSlow(true), 6000);
    return () => clearTimeout(t);
  }, [busy]);

  async function share() {
    setNote(null); setBusy(true); setOffline(false);
    const say = (k: Kind) => { if (live.current) setNote(k); };
    try {
      const res = await fetch(viewUrl, { credentials: "same-origin", cache: "no-store" });
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("pdf")) { say(res.status === 401 ? "auth" : "server"); return; }
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: "application/pdf" });
      if (typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title, text: title });
          say("shared");
        } catch (e) {
          if ((e as { name?: string })?.name === "AbortError") return;   // the person closed the share sheet: nothing to say
          say("sharefail");
        }
      } else say("nosupport");
    } catch {
      if (live.current) setOffline(true);
      say("offline");
    } finally { if (live.current) setBusy(false); }
  }

  const noteBody = (k: Kind) => (
    <>
      <p>{WORDS[k]}</p>
      {k === "auth" && <a className="pd-btn small" href="/">Sign in again</a>}
      {(k === "server" || k === "offline") && <button type="button" className="pd-btn small" onClick={share}>Try again</button>}
      {k === "sharefail" && <a className="pd-btn small" href={downloadUrl} download={fileName}>Download PDF</a>}
    </>
  );

  return (
    <div className="stack" aria-label="PDF">
      <div className="pd-top">
        <span className={`pd-prev${full ? " full" : ""}`} aria-hidden="true">
          <span className="pd-prev-page">
            <i className="pd-prev-bar" />
            <span className="pd-prev-badges"><i /><i /></span>
            <i className="pd-prev-gold" />
            <i className="pd-prev-line" /><i className="pd-prev-line short" /><i className="pd-prev-line" /><i className="pd-prev-line short" />
          </span>
        </span>
        <div className="pd-pick">
          <div className="pd-seg" role="group" aria-label="How much to include" aria-describedby={descId}>
            <button type="button" aria-pressed={!full} aria-label="Short" onClick={() => setFull(false)}>Short</button>
            <button type="button" aria-pressed={full} aria-label="Full with ball by ball" onClick={() => setFull(true)}>Full</button>
          </div>
          <p className="pd-desc" id={descId}>{full ? "Everything, including every ball. Usually 4 pages or more." : "Scorecards, Player of the Match and stats. About 2 pages."}</p>
        </div>
      </div>
      <div className="pd-two">
        {offline ? (
          <>
            <button type="button" className="pd-btn" aria-disabled="true" aria-label="View PDF" aria-describedby={noteId} onClick={(e) => e.preventDefault()}><PdIcon name="eye" />View</button>
            <button type="button" className="pd-btn" aria-disabled="true" aria-label="Download PDF" aria-describedby={noteId} onClick={(e) => e.preventDefault()}><PdIcon name="download" />Download</button>
          </>
        ) : (
          <>
            <a className="pd-btn" href={viewUrl} target="_blank" rel="noopener noreferrer" aria-label="View PDF"><PdIcon name="eye" />View</a>
            <a className="pd-btn" href={downloadUrl} download={fileName} aria-label="Download PDF"><PdIcon name="download" />Download</a>
          </>
        )}
      </div>
      <button type="button" className="pd-btn gold" onClick={share} disabled={busy} aria-busy={busy}>
        {busy ? <><PdIcon name="spinner" /><span>Preparing…</span></> : <><PdIcon name="share" />Share</>}
      </button>
      {busy && slow && <p className="pd-slow" role="status">Still preparing. A slow signal can take a little longer.</p>}
      {offline && !note && <p className="pd-slow" id={noteId}>You are offline. View, Download and Share need a signal.</p>}
      {note && (
        <div className={`pd-note ${TONE[note]}`} role="status" id={noteId}>
          <PdIcon name={ICON[note]} />
          <div className="pd-note-body">{noteBody(note)}</div>
        </div>
      )}
      {note === "nosupport" && <a className="pd-btn green" href={whatsapp} target="_blank" rel="noopener noreferrer"><PdIcon name="send" />Share link on WhatsApp</a>}
    </div>
  );
}
