// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PdfActions from "@/components/PdfActions";

const pdfOk = () => ({ ok: true, status: 200, headers: { get: () => "application/pdf" }, blob: async () => new Blob(["%PDF-1.7"], { type: "application/pdf" }) });
const props = { pdfBase: "/api/matches/m1/pdf?communityId=c1", shareUrl: "https://app.example/r/abc", title: "Alpha v Bravo", fileName: "Alpha-v-Bravo.pdf" };

beforeEach(() => { vi.stubGlobal("fetch", vi.fn(async () => pdfOk())); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete (navigator as unknown as Record<string, unknown>).share; delete (navigator as unknown as Record<string, unknown>).canShare; });

describe("PDF actions", () => {
  it("has View, Download and Share, and a Short or Full choice that changes the addresses", () => {
    render(<PdfActions {...props} />);
    const view = screen.getByRole("link", { name: "View PDF" });
    const dl = screen.getByRole("link", { name: "Download PDF" });
    expect(screen.getByRole("button", { name: "Share" })).toBeTruthy();
    expect(view.getAttribute("href")).toBe("/api/matches/m1/pdf?communityId=c1&full=0&download=0");
    expect(view.getAttribute("target")).toBe("_blank");
    expect(dl.getAttribute("href")).toBe("/api/matches/m1/pdf?communityId=c1&full=0&download=1");
    expect(dl.hasAttribute("download")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Full with ball by ball" }));
    expect(screen.getByRole("link", { name: "View PDF" }).getAttribute("href")).toContain("full=1");
    expect(screen.getByRole("link", { name: "Download PDF" }).getAttribute("href")).toContain("full=1&download=1");
    fireEvent.click(screen.getByRole("button", { name: "Short" }));
    expect(screen.getByRole("link", { name: "View PDF" }).getAttribute("href")).toContain("full=0");
  });

  it("works for the public report too (no community in the address)", () => {
    render(<PdfActions {...props} pdfBase="/r/abc/pdf" />);
    expect(screen.getByRole("link", { name: "View PDF" }).getAttribute("href")).toBe("/r/abc/pdf?full=0&download=0");
  });

  it("Share sends the PDF file with the phone's share sheet (WhatsApp is offered there) when files can be shared", async () => {
    const share = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "canShare", { value: vi.fn(() => true), configurable: true });
    Object.defineProperty(navigator, "share", { value: share, configurable: true });
    render(<PdfActions {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await screen.findByText("Shared.");
    expect(share).toHaveBeenCalledTimes(1);
    const arg = (share.mock.calls[0] as unknown as [{ files: File[]; title: string }])[0];
    expect(arg.files[0]!.name).toBe("Alpha-v-Bravo.pdf");
    expect(arg.files[0]!.type).toBe("application/pdf");
    expect(arg.title).toBe("Alpha v Bravo");
    expect(screen.queryByRole("link", { name: "Share link on WhatsApp" })).toBeNull();
  });

  it("closing the share sheet is not an error", async () => {
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    Object.defineProperty(navigator, "share", { value: vi.fn(async () => { throw Object.assign(new Error("cancelled"), { name: "AbortError" }); }), configurable: true });
    render(<PdfActions {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Share" }).hasAttribute("disabled")).toBe(false));
    expect(screen.queryByText(/did not work/)).toBeNull();
  });

  it("when files cannot be shared, it says so plainly and offers the report link on WhatsApp", async () => {
    render(<PdfActions {...props} />);                 // no navigator.share in this browser
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await screen.findByText(/cannot share a PDF file directly/);
    const wa = screen.getByRole("link", { name: "Share link on WhatsApp" });
    expect(wa.getAttribute("href")).toBe(`https://wa.me/?text=${encodeURIComponent("Alpha v Bravo\nhttps://app.example/r/abc")}`);
  });

  it("errors are in words: signed out, server problem, no connection, and a share that fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 401, headers: { get: () => "application/json" } })));
    render(<PdfActions {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await screen.findByText(/sign-in ran out/);
    cleanup();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, headers: { get: () => "application/json" } })));
    render(<PdfActions {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await screen.findByText(/could not be made right now/);
    cleanup();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    render(<PdfActions {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await screen.findByText(/No connection/);
    cleanup();
    vi.stubGlobal("fetch", vi.fn(async () => pdfOk()));
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    Object.defineProperty(navigator, "share", { value: vi.fn(async () => { throw new Error("boom"); }), configurable: true });
    render(<PdfActions {...props} />);
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await screen.findByText(/Sharing did not work/);
  });
});
