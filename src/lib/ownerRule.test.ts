// Who may cancel or delete: the person who added the record, or an Admin (src/lib/ownerRule.ts), and how the match menus follow it.
import { describe, expect, it } from "vitest";
import { CANCEL_OWNER_WHY, DELETE_OWNER_WHY, manageItems } from "@/lib/crManage";
import { menuFor } from "@/lib/matchList";
import { mayManage, ownerReason } from "@/lib/ownerRule";

describe("mayManage", () => {
  it("is true for the person who added it", () => {
    expect(mayManage({ id: "ali", admin: false }, "ali")).toBe(true);
  });
  it("is true for an Admin, whoever added it", () => {
    expect(mayManage({ id: "sara", admin: true }, "ali")).toBe(true);
    expect(mayManage({ id: "sara", admin: true }, null)).toBe(true);
  });
  it("is false for another member", () => {
    expect(mayManage({ id: "hamza", admin: false }, "ali")).toBe(false);
  });
  it("is false for a member when nobody is recorded as the creator (the person is gone): Admins only", () => {
    expect(mayManage({ id: "hamza", admin: false }, null)).toBe(false);
    expect(mayManage({ id: "hamza", admin: false }, undefined)).toBe(false);
    expect(mayManage({ id: "", admin: false }, "")).toBe(false);
  });
});

describe("ownerReason", () => {
  it("names the person who added it", () => {
    expect(ownerReason("delete", "Ali Raza")).toBe("Only Ali Raza (who added this) or an Admin can delete it.");
  });
  it("says Admins only when the creator is not known", () => {
    expect(ownerReason("delete", null)).toBe("Only an Admin can delete this, because the person who added it is no longer here.");
  });
});

describe("match menus follow the rule", () => {
  it("manageItems: with the right, cancel and delete work as before", () => {
    const items = manageItems("scheduled");
    expect(items.find((i) => i.key === "cancel")!.ok).toBe(true);
    expect(items.find((i) => i.key === "delete")!.ok).toBe(true);
    expect(manageItems("scheduled", true)).toEqual(items);
  });
  it("manageItems: without the right, cancel and delete are off with the reason; edit, postpone and rematch stay open", () => {
    const items = manageItems("scheduled", false);
    expect(items.find((i) => i.key === "cancel")).toMatchObject({ ok: false, why: CANCEL_OWNER_WHY });
    expect(items.find((i) => i.key === "delete")).toMatchObject({ ok: false, why: DELETE_OWNER_WHY });
    for (const k of ["rematch", "edit", "postpone"]) expect(items.find((i) => i.key === k)!.ok).toBe(true);
  });
  it("menuFor: without the right, cancel and delete are not listed; everything else is", () => {
    const keys = (s: Parameters<typeof menuFor>[0], can?: boolean) => menuFor(s, can).map((a) => a.key);
    expect(keys("scheduled")).toEqual(["open", "lineup", "edit", "rematch", "postpone", "cancel", "delete"]);
    expect(keys("scheduled", false)).toEqual(["open", "lineup", "edit", "rematch", "postpone"]);
    expect(keys("cancelled", false)).toEqual(["open", "rematch"]);
    expect(keys("cancelled", true)).toContain("delete");
  });
});
