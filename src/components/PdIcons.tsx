// Small line icons for the PDF actions card. They are decoration: every one sits next to a word.
const PATHS: Record<string, React.ReactNode> = {
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="3" /></>,
  download: <><path d="M12 4v11M8 11l4 4 4-4M5 19.5h14" /></>,
  share: <><path d="M12 15V4M8 8l4-4 4 4M5 13v5.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V13" /></>,
  spinner: <><path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" /></>,
  check: <><path d="M5 12.5l4.5 4.5L19 7.5" /></>,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8v.01" /></>,
  warn: <><path d="M12 4l9 15.5H3L12 4Z" /><path d="M12 10v4.5M12 17.2v.01" /></>,
  wifioff: <><path d="M4 9.5a12 12 0 0 1 4-2.4M20 9.5a12 12 0 0 0-5.3-3M7 13a7.5 7.5 0 0 1 3-1.7M17 13a7.5 7.5 0 0 0-2-1.4M10 16.5a3.5 3.5 0 0 1 4 0M12 19.5v.01M4 4l16 16" /></>,
  send: <><path d="M21 3L10 14M21 3l-6.5 18-3.5-7.5L3.5 10 21 3Z" /></>,
  doc: <><path d="M7 3.5h7l4 4v13H7a1.5 1.5 0 0 1-1.5-1.5v-14A1.5 1.5 0 0 1 7 3.5Z" /><path d="M14 3.5v4h4M9 12h6M9 15.5h6" /></>,
};

export default function PdIcon({ name, size = 20 }: { name: keyof typeof PATHS | string; size?: number }) {
  return (
    <svg className="pd-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}
