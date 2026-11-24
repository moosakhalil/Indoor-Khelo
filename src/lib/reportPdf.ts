// The match report as a PDF. buildReportBlocks turns a finished match into plain blocks (pure, easy to test);
// renderReportPdf draws the blocks on A4 pages with pdf-lib and the standard Helvetica fonts: no font files, no images.
// Dark text on white, so it also prints well. Letters the standard fonts do not have print as "?" (known limit).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { teamColor } from "@/components/TeamBadge";
import { dismissalText, economy, oversText, strikeRate, totalExtras } from "@/lib/engine/engine";
import type { InningsState, MatchState } from "@/lib/engine/types";
import { computeMatchStats, matchFigures, oversSummary, partnershipsOf } from "@/lib/stats";
import { initials } from "@/lib/validation";

/** One team in the page-1 header: its badge, score and whether it won. */
export type TeamLine = { name: string; score: string; overs: string; note: string; won: boolean };
export type BannerTone = "win" | "tie" | "abandoned" | "neutral";
/** One ball drawn as a bubble in the Full version. */
export type BallBubble = { label: string; kind: "dot" | "run" | "four" | "six" | "wicket" | "extra" };
export type OverRow = { over: number; bowler: string; runs: number; wickets: number; balls: BallBubble[]; notes: string[] };
export type WormSeries = { name: string; side: 1 | 2; points: { x: number; y: number }[]; wickets: { x: number; y: number }[] };

export type Block =
  | { t: "title"; text: string; sub?: string; teams?: TeamLine[]; banner?: { tone: BannerTone; text: string }; version?: string; community?: string }
  | { t: "heading"; text: string; team?: string; right?: string; rightSub?: string }
  | { t: "subheading"; text: string; team?: string }
  | { t: "kv"; rows: [string, string][]; hide?: string[] }
  | { t: "text"; text: string; muted?: boolean; bold?: boolean }
  | { t: "table"; head: string[]; rows: string[][]; widths: number[]; align: ("l" | "r")[]; twoLine?: boolean; strongCol?: number }
  | { t: "bars"; rows: { label: string; value: number; max: number; note: string; wickets?: number }[]; side?: 1 | 2; team?: string; sides?: [string, string] }
  | { t: "bullets"; items: string[]; meters?: { value: number; max: number }[]; overs?: OverRow[] }
  | { t: "glance"; series: WormSeries[]; sides: [string, string]; maxBalls: number; tiles: { label: string; value: string }[] }
  | { t: "qr"; url: string; title: string; text: string }
  | { t: "callout"; tone: "gold" | "calm"; label: string; items: { text: string; team?: string; points?: number; chips?: string[] }[]; notes: string[] };

export type ReportMeta = { dateText: string; venue: string; overs: number; createdBy: string | null; scorers: { name: string; balls: number }[]; appName?: string;
  /** The community's name, printed in the page-1 header. Left out of the public PDF (the public report does not show it). */
  communityName?: string | null;
  /** The address of the public report. Only given while the share link is on; it becomes the QR box. */
  reportUrl?: string | null;
};

const f1 = (n: number) => n.toFixed(1);

function ballKind(r: InningsState["balls"][number]): BallBubble["kind"] {
  if (r.wicket) return "wicket";
  if (r.extra) return "extra";
  if (r.batRuns === 6) return "six";
  if (r.batRuns === 4) return "four";
  return r.teamRuns === 0 ? "dot" : "run";
}

