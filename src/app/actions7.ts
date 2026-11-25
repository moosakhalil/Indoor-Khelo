"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAcceptedUser } from "@/lib/session";
import { isUuid } from "@/lib/community";
import {
  createBooking, createVenue, deleteBooking, deletePayment, deleteVenue, linkMatches, remindUnpaid, setBookingStatus, setSharing, updateBooking, updatePayment, updateVenue, verifyPayment,
} from "@/lib/bookings";
import { validTimeZone } from "@/lib/matchRules";
import { validateBooking, validateGuest, validatePayment, validateVenue } from "@/lib/payments";
import type { FormState } from "@/app/actions";

const idOf = (fd: FormData, key: string) => { const v = String(fd.get(key) ?? ""); return isUuid(v) ? v : null; };
const fixFields = "Please fix the highlighted fields.";
const pay = (communityId: string, tail = "") => `/c/${communityId}/payments${tail}`;

async function zoneOf(fd: FormData): Promise<string | null> {
  const jar = await cookies();
  const c = jar.get("ik_tz")?.value;
  return validTimeZone(fd.get("tz")) ?? validTimeZone(c ? decodeURIComponent(c) : null);
}

/* ---------- venues ---------- */
export async function createVenueAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId");
  if (!communityId) return { error: "Community not found." };
  const v = validateVenue({ name: fd.get("name"), address: fd.get("address"), contact: fd.get("contact") });
  if (!v.ok) return { fieldErrors: v.errors, error: fixFields };
  const r = await createVenue(user.id, communityId, v.value);
  if (r.outcome === "name_taken") return { fieldErrors: { name: "A venue with this name already exists in this community." }, error: fixFields };
  if (r.outcome !== "ok") return { error: "Only members of this community can add venues." };
  revalidatePath(pay(communityId), "layout");
  redirect(pay(communityId, "/venues?added=1"));
}

export async function updateVenueAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId"), venueId = idOf(fd, "venueId");
  if (!communityId || !venueId) return { error: "Venue not found." };
  const v = validateVenue({ name: fd.get("name"), address: fd.get("address"), contact: fd.get("contact") });
  if (!v.ok) return { fieldErrors: v.errors, error: fixFields };
  const r = await updateVenue(user.id, communityId, venueId, v.value);
  if (r === "name_taken") return { fieldErrors: { name: "A venue with this name already exists in this community." }, error: fixFields };
  if (r === "not_found") return { error: "That venue no longer exists." };
  if (r !== "ok") return { error: "Only members of this community can change venues." };
  revalidatePath(pay(communityId), "layout");
  return { message: "Saved." };
}

export async function deleteVenueAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId"), venueId = idOf(fd, "venueId");
  if (!communityId || !venueId) return;
  const r = await deleteVenue(user.id, communityId, venueId);
  revalidatePath(pay(communityId), "layout");
  redirect(pay(communityId, r === "in_use" ? `/venues/${venueId}?e=in_use` : "/venues"));
}

/* ---------- bookings ---------- */
function bookingFields(fd: FormData, tz: string) {
  return validateBooking({ venueId: fd.get("venueId"), when: fd.get("when"), durationMinutes: fd.get("durationMinutes"), totalCost: fd.get("totalCost"), reference: fd.get("reference"), notes: fd.get("notes") }, tz, new Date(), isUuid);
}

export async function createBookingAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId");
  if (!communityId) return { error: "Community not found." };
  const tz = await zoneOf(fd);
  if (!tz) return { error: "We could not read your phone's time zone. Please reload the page and try again." };
  const b = bookingFields(fd, tz);
  if (!b.ok) return { fieldErrors: b.errors, error: fixFields };
  const r = await createBooking(user.id, communityId, b.value);
  if (r.outcome === "bad_venue") return { fieldErrors: { venueId: "Choose a venue from this community." }, error: fixFields };
  if (r.outcome !== "ok") return { error: "Only members of this community can create bookings." };
  revalidatePath(pay(communityId), "layout");
  redirect(pay(communityId, `/${r.id}?created=1`));
}

export async function updateBookingAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId"), bookingId = idOf(fd, "bookingId");
  if (!communityId || !bookingId) return { error: "Booking not found." };
  const tz = await zoneOf(fd);
  if (!tz) return { error: "We could not read your phone's time zone. Please reload the page and try again." };
  const b = bookingFields(fd, tz);
  if (!b.ok) return { fieldErrors: b.errors, error: fixFields };
  const r = await updateBooking(user.id, communityId, bookingId, b.value);
  if (r === "bad_venue") return { fieldErrors: { venueId: "Choose a venue from this community." }, error: fixFields };
  if (r === "not_found") return { error: "That booking no longer exists." };
  if (r !== "ok") return { error: "Only members of this community can change bookings." };
  revalidatePath(pay(communityId), "layout");
  redirect(pay(communityId, `/${bookingId}?saved=1`));
}

