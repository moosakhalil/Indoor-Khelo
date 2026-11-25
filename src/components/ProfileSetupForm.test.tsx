// @vitest-environment jsdom
// "Tell us how you play": the optional profile step after the first number.
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({ default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => <a href={href} {...rest}>{children}</a> }));
const h = vi.hoisted(() => ({ calls: [] as FormData[], result: {} as { error?: string } }));
vi.mock("@/app/actions3", () => ({ saveProfileSetupAction: async (_p: unknown, fd: FormData) => { h.calls.push(fd); return h.result; } }));

import ProfileSetupForm from "@/components/ProfileSetupForm";

afterEach(() => { cleanup(); h.calls = []; h.result = {}; });

const draw = (isNew = false) => render(<ProfileSetupForm communityId="c1" isNew={isNew} skipHref={isNew ? "/c/c1/invite?new=1" : "/c/c1"} />);

describe("Profile setup form", () => {
  it("asks all four questions, each with Not set, and starts with nothing chosen", () => {
    draw();
    for (const g of ["Playing role", "Batting hand", "Batting position", "Bowling style"]) {
      const group = screen.getByRole("radiogroup", { name: g });
      const notSet = within(group).getByRole("radio", { name: /Not set/ }) as HTMLInputElement;
      expect(notSet.checked).toBe(true);
    }
  });

  it("Skip for now is a plain link that goes straight on (home, or the invite page for a creator)", () => {
    draw();
    expect(screen.getByRole("link", { name: "Skip for now" }).getAttribute("href")).toBe("/c/c1");
    cleanup();
    draw(true);
    expect(screen.getByRole("link", { name: "Skip for now" }).getAttribute("href")).toBe("/c/c1/invite?new=1");
  });

  it("saving with only the role chosen sends the role and leaves the rest empty", async () => {
    const { container } = draw();
    const role = screen.getByRole("radiogroup", { name: "Playing role" });
    const first = within(role).getAllByRole("radio").find((r) => (r as HTMLInputElement).value !== "") as HTMLInputElement;
    fireEvent.click(first);
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    const fd = h.calls[0]!;
    expect(fd.get("playingRole")).toBe(first.value);
    expect(fd.get("battingHand")).toBe("");
    expect(fd.get("battingPosition")).toBe("");
    expect(fd.get("bowlingStyle")).toBe("");
    expect(fd.get("communityId")).toBe("c1");
    expect(fd.get("isNew")).toBe("0");
  });

  it("saving with everything left empty is allowed", async () => {
    const { container } = draw(true);
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    expect(h.calls).toHaveLength(1);
    expect(h.calls[0]!.get("isNew")).toBe("1");
    expect(h.calls[0]!.get("playingRole")).toBe("");
  });

  it("a refused value shows the message and the way out", async () => {
    h.result = { error: "Please choose a playing role from the list." };
    const { container } = draw();
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Please choose a playing role from the list.");
    expect(alert.textContent).toContain("You can also skip");
  });
});
