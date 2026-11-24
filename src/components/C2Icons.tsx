// Small line icons for Plan several matches and Rematch. Decorative only: the words next to them carry the meaning.
type P = { size?: number };
const base = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: false });

export const SvPlus = ({ size = 18 }: P) => <svg {...base(size)}><path d="M12 5v14M5 12h14" /></svg>;
export const SvMinus = ({ size = 18 }: P) => <svg {...base(size)}><path d="M5 12h14" /></svg>;
export const SvCopy = ({ size = 18 }: P) => <svg {...base(size)}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h8" /></svg>;
export const SvTrash = ({ size = 18 }: P) => <svg {...base(size)}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>;
export const SvSwap = ({ size = 16 }: P) => <svg {...base(size)}><path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 20l-4-4 4-4" /></svg>;
export const SvCalendar = ({ size = 18 }: P) => <svg {...base(size)}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
export const SvRepeat = ({ size = 18 }: P) => <svg {...base(size)}><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4M9 15h6M13 13l2 2-2 2" /></svg>;
export const SvPin = ({ size = 18 }: P) => <svg {...base(size)}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
export const SvWarn = ({ size = 18 }: P) => <svg {...base(size)}><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18v.5" /></svg>;
export const SvLock = ({ size = 18 }: P) => <svg {...base(size)}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
export const SvInfo = ({ size = 18 }: P) => <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>;
export const SvBell = ({ size = 18 }: P) => <svg {...base(size)}><path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4l2-2zM10 21h4" /></svg>;
export const SvCheck = ({ size = 16 }: P) => <svg {...base(size)}><path d="M5 13l4 4L19 7" /></svg>;
export const SvChevron = ({ size = 18 }: P) => <svg {...base(size)}><path d="M9 6l6 6-6 6" /></svg>;
export const SvClose = ({ size = 20 }: P) => <svg {...base(size)}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const SvTrophy = ({ size = 18 }: P) => <svg {...base(size)}><path d="M8 4h8v6a4 4 0 0 1-8 0V4zM8 6H4v2a3 3 0 0 0 4 2.8M16 6h4v2a3 3 0 0 1-4 2.8M12 14v4M8 21h8M10 18h4" /></svg>;