export async function bookingStatusAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId"), bookingId = idOf(fd, "bookingId");
  if (!communityId || !bookingId) return;
  const r = await setBookingStatus(user.id, communityId, bookingId, String(fd.get("status") ?? ""));
  revalidatePath(pay(communityId), "layout");
  redirect(pay(communityId, `/${bookingId}${r === "ok" ? "?status=1" : `?e=${r}`}`));
}

export async function deleteBookingAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId"), bookingId = idOf(fd, "bookingId");
  if (!communityId || !bookingId) return;
  const r = await deleteBooking(user.id, communityId, bookingId);   // refusals (including not_owner) come back as ?e= and the booking page words them
  revalidatePath(pay(communityId), "layout");
  redirect(r === "ok" ? pay(communityId, "?deleted=1") : pay(communityId, `/${bookingId}?e=${r}`));
}

/* ---------- sharing and matches ---------- */
export async function sharingAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId"), bookingId = idOf(fd, "bookingId");
  if (!communityId || !bookingId) return;
  const members = fd.getAll("member").map(String);
  const guests: string[] = [];
  for (const g of String(fd.get("guests") ?? "").split(/[\n,]+/)) {
    if (!g.trim()) continue;
    const v = validateGuest(g);
    if (!v.ok) redirect(pay(communityId, `/${bookingId}/share?e=guest`));
    guests.push(v.value);
  }
  const r = await setSharing(user.id, communityId, bookingId, members, guests);
  revalidatePath(pay(communityId), "layout");
  redirect(pay(communityId, `/${bookingId}${r === "ok" ? "?shared=1" : `/share?e=${r}`}`));
}

export async function linkMatchesAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId"), bookingId = idOf(fd, "bookingId");
  if (!communityId || !bookingId) return;
  const r = await linkMatches(user.id, communityId, bookingId, fd.getAll("match").map(String));
  revalidatePath(pay(communityId), "layout");
  redirect(pay(communityId, `/${bookingId}${r === "ok" ? "?linked=1" : `?e=${r}`}`));
}

/* ---------- payments (recording goes through the offline-capable API route) ---------- */
export async function verifyPaymentAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId"), bookingId = idOf(fd, "bookingId"), paymentId = idOf(fd, "paymentId");
  if (!communityId || !bookingId || !paymentId) return;
  await verifyPayment(user.id, communityId, bookingId, paymentId, String(fd.get("on") ?? "") === "1");
  revalidatePath(pay(communityId), "layout");
  redirect(pay(communityId, `/${bookingId}#payments`));
}

export async function deletePaymentAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId"), bookingId = idOf(fd, "bookingId"), paymentId = idOf(fd, "paymentId");
  if (!communityId || !bookingId || !paymentId) return;
  const r = await deletePayment(user.id, communityId, bookingId, paymentId);
  revalidatePath(pay(communityId), "layout");
  // A refusal (for example not the person who recorded it, and not an Admin) is shown on the booking page, never reported as "removed".
  redirect(pay(communityId, r === "ok" ? `/${bookingId}?removed=1#payments` : `/${bookingId}?e=${r}#payments`));
}

export async function updatePaymentAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId"), bookingId = idOf(fd, "bookingId"), paymentId = idOf(fd, "paymentId");
  if (!communityId || !bookingId || !paymentId) return { error: "Payment not found." };
  const v = validatePayment({ kind: fd.get("kind"), amount: fd.get("amount"), paidOn: fd.get("paidOn"), method: fd.get("method"), reference: fd.get("reference"), payer: fd.get("payer") }, new Date(), isUuid);
  if (!v.ok) return { fieldErrors: v.errors, error: fixFields };
  const r = await updatePayment(user.id, communityId, bookingId, paymentId, v.value);
  if (r === "too_much") return { fieldErrors: { amount: "A refund cannot be more than that person has paid in." }, error: fixFields };
  if (r === "bad_person") return { fieldErrors: { payer: "That person is not a member of this community." }, error: fixFields };
  if (r === "not_found") return { error: "That record no longer exists." };
  if (r === "not_owner") return { error: "Only the person who recorded this, or an Admin, can change it." };
  if (r !== "ok") return { error: "Only members of this community can change payment records." };
  revalidatePath(pay(communityId), "layout");
  redirect(pay(communityId, `/${bookingId}?saved=1#payments`));
}

export async function remindPaymentsAction(fd: FormData) {
  const user = await requireAcceptedUser();
  const communityId = idOf(fd, "communityId"), bookingId = idOf(fd, "bookingId");
  if (!communityId || !bookingId) return;
  const r = await remindUnpaid(user.id, communityId, bookingId);
  revalidatePath(pay(communityId), "layout");
  if (r.outcome === "ok") redirect(pay(communityId, `/${bookingId}?reminded=${r.sent}`));
  if (r.outcome === "too_soon") redirect(pay(communityId, `/${bookingId}?e=too_soon&n=${r.waitMinutes}`));
  redirect(pay(communityId, `/${bookingId}?e=${r.outcome}`));
}
