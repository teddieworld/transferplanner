import type { CSSProperties, ReactNode } from "react";

type IconName = "arrow" | "book" | "building" | "check" | "chevron" | "compass" | "grid" | "info" | "list" | "plus" | "search" | "spark" | "x";

const paths: Record<IconName, ReactNode> = {
  arrow: <><path d="M4 12h15M13 5l7 7-7 7" /></>,
  book: <><path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Z" /><path d="M12 6v14" /></>,
  building: <><path d="m3 9 9-5 9 5M4 10h16M6 11v8m6-8v8m6-8v8M3 20h18" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z" /></>,
  grid: <><rect x="4" y="4" width="6" height="6" rx="1.5" /><rect x="14" y="4" width="6" height="6" rx="1.5" /><rect x="4" y="14" width="6" height="6" rx="1.5" /><rect x="14" y="14" width="6" height="6" rx="1.5" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-9v.1" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11M4 6h.1M4 12h.1M4 18h.1" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
  spark: <><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z" /></>,
  x: <path d="m6 6 12 12M6 18 18 6" />,
};

export default function Icon({ name, size = 20, className, style }: {
  name: IconName; size?: number; className?: string; style?: CSSProperties;
}) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>
    {paths[name]}
  </svg>;
}
