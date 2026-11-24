// Small line icons for the match report and the shared report (Phase D3). Decoration only: every one sits next to a word
// or sits inside a control that has an aria-label.
const PATHS = {
  trophy: <><path d="M8 4h8v5a4 4 0 0 1-8 0V4Z" /><path d="M8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3M12 13v4M8.5 20h7M10 17h4" /></>,
  doc: <><path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.500 3.5Z" /><path d="M14 3.5V8h4M9 12.500h6M9 16h4" /></>,
  share: <><path d="M12 15V4M8 8l4-4 4 4M5 13v5.500A1.500 1.500 0 0 0 6.500 20h11a1.500 1.500 0 0 0 1.500-1.500V13" /></>,
  eye: <><path d="M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12Z" /><circle cx="12" cy="12" r="2.800" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3A4 4 0 0 0 11 18.700l1-1" /></>,
  info: <><circle cx="12" cy="12" r="8.500" /><path d="M12 11v5M12 7.800v.2" /></>,
  check: <><path d="M5 12.500l4.500 4.500L19 7.500" /></>,
  pencil: <><path d="M4 20l1-4L16.500 4.500a2 2 0 0 1 2.800 0l.2.2a2 2 0 0 1 0 2.800L8 19l-4 1Z" /></>,
  refresh: <><path d="M19.500 12a7.500 7.500 0 0 1-13 5M4.500 12a7.500 7.500 0 0 1 13-5M17.500 3.500V7H14M6.500 20.500V17H10" /></>,
  chevron: <><path d="M6 9.500l6 6 6-6" /></>,
  flag: <><path d="M6 21V4M6 5h11l-2 4 2 4H6" /></>,
  bat: <><path d="M14.500 4.500l5 5-8.500 8.500-5-5 8.500-8.500Z" /><path d="M6 13l-2.500 6.500L10 18" /></>,
  userplus: <><circle cx="9.500" cy="8.500" r="3.500" /><path d="M3 20c0-3.400 2.900-6 6.500-6s6.500 2.600 6.500 6M19 8v6M16 11h6" /></>,
  pause: <><path d="M9 5v14M15 5v14" /></>,
  equal: <><path d="M5 9h14M5 15h14" /></>,
  chart: <><path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6" /></>,
  ball: <><circle cx="12" cy="12" r="8.500" /><path d="M5.500 7.500c3 1.500 3 7.500 0 9M18.500 7.500c-3 1.500-3 7.500 0 9" /></>,
  clock: <><circle cx="12" cy="12" r="8.500" /><path d="M12 7.500V12l3 2" /></>,
  dot: <><circle cx="12" cy="12" r="3" /></>,
  swap: <><path d="M4 8h14l-3.500-3.500M20 16H6l3.500 3.500" /></>,
} as const;

export type RpIconName = keyof typeof PATHS;

export default function RpIcon({ name, size = 20, className }: { name: RpIconName; size?: number; className?: string }) {
  return (
    <svg className={`rp-icon${className ? ` ${className}` : ""}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
