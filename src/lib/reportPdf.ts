// The match report as a PDF. buildReportBlocks turns a finished match into plain blocks (pure, easy to test);
// renderReportPdf draws the blocks on A4 pages. Dark text on white, so it also prints well.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { dismissalText, economy, oversText, strikeRate, totalExtras } from "@/lib/engine/engine";
import type { MatchState } from "@/lib/engine/types";
import { computeMatchStats, matchFigures, oversSummary, partnershipsOf } from "@/lib/stats";

export type Block =
  | { t: "title"; text: string; sub?: string }
  | { t: "heading"; text: string }
  | { t: "subheading"; text: string }
  | { t: "kv"; rows: [string, string][] }
  | { t: "text"; text: string; muted?: boolean; bold?: boolean }
  | { t: "table"; head: string[]; rows: string[][]; widths: number[]; align: ("l" | "r")[] }
  | { t: "bars"; rows: { label: string; value: number; max: number; note: string }[] }
  | { t: "bullets"; items: string[] };

export type ReportMeta = { dateText: string; venue: string; overs: number; createdBy: string | null; scorers: { name: string; balls: number }[]; appName?: string };

const f1 = (n: number) => n.toFixed(1);

/** Everything in the report, in order. `full` adds the ball-by-ball record. */
export function buildReportBlocks(m: MatchState, meta: ReportMeta, opts: { full: boolean }): Block[] {
  const bpo = m.rules.ballsPerOver;
  const blocks: Block[] = [];
  const { players, pom } = computeMatchStats(m);
  const name = (id: string | null) => (id ? m.players[id]?.name ?? "Player" : "");

  blocks.push({ t: "title", text: `${m.sides[0]} v ${m.sides[1]}`, sub: [meta.dateText, meta.venue, `${meta.overs} overs`].filter(Boolean).join("  |  ") });
  const kv: [string, string][] = [];
  if (m.toss) kv.push(["Toss", `${m.sides[m.toss.winner - 1]} won the toss and chose to ${m.toss.decision}`]);
  kv.push(["Result", m.result?.text ?? "No result"]);
  kv.push(["Created by", meta.createdBy ?? "-"]);
  if (meta.scorers.length) kv.push(["Scored by", meta.scorers.map((s) => `${s.name} (${s.balls} ball${s.balls === 1 ? "" : "s"})`).join(", ")]);
  blocks.push({ t: "kv", rows: kv });

  // Player of the Match
  blocks.push({ t: "heading", text: "Player of the Match" });
  if (!pom) blocks.push({ t: "text", text: m.result?.kind === "abandoned" ? "An abandoned match has no Player of the Match." : "No Player of the Match for this result.", muted: true });
  else {
    for (const id of pom.winners) {
      const p = players.find((x) => x.entryId === id)!;
      blocks.push({ t: "text", bold: true, text: `${p.name}${m.players[id]?.kind === "guest" ? " (guest)" : ""}: ${p.points} points` });
      blocks.push({ t: "text", muted: true, text: (pom.breakdown[id] ?? []).map((x) => `${x.label} ${x.points > 0 ? "+" : ""}${x.points}`).join(", ") });
    }
    blocks.push({ t: "text", muted: true, text: `Top three: ${pom.top.map((t, i) => `${i + 1}. ${t.name} ${t.points}`).join("   ")}` });
    blocks.push({ t: "text", muted: true, text: "The app adds up points from the balls scored. Nobody picks the winner." });
  }

  // scorecards
  for (const inn of m.innings) {
    const title = inn.superOver ? "Super over" : `Innings ${inn.index + 1}`;
    blocks.push({ t: "heading", text: `${title}: ${m.sides[inn.batting - 1]}  ${inn.runs}/${inn.wickets} (${oversText(inn.legalBalls, bpo)} ov)` });
    const batted = Object.values(inn.batters).sort((a, b) => a.order - b.order);
    blocks.push({
      t: "table", head: ["Batter", "How out", "R", "B", "4s", "6s", "SR"], widths: [3, 4, 1, 1, 1, 1, 1.4], align: ["l", "l", "r", "r", "r", "r", "r"],
      rows: batted.map((b) => [`${name(b.id)}${m.players[b.id]?.kind === "guest" ? " (guest)" : ""}`, dismissalText(m, b), String(b.runs), String(b.balls), String(b.fours), String(b.sixes), f1(strikeRate(b))]),
    });
    const dnb = Object.values(m.players).filter((p) => p.side === inn.batting && !inn.batters[p.id] && !m.gone[p.id]);
    if (dnb.length) blocks.push({ t: "text", muted: true, text: `Did not bat: ${dnb.map((p) => p.name).join(", ")}` });
    blocks.push({ t: "text", text: `Extras ${totalExtras(inn)} (wides ${inn.extras.wide}, no balls ${inn.extras.noball}, byes ${inn.extras.bye}, leg-byes ${inn.extras.legbye}${inn.extras.penalty ? `, penalty ${inn.extras.penalty}` : ""})` });
    if (inn.fow.length) blocks.push({ t: "text", muted: true, text: `Fall of wickets: ${inn.fow.map((w) => `${w.n}-${w.runs} (${name(w.player)}, ${w.over} ov)`).join(", ")}` });
    const bowlers = Object.values(inn.bowlers);
    blocks.push({
      t: "table", head: ["Bowler", "O", "M", "R", "W", "Econ"], widths: [4, 1, 1, 1, 1, 1.4], align: ["l", "r", "r", "r", "r", "r"],
      rows: bowlers.map((b) => [`${name(b.id)}${m.players[b.id]?.kind === "guest" ? " (guest)" : ""}`, oversText(b.legalBalls, bpo), String(b.maidens), String(b.runs), String(b.wickets), f1(economy(b, bpo))]),
    });
    const parts = partnershipsOf(inn);
    if (parts.length) blocks.push({ t: "bullets", items: parts.map((p) => `${name(p.a)}${p.b ? ` & ${name(p.b)}` : ""}: ${p.runs} (${p.balls} balls)`) });
  }

  // over by over
  const all = oversSummary(m);
  if (all.length) {
    const max = Math.max(1, ...all.map((o) => o.runs));
    blocks.push({ t: "heading", text: "Over by over" });
    for (const inn of m.innings) {
      const overs = all.filter((o) => o.innings === inn.index);
      if (!overs.length) continue;
      blocks.push({ t: "subheading", text: `${inn.superOver ? "Super over" : `Innings ${inn.index + 1}`}: ${m.sides[inn.batting - 1]}` });
      blocks.push({ t: "bars", rows: overs.map((o) => ({ label: `Over ${o.over + 1}`, value: o.runs, max, note: `${o.runs} runs${o.wickets ? `, ${o.wickets} wkt${o.wickets === 1 ? "" : "s"}` : ""} (${name(o.bowler)})` })) });
    }
  }

  // match stats
  const f = matchFigures(m);
  blocks.push({ t: "heading", text: "Match stats" });
  const regular = m.innings.filter((i) => !i.superOver);
  blocks.push({
    t: "kv", rows: [
      ...regular.map((i): [string, string] => [`Run rate, ${m.sides[i.batting - 1]}`, i.legalBalls ? ((i.runs * bpo) / i.legalBalls).toFixed(2) : "0.00"]),
      ["Fours", String(f.fours)], ["Sixes", String(f.sixes)], ["Dot balls", `${f.dotPercent}%`],
      ["Extras", `wides ${f.extras.wide}, no balls ${f.extras.noball}, byes ${f.extras.bye}, leg-byes ${f.extras.legbye}${f.extras.penalty ? `, penalty ${f.extras.penalty}` : ""}`],
    ],
  });
  if (f.bestPartnerships.length) {
    blocks.push({ t: "subheading", text: "Best partnerships" });
    blocks.push({ t: "bullets", items: f.bestPartnerships.map((p) => `${name(p.a)}${p.b ? ` & ${name(p.b)}` : ""}: ${p.runs} (${p.balls} balls)`) });
  }
  const tops = [
    ...f.topBatters.map((p) => `${p.name} (${m.sides[p.side - 1]}): ${p.bat.reduce((a, b) => a + b.runs, 0)} off ${p.bat.reduce((a, b) => a + b.balls, 0)}`),
    ...f.topBowlers.map((p) => `${p.name} (${m.sides[p.side - 1]}): ${p.bowl.reduce((a, b) => a + b.wickets, 0)}/${p.bowl.reduce((a, b) => a + b.runs, 0)}`),
  ];
  if (tops.length) { blocks.push({ t: "subheading", text: "Top performers" }); blocks.push({ t: "bullets", items: tops }); }

  // changes
  blocks.push({ t: "heading", text: "Changes during the match, and corrections after it" });
  blocks.push(m.timeline.length ? { t: "bullets", items: m.timeline.map((t) => `${t.text}${t.by ? ` (${t.by})` : ""}`) } : { t: "text", muted: true, text: "Nothing was changed." });

  // ball by ball (full version only)
  if (opts.full) {
    blocks.push({ t: "heading", text: "Ball by ball" });
    for (const inn of m.innings) {
      blocks.push({ t: "subheading", text: `${inn.superOver ? "Super over" : `Innings ${inn.index + 1}`}: ${m.sides[inn.batting - 1]}` });
      blocks.push(inn.balls.length ? { t: "bullets", items: inn.balls.map((b) => b.text) } : { t: "text", muted: true, text: "No balls bowled." });
    }
  }
  return blocks;
}

