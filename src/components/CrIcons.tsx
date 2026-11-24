// Small line icons for Create match and Edit match. Always decorative: the words next to them carry the meaning.
// (Calendar, lock, warning, info, check, cross, trash, plus, pencil and chevron come from B4Icons.)
type P = { size?: number };
const base = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: false });

export const IconPin = ({ size = 18 }: P) => <svg {...base(size)}><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z" /><circle cx="12" cy="9.5" r="2.5" /></svg>;
export const IconSwap = ({ size = 18 }: P) => <svg {...base(size)}><path d="M4 8h14l-3-3M20 16H6l3 3" /></svg>;
export const IconBell = ({ size = 18 }: P) => <svg {...base(size)}><path d="M6 17V11a6 6 0 0 1 12 0v6l1.5 2h-15L6 17zM10 21h4" /></svg>;
export const IconClock = ({ size = 18 }: P) => <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const IconReset = ({ size = 18 }: P) => <svg {...base(size)}><path d="M4 12a8 8 0 1 0 2.5-5.8M4 4v5h5" /></svg>;
export const IconMinus = ({ size = 20 }: P) => <svg {...base(size)}><path d="M5 12h14" /></svg>;
export const IconBack = ({ size = 18 }: P) => <svg {...base(size)}><path d="M15 6l-6 6 6 6" /></svg>;
export const IconNext = ({ size = 18 }: P) => <svg {...base(size)}><path d="M9 6l6 6-6 6" /></svg>;
export const IconWhistle = ({ size = 18 }: P) => <svg {...base(size)}><circle cx="9" cy="14" r="5" /><path d="M13 11l8-3M9 14h.01" /></svg>;
export const IconTeams = ({ size = 18 }: P) => <svg {...base(size)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.7 0 4.5 1.9 4.5 4.5" /></svg>;
