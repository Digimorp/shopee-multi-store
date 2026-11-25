import type { SVGProps } from "react";

// Set ikon garis (stroke) 24x24, mewarisi currentColor. Gaya Lucide.
const PATHS: Record<string, string> = {
  home: "M3 9.5 12 3l9 6.5M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10",
  upload: "M12 15V3m0 0-4 4m4-4 4 4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  wallet: "M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v1H5a2 2 0 0 0 0 4h14a1 1 0 0 1 1 1v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Zm14 6h.01",
  trendingUp: "m3 17 6-6 4 4 8-8m0 0h-5m5 0v5",
  box: "m21 8-9-5-9 5m18 0-9 5m9-5v8l-9 5m0-13L3 8m9 5v8m-9-13v8l9 5",
  store: "M4 9h16l-1-5H5L4 9Zm0 0v10a1 1 0 0 0 1 1h4v-6h6v6h4a1 1 0 0 0 1-1V9M4 9l1 1m14-1-1 1",
  sliders: "M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4",
  calendar: "M7 3v3m10-3v3M4 8h16M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0",
  logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9",
  hourglass: "M6 3h12M6 21h12M8 3v3.5a4 4 0 0 0 1.5 3.1L12 12l2.5-2.4A4 4 0 0 0 16 6.5V3M8 21v-3.5a4 4 0 0 1 1.5-3.1L12 12l2.5 2.4a4 4 0 0 1 1.5 3.1V21",
  check: "m5 13 4 4L19 7",
  chevronDown: "m6 9 6 6 6-6",
  arrowRight: "M5 12h14m-6-6 6 6-6 6",
  scale: "M12 3v18M7 21h10M5 7h14M5 7l-2.5 6a3.5 3.5 0 0 0 5 0L5 7Zm14 0-2.5 6a3.5 3.5 0 0 0 5 0L19 7ZM12 3 5 7m7-4 7 4",
  download: "M12 3v12m0 0-4-4m4 4 4-4M5 19h14",
  fileText: "M14 3v5h5M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Zm-5 9h6m-6 4h6",
  refresh: "M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5M21 12a9 9 0 0 1-15 6.7L3 16m0 5v-5h5",
  x: "M18 6 6 18M6 6l12 12",
  dot: "M12 12h.01", // cadangan bila nama ikon tidak dikenal
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