/* ---------- drawing ---------- */
const CHAR_MAP: Record<string, string> = { "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "...", "•": "-", " ": " ", "→": "->", "×": "x" };

/** The standard PDF fonts only know basic Latin letters. Anything else becomes "?" so a name in any script can never crash the file. */
export function sanitize(text: string): string {
  let out = "";
  for (const ch of text) {
    if (CHAR_MAP[ch]) { out += CHAR_MAP[ch]; continue; }
    const c = ch.codePointAt(0)!;
    if ((c >= 0x20 && c <= 0x7e) || (c >= 0xa1 && c <= 0xff)) out += ch;
    else if (ch === "\n" || ch === "\t") out += " ";
    else out += "?";
  }
  return out;
}

const PAGE_W = 595.28, PAGE_H = 841.89, MARGIN = 40, BOTTOM = 52;
const INK = rgb(0.09, 0.1, 0.13), MUTED = rgb(0.38, 0.41, 0.48), LINE = rgb(0.82, 0.84, 0.88), ACCENT = rgb(0.1, 0.35, 0.6), SOFT = rgb(0.94, 0.95, 0.97);

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = "";
  const push = () => { lines.push(line); line = ""; };
  for (const word of sanitize(text).split(" ")) {
    let w = word;
    // a single word longer than the line is cut into pieces
    while (font.widthOfTextAtSize(w, size) > width) {
      let n = w.length;
      while (n > 1 && font.widthOfTextAtSize(w.slice(0, n), size) > width) n--;
      if (line) push();
      lines.push(w.slice(0, n));
      w = w.slice(n);
    }
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) <= width) line = next;
    else { if (line) push(); line = w; }
  }
  if (line || !lines.length) push();
  return lines;
}

