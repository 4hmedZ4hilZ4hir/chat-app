type P = { size?: number; filled?: boolean; className?: string };
const S = ({ size = 20, className, children, filled }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.7}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>{children}</svg>
);
export const SidebarIcon = (p: P) => <S {...p}><rect x="3.5" y="4.5" width="17" height="15" rx="3.5" /><path d="M9.5 4.5v15" /></S>;
export const Compose = (p: P) => <S {...p}><path d="M12 5H7.5A3.5 3.5 0 0 0 4 8.5v8A3.5 3.5 0 0 0 7.5 20h8a3.5 3.5 0 0 0 3.5-3.5V12" /><path d="M17.6 3.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4 8.6-8.4z" /></S>;
export const Search = (p: P) => <S {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></S>;
export const Plus = (p: P) => <S {...p}><path d="M12 5v14M5 12h14" /></S>;
export const ArrowUp = (p: P) => <S {...p}><path d="M12 19V5M6 11l6-6 6 6" strokeWidth={2.2} /></S>;
export const Copy = (p: P) => <S {...p}><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M15 9V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15H9" /></S>;
export const Check = (p: P) => <S {...p}><path d="M5 12.5 9.5 17 19 7.5" /></S>;
export const ThumbUp = (p: P) => <S {...p}><path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /></S>;
export const ThumbDown = (p: P) => <S {...p}><path d="M17 14V2" /><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22a3.13 3.13 0 0 1-3-3.88Z" /></S>;
export const Reply = (p: P) => <S {...p}><path d="m9 17-5-5 5-5" /><path d="M20 18v-2a4 4 0 0 0-4-4H4" /></S>;
export const Pin = (p: P) => <S {...p}><path d="M12 17v5" /><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" /></S>;
export const Pencil = (p: P) => <S {...p}><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></S>;
export const Trash = (p: P) => <S {...p}><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></S>;
export const Users = (p: P) => <S {...p}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></S>;
export const Bell = (p: P) => <S {...p}><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></S>;
export const Close = (p: P) => <S {...p}><path d="M6 6l12 12M18 6 6 18" /></S>;
export const Dots = (p: P) => <S {...p}><circle cx="5" cy="12" r="1" fill="currentColor" /><circle cx="12" cy="12" r="1" fill="currentColor" /><circle cx="19" cy="12" r="1" fill="currentColor" /></S>;
export const Logout = (p: P) => <S {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="m16 17 5-5-5-5" /><path d="M21 12H9" /></S>;