/** Everything in the report, in order. `full` adds the ball-by-ball record. */
export function buildReportBlocks(m: MatchState, meta: ReportMeta, opts: { full: boolean }): Block[] {
  const bpo = m.rules.ballsPerOver;
  const blocks: Block[] = [];
  const { players, pom } = computeMatchStats(m);
  const name = (id: string | null) => (id ? m.players[id]?.name ?? "Player" : "");
  const guest = (id: string) => (m.players[id]?.kind === "guest" ? " (guest)" : "");
  const regularInns = m.innings.filter((i) => !i.superOver);

  // header: both teams with badge, score and winner mark, then the result banner
  const teams: TeamLine[] = ([1, 2] as const).map((s) => {
    const inn = regularInns.find((i) => i.batting === s);
    const first = regularInns[0]?.batting === s;
    return {
      name: m.sides[s - 1],
      score: inn ? `${inn.runs}/${inn.wickets}` : "-",
      overs: inn ? `${oversText(inn.legalBalls, bpo)} ov` : "",
      note: !inn ? "Did not bat" : first ? "Batted first" : inn.target ? `Chased ${inn.target}` : "Batted second",
      won: m.result?.kind === "win" && m.result.winner === s,
    };
  });
  const tone: BannerTone = m.result?.kind === "win" ? "win" : m.result?.kind === "tie" ? "tie" : m.result?.kind === "abandoned" ? "abandoned" : "neutral";
  blocks.push({
    t: "title", text: `${m.sides[0]} v ${m.sides[1]}`, sub: [meta.dateText, meta.venue, `${meta.overs} overs`].filter(Boolean).join("  |  "),
    teams, banner: { tone, text: m.result?.text ?? "No result" }, version: opts.full ? "Full report" : "Short report",
    ...(meta.communityName?.trim() ? { community: meta.communityName.trim() } : {}),
  });
  const kv: [string, string][] = [];
  if (m.toss) kv.push(["Toss", `${m.sides[m.toss.winner - 1]} won the toss and chose to ${m.toss.decision}`]);
  kv.push(["Result", m.result?.text ?? "No result"]);
  kv.push(["Created by", meta.createdBy ?? "-"]);
  if (meta.scorers.length) kv.push(["Scored by", meta.scorers.map((s) => `${s.name} (${s.balls} ball${s.balls === 1 ? "" : "s"})`).join(", ")]);
  blocks.push({ t: "kv", rows: kv, hide: ["Result"] });      // the result is the banner above

  // the match at a glance: worm chart and the key numbers
  const f = matchFigures(m);
  const bpoMax = Math.max(1, ...regularInns.map((i) => Math.max(i.maxOvers * bpo, i.legalBalls)));
  const series: WormSeries[] = regularInns.filter((i) => i.balls.length).map((inn) => {
    let runs = 0, legal = 0;
    const points = [{ x: 0, y: 0 }];
    const wickets: { x: number; y: number }[] = [];
    for (const b of inn.balls) {
      runs += b.teamRuns; if (b.counted) legal++;
      points.push({ x: legal, y: runs });
      if (b.wicket) wickets.push({ x: legal, y: runs });
    }
    return { name: m.sides[inn.batting - 1], side: inn.batting, points, wickets };
  });
  const extrasTotal = f.extras.wide + f.extras.noball + f.extras.bye + f.extras.legbye + f.extras.penalty;
  blocks.push({ t: "glance", series, sides: [m.sides[0], m.sides[1]], maxBalls: bpoMax, tiles: [{ label: "Fours", value: String(f.fours) }, { label: "Sixes", value: String(f.sixes) }, { label: "Dot balls", value: `${f.dotPercent}%` }, { label: "Extras", value: String(extrasTotal) }] });

  // Player of the Match
  if (!pom) {
    blocks.push({ t: "callout", tone: "calm", label: "Player of the Match", items: [], notes: [m.result?.kind === "abandoned" ? "An abandoned match has no Player of the Match." : "No Player of the Match for this result."] });
  } else {
    blocks.push({
      t: "callout", tone: "gold", label: "Player of the Match",
      items: pom.winners.map((id) => {
        const p = players.find((x) => x.entryId === id)!;
        return { text: `${p.name}${guest(id)}: ${p.points} points`, team: m.sides[p.side - 1], points: p.points, chips: (pom.breakdown[id] ?? []).map((x) => `${x.label} ${x.points > 0 ? "+" : ""}${x.points}`) };
      }),
      notes: [`Top three: ${pom.top.map((t, i) => `${i + 1}. ${t.name} ${t.points}`).join("   ")}`, "The app adds up points from the balls scored. Nobody picks the winner."],
    });
  }

  // scorecards
  for (const inn of m.innings) {
    const title = inn.superOver ? "Super over" : `Innings ${inn.index + 1}`;
    const team = m.sides[inn.batting - 1];
    blocks.push({
      t: "heading", text: `${title}: ${team}`, team, right: `${inn.runs}/${inn.wickets}`,
      rightSub: `${oversText(inn.legalBalls, bpo)} ov${inn.legalBalls ? `  |  RR ${((inn.runs * bpo) / inn.legalBalls).toFixed(2)}` : ""}`,
    });
    const batted = Object.values(inn.batters).sort((a, b) => a.order - b.order);
    blocks.push({
      t: "table", head: ["Batter", "How out", "R", "B", "4s", "6s", "SR"], widths: [3, 4, 1, 1, 1, 1, 1.4], align: ["l", "l", "r", "r", "r", "r", "r"], twoLine: true, strongCol: 2,
      rows: batted.map((b) => [`${name(b.id)}${guest(b.id)}`, dismissalText(m, b), String(b.runs), String(b.balls), String(b.fours), String(b.sixes), f1(strikeRate(b))]),
    });
    const dnb = Object.values(m.players).filter((p) => p.side === inn.batting && !inn.batters[p.id] && !m.gone[p.id]);
    if (dnb.length) blocks.push({ t: "text", muted: true, text: `Did not bat: ${dnb.map((p) => p.name).join(", ")}` });
    blocks.push({ t: "text", text: `Extras ${totalExtras(inn)} (wides ${inn.extras.wide}, no balls ${inn.extras.noball}, byes ${inn.extras.bye}, leg-byes ${inn.extras.legbye}${inn.extras.penalty ? `, penalty ${inn.extras.penalty}` : ""})` });
    if (inn.fow.length) blocks.push({ t: "text", muted: true, text: `Fall of wickets: ${inn.fow.map((w) => `${w.n}-${w.runs} (${name(w.player)}, ${w.over} ov)`).join(", ")}` });
    const bowlers = Object.values(inn.bowlers);
    blocks.push({
      t: "table", head: ["Bowler", "O", "M", "R", "W", "Econ"], widths: [4, 1, 1, 1, 1, 1.4], align: ["l", "r", "r", "r", "r", "r"], strongCol: 4,
      rows: bowlers.map((b) => [`${name(b.id)}${guest(b.id)}`, oversText(b.legalBalls, bpo), String(b.maidens), String(b.runs), String(b.wickets), f1(economy(b, bpo))]),
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
      const team = m.sides[inn.batting - 1];
      blocks.push({ t: "subheading", text: `${inn.superOver ? "Super over" : `Innings ${inn.index + 1}`}: ${team}`, team });
      blocks.push({ t: "bars", side: inn.batting, team, sides: [m.sides[0], m.sides[1]], rows: overs.map((o) => ({ label: `Over ${o.over + 1}`, value: o.runs, max, wickets: o.wickets, note: `${o.runs} runs${o.wickets ? `, ${o.wickets} wkt${o.wickets === 1 ? "" : "s"}` : ""} (${name(o.bowler)})` })) });
    }
  }

  // partnerships and top performers
  if (f.bestPartnerships.length) {
    blocks.push({ t: "heading", text: "Best partnerships" });
    const maxRuns = Math.max(1, ...f.bestPartnerships.map((p) => p.runs));
    blocks.push({ t: "bullets", items: f.bestPartnerships.map((p) => `${name(p.a)}${p.b ? ` & ${name(p.b)}` : ""}: ${p.runs} (${p.balls} balls)`), meters: f.bestPartnerships.map((p) => ({ value: p.runs, max: maxRuns })) });
  }
  const tops = [
    ...f.topBatters.map((p) => `${p.name} (${m.sides[p.side - 1]}): ${p.bat.reduce((a, b) => a + b.runs, 0)} off ${p.bat.reduce((a, b) => a + b.balls, 0)}`),
    ...f.topBowlers.map((p) => `${p.name} (${m.sides[p.side - 1]}): ${p.bowl.reduce((a, b) => a + b.wickets, 0)}/${p.bowl.reduce((a, b) => a + b.runs, 0)}`),
  ];
  if (tops.length) { blocks.push({ t: "heading", text: "Top performers" }); blocks.push({ t: "bullets", items: tops }); }

  // changes
  blocks.push({ t: "heading", text: "Changes during the match, and corrections after it" });
  blocks.push(m.timeline.length ? { t: "bullets", items: m.timeline.map((t) => `${t.text}${t.by ? ` (${t.by})` : ""}`) } : { t: "text", muted: true, text: "Nothing was changed." });

  // the QR box: only when the public share link is on
  if (meta.reportUrl) blocks.push({ t: "qr", url: meta.reportUrl, title: "Open the report online", text: "Scan to read the full ball-by-ball record." });

  // ball by ball (full version only): one row per over with the balls as bubbles, and the full sentence of EVERY ball (with the batter and the bowler) under it (decided 2026-11-24)
  if (opts.full) {
    blocks.push({ t: "heading", text: "Ball by ball" });
    for (const inn of m.innings) {
      const team = m.sides[inn.batting - 1];
      blocks.push({ t: "subheading", text: `${inn.superOver ? "Super over" : `Innings ${inn.index + 1}`}: ${team}`, team });
      if (!inn.balls.length) { blocks.push({ t: "text", muted: true, text: "No balls bowled." }); continue; }
      const byOver = new Map<number, InningsState["balls"]>();
      for (const b of inn.balls) byOver.set(b.over, [...(byOver.get(b.over) ?? []), b]);
      const overs: OverRow[] = Array.from(byOver.entries()).sort((a, b) => a[0] - b[0]).map(([over, bs]) => ({
        over: over + 1, bowler: `${name(bs[0]!.bowler)}${guest(bs[0]!.bowler)}`, runs: bs.reduce((a, b) => a + b.teamRuns, 0), wickets: bs.filter((b) => b.wicket).length,
        balls: bs.map((b) => ({ label: b.label, kind: ballKind(b) })), notes: bs.map((b) => b.text),
      }));
      blocks.push({ t: "bullets", items: inn.balls.map((b) => b.text), overs });
    }
  }
  return blocks;
}

/* ---------- QR code ---------- */
/** The QR code of a link as runs of dark modules, row by row (so it can be drawn with plain rectangles). Error correction M. */
export function qrRuns(url: string): { size: number; runs: { row: number; col: number; len: number }[] } {
  const modules = QRCode.create(url, { errorCorrectionLevel: "M" }).modules;
  const size = modules.size;
  const runs: { row: number; col: number; len: number }[] = [];
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!modules.get(row, col)) continue;
      let len = 1;
      while (col + len < size && modules.get(row, col + len)) len++;
      runs.push({ row, col, len });
      col += len;
    }
  }
  return { size, runs };
}
/** One QR module is 1.2 mm or more on paper (3.5 pt), so a phone camera reads it from a printed A4 page. */
const QR_MODULE = 3.5, QR_QUIET = 4;

