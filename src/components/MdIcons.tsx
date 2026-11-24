// Phase D1: small line icons for the Match details page and the toss card. Decoration only: every icon sits next to a word.
// (Calendar, pin, clock, users, warning, info, check, cross, lock, pencil, trash and chevron come from B4Icons / CrIcons / C2Icons.)
type P = { size?: number };
const base = (size: number) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, focusable: false });

export const MdCoin = ({ size = 18 }: P) => <svg {...base(size)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5.5" /><path d="M10.2 9.6h3.3M10.2 14.4h3.3M12 8.4v7.2" /></svg>;
export const MdBat = ({ size = 22 }: P) => <svg {...base(size)}><path d="M14.5 3.5l6 6-9.8 9.8a2 2 0 0 1-1.4.6H6.5l-2-2v-2.8a2 2 0 0 1 .6-1.4l9.4-9.2zM3 21l3-3" /></svg>;
export const MdBall = ({ size = 22 }: P) => <svg {...base(size)}><circle cx="12" cy="12" r="9" /><path d="M5 7.5c3 1.5 5 1.5 8 0s5-1.5 6 0M5 16.5c3-1.5 5-1.5 8 0s5 1.5 6 0" /></svg>;
export const MdShare = ({ size = 20 }: P) => <svg {...base(size)}><path d="M12 15V4M8 8l4-4 4 4M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6" /></svg>;
export const MdDots = ({ size = 20 }: P) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>;
export const MdEye = ({ size = 20 }: P) => <svg {...base(size)}><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>;
export const MdBars = ({ size = 20 }: P) => <svg {...base(size)}><path d="M5 20V10M12 20V4M19 20v-7" /></svg>;
export const MdScore = ({ size = 20 }: P) => <svg {...base(size)}><path d="M4 20l1-4L16.5 4.5a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8L8 19l-4 1z" /></svg>;
export const MdLink = ({ size = 18 }: P) => <svg {...base(size)}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>;
export const MdTrophy = ({ size = 16 }: P) => <svg {...base(size)}><path d="M8 4h8v6a4 4 0 0 1-8 0V4zM8 6H4v2a3 3 0 0 0 4 2.8M16 6h4v2a3 3 0 0 1-4 2.8M12 14v4M8 21h8M10 18h4" /></svg>;
export const MdMic = ({ size = 18 }: P) => <svg {...base(size)}><circle cx="9" cy="14" r="5" /><path d="M13 11l8-3M9 14h.01" /></svg>;
