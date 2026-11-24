// Phase E2 (UI redesign): the few icons the pad's sheets use. Decorative: the words next to them carry the meaning.
type Name = "alert" | "info" | "check" | "edit" | "x" | "plus" | "minus" | "clock" | "lock" | "search" | "user" | "users";

const PATHS: Record<Name, React.ReactNode> = {
  alert: <><path d="M12 3.5 2.8 19.5h18.4L12 3.5Z" /><path d="M12 10v4.5M12 17.4v.1" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.1" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  edit: <><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" /><path d="m13.5 7.5 3 3" /></>,
  x: <path d="m6 6 12 12M18 6 6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  user: <><circle cx="12" cy="8.5" r="3.6" /><path d="M5 20c.7-3.6 3.4-5.4 7-5.4s6.3 1.8 7 5.4" /></>,
  users: <><circle cx="9" cy="9" r="3.2" /><path d="M3 19.5c.6-3.2 2.8-4.8 6-4.8s5.4 1.6 6 4.8" /><path d="M16 6.2a3.1 3.1 0 0 1 0 5.8M18.5 15c1.4.8 2.2 2.2 2.5 4" /></>,
};

export default function PsIcon({ name, size = 20 }: { name: Name; size?: number }) {
  return (
    <svg className="ps-ic" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
