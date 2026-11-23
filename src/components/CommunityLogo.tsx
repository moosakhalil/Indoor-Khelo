import { initials } from "@/lib/validation";

export default function CommunityLogo({ name, big }: { name: string; big?: boolean }) {
  return (
    <span className={`logo-mark${big ? " big" : ""}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
