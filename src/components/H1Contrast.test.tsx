// Phase H1: WCAG contrast checks for the colours the app really uses.
// Tokens are parsed out of src/app/globals.css (and the component css files that define their own tokens), so a token
// change that breaks a pair fails here. Normal text needs 4.5:1; large text, icons and borders that carry meaning need 3:1.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src");
const cssFiles = [join(SRC, "app", "globals.css"), ...readdirSync(join(SRC, "components")).filter((f) => f.endsWith(".css")).map((f) => join(SRC, "components", f))];
const css = Object.fromEntries(cssFiles.map((f) => [f, readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "")]));
const globals = css[cssFiles[0]];

// ---- tokens -------------------------------------------------------------------------------------------------------
const TOKENS: Record<string, string> = {};
for (const text of Object.values(css)) {
  for (const m of text.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{3,6})\s*;/g)) TOKENS[m[1]] = normHex(m[2]);
}
function normHex(h: string): string {
  let x = h.replace("#", "").toLowerCase();
  if (x.length === 3) x = x.split("").map((c) => c + c).join("");
  return "#" + x;
}
function lum(hex: string): number {
  const h = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
const T = (name: string) => {
  const v = TOKENS[name];
  if (!v) throw new Error(`token ${name} not found in the css`);
  return v;
};
function resolve(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  const m = s.match(/^var\((--[\w-]+)(?:\s*,[^)]*)?\)$/);
  if (m) return TOKENS[m[1]] ?? null;
  if (/^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/.test(s)) return normHex(s);
  return null;
}

const SURFACES = ["--night", "--card", "--card2", "--s1", "--s3"];
const LIT_GREEN = "#4be38a"; // the lighter green/red used for status TEXT (the base tokens are used for fills and borders)
const LIT_RED = "#ff9a9e";