/* ---------- drawing ---------- */
const CHAR_MAP: Record<string, string> = { "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-", "…": "...", "•": "-", " ": " ", "→": "->", "×": "x" };

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

const PAGE_W = 595.28, PAGE_H = 841.89, MARGIN = 40, BOTTOM = 56, CONTENT_W = PAGE_W - MARGIN * 2;
const INK = rgb(0.09, 0.1, 0.13), MUTED = rgb(0.38, 0.41, 0.48), LINE = rgb(0.82, 0.84, 0.88), SOFT = rgb(0.95, 0.96, 0.98), WHITE = rgb(1, 1, 1);
const NIGHT = rgb(0.043, 0.063, 0.125), GOLD = rgb(0.96, 0.78, 0.29), RED = rgb(0.78, 0.18, 0.2), AMBER = rgb(1, 0.78, 0.4), BLUE_FILL = rgb(0.58, 0.76, 1), GREEN_FILL = rgb(0.5, 0.86, 0.62);
const TONES: Record<BannerTone, { fill: ReturnType<typeof rgb>; edge: ReturnType<typeof rgb> }> = {
  win: { fill: rgb(0.99, 0.94, 0.75), edge: rgb(0.85, 0.62, 0.05) },
  tie: { fill: rgb(0.88, 0.93, 1), edge: rgb(0.2, 0.43, 0.8) },
  abandoned: { fill: rgb(0.99, 0.9, 0.9), edge: rgb(0.78, 0.18, 0.2) },
  neutral: { fill: SOFT, edge: MUTED },
};

const hex = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const darken = (h: string, k: number) => rgb((parseInt(h.slice(1, 3), 16) / 255) * k, (parseInt(h.slice(3, 5), 16) / 255) * k, (parseInt(h.slice(5, 7), 16) / 255) * k);

/** Colours for the two sides in charts: from the team names, but never the same for both sides. */
function chartHex(a: string, b: string): [string, string] {
  const ca = teamColor(a).bg;
  let cb = teamColor(b).bg;
  if (cb === ca) cb = ca === "#5AA9FF" ? "#FFB547" : "#5AA9FF";
  return [ca, cb];
}

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

/** A rounded rectangle as an SVG path, with its top-left corner at (0,0). */
const rrPath = (w: number, h: number, r: number) => {
  r = Math.min(r, w / 2, h / 2);
  return `M ${r} 0 L ${w - r} 0 Q ${w} 0 ${w} ${r} L ${w} ${h - r} Q ${w} ${h} ${w - r} ${h} L ${r} ${h} Q 0 ${h} 0 ${h - r} L 0 ${r} Q 0 0 ${r} 0 Z`;
};
function roundRect(page: PDFPage, x: number, yBottom: number, w: number, h: number, r: number, o: { fill?: ReturnType<typeof rgb>; stroke?: ReturnType<typeof rgb>; width?: number }) {
  page.drawSvgPath(rrPath(w, h, r), { x, y: yBottom + h, color: o.fill, borderColor: o.stroke, borderWidth: o.stroke ? o.width ?? 0.6 : 0 });
}

