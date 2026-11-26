// "The sign-in service did not answer" must never be treated as "signed out".
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ auth: { getSession: h.getSession } }));
vi.mock("@/lib/db", () => ({ one: async () => ({ name: "Ali", terms_accepted_at: new Date() }) }));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`redirect:${to}`); } }));

import { AuthUnreachableError } from "@/lib/authError";
import { getSessionUser, requireUser } from "@/lib/session";

beforeEach(() => h.getSession.mockReset());

describe("getSessionUser", () => {
  for (const status of [500, 502, 503, 429, undefined]) {
    it(`throws "unreachable" for an error with status ${status}`, async () => {
      h.getSession.mockResolvedValue({ data: null, error: { status, message: "x" } });
      await expect(getSessionUser()).rejects.toBeInstanceOf(AuthUnreachableError);
      await expect(requireUser()).rejects.toBeInstanceOf(AuthUnreachableError);
    });
  }

  it("is signed out for 401", async () => {
    h.getSession.mockResolvedValue({ data: null, error: { status: 401, message: "x" } });
    expect(await getSessionUser()).toBeNull();
  });

  it("is signed out when the service answers with no session", async () => {
    h.getSession.mockResolvedValue({ data: null, error: null });
    await expect(requireUser()).rejects.toThrow("redirect:/");
  });

  it("returns the user when the service answers with a session", async () => {
    h.getSession.mockResolvedValue({ data: { user: { id: "u1", name: "Ali", email: "a@x.test" } }, error: null });
    expect((await getSessionUser())?.id).toBe("u1");
  });
});
