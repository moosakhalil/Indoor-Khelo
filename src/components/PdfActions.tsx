"use client";
// View, download or share the match report as a PDF. Sharing the file itself (so WhatsApp can take it) works on phones whose
// browser supports it; otherwise we offer a WhatsApp message with the report link and say so plainly.
import { useState } from "react";

const withParams = (base: string, params: Record<string, string>) => `${base}${base.includes("?") ? "&" : "?"}${new URLSearchParams(params).toString()}`;

export default function PdfActions({ pdfBase, shareUrl, title, fileName = "match-report.pdf" }: { pdfBase: string; shareUrl: string; title: string; fileName?: string }) {
  const [full, setFull] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ tone: "green" | "red" | "mute"; text: string } | null>(null);
  const [fallback, setFallback] = useState(false);
  const f = full ? "1" : "0";
  const viewUrl = withParams(pdfBase, { full: f, download: "0" });
  const downloadUrl = withParams(pdfBase, { full: f, download: "1" });
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`${title}\n${shareUrl}`)}`;

  async function share() {
    setNote(null); setFallback(false); setBusy(true);
    try {
      const res = await fetch(viewUrl, { credentials: "same-origin", cache: "no-store" });
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("pdf")) {
        setNote({ tone: "red", text: res.status === 401 ? "Your sign-in ran out. Sign in again and try once more." : "The PDF could not be made right now. Check your signal and try again." });
        return;
      }
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: "application/pdf" });
      if (typeof navigator !== "undefined" && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title, text: title });
          setNote({ tone: "green", text: "Shared." });
        } catch (e) {
          if ((e as { name?: string })?.name === "AbortError") return;   // the person closed the share sheet: nothing to say
          setNote({ tone: "red", text: "Sharing did not work. You can download the PDF and send it yourself." });
        }
      } else {
        setFallback(true);
        setNote({ tone: "mute", text: "This browser cannot share a PDF file directly. You can send the report link on WhatsApp instead, or download the PDF and attach it." });
      }
    } catch {
      setNote({ tone: "red", text: "No connection. The PDF needs a signal. Try again when you are online." });
    } finally { setBusy(false); }
  }

  return (
    <div className="stack" aria-label="PDF">
      <div className="row wrap" role="group" aria-label="How much to include">
        <button type="button" className={`chip${!full ? " gold" : ""}`} aria-pressed={!full} onClick={() => setFull(false)}>Short</button>
        <button type="button" className={`chip${full ? " gold" : ""}`} aria-pressed={full} onClick={() => setFull(true)}>Full with ball by ball</button>
      </div>
      <p className="muted small" style={{ margin: 0 }}>{full ? "Everything, including every ball. Longer." : "Scorecards, Player of the Match and stats."}</p>
      <div className="two">
        <a className="btn ghost" href={viewUrl} target="_blank" rel="noopener noreferrer">View PDF</a>
        <a className="btn ghost" href={downloadUrl} download={fileName}>Download PDF</a>
      </div>
      <button type="button" className="btn gold" onClick={share} disabled={busy}>{busy ? "Preparing…" : "Share"}</button>
      {note && <p className={note.tone === "red" ? "err" : `banner ${note.tone}`} role="status" style={{ margin: 0 }}>{note.text}</p>}
      {fallback && <a className="btn green" href={whatsapp} target="_blank" rel="noopener noreferrer">Share link on WhatsApp</a>}
    </div>
  );
}
