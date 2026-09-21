import type { SVGProps } from "react";

// 24x24 stroke icons, shared by the landing page, dashboard and settings.
const PATHS = {
  mail: "M4 6h16v12H4V6Zm0 0 8 7 8-7",
  list: "M5 5h14M5 10h14M5 15h9M5 20h5",
  compare: "M8 4v12a2 2 0 0 0 2 2h6M4 8l4-4 4 4M20 16l-4 4-4-4",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM5.6 5.6l3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9",
  file: "M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5ZM14 3v5h5M9 13h6M9 17h6",
  table: "M4 5h16v14H4V5ZM4 10h16M4 15h16M10 5v14",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18",
  code: "m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14",
  plug: "M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0V7ZM12 17v5",
  shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3ZM9 12l2 2 4-4",
  refresh: "M20 11a8 8 0 0 0-14.5-4M4 4v4h4M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4",
  layers: "M12 3 3 8l9 5 9-5-9-5ZM3 12.5l9 5 9-5M3 17l9 5 9-5",
  cpu: "M7 7h10v10H7V7ZM9 3v4M15 3v4M9 17v4M15 17v4M3 9h4M3 15h4M17 9h4M17 15h4",
  server: "M4 4h16v6H4V4ZM4 14h16v6H4v-6ZM8 7h.01M8 17h.01",
  box: "M12 3 3 7.5v9L12 21l9-4.5v-9L12 3ZM3 7.5l9 4.5 9-4.5M12 12v9",
  cloud: "M7 18a4 4 0 0 1-.5-8A6 6 0 0 1 18 9.5 4.5 4.5 0 0 1 17.5 18H7Z",
  laptop: "M5 5h14v10H5V5ZM2 19h20",
  home: "M4 12 12 4l8 8M6 10v10h12V10",
  play: "M6 4.5v15l13-7.5-13-7.5Z",
  flask: "M9 3h6M10 3v5.2L5.5 17a2 2 0 0 0 1.8 2.9h9.4a2 2 0 0 0 1.8-2.9L14 8.2V3",
  check: "m5 12.5 4.5 4.5L19 7.5",
  alert: "M12 4 2.5 20h19L12 4ZM12 10v4.5M12 17.5h.01",
  palette:
    "M12 3a9 9 0 1 0 0 18 2 2 0 0 0 1.5-3.3 2 2 0 0 1 1.5-3.4H17a4 4 0 0 0 4-4C21 6.5 17 3 12 3ZM7.5 11h.01M10 7.5h.01M14.5 7.5h.01",
  sliders: "M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M13 4v4M9 10v4M17 16v4",
  copy: "M9 9h11v11H9V9ZM5 15V5h10",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
  users: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20a6.5 6.5 0 0 1 13 0M16 4.3a3.5 3.5 0 0 1 0 6.4M18 14a6.5 6.5 0 0 1 3.5 6",
  logout: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3",
  arrowLeft: "M15 18l-6-6 6-6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-3.5-3.5",
  plus: "M12 4v16M4 12h16",
  menu: "M4 6h16M4 12h16M4 18h16",
  x: "M6 6l12 12M18 6 6 18",
  database: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3ZM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3",
  zap: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  inbox: "M3 13h5l1 3h6l1-3h5M3 13l3-8h12l3 8v6H3v-6Z",
  scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M4 12h16",
  lock: "M6 11h12v9H6v-9ZM8.5 11V8a3.5 3.5 0 1 1 7 0v3M12 15v2",
  unlock: "M6 11h12v9H6v-9ZM8.5 11V8a3.5 3.5 0 0 1 6.8-1.2M12 15v2",
  download: "M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19h14",
  upload: "M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14",
  chevronDown: "m6 9 6 6 6-6",
  chevronUp: "m6 15 6-6 6 6",
  chevronRight: "m9 6 6 6-6 6",
  filter: "M4 5h16l-6 8v5l-4 2v-7L4 5Z",
  undo: "M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  history: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2",
  edit: "M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4",
  note: "M5 4h14v12l-5 5H5V4ZM14 21v-5h5M8 9h8M8 13h5",
  pause: "M8 5v14M16 5v14",
  flag: "M5 21V4M5 4h11l-2 4 2 4H5",
  folder: "M3 6a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6Z",
  sparkles:
    "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  activity: "M3 12h4l3-8 4 16 3-8h4",
  target: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 12h.01",
  chart: "M5 20V11M12 20V4M19 20v-7",
  pie: "M12 3v9h9a9 9 0 1 1-9-9ZM15 3.5A9 9 0 0 1 20.5 9H15V3.5Z",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 11v5M12 8h.01",
  checkCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM8.5 12.5l2.5 2.5 4.5-5",
  xCircle: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM9 9l6 6M15 9l-6 6",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
  swap: "M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7",
  save: "M5 4h11l3 3v13H5V4ZM8 4v5h7V4M8 20v-6h8v6",
  key: "M11.9 12A4 4 0 1 0 8 16a4 4 0 0 0 3.9-4Zm0 0H21m-3 0v3m-3-3v2",
  power: "M12 3v8M6.3 6.5a8 8 0 1 0 11.4 0",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l2 2H4l2-2ZM10 21h4",
  gear: "M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
