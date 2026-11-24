// @vitest-environment jsdom
// Phase D4 (UI redesign): the PDF actions card. Segmented Short/Full with a page hint, three equal buttons, honest progress,
// and every message with an icon, plain words and the next step.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PdfActions from "@/components/PdfActions";

const pdfOk = () => ({ ok: true, status: 200, headers: { get: () => "application/pdf" }, blob: async () => new Blob(["%PDF-1.7"], { type: "application/pdf" }) });
const failWith = (status: number) => ({ ok: false, status, headers: { get: () => "application/json" } });
const props = { pdfBase: "/api/matches/m1/pdf?communityId=c1", shareUrl: "https://app.example/r/abc", title: "Alpha v Bravo", fileName: "Alpha-v-Bravo.pdf" };
const canShare = (share: () => Promise<void>) => {
  Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
  Object.defineProperty(navigator, "share", { value: share, configurable: true });
};

beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async () => pdfOk())); });
afterEach(() => {
  cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); vi.restoreAllMocks();
  delete (navigator as unknown as Record<string, unknown>).share; delete (navigator as unknown as Record<string, unknown>).canShare;
});
const clickShare = () => fireEvent.click(screen.getByRole("button", { name: "Share" }));

describe("idle: Short or Full, View, Download and Share", () => {
  it("Short is selected by default; the choice is a pressed button in a labelled group, and the hint says how many pages", () => {
    render(<PdfActions {...props} />);
    const group = screen.getByRole("group", { name: "How much to include" });
    expect(group).toBeTruthy();
    expect(screen.getByRole("button", { name: "Short" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Full with ball by ball" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText("Scorecards, Player of the Match and stats. About 2 pages.")).toBeTruthy();
    expect(group.getAttribute("aria-describedby")).toBeTruthy();
  });
  it("choosing Full changes the hint, the preview (a second page behind) and both addresses", () => {
    const { container } = render(<PdfActions {...props} />);
    expect(container.querySelector(".pd-prev.full")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Full with ball by ball" }));
    expect(screen.getByText("Everything, including every ball. Usually 4 pages or more.")).toBeTruthy();
    expect(container.querySelector(".pd-prev.full")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Full with ball by ball" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("link", { name: "View PDF" }).getAttribute("href")).toBe("/api/matches/m1/pdf?communityId=c1&full=1&download=0");
    expect(screen.getByRole("link", { name: "Download PDF" }).getAttribute("href")).toBe("/api/matches/m1/pdf?communityId=c1&full=1&download=1");
  });
  it("View opens in a new tab safely, Download keeps the file name; every icon is hidden from screen readers; the preview is decoration", () => {
    const { container } = render(<PdfActions {...props} />);
    const view = screen.getByRole("link", { name: "View PDF" });
    expect(view.getAttribute("target")).toBe("_blank");
    expect(view.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByRole("link", { name: "Download PDF" }).getAttribute("download")).toBe("Alpha-v-Bravo.pdf");
    expect(container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(3);
    expect([...container.querySelectorAll("svg")].every((s) => s.getAttribute("aria-hidden") === "true")).toBe(true);
    expect(container.querySelector(".pd-prev")!.getAttribute("aria-hidden")).toBe("true");
  });
  it("works without a file name (the old default) and for the public link", () => {
    render(<PdfActions pdfBase="/r/abc/pdf" shareUrl="https://app.example/r/abc" title="A v B" />);
    expect(screen.getByRole("link", { name: "Download PDF" }).getAttribute("download")).toBe("match-report.pdf");
    expect(screen.getByRole("link", { name: "View PDF" }).getAttribute("href")).toBe("/r/abc/pdf?full=0&download=0");
  });
});

describe("Share in progress and finished", () => {
  it("shows a spinner with Preparing…; Share cannot be pressed twice, but View and Download stay usable", async () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const { container } = render(<PdfActions {...props} />);
    clickShare();
    const busy = await screen.findByRole("button", { name: "Preparing…" });
    expect(busy.hasAttribute("disabled")).toBe(true);
    expect(busy.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector(".pd-spin, svg")).toBeTruthy();
    expect(screen.getByRole("link", { name: "View PDF" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Download PDF" })).toBeTruthy();
    expect(screen.queryByText(/Still preparing/)).toBeNull();
  });
  it("after a long wait it says it is still working, so a slow signal does not look frozen", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<PdfActions {...props} />);
    clickShare();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.queryByText(/Still preparing/)).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(screen.getByText(/Still preparing/)).toBeTruthy();
  });
  it("success is a green message with a tick: Shared.", async () => {
    canShare(async () => undefined);
    const { container } = render(<PdfActions {...props} />);
    clickShare();
    const msg = await screen.findByText("Shared.");
    expect(msg.closest(".pd-note")!.className).toContain("ok");
    expect(msg.closest("[role=status]")).toBeTruthy();
    expect(container.querySelector(".pd-note svg")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Share" }).hasAttribute("disabled")).toBe(false);
  });
});

describe("when the file cannot be shared", () => {
  it("a calm information message, then the WhatsApp link button (not styled as an error)", async () => {
    render(<PdfActions {...props} />);
    clickShare();
    const msg = await screen.findByText(/cannot share a PDF file directly/);
    expect(msg.closest(".pd-note")!.className).toContain("quiet");
    expect(msg.closest(".pd-note")!.className).not.toContain("red");
    const wa = screen.getByRole("link", { name: "Share link on WhatsApp" });
    expect(wa.getAttribute("href")).toBe(`https://wa.me/?text=${encodeURIComponent("Alpha v Bravo\nhttps://app.example/r/abc")}`);
    expect(wa.getAttribute("target")).toBe("_blank");
  });
});

describe("errors say what happened and give the next step", () => {
  it("401: a red message and a Sign in again button that goes to the sign-in page", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => failWith(401)));
    render(<PdfActions {...props} />);
    clickShare();
    const msg = await screen.findByText(/sign-in ran out/);
    expect(msg.closest(".pd-note")!.className).toContain("red");
    expect(screen.getByRole("link", { name: "Sign in again" }).getAttribute("href")).toBe("/");
  });
  it("500 or not a PDF: Try again asks again and works the second time", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(failWith(500))
      .mockResolvedValueOnce({ ok: true, status: 200, headers: { get: () => "text/html" } })
      .mockResolvedValue(pdfOk());
    vi.stubGlobal("fetch", fetchMock);
    canShare(async () => undefined);
    render(<PdfActions {...props} />);
    clickShare();
    await screen.findByText(/could not be made right now/);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await screen.findByText(/could not be made right now/);          // a 200 that is not a PDF is also an error
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Shared.");
    expect(screen.queryByText(/could not be made/)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
  it("no connection: a quiet message with Try again, and View and Download are disabled with that reason until the signal returns", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    render(<PdfActions {...props} />);
    clickShare();
    const msg = await screen.findByText(/No connection/);
    expect(msg.closest(".pd-note")!.className).toContain("quiet");
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
    const view = screen.getByRole("button", { name: "View PDF" });
    const dl = screen.getByRole("button", { name: "Download PDF" });
    expect(view.getAttribute("aria-disabled")).toBe("true");
    expect(dl.getAttribute("aria-disabled")).toBe("true");
    expect(document.getElementById(view.getAttribute("aria-describedby")!)!.textContent).toMatch(/No connection/);
    expect(screen.queryByRole("link", { name: "View PDF" })).toBeNull();
    act(() => { window.dispatchEvent(new Event("online")); });
    await waitFor(() => expect(screen.getByRole("link", { name: "View PDF" })).toBeTruthy());
    expect(screen.queryByText(/No connection/)).toBeNull();
  });
  it("already offline when the card opens: View and Download are disabled with a reason, and come back when online", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(<PdfActions {...props} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "View PDF" }).getAttribute("aria-disabled")).toBe("true"));
    expect(screen.getByText(/You are offline/)).toBeTruthy();
    act(() => { window.dispatchEvent(new Event("online")); });
    await waitFor(() => expect(screen.getByRole("link", { name: "View PDF" })).toBeTruthy());
  });
  it("sharing did not work: a red message with a Download PDF link right next to it", async () => {
    canShare(async () => { throw new Error("boom"); });
    render(<PdfActions {...props} />);
    clickShare();
    const msg = await screen.findByText(/Sharing did not work/);
    const inNote = msg.closest(".pd-note") as HTMLElement;
    expect(inNote.className).toContain("red");
    const links = [...inNote.querySelectorAll("a")];
    expect(links).toHaveLength(1);
    expect(links[0]!.textContent).toBe("Download PDF");
    expect(links[0]!.getAttribute("href")).toBe("/api/matches/m1/pdf?communityId=c1&full=0&download=1");
    expect(links[0]!.getAttribute("download")).toBe("Alpha-v-Bravo.pdf");
  });
  it("closing the share sheet says nothing, and the card goes back to idle", async () => {
    canShare(async () => { throw Object.assign(new Error("cancelled"), { name: "AbortError" }); });
    const { container } = render(<PdfActions {...props} />);
    clickShare();
    await waitFor(() => expect(screen.getByRole("button", { name: "Share" }).hasAttribute("disabled")).toBe(false));
    expect(container.querySelector(".pd-note")).toBeNull();
  });
  it("the message is cleared when Share is tried again", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(failWith(500)).mockImplementation(() => new Promise(() => {}));
    vi.stubGlobal("fetch", fetchMock);
    render(<PdfActions {...props} />);
    clickShare();
    await screen.findByText(/could not be made/);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByText(/could not be made/)).toBeNull());
  });
  it("leaving the page while preparing does not update anything afterwards", async () => {
    let release!: (v: unknown) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((r) => { release = r; })));
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = render(<PdfActions {...props} />);
    clickShare();
    await screen.findByText("Preparing…");
    unmount();
    await act(async () => { release(failWith(500)); });
    expect(err).not.toHaveBeenCalled();
  });
});
