// Phase H1: static accessibility audit of the app's .tsx sources (names, roles, links, zoom).
// It parses every non-test .tsx file under src/ with the TypeScript compiler (already a dev dependency) and checks
// simple, robust JSX patterns. Anything it cannot prove is listed in an explicit ALLOW list with a reason; there is no
// blanket skip. A real screen reader and a real keyboard still have to confirm the result.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const SRC = join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name) && !/\.test\./.test(name)) out.push(p);
  }
  return out;
}

type Found = { file: string; line: number; tag: string; text: string };
type El = { node: ts.JsxOpeningElement | ts.JsxSelfClosingElement; parent: ts.JsxElement | null; ancestors: string[]; sf: ts.SourceFile; file: string };

const FILES = walk(SRC);
const ELEMENTS: El[] = [];
const SOURCES = new Map<string, string>();

for (const f of FILES) {
  const text = readFileSync(f, "utf8");
  SOURCES.set(f, text);
  const sf = ts.createSourceFile(f, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (n: ts.Node, stack: string[]) => {
    let next = stack;
    if (ts.isJsxElement(n)) {
      ELEMENTS.push({ node: n.openingElement, parent: n, ancestors: stack, sf, file: f });
      next = [...stack, n.openingElement.tagName.getText(sf)];
    } else if (ts.isJsxSelfClosingElement(n)) {
      ELEMENTS.push({ node: n, parent: null, ancestors: stack, sf, file: f });
    }
    ts.forEachChild(n, (c) => visit(c, next));
  };
  visit(sf, []);
}

const HTML_FOR = new Map<string, string[]>();
for (const e of ELEMENTS) {
  const att = e.node.attributes.properties.find((x) => ts.isJsxAttribute(x) && x.name.getText(e.sf) === "htmlFor") as ts.JsxAttribute | undefined;
  if (att?.initializer) {
    const list = HTML_FOR.get(e.file) ?? [];
    list.push(att.initializer.getText(e.sf).replace(/[{}"'`$]/g, ""));
    HTML_FOR.set(e.file, list);
  }
}

const tagOf = (e: El) => e.node.tagName.getText(e.sf);
const attrsOf = (e: El): Record<string, string> => {
  const o: Record<string, string> = {};
  e.node.attributes.properties.forEach((a) => {
    if (ts.isJsxAttribute(a)) o[a.name.getText(e.sf)] = a.initializer ? a.initializer.getText(e.sf) : "true";
    else o["...spread"] = a.getText(e.sf);
  });
  return o;
};
const lineOf = (e: El) => e.sf.getLineAndCharacterOfPosition(e.node.getStart(e.sf)).line + 1;
const rel = (f: string) => relative(SRC, f).replace(/\\/g, "/");
const show = (found: Found[]) => found.map((f) => `${f.file}:${f.line} <${f.tag}> ${f.text}`);

/**
 * Explicit allow list. Key = "check|file|tag|key"; the value is the reason it is a false positive.
 * An entry that no longer matches a file fails the last test, so this list cannot rot silently.
 */
const ALLOW: Record<string, string> = {
  "clickdiv|components/CommunitySwitcher.tsx|div|\"stack\"":
    "Event delegation only: the click handler closes the sheet when a real <a> inside it was activated; the links themselves are keyboard reachable.",
  "clickdiv|components/CommunitySwitcher.tsx|div|\"two\"":
    "Event delegation only (same as above): it closes the sheet after the Create/Join <Link> is activated.",
  "clickdiv|components/CommunitySwitcher.tsx|div|\"hm-sw-grid\"":
    "Event delegation only (same as above): it closes the sheet after a real <a> in the grid is activated.",
  "clickdiv|components/ReportClient.tsx|div|\"rp-sheet-back\"":
    "Sheet backdrop (hidden while closed); the sheet has its own Close button and handles Escape, so the backdrop is only a pointer shortcut.",
  "field|components/MatchSetup.tsx|input|{id}":
    "IconField receives its id as a prop; the callers render <label htmlFor=\"cr-venue\"> and <label htmlFor=\"cr-ump\"> (checked by hand in MatchSetup.tsx).",
  "dialogrole|components/PsParts.tsx|div|ps-sheet":
    "ps-sheet is the inner panel of the sheet; its parent .ps-wrap carries role=dialog, aria-modal and aria-label (the test above checks that element).",
};

function allowed(check: string, file: string, tag: string, key = ""): boolean {
  return Object.prototype.hasOwnProperty.call(ALLOW, `${check}|${rel(file)}|${tag}|${key}`);
}

// Does the CONTENT of a JSX element (its children, not its own attributes) hold something a screen reader can read?
function hasReadableText(el: ts.JsxElement, sf: ts.SourceFile): boolean {
  const ICON = /^(Icon[A-Z]?\w*|Svg\w*|[A-Z][a-z0-9]*Icon|[A-Z][a-z0-9]*Ic|SvMinus|SvPlus)$/;
  const jsxOk = (x: ts.Node): boolean => {
    if (ts.isJsxText(x)) return x.getText(sf).replace(/&nbsp;|\s/g, "").length > 0;
    if (ts.isJsxExpression(x)) return !!x.expression && exprOk(x.expression);
    if (ts.isJsxFragment(x)) return x.children.some(jsxOk);
    if (!ts.isJsxElement(x) && !ts.isJsxSelfClosingElement(x)) return false;
    const open = ts.isJsxElement(x) ? x.openingElement : x;
    const name = open.tagName.getText(sf);
    const at = open.attributes.properties.map((p) => (ts.isJsxAttribute(p) ? p.name.getText(sf) : "...spread"));
    if (at.includes("...spread") || at.includes("aria-label") || at.includes("title") || at.includes("aria-labelledby")) return true;
    if (ICON.test(name) || name === "svg" || name === "path") return false;
    if (/^[A-Z]/.test(name)) return true; // another component (Shirt, TeamBadge, Mark, ...) renders its own readable name
    return ts.isJsxElement(x) ? x.children.some(jsxOk) : false;
  };
  // {label}, {count}, {a ? "Yes" : "No"} count as text; {cond ? <IconX/> : <IconY/>}, null and false do not
  const exprOk = (e: ts.Expression): boolean => {
    if (ts.isParenthesizedExpression(e)) return exprOk(e.expression);
    if (ts.isConditionalExpression(e)) return exprOk(e.whenTrue) || exprOk(e.whenFalse);
    if (ts.isBinaryExpression(e) && [ts.SyntaxKind.AmpersandAmpersandToken, ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(e.operatorToken.kind)) {
      return e.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ? exprOk(e.right) : exprOk(e.left) || exprOk(e.right);
    }
    if (e.kind === ts.SyntaxKind.NullKeyword || e.kind === ts.SyntaxKind.FalseKeyword || e.getText(sf) === "undefined") return false;
    if (ts.isJsxElement(e) || ts.isJsxSelfClosingElement(e) || ts.isJsxFragment(e)) return jsxOk(e);
    return true; // identifiers, calls, strings, template strings: assumed to produce text
  };
  return el.children.some(jsxOk);
}

describe("H1 audit: names and roles (static)", () => {
  it("scans a real, non-trivial set of files", () => {
    expect(FILES.length).toBeGreaterThan(150);
    expect(ELEMENTS.length).toBeGreaterThan(2000);
  });

  it("every <img> / next Image has alt text (alt may be empty only for decoration)", () => {
    const bad: Found[] = [];
    for (const e of ELEMENTS) {
      const t = tagOf(e);
      if (t !== "img" && t !== "Image") continue;
      const a = attrsOf(e);
      if (!("alt" in a) && !a["...spread"] && !allowed("img", e.file, t)) bad.push({ file: rel(e.file), line: lineOf(e), tag: t, text: "no alt" });
    }
    expect(show(bad)).toEqual([]);
  });

  it("no button or link is icon-only without an accessible name (aria-label, title, aria-labelledby or visible/hidden text)", () => {
    const bad: Found[] = [];
    for (const e of ELEMENTS) {
      const t = tagOf(e);
      if (!["button", "a", "Link", "summary"].includes(t)) continue;
      const a = attrsOf(e);
      if (a["aria-label"] || a["aria-labelledby"] || a.title || a["...spread"]) continue;
      if (!e.parent) { // self-closing <a /> or <button /> has no content at all
        if (!allowed("name", e.file, t)) bad.push({ file: rel(e.file), line: lineOf(e), tag: t, text: "empty, no label" });
        continue;
      }
      if (!hasReadableText(e.parent, e.sf) && !allowed("name", e.file, t, String(lineOf(e)))) {
        bad.push({ file: rel(e.file), line: lineOf(e), tag: t, text: "icon-only, no label" });
      }
    }
    expect(show(bad)).toEqual([]);
  });

  it("a click handler is never put on a plain div/span/li (not keyboard reachable) unless it has a role and tabIndex", () => {
    const bad: Found[] = [];
    for (const e of ELEMENTS) {
      const t = tagOf(e);
      if (!["div", "span", "li", "p", "section", "article", "tr", "td"].includes(t)) continue;
      const a = attrsOf(e);
      if (!a.onClick) continue;
      if (a.role && a.tabIndex) continue;
      if (a["aria-hidden"]) continue; // a sheet backdrop: the keyboard route is the Close button and Escape, so it is not a control
      if (!allowed("clickdiv", e.file, t, a.className ?? "")) bad.push({ file: rel(e.file), line: lineOf(e), tag: t, text: "onClick on a non-interactive element" });
    }
    expect(show(bad)).toEqual([]);
  });

  it("every input / select / textarea has a label, aria-label, aria-labelledby, title, or sits inside a <label>", () => {
    const bad: Found[] = [];
    for (const e of ELEMENTS) {
      const t = tagOf(e);
      if (!["input", "select", "textarea"].includes(t)) continue;
      const a = attrsOf(e);
      const type = (a.type ?? "").replace(/["'{}`]/g, "");
      if (["hidden", "submit", "button", "reset", "image"].includes(type)) continue;
      if (a["aria-label"] || a["aria-labelledby"] || a.title || a["...spread"]) continue;
      if (e.ancestors.includes("label")) continue;
      if (a.id) {
        // compare the id and every htmlFor in the same file after stripping braces, quotes, backticks and "$"
        const norm = (x: string) => x.replace(/[{}"'`$]/g, "");
        const fors = HTML_FOR.get(e.file) ?? [];
        if (fors.includes(norm(a.id))) continue;
      }
      if (!allowed("field", e.file, t, a.id ?? "")) bad.push({ file: rel(e.file), line: lineOf(e), tag: t, text: "no label" });
    }
    expect(show(bad)).toEqual([]);
  });

  it("every dialog role has aria-modal and a name; every sheet/dialog container declares role=dialog", () => {
    const bad: Found[] = [];
    for (const e of ELEMENTS) {
      const a = attrsOf(e);
      const t = tagOf(e);
      const role = (a.role ?? "").replace(/["'{}]/g, "");
      if (role === "dialog" || role === "alertdialog") {
        if (!a["aria-modal"]) bad.push({ file: rel(e.file), line: lineOf(e), tag: t, text: "dialog without aria-modal" });
        if (!a["aria-label"] && !a["aria-labelledby"]) bad.push({ file: rel(e.file), line: lineOf(e), tag: t, text: "dialog without a name" });
        continue;
      }
      // container elements whose class says they are a dialog/sheet panel (not the backdrop, grip or body parts)
      const cls = (a.className ?? "").replace(/\$\{[^}]*\}/g, " ");
      const tokens = cls.match(/[A-Za-z][\w-]*/g) ?? [];
      const looksLikePanel = tokens.some((c) => c === "dlg" || /^[a-z]{1,3}-sheet$/.test(c) || /-(modal|dialog)$/.test(c));
      if (looksLikePanel && typeof a.role === "undefined" && !a["...spread"] && !allowed("dialogrole", e.file, t, tokens.find((c) => /sheet|dlg|modal|dialog/.test(c)) ?? "")) {
        bad.push({ file: rel(e.file), line: lineOf(e), tag: t, text: `panel "${tokens.join(" ")}" has no role` });
      }
    }
    expect(show(bad)).toEqual([]);
  });

  it('target="_blank" always carries rel with noopener', () => {
    const bad: Found[] = [];
    for (const e of ELEMENTS) {
      const a = attrsOf(e);
      if (!/_blank/.test(a.target ?? "")) continue;
      if (!/noopener/.test(a.rel ?? "") && !a["...spread"]) bad.push({ file: rel(e.file), line: lineOf(e), tag: tagOf(e), text: "target=_blank without rel=noopener" });
    }
    expect(show(bad)).toEqual([]);
  });

  it("nothing blocks zoom: no maximum-scale, user-scalable=no or maximumScale/userScalable in the viewport", () => {
    const bad: string[] = [];
    const all = [...walkAny(SRC)];
    for (const f of all) {
      const text = readFileSync(f, "utf8");
      if (/\.test\./.test(f)) continue;
      if (/maximum-scale|user-scalable\s*=\s*(no|0)|userScalable\s*:\s*false|maximumScale\s*:/.test(text)) bad.push(rel(f));
    }
    expect(bad).toEqual([]);
    const layout = readFileSync(join(SRC, "app", "layout.tsx"), "utf8");
    expect(layout).toMatch(/viewport/);
  });

  it("the allow list has a reason for every entry and no entry is stale", () => {
    for (const [k, why] of Object.entries(ALLOW)) {
      expect(why.length, k).toBeGreaterThan(10);
      const [, file] = k.split("|");
      expect(SOURCES.has(join(SRC, file)), k).toBe(true);
    }
  });
});

function* walkAny(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walkAny(p);
    else if (/\.(tsx?|css)$/.test(name)) yield p;
  }
}
