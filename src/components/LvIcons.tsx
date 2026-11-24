// Small line icons for the live view and the take-over gate. Always decorative: the words next to them carry the meaning.
type P = { size?: number };
const base = (size: number) => ({ className: "lv-ic", width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: false });

export const IconRefresh = ({ size = 16 }: P) => <svg {...base(size)}><path d="M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4" /></svg>;
export const IconSwap = ({ size = 18 }: P) => <svg {...base(size)}><path d="M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4" /></svg>;
export const IconPencil = ({ size = 18 }: P) => <svg {...base(size)}><path d="M4 20l4-1 11-11-3-3L5 16l-1 4z" /></svg>;
export const IconShield = ({ size = 18 }: P) => <svg {...base(size)}><path d="M12 3l8 3v6c0 4.5-3.2 7.8-8 9-4.8-1.2-8-4.5-8-9V6l8-3z" /></svg>;
export const IconWarn = ({ size = 18 }: P) => <svg {...base(size)}><path d="M12 3l10 18H2L12 3z" /><path d="M12 10v5M12 18v.5" /></svg>;
export const IconClock = ({ size = 18 }: P) => <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const IconUsers = ({ size = 18 }: P) => <svg {...base(size)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.5 2.9-6 6.5-6s6.5 2.5 6.5 6" /><circle cx="17" cy="9" r="2.5" /><path d="M17 14c2.7 0 4.5 1.9 4.5 4.5" /></svg>;
export const IconBack = ({ size = 18 }: P) => <svg {...base(size)}><path d="M15 6l-6 6 6 6" /></svg>;
