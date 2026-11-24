import { EnSplash } from "@/components/EnParts";

// Shown while /profile finds your profile page (it draws nothing itself).
export default function Loading() {
  return <EnSplash title="Opening your profile" sub="Checking your communities…" />;
}
