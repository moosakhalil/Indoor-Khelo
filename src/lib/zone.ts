// The viewer's time zone, learned from a cookie the app sets on the phone (see PwaShell). Falls back to UTC.
import { cookies } from "next/headers";
import { validTimeZone } from "@/lib/matchRules";

export async function getZone(): Promise<string> {
  const jar = await cookies();
  const raw = jar.get("ik_tz")?.value;
  return validTimeZone(raw ? decodeURIComponent(raw) : null) ?? "UTC";
}
