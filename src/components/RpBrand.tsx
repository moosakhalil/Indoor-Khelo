// The Indoor Khelo mark on the public pages (same logo as the app: gold rounded square with IK).
export function AppMark({ size = "md" }: { size?: "sm" | "md" }) {
  return <span className={`logo-mark rp-mark${size === "sm" ? " sm" : ""}`} aria-hidden="true">IK</span>;
}