describe("H1 contrast: tokens parsed from the css", () => {
  it("finds every token this test relies on", () => {
    for (const n of ["--night", "--card", "--card2", "--s1", "--s3", "--white", "--mute", "--gold", "--green", "--red", "--blue", "--orange", "--red-solid"]) {
      expect(TOKENS[n], n).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("body text (white) and muted text pass AA on every dark surface", () => {
    for (const s of SURFACES) {
      expect(ratio(T("--white"), T(s)), `white on ${s}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(T("--mute"), T(s)), `mute on ${s}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("gold, blue and orange text pass AA on night, card and card2", () => {
    for (const c of ["--gold", "--blue", "--orange"]) {
      for (const s of ["--night", "--card", "--card2"]) expect(ratio(T(c), T(s)), `${c} on ${s}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("green text (base token and the lit text green) passes AA on night, card and card2", () => {
    for (const s of ["--night", "--card", "--card2"]) {
      expect(ratio(T("--green"), T(s)), `green on ${s}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(LIT_GREEN, T(s)), `lit green on ${s}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("red: the lit red is the TEXT colour (AA everywhere); the base --red is for fills and borders (3:1) and AA on night only", () => {
    for (const s of ["--night", "--card", "--card2"]) {
      expect(ratio(LIT_RED, T(s)), `lit red text on ${s}`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(T("--red"), T(s)), `red border on ${s}`).toBeGreaterThanOrEqual(3);
    }
    expect(ratio(T("--red"), T("--night"))).toBeGreaterThanOrEqual(4.5);
  });

  it("no rule uses the base --red as a text colour (it is below 4.5:1 on card and card2)", () => {
    const offenders: string[] = [];
    for (const [f, text] of Object.entries(css)) {
      for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
        if (/(^|[;\s])color:\s*var\(--red\)/.test(m[2])) offenders.push(`${f.split(/[\\/]/).pop()}: ${m[1].trim()}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("dark text (night) on gold, green, red, orange and blue buttons and chips passes AA", () => {
    for (const c of ["--gold", "--green", "--red", "--orange", "--blue"]) expect(ratio(T("--night"), T(c)), `night on ${c}`).toBeGreaterThanOrEqual(4.5);
    expect(ratio("#1a1205", T("--orange")), "dark brown on orange (armed pad key)").toBeGreaterThanOrEqual(4.5);
    expect(ratio("#1f1f1f", "#ffffff"), "Google button").toBeGreaterThanOrEqual(4.5);
  });

  it("white text on a solid red passes AA (--red-solid; white on the base --red is only about 3.9:1)", () => {
    expect(ratio("#ffffff", T("--red-solid"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio("#ffffff", T("--ps-red-solid"))).toBeGreaterThanOrEqual(4.5);
    expect(ratio("#ffffff", T("--red"))).toBeLessThan(4.5); // documents why the extra token exists
  });

  it("the focus ring (gold) is at least 3:1 on night, card, card2 and against the gold button's neighbours", () => {
    for (const s of ["--night", "--card", "--card2", "--s1", "--s3"]) expect(ratio(T("--gold"), T(s)), `ring on ${s}`).toBeGreaterThanOrEqual(3);
    expect(globals).toMatch(/:focus-visible\s*\{\s*outline:\s*2px solid var\(--gold\);\s*outline-offset:\s*2px/);
  });

  it("status borders (green, red, orange, blue, gold) pass the 3:1 non-text rule on card and card2", () => {
    for (const c of ["--green", "--red", "--orange", "--blue", "--gold"]) {
      for (const s of ["--card", "--card2"]) expect(ratio(T(c), T(s)), `${c} border on ${s}`).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("H1 contrast: every colour pair actually written in the css", () => {
  type Pair = { file: string; sel: string; fg: string; bg: string; r: number };
  const pairs: Pair[] = [];
  const lightTextOnly: { file: string; sel: string; fg: string }[] = [];
  for (const [f, text] of Object.entries(css)) {
    for (const m of text.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
      const body = m[2];
      const col = body.match(/(?<![-\w])color:\s*([^;]+)/)?.[1];
      const bgv = body.match(/(?<![-\w])background(?:-color)?:\s*([^;]+)/)?.[1];
      const fg = resolve(col);
      const bg = resolve(bgv);
      const file = f.split(/[\\/]/).pop()!;
      if (fg && bg) pairs.push({ file, sel: m[1].trim(), fg, bg, r: ratio(fg, bg) });
      else if (fg && lum(fg) > 0.25) lightTextOnly.push({ file, sel: m[1].trim(), fg });
    }
  }

  it("parsed a meaningful number of pairs", () => {
    expect(pairs.length).toBeGreaterThan(60);
    expect(lightTextOnly.length).toBeGreaterThan(100);
  });

  it("every rule that sets both a text colour and a plain background reaches 4.5:1", () => {
    const bad = pairs.filter((p) => p.r < 4.5).map((p) => `${p.file}: ${p.sel} ${p.fg} on ${p.bg} = ${p.r.toFixed(2)}`);
    expect(bad).toEqual([]);
  });

  it("every light text colour written on its own reaches 4.5:1 on the lightest surface it can sit on (card2)", () => {
    const bad = lightTextOnly.filter((t) => ratio(t.fg, T("--card2")) < 4.5).map((t) => `${t.file}: ${t.sel} ${t.fg} on card2 = ${ratio(t.fg, T("--card2")).toFixed(2)}`);
    expect(bad).toEqual([]);
  });

  it("placeholder text uses a colour that passes AA on the field backgrounds", () => {
    const bad: string[] = [];
    for (const [f, text] of Object.entries(css)) {
      for (const m of text.matchAll(/([^{}]*::placeholder[^{}]*)\{([^{}]*)\}/g)) {
        const c = resolve(m[2].match(/(?<![-\w])color:\s*([^;]+)/)?.[1]);
        if (c && ratio(c, T("--card2")) < 4.5) bad.push(`${f.split(/[\\/]/).pop()}: ${m[1].trim()} ${c}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
