import type { SVGProps } from "react";

// Set ikon garis (stroke) 24x24, mewarisi currentColor. Gaya Lucide.
const PATHS: Record<string, string> = {
  home: "M3 9.5 12 3l9 6.5M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10",
  upload: "M12 15V3m0 0-4 4m4-4 4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  wallet: "M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1H5a2 2 0 0 0 0 4h14a1 1 0 0 1 1 1v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm14 6h.01",
  trendingUp: "m3 17 6-6 4 4 8-8m0 0h-5m5 0v5",
  box: "m21 8-9-5-9 5m18 0-9 5m9-5v8l-9 5m0-13L3 8m9 5v8m-9-13v8l9 5",
  store: "M4 9h16l-1-5H5L4 9Zm0 0v10a1 1 0 0 0 1 1h4v-6h6v6h4a1 1 0 0 0 1-1V9M4 9l1 1m14-1-1 1",
  undo: "M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3",
  clipboard: "M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1Zm-3 2h12a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm3 6h6m-6 4h6",
  users: "M16 19v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 8v-1a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11",
  tag: "M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L3 13V4a1 1 0 0 1 1-1h9l7.59 7.59a2 2 0 0 1 0 2.82ZM7.5 7.5h.01",
  sliders: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4",
  calendar: "M7 3v3m10-3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
  search: "m21 21-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9",
  coins: "M9 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm6-8.9A5 5 0 1 1 15 15.8M9 14v0",
  cash: "M2 8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8Zm10 8a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
  hourglass: "M6 3h12M6 21h12M8 3v3.5a4 4 0 0 0 1.5 3.1L12 12l2.5-2.4A4 4 0 0 0 16 6.5V3M8 21v-3.5a4 4 0 0 1 1.5-3.1L12 12l2.5 2.4a4 4 0 0 1 1.5 3.1V21",
  pie: "M12 3v9l7.5 4.3A9 9 0 1 0 12 3Z",
  sparkles: "m12 3 1.9 4.6L18 9.5l-4.1 1.9L12 16l-1.9-4.6L6 9.5l4.1-1.9L12 3Zm7 10 .8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z",
  cloudUp: "M12 13V7m0 0-2.5 2.5M12 7l2.5 2.5M7 18a4 4 0 0 1-.9-7.9A5.5 5.5 0 0 1 17 9a4.5 4.5 0 0 1 .5 9H7Z",
  check: "m5 13 4 4L19 7",
  chevronDown: "m6 9 6 6 6-6",
  arrowRight: "M5 12h14m-6-6 6 6-6 6",
  scale: "M12 3v18M7 21h10M5 7h14M5 7l-2.5 6a3.5 3.5 0 0 0 5 0L5 7Zm14 0-2.5 6a3.5 3.5 0 0 0 5 0L19 7ZM12 3 5 7m7-4 7 4",
  download: "M12 3v12m0 0-4-4m4 4 4-4M5 19h14",
  fileText: "M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm-5 9h6m-6 4h6",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6",
  refresh: "M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16m0 5v-5h5",
  dot: "M12 12h.01",
};

export type IconName = keyof typeof PATHS | string;

export function Icon({
  name,
  size = 20,
  strokeWidth = 1.8,
  ...rest
}: { name: IconName; size?: number; strokeWidth?: number } & SVGProps<SVGSVGElement>) {
  const d = PATHS[name] ?? PATHS.dot;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={d} />
    </svg>
  );
}