function fit(text: string, font: PDFFont, size: number, width: number): string {
  let t = sanitize(text);
  if (font.widthOfTextAtSize(t, size) <= width) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > width) t = t.slice(0, -1);
  return `${t}...`;
}

export async function renderReportPdf(blocks: Block[], opts: { title?: string; appName?: string } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(sanitize(opts.title ?? "Match report"));
  doc.setCreator("Indoor Khelo");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const contentW = PAGE_W - MARGIN * 2;
  let page!: PDFPage;
  let y = 0;
  const newPage = () => { page = doc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN; };
  const ensure = (h: number) => { if (y - h < BOTTOM) newPage(); };
  newPage();

  const paragraph = (text: string, size: number, f: PDFFont, color = INK, indent = 0, gap = 3) => {
    const lines = wrap(text, f, size, contentW - indent);
    for (const l of lines) { ensure(size + 3); page.drawText(l, { x: MARGIN + indent, y: y - size, size, font: f, color }); y -= size + 3; }
    y -= gap;
  };

  for (const b of blocks) {
    if (b.t === "title") {
      paragraph(b.text, 22, bold, INK, 0, 2);
      if (b.sub) paragraph(b.sub, 10.5, font, MUTED, 0, 6);
      ensure(6); page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 1.2, color: ACCENT }); y -= 10;
    } else if (b.t === "heading") {
      ensure(40); y -= 8;
      paragraph(b.text, 13, bold, ACCENT, 0, 2);
      page.drawLine({ start: { x: MARGIN, y: y + 1 }, end: { x: PAGE_W - MARGIN, y: y + 1 }, thickness: 0.5, color: LINE }); y -= 5;
    } else if (b.t === "subheading") {
      ensure(30); paragraph(b.text, 10.5, bold, INK, 0, 2);
    } else if (b.t === "text") {
      paragraph(b.text, 9.5, b.bold ? bold : font, b.muted ? MUTED : INK, 0, 3);
    } else if (b.t === "kv") {
      for (const [k, v] of b.rows) {
        const lines = wrap(v, font, 9.5, contentW - 110);
        ensure(lines.length * 12.5 + 2);
        page.drawText(fit(k, bold, 9.5, 104), { x: MARGIN, y: y - 9.5, size: 9.5, font: bold, color: MUTED });
        for (const l of lines) { page.drawText(l, { x: MARGIN + 110, y: y - 9.5, size: 9.5, font, color: INK }); y -= 12.5; }
        y -= 1;
      }
      y -= 4;
    } else if (b.t === "table") {
      const total = b.widths.reduce((a, x) => a + x, 0);
      const cols = b.widths.map((w) => (w / total) * contentW);
      const xs = cols.map((_, i) => MARGIN + cols.slice(0, i).reduce((a, x) => a + x, 0));
      const header = () => {
        ensure(20); page.drawRectangle({ x: MARGIN, y: y - 14, width: contentW, height: 14, color: SOFT });
        b.head.forEach((h, i) => {
          const t = fit(h, bold, 8.5, cols[i]! - 6);
          const x = b.align[i] === "r" ? xs[i]! + cols[i]! - 4 - bold.widthOfTextAtSize(t, 8.5) : xs[i]! + 3;
          page.drawText(t, { x, y: y - 10.5, size: 8.5, font: bold, color: MUTED });
        });
        y -= 16;
      };
      header();
      for (const row of b.rows) {
        if (y - 14 < BOTTOM) { newPage(); header(); }       // the header repeats on every page
        row.forEach((cell, i) => {
          const t = fit(cell, font, 9, cols[i]! - 6);
          const x = b.align[i] === "r" ? xs[i]! + cols[i]! - 4 - font.widthOfTextAtSize(t, 9) : xs[i]! + 3;
          page.drawText(t, { x, y: y - 9.5, size: 9, font: i === 0 ? bold : font, color: INK });
        });
        y -= 13;
        page.drawLine({ start: { x: MARGIN, y: y + 1.5 }, end: { x: PAGE_W - MARGIN, y: y + 1.5 }, thickness: 0.3, color: LINE });
      }
      y -= 6;
    } else if (b.t === "bars") {
      for (const r of b.rows) {
        ensure(14);
        page.drawText(fit(r.label, font, 8.5, 48), { x: MARGIN, y: y - 9, size: 8.5, font, color: MUTED });
        const w = Math.max(2, (r.value / r.max) * 220);
        page.drawRectangle({ x: MARGIN + 52, y: y - 10, width: w, height: 9, color: ACCENT });
        page.drawText(fit(r.note, font, 8.5, contentW - 52 - 228), { x: MARGIN + 52 + 228, y: y - 9, size: 8.5, font, color: INK });
        y -= 13;
      }
      y -= 4;
    } else if (b.t === "bullets") {
      for (const item of b.items) {
        const lines = wrap(item, font, 9, contentW - 12);
        ensure(lines.length * 11.5);
        page.drawText("-", { x: MARGIN + 2, y: y - 9, size: 9, font, color: MUTED });
        for (const l of lines) { page.drawText(l, { x: MARGIN + 12, y: y - 9, size: 9, font, color: INK }); y -= 11.5; }
      }
      y -= 4;
    }
  }

  // footer and page numbers, once the number of pages is known
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN, y: 38 }, end: { x: PAGE_W - MARGIN, y: 38 }, thickness: 0.4, color: LINE });
    p.drawText(`Scored with ${sanitize(opts.appName ?? "Indoor Khelo")}`, { x: MARGIN, y: 26, size: 8, font, color: MUTED });
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: PAGE_W - MARGIN - font.widthOfTextAtSize(label, 8), y: 26, size: 8, font, color: MUTED });
  });
  return doc.save();
}

/** A safe file name such as Alpha-v-Bravo-2026-11-23.pdf (letters, numbers and dashes only). */
export function pdfFileName(sideA: string, sideB: string, date: Date | null): string {
  const clean = (s: string) => sanitize(s).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "Team";
  const d = date ? date.toISOString().slice(0, 10) : "match";
  return `${clean(sideA)}-v-${clean(sideB)}-${d}.pdf`;
}