export async function renderReportPdf(blocks: Block[], opts: { title?: string; appName?: string } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(sanitize(opts.title ?? "Match report"));
  doc.setCreator("Indoor Khelo");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const appName = sanitize(opts.appName ?? "Indoor Khelo");
  const first = blocks[0]?.t === "title" ? blocks[0] : null;
  const headTeams = first?.teams?.map((t) => t.name) ?? [];
  const version = first?.version ?? "";
  let page!: PDFPage;
  let y = 0;

  const textW = (t: string, size: number, f: PDFFont = font) => f.widthOfTextAtSize(t, size);
  const draw = (t: string, x: number, yBase: number, size: number, f: PDFFont = font, color = INK) => page.drawText(sanitize(t), { x, y: yBase, size, font: f, color });
  const drawRight = (t: string, xRight: number, yBase: number, size: number, f: PDFFont = font, color = INK) => { const s = sanitize(t); page.drawText(s, { x: xRight - textW(s, size, f), y: yBase, size, font: f, color }); };
  const drawCentre = (t: string, xMid: number, yBase: number, size: number, f: PDFFont = font, color = INK) => { const s = sanitize(t); page.drawText(s, { x: xMid - textW(s, size, f) / 2, y: yBase, size, font: f, color }); };

  /** The team badge: a rounded square with the team's initials, in the colour made from the team name. */
  const badge = (name: string, x: number, yBottom: number, size: number) => {
    const c = teamColor(name);
    roundRect(page, x, yBottom, size, size, size * 0.24, { fill: hex(c.bg) });
    const ini = sanitize(initials(name));
    const fs = size * (ini.length > 1 ? 0.4 : 0.48);
    drawCentre(ini, x + size / 2, yBottom + size / 2 - fs * 0.35, fs, bold, hex(c.fg));
  };
  const brandMark = (x: number, yBottom: number, size: number) => {
    roundRect(page, x, yBottom, size, size, size * 0.24, { fill: NIGHT });
    drawCentre("IK", x + size / 2, yBottom + size / 2 - size * 0.14, size * 0.4, bold, GOLD);
  };

  const pageHeader = (n: number) => {
    if (n === 1) {
      brandMark(MARGIN, y - 26, 26);
      draw("Match report", MARGIN + 34, y - 12, 13, bold, INK);
      draw(fit(first?.community ? `${appName} · ${first.community}` : appName, font, 8, CONTENT_W - 34 - (version ? textW(sanitize(version), 8.5, bold) + 14 : 0)), MARGIN + 34, y - 23, 8, font, MUTED);
      if (version) drawRight(version, PAGE_W - MARGIN, y - 12, 8.5, bold, MUTED);
      page.drawLine({ start: { x: MARGIN, y: y - 33 }, end: { x: PAGE_W - MARGIN, y: y - 33 }, thickness: 1.4, color: GOLD });
      y -= 44;
    } else {
      brandMark(MARGIN, y - 16, 16);
      draw(appName, MARGIN + 22, y - 12, 9, bold, INK);
      if (headTeams.length === 2) {
        const right = PAGE_W - MARGIN;
        badge(headTeams[1]!, right - 16, y - 16, 16);
        const label = fit(`${headTeams[0]} v ${headTeams[1]}`, bold, 9, 270);
        drawRight(label, right - 22, y - 12, 9, bold, INK);
        badge(headTeams[0]!, right - 22 - textW(label, 9, bold) - 22, y - 16, 16);
      }
      page.drawLine({ start: { x: MARGIN, y: y - 22 }, end: { x: PAGE_W - MARGIN, y: y - 22 }, thickness: 0.8, color: GOLD });
      y -= 32;
    }
  };
  const newPage = () => { page = doc.addPage([PAGE_W, PAGE_H]); y = PAGE_H - MARGIN + 6; pageHeader(doc.getPageCount()); };
  const ensure = (h: number) => { if (y - h < BOTTOM) newPage(); };
  newPage();

  const paragraph = (text: string, size: number, f: PDFFont, color = INK, indent = 0, gap = 3) => {
    const lines = wrap(text, f, size, CONTENT_W - indent);
    for (const l of lines) { ensure(size + 3); page.drawText(l, { x: MARGIN + indent, y: y - size, size, font: f, color }); y -= size + 3; }
    y -= gap;
  };

  /** A name, with "(guest)" turned into a small tag. */
  const nameWithTag = (raw: string, x: number, yBase: number, size: number, f: PDFFont, maxW: number, star: boolean) => {
    const isGuest = raw.endsWith(" (guest)");
    const base = isGuest ? raw.slice(0, -8) : raw;
    const tagW = isGuest ? 28 : 0;
    const starW = star ? textW(" *", size, f) : 0;
    const t = fit(base, f, size, maxW - tagW - starW);
    draw(t, x, yBase, size, f, INK);
    let cx = x + textW(t, size, f);
    if (star) { draw(" *", cx, yBase, size, f, INK); cx += starW; }
    if (isGuest) {
      roundRect(page, cx + 4, yBase - 2, 24, 8.5, 2.5, { stroke: MUTED, width: 0.5 });
      drawCentre("GUEST", cx + 16, yBase + 0.6, 5.5, bold, MUTED);
    }
  };

  const heading = (b: Extract<Block, { t: "heading" }>, extra = 0) => {
    if (b.team) {
      ensure(110); y -= 6;
      roundRect(page, MARGIN, y - 30, CONTENT_W, 30, 6, { fill: SOFT, stroke: LINE });
      badge(b.team, MARGIN + 8, y - 26, 22);
      draw(fit(b.text, bold, 11.5, CONTENT_W - 190), MARGIN + 38, y - 16, 11.5, bold, INK);
      if (b.right) drawRight(b.right, PAGE_W - MARGIN - 10, y - 15, 17, bold, INK);
      if (b.rightSub) drawRight(b.rightSub, PAGE_W - MARGIN - 10, y - 25, 7.5, font, MUTED);
      y -= 36;
      return;
    }
    ensure(60 + extra); y -= 8;
    const t = sanitize(b.text).toUpperCase();
    page.drawText(t, { x: MARGIN, y: y - 9, size: 9, font: bold, color: MUTED });
    y -= 14;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_W - MARGIN, y }, thickness: 0.5, color: LINE });
    y -= 6;
  };

  const titleBlock = (b: Extract<Block, { t: "title" }>) => {
    if (b.teams) {
      b.teams.forEach((t, i) => {
        const h = 40;
        const tied = b.banner?.tone === "tie";
        roundRect(page, MARGIN, y - h, CONTENT_W, h, 8, { fill: t.won ? TONES.win.fill : tied ? TONES.tie.fill : SOFT, stroke: t.won ? TONES.win.edge : LINE, width: t.won ? 1 : 0.5 });
        badge(t.name, MARGIN + 8, y - 34, 28);
        const right = PAGE_W - MARGIN - 12;
        const scoreW = textW(sanitize(t.score), 22, bold) + 38;
        const nameText = fit(t.name, bold, 14.5, CONTENT_W - 58 - scoreW - (t.won ? 40 : 0));
        draw(nameText, MARGIN + 44, y - 17, 14.5, bold, INK);
        if (t.won) {
          const wx = MARGIN + 44 + textW(nameText, 14.5, bold) + 7;
          roundRect(page, wx, y - 18, 28, 11, 3, { fill: GOLD });
          drawCentre("WON", wx + 14, y - 15.4, 7, bold, NIGHT);
        }
        draw(t.note, MARGIN + 44, y - 31, 8.5, font, MUTED);
        drawRight(t.overs, right, y - 17, 8, font, MUTED);
        drawRight(t.score, right - (t.overs ? textW(sanitize(t.overs), 8) + 6 : 0), y - 21, 22, bold, INK);
        y -= h + (i === 0 ? 6 : 8);
      });
    } else paragraph(b.text, 20, bold, INK, 0, 4);
    if (b.banner) {
      const tn = TONES[b.banner.tone];
      const lines = wrap(b.banner.text, bold, 12, CONTENT_W - 28);
      const h = lines.length * 15 + 10;
      ensure(h + 8);
      roundRect(page, MARGIN, y - h, CONTENT_W, h, 7, { fill: tn.fill, stroke: tn.edge, width: 1 });
      page.drawRectangle({ x: MARGIN, y: y - h + 3, width: 4, height: h - 6, color: tn.edge });
      lines.forEach((l, i) => page.drawText(l, { x: MARGIN + 14, y: y - 18 - i * 15, size: 12, font: bold, color: INK }));
      y -= h + 6;
    }
    if (b.sub) paragraph(b.sub, 9, font, MUTED, 0, 4);
  };

  const glance = (b: Extract<Block, { t: "glance" }>) => {
    const H = 132, gap = 10;
    ensure(H + 8);
    const hasWorm = b.series.length > 0;
    const wormW = hasWorm ? 330 : 0;
    const tilesX = MARGIN + (hasWorm ? wormW + gap : 0);
    const tilesW = CONTENT_W - (hasWorm ? wormW + gap : 0);
    const top = y;
    if (hasWorm) {
      roundRect(page, MARGIN, top - H, wormW, H, 8, { stroke: LINE });
      draw("MATCH WORM: RUNS BALL BY BALL", MARGIN + 10, top - 15, 7, bold, MUTED);
      const px = MARGIN + 30, pw = wormW - 30 - 14, pTop = top - 24, ph = 56, pBottom = pTop - ph;
      const maxRuns = Math.max(1, ...b.series.flatMap((s) => s.points.map((p) => p.y)));
      const step = maxRuns <= 40 ? 10 : maxRuns <= 100 ? 20 : maxRuns <= 200 ? 50 : 100;
      const yMax = Math.ceil(maxRuns / step) * step;
      const X = (v: number) => px + (v / b.maxBalls) * pw;
      const Y = (v: number) => pBottom + (v / yMax) * ph;
      for (let v = 0; v <= yMax; v += step) {
        page.drawLine({ start: { x: px, y: Y(v) }, end: { x: px + pw, y: Y(v) }, thickness: 0.3, color: LINE });
        drawRight(String(v), px - 4, Y(v) - 2.5, 6.5, font, MUTED);
      }
      draw("0", px - 2, pBottom - 9, 6.5, font, MUTED);
      drawRight("balls", px + pw, pBottom - 9, 6.5, font, MUTED);
      const [c1, c2] = chartHex(b.sides[0], b.sides[1]);
      const colourFor = (s: WormSeries) => darken(s.side === 1 ? c1 : c2, 0.82);
      for (const s of b.series) {
        const col = colourFor(s);
        for (let i = 1; i < s.points.length; i++) {
          const p = s.points[i - 1]!, q = s.points[i]!;
          page.drawLine({ start: { x: X(p.x), y: Y(p.y) }, end: { x: X(q.x), y: Y(q.y) }, thickness: 1.5, color: col, dashArray: s.side === 2 ? [4, 2.5] : undefined });
        }
      }
      for (const s of b.series) for (const w of s.wickets) page.drawCircle({ x: X(w.x), y: Y(w.y), size: 2.4, color: RED, borderColor: WHITE, borderWidth: 0.6 });
      // legend: badge, name and line sample for each side, then the wicket mark
      let lx = MARGIN + 10;
      const ly = top - H + 24;
      for (const s of b.series) {
        badge(s.name, lx, ly - 3, 11);
        page.drawLine({ start: { x: lx + 15, y: ly + 2.5 }, end: { x: lx + 31, y: ly + 2.5 }, thickness: 1.6, color: colourFor(s), dashArray: s.side === 2 ? [4, 2.5] : undefined });
        const lab = fit(s.name, font, 7.5, 85);
        draw(lab, lx + 35, ly, 7.5, font, INK);
        lx += 35 + textW(lab, 7.5) + 12;
      }
      page.drawCircle({ x: MARGIN + 14, y: top - H + 9, size: 2.8, color: RED });
      draw("Wicket", MARGIN + 20, top - H + 6.5, 7, font, MUTED);
    }
    // key numbers
    roundRect(page, tilesX, top - H, tilesW, H, 8, { stroke: LINE });
    draw("KEY NUMBERS", tilesX + 10, top - 15, 7, bold, MUTED);
    const cols = hasWorm ? 2 : 4, rows = Math.ceil(b.tiles.length / cols);
    const tw = (tilesW - 20 - (cols - 1) * 6) / cols, th = hasWorm ? (H - 30 - 8 - (rows - 1) * 6) / rows : 70;
    b.tiles.forEach((t, i) => {
      const cx = tilesX + 10 + (i % cols) * (tw + 6), cy = top - 24 - Math.floor(i / cols) * (th + 6);
      roundRect(page, cx, cy - th, tw, th, 6, { fill: SOFT });
      draw(t.value, cx + 9, cy - th / 2 + 1, 17, bold, INK);
      draw(t.label, cx + 9, cy - th / 2 - 10, 7.5, font, MUTED);
    });
    y = top - H - 10;
  };

  const callout = (b: Extract<Block, { t: "callout" }>) => {
    const gold = b.tone === "gold";
    const rowsH = b.items.map((it) => {
      let lines = 1, cx = 0;
      const avail = CONTENT_W - 28 - 50 - 70;
      for (const c of it.chips ?? []) { const w = textW(sanitize(c), 7) + 12; if (cx + w > avail) { lines++; cx = 0; } cx += w + 4; }
      return 30 + (it.chips?.length ? lines * 15 : 0);
    });
    const noteLines = b.notes.flatMap((n) => wrap(n, font, 8.5, CONTENT_W));
    const boxH = gold ? 18 + rowsH.reduce((a, x) => a + x, 0) + 4 : 8 + noteLines.length * 12 + 6;
    ensure(boxH + (gold ? noteLines.length * 12 : 0) + 18);
    y -= 2;
    roundRect(page, MARGIN, y - boxH, CONTENT_W, boxH, 8, { fill: gold ? rgb(0.995, 0.96, 0.82) : SOFT, stroke: gold ? TONES.win.edge : LINE, width: gold ? 1 : 0.6 });
    if (gold) {
      draw(b.label.toUpperCase(), MARGIN + 12, y - 13, 7, bold, MUTED);
      let cy = y - 18;
      b.items.forEach((it, i) => {
        if (it.team) badge(it.team, MARGIN + 12, cy - 26, 24);
        const tx = MARGIN + (it.team ? 44 : 12);
        const raw = it.text;
        const isGuest = raw.includes(" (guest)");
        draw(fit(raw, bold, 13, CONTENT_W - (tx - MARGIN) - 90), tx, cy - 14, 13, bold, INK);
        if (it.team) draw(it.team, tx, cy - 25, 8, font, MUTED);
        if (isGuest) { /* the word (guest) stays in the text */ }
        if (it.points !== undefined) {
          drawRight(String(it.points), PAGE_W - MARGIN - 14, cy - 18, 24, bold, INK);
          drawRight("POINTS", PAGE_W - MARGIN - 14, cy - 27, 6.5, bold, MUTED);
        }
        let cx = tx, chipY = cy - 30;
        const avail = CONTENT_W - (tx - MARGIN) - 70;
        for (const c of it.chips ?? []) {
          const s = sanitize(c), w = textW(s, 7) + 10;
          if (cx + w > tx + avail) { cx = tx; chipY -= 15; }
          roundRect(page, cx, chipY - 11, w, 12, 6, { fill: WHITE, stroke: TONES.win.edge, width: 0.5 });
          draw(s, cx + 5, chipY - 7.5, 7, font, INK);
          cx += w + 4;
        }
        cy -= rowsH[i]!;
      });
    } else {
      noteLines.forEach((l, i) => page.drawText(l, { x: MARGIN + 12, y: y - 17 - i * 12, size: 9, font, color: MUTED }));
    }
    y -= boxH + 4;
    if (gold) for (const n of b.notes) paragraph(n, 8, font, MUTED, 2, 1);
    y -= 4;
  };

  /** "Open the report online": the QR code of the public link, drawn as rectangles (black on white, with its quiet zone), and a short caption. */
  const qrBox = (b: Extract<Block, { t: "qr" }>) => {
    const { size, runs } = qrRuns(b.url);
    const side = (size + QR_QUIET * 2) * QR_MODULE;
    ensure(side + 14);
    y -= 4;
    const top = y;
    roundRect(page, MARGIN, top - side, CONTENT_W, side, 8, { fill: WHITE, stroke: LINE });
    const qx = MARGIN + QR_QUIET * QR_MODULE, qy = top - QR_QUIET * QR_MODULE;
    for (const r of runs) page.drawRectangle({ x: qx + r.col * QR_MODULE, y: qy - (r.row + 1) * QR_MODULE - 0.1, width: r.len * QR_MODULE, height: QR_MODULE + 0.1, color: rgb(0, 0, 0) });
    const tx = MARGIN + side + 4, tw = PAGE_W - MARGIN - 14 - tx;
    const caption = wrap(b.text, font, 9, tw), link = wrap(b.url, font, 7.5, tw);
    const textH = 15 + caption.length * 12 + 4 + link.length * 9.5;
    let ty = top - side / 2 + textH / 2;
    draw(fit(b.title, bold, 12, tw), tx, ty - 11, 12, bold, INK); ty -= 15;
    for (const l of caption) { page.drawText(l, { x: tx, y: ty - 9, size: 9, font, color: MUTED }); ty -= 12; }
    ty -= 4;
    for (const l of link) { page.drawText(l, { x: tx, y: ty - 7.5, size: 7.5, font, color: MUTED }); ty -= 9.5; }
    y = top - side - 10;
  };

  const table = (b: Extract<Block, { t: "table" }>) => {
    const total = b.widths.reduce((a, x) => a + x, 0);
    let cols = b.widths.map((w) => (w / total) * CONTENT_W);
    const two = !!b.twoLine;
    if (two) cols = [cols[0]! + cols[1]!, 0, ...cols.slice(2)];     // "How out" sits under the name, so it has no column of its own
    const xs = cols.map((_, i) => MARGIN + cols.slice(0, i).reduce((a, x) => a + x, 0));
    const rowH = two ? 22 : 14;
    const header = () => {
      roundRect(page, MARGIN, y - 14, CONTENT_W, 14, 3, { fill: SOFT });
      b.head.forEach((h, i) => {
        if (two && i === 1) return;
        const t = fit(h.toUpperCase(), bold, 7, cols[i]! - 8);
        if (b.align[i] === "r") drawRight(t, xs[i]! + cols[i]! - 5, y - 9.5, 7, bold, MUTED); else draw(t, xs[i]! + 5, y - 9.5, 7, bold, MUTED);
      });
      y -= 16;
    };
    ensure(20 + rowH * 2 + 4);
    header();
    b.rows.forEach((row, ri) => {
      if (y - rowH < BOTTOM) { newPage(); header(); }       // the header repeats on every page
      if (ri % 2 === 1) page.drawRectangle({ x: MARGIN, y: y - rowH + 1, width: CONTENT_W, height: rowH, color: rgb(0.975, 0.98, 0.99) });
      const base = y - (two ? 10 : 10.5);
      row.forEach((cell, i) => {
        if (two && i === 1) { draw(fit(cell, font, 7.5, cols[0]! - 10), xs[0]! + 5, y - 18.5, 7.5, font, MUTED); return; }
        if (i === 0) { nameWithTag(cell, xs[0]! + 5, base, 9.5, bold, cols[0]! - 10, two && row[1] === "not out"); return; }
        const t = fit(cell, i === b.strongCol ? bold : font, 9.5, cols[i]! - 8);
        drawRight(t, xs[i]! + cols[i]! - 5, base, 9.5, i === b.strongCol ? bold : font, INK);
      });
      y -= rowH;
      page.drawLine({ start: { x: MARGIN, y: y + 1 }, end: { x: PAGE_W - MARGIN, y: y + 1 }, thickness: 0.3, color: LINE });
    });
    y -= 6;
  };

  /** One innings as columns of runs per over, wickets marked with a red W. `xl`/`w` place it, so two short innings can sit side by side. */
  const manhattan = (b: Extract<Block, { t: "bars" }>, xl = MARGIN, w = CONTENT_W, top = y, move = true) => {
    const n = b.rows.length;
    const H = 86;
    if (move) ensure(H + 18);
    const y0 = move ? y : top;
    const slot = Math.min(40, w / n), bw = Math.max(6, slot * 0.55);
    const x0 = xl + (w - slot * n) / 2;
    const base = y0 - H + 12;
    const hMax = 40;
    const [c1, c2] = chartHex(b.sides?.[0] ?? b.team ?? "", b.sides?.[1] ?? "");
    const col = hex(b.side === 2 ? c2 : c1);
    page.drawLine({ start: { x: xl, y: base }, end: { x: xl + w, y: base }, thickness: 0.6, color: LINE });
    b.rows.forEach((r, i) => {
      const bh = Math.max(1.5, (r.value / r.max) * hMax);
      const cx = x0 + i * slot + slot / 2;
      page.drawRectangle({ x: cx - bw / 2, y: base, width: bw, height: bh, color: col, borderColor: darken(b.side === 2 ? c2 : c1, 0.7), borderWidth: 0.5 });
      drawCentre(String(r.value), cx, base + bh + 3, 7.5, bold, INK);
      const w = r.wickets ?? 0;
      if (w) {
        const wy = base + bh + 16;
        page.drawCircle({ x: cx, y: wy, size: 4.6, color: RED });
        drawCentre(w > 1 ? String(w) : "W", cx, wy - 2.3, 6, bold, WHITE);
      }
      drawCentre(String(i + 1), cx, base - 9, 7, font, MUTED);
    });
    draw("Over number", xl, base - 18.5, 6.5, font, MUTED);
    page.drawCircle({ x: xl + w - 66, y: base - 16.5, size: 3.4, color: RED });
    draw("Wicket in the over", xl + w - 60, base - 19, 6.5, font, MUTED);
    if (move) y -= H + 12;
  };

  const bubbleColours: Record<BallBubble["kind"], { fill: ReturnType<typeof rgb> | undefined; stroke: ReturnType<typeof rgb>; text: ReturnType<typeof rgb> }> = {
    dot: { fill: WHITE, stroke: LINE, text: MUTED }, run: { fill: WHITE, stroke: MUTED, text: INK },
    four: { fill: BLUE_FILL, stroke: rgb(0.2, 0.43, 0.8), text: INK }, six: { fill: GREEN_FILL, stroke: rgb(0.1, 0.55, 0.3), text: INK },
    wicket: { fill: RED, stroke: RED, text: WHITE }, extra: { fill: AMBER, stroke: rgb(0.8, 0.55, 0.1), text: INK },
  };
  const bubble = (ball: BallBubble, cx: number, cy: number) => {
    const c = bubbleColours[ball.kind];
    page.drawCircle({ x: cx, y: cy, size: 8, color: c.fill, borderColor: c.stroke, borderWidth: 0.7 });
    const label = sanitize(ball.label);
    const size = Math.min(7.5, 13 / Math.max(1, textW(label, 1, bold)));
    drawCentre(label, cx, cy - size * 0.35, size, bold, c.text);
  };
  const BX = MARGIN + 200, PITCH = 19, PER_LINE = Math.floor((CONTENT_W - 200) / PITCH);
  const legend = () => {
    ensure(26);
    let lx = MARGIN;
    const items: [BallBubble, string][] = [[{ label: "0", kind: "dot" }, "Dot"], [{ label: "4", kind: "four" }, "Four"], [{ label: "6", kind: "six" }, "Six"], [{ label: "W", kind: "wicket" }, "Wicket"], [{ label: "Wd", kind: "extra" }, "Wide, no ball, bye, leg-bye"]];
    for (const [bb, lab] of items) { bubble(bb, lx + 8, y - 10); draw(lab, lx + 19, y - 12.5, 7.5, font, MUTED); lx += 19 + textW(lab, 7.5) + 12; }
    y -= 24;
  };
  const overRows = (rows: OverRow[]) => {
    legend();
    for (const r of rows) {
      const lines = Math.max(1, Math.ceil(r.balls.length / PER_LINE));
      const noteLines = r.notes.flatMap((n) => wrap(n, font, 7.5, CONTENT_W - 30));
      const h = lines * 20 + noteLines.length * 9.5 + 4;
      ensure(h + 2);
      draw(`Ov ${r.over}`, MARGIN + 2, y - 14, 8.5, bold, INK);
      draw(fit(r.bowler, font, 8.5, 108), MARGIN + 34, y - 14, 8.5, font, INK);
      drawRight(`${r.runs} run${r.runs === 1 ? "" : "s"}${r.wickets ? `, ${r.wickets} wkt${r.wickets === 1 ? "" : "s"}` : ""}`, BX - 12, y - 14, 8.5, r.wickets ? bold : font, r.wickets ? RED : INK);
      r.balls.forEach((bb, i) => bubble(bb, BX + (i % PER_LINE) * PITCH + 8, y - 10 - Math.floor(i / PER_LINE) * 20));
      let ny = y - lines * 20 - 1;
      for (const l of noteLines) { draw(l, MARGIN + 30, ny - 6, 7.5, font, MUTED); ny -= 9.5; }
      y -= h;
      page.drawLine({ start: { x: MARGIN, y: y + 1 }, end: { x: PAGE_W - MARGIN, y: y + 1 }, thickness: 0.3, color: LINE });
    }
    y -= 6;
  };

  for (let bi = 0; bi < blocks.length; bi++) {
    const b = blocks[bi]!;
    // two short innings (up to 10 overs each) sit side by side
    const s1 = blocks[bi + 1], s2 = blocks[bi + 2], s3 = blocks[bi + 3];
    if (b.t === "subheading" && b.team && s1?.t === "bars" && s2?.t === "subheading" && s2.team && s3?.t === "bars" && s1.rows.length <= 10 && s3.rows.length <= 10) {
      ensure(86 + 40);
      const colW = (CONTENT_W - 20) / 2, top = y;
      [[b, s1], [s2, s3]].forEach(([sh, bars], i) => {
        const x = MARGIN + i * (colW + 20);
        const hd = sh as Extract<Block, { t: "subheading" }>;
        badge(hd.team!, x, top - 14, 14); draw(fit(hd.text, bold, 10.5, colW - 22), x + 20, top - 11, 10.5, bold, INK);
        manhattan(bars as Extract<Block, { t: "bars" }>, x, colW, top - 20, false);
      });
      y = top - 20 - 86 - 12;
      bi += 3;
      continue;
    }
    if (b.t === "title") titleBlock(b);
    else if (b.t === "heading") heading(b, s1?.t === "subheading" ? 100 : s1?.t === "bullets" ? Math.min(s1.items.length, 8) * 11 + 6 : s1?.t === "text" ? 16 : 0);
    else if (b.t === "subheading") {
      ensure(s1?.t === "bars" ? 130 : 70);
      if (b.team) { badge(b.team, MARGIN, y - 14, 14); draw(fit(b.text, bold, 10.5, CONTENT_W - 22), MARGIN + 20, y - 11, 10.5, bold, INK); y -= 20; }
      else paragraph(b.text, 10.5, bold, INK, 0, 3);
    } else if (b.t === "text") {
      paragraph(b.text, 9, b.bold ? bold : font, b.muted ? MUTED : INK, 0, 3);
    } else if (b.t === "kv") {
      for (const [k, v] of b.rows) {
        if (b.hide?.includes(k)) continue;
        const lines = wrap(v, font, 9, CONTENT_W - 80);
        ensure(lines.length * 12 + 2);
        draw(fit(k, bold, 8.5, 74), MARGIN, y - 9, 8.5, bold, MUTED);
        for (const l of lines) { page.drawText(l, { x: MARGIN + 80, y: y - 9, size: 9, font, color: INK }); y -= 12; }
        y -= 1;
      }
      y -= 4;
    } else if (b.t === "glance") glance(b);
    else if (b.t === "callout") callout(b);
    else if (b.t === "qr") qrBox(b);
    else if (b.t === "table") table(b);
    else if (b.t === "bars") manhattan(b);
    else if (b.t === "bullets") {
      if (b.overs) { overRows(b.overs); continue; }
      const halfW = CONTENT_W / 2 - 16;
      const twoCols = !b.meters && b.items.length >= 3 && b.items.every((it) => textW(sanitize(it), 8.5) <= halfW);
      if (twoCols) {
        const rowsN = Math.ceil(b.items.length / 2);
        ensure(Math.min(rowsN, 6) * 11 + 4);
        for (let r = 0; r < rowsN; r++) {
          if (y - 11 < BOTTOM) newPage();
          [r, r + rowsN].forEach((idx, c) => {
            const item = b.items[idx];
            if (item === undefined) return;
            const x = MARGIN + c * (CONTENT_W / 2);
            page.drawCircle({ x: x + 4, y: y - 6, size: 1.3, color: MUTED });
            page.drawText(sanitize(item), { x: x + 12, y: y - 8.5, size: 8.5, font, color: INK });
          });
          y -= 11;
        }
        y -= 4;
        continue;
      }
      // a short list is kept together on one page
      ensure(b.items.length <= 8 ? b.items.length * 11 + (b.meters ? b.items.length * 4 : 0) + 4 : 24);
      b.items.forEach((item, i) => {
        const lines = wrap(item, font, 8.5, CONTENT_W - 12 - (b.meters ? 150 : 0));
        ensure(lines.length * 11 + (b.meters ? 4 : 0));
        page.drawCircle({ x: MARGIN + 4, y: y - 6, size: 1.3, color: MUTED });
        if (b.meters) {
          const m = b.meters[i]!;
          page.drawRectangle({ x: PAGE_W - MARGIN - 140, y: y - 8, width: 140, height: 6, color: SOFT });
          page.drawRectangle({ x: PAGE_W - MARGIN - 140, y: y - 8, width: Math.max(3, (m.value / m.max) * 140), height: 6, color: hex("#F5C84B") });
        }
        for (const l of lines) { page.drawText(l, { x: MARGIN + 12, y: y - 8.5, size: 8.5, font, color: INK }); y -= 11; }
        if (b.meters) y -= 4;
      });
      y -= 4;
    }
  }

  // footer and page numbers, once the number of pages is known
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN, y: 38 }, end: { x: PAGE_W - MARGIN, y: 38 }, thickness: 0.4, color: LINE });
    p.drawText(`Scored with ${appName}${version ? `  |  ${version}` : ""}`, { x: MARGIN, y: 26, size: 8, font, color: MUTED });
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
