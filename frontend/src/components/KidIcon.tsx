import React from "react";

export type KidIconName =
  | "dashboard"
  | "exercises"
  | "assignments"
  | "ocr"
  | "daily"
  | "students"
  | "settings"
  | "wave"
  | "flame"
  | "puzzle"
  | "rocket"
  | "check"
  | "book"
  | "studentCap"
  | "teacherBook"
  | "dice"
  | "pencil"
  | "keyboard"
  | "note"
  | "repeat"
  | "sparkles"
  | "target"
  | "camera"
  | "users"
  | "clipboard"
  | "chart"
  | "search"
  | "arrowLeft"
  | "x"
  | "dot";

type Props = {
  name: KidIconName;
  className?: string;
  style?: React.CSSProperties;
};

export function KidIcon({ name, className, style }: Props) {
  const common = {
    width: "1em",
    height: "1em",
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    className,
    style,
    "aria-hidden": true as const,
    focusable: false,
  };

  switch (name) {
    case "dashboard":
      return (
        <svg {...common}>
          <path
            d="M4 13.5C4 10.5 6.5 8 9.5 8H20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M4 20V13.5C4 11.6 5.6 10 7.5 10H9.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M20 4V20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M16 8V20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "exercises":
      return (
        <svg {...common}>
          <path
            d="M4 19V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M8 8h8M8 12h8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "assignments":
      return (
        <svg {...common}>
          <path
            d="M8 3h8l3 3v15a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M16 3v4a2 2 0 0 0 2 2h4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M8.5 13h7M8.5 17h7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "ocr":
      return (
        <svg {...common}>
          <path
            d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M8.5 8h7M8.5 12h7M8.5 16h4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M19.5 13.5l2 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "daily":
      return (
        <svg {...common}>
          <path
            d="M7 3v3M17 3v3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M4 8h16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M8 13h4v4H8v-4Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "students":
      return (
        <svg {...common}>
          <path
            d="M16 11a4 4 0 1 0-8 0"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M4 21c1.2-4.2 4.8-6 8-6s6.8 1.8 8 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M20 8a3 3 0 0 1 0 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <path
            d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M12 2.75v2.2M12 19.05v2.2M4.95 12h-2.2M21.25 12h-2.2M5.88 5.88l1.56 1.56M18.56 18.56l-1.56-1.56M18.56 5.88 17 7.44M5.88 18.56 7.44 17"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="7.2" stroke="currentColor" strokeWidth="1.8" opacity="0.7" />
        </svg>
      );
    case "wave":
      return (
        <svg {...common}>
          <path
            d="M8 17c-1.5-1.5-2-3.6-1-5.5C7.8 9.2 9.8 8 12 8c2.2 0 4.2 1.2 5 3.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M4 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.9"
          />
        </svg>
      );
    case "flame":
      return (
        <svg {...common}>
          <path
            d="M12 22c4 0 7-3.1 7-7 0-3.6-2.5-5.6-4-8-1-1.6-1-3-1-5-2 1.3-3 3-3 5-2 1.3-6 4-6 8 0 3.9 3 7 7 7Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M12 18c2 0 3-1.4 3-3.2 0-1.4-1-2.2-1.6-3-.5-.7-.6-1.2-.6-2.1-1.3.8-1.8 2-1.8 3.2-.9.7-2 1.8-2 3.1C8.9 16.6 10 18 12 18Z"
            fill="currentColor"
            opacity="0.22"
          />
        </svg>
      );
    case "puzzle":
      return (
        <svg {...common}>
          <path
            d="M7 9a2 2 0 0 1 2-2h2V5.8A2.2 2.2 0 0 1 13.2 3H14a2 2 0 0 1 2 2v1.2h1.1A2.9 2.9 0 0 1 20 9v1a2 2 0 0 1-2 2h-1v2h1.1A2.9 2.9 0 0 1 20 18v1a2 2 0 0 1-2 2H17.2A2.2 2.2 0 0 1 15 18.8V17h-2v1a2 2 0 0 1-2 2h-1a2.9 2.9 0 0 1-2.9-2.9V16H4a2 2 0 0 1-2-2v-1a2.9 2.9 0 0 1 2.9-2.9H7v-1Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "rocket":
      return (
        <svg {...common}>
          <path
            d="M6 14c-1.2 0-2 .8-2 2v2h2c1.2 0 2-.8 2-2v-2H6Z"
            fill="currentColor"
            opacity="0.2"
          />
          <path
            d="M14 3c4 1 7 4 7 8-2 3-6 7-10 9-4 1-7-2-6-6 2-4 6-8 9-11Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M15 8.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z"
            fill="currentColor"
          />
        </svg>
      );
    case "check":
      return (
        <svg {...common}>
          <path
            d="M20 6 9 17l-5-5"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "book":
      return (
        <svg {...common}>
          <path
            d="M4 5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-2V5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M18 21V3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "studentCap":
      return (
        <svg {...common}>
          <path
            d="M12 3 2 8l10 5 10-5-10-5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M6 10v6c0 1.2 2.7 3 6 3s6-1.8 6-3v-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "teacherBook":
      return (
        <svg {...common}>
          <path
            d="M6 3h11a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2V5a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M8 7h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M8 11h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "dice":
      return (
        <svg {...common}>
          <path
            d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path d="M8 8h.01" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <path d="M12 12h.01" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <path d="M16 16h.01" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
    case "pencil":
      return (
        <svg {...common}>
          <path
            d="M12 20h9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "keyboard":
      return (
        <svg {...common}>
          <path
            d="M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path d="M7 9h.01" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <path d="M11 9h.01" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <path d="M15 9h.01" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
          <path d="M8 13h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M8 16h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case "note":
      return (
        <svg {...common}>
          <path
            d="M4 4h16v16H4V4Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            opacity="0.8"
          />
          <path
            d="M8 14c1.2-2 3-2 4.2-.8 1.1 1 2.3 1 3.8-.7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "repeat":
      return (
        <svg {...common}>
          <path
            d="M3 12a9 9 0 0 1 15.4-6.4L21 8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M21 12a9 9 0 0 1-15.4 6.4L3 16"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "sparkles":
      return (
        <svg {...common}>
          <path
            d="M12 2l1.5 5.5L19 9l-5.5 1.5L12 16l-1.5-5.5L5 9l5.5-1.5L12 2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M20 14l.8 2.6L23 17l-2.2.4L20 20l-.8-2.6L17 17l2.2-.4L20 14Z"
            fill="currentColor"
            opacity="0.25"
          />
        </svg>
      );
    case "target":
      return (
        <svg {...common}>
          <path
            d="M12 21a9 9 0 1 0-9-9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 17a5 5 0 1 0-5-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M12 13a1 1 0 1 0-1-1"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M22 2 14 10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "camera":
      return (
        <svg {...common}>
          <path
            d="M20 7h-3l-2-2H9L7 7H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <path
            d="M16 11a4 4 0 1 0-8 0"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M4 21c1.2-4.2 4.8-6 8-6s6.8 1.8 8 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "clipboard":
      return (
        <svg {...common}>
          <path
            d="M9 3h6l1 2h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l1-2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
          <path
            d="M8 12h8M8 16h6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path
            d="M4 19V5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M8 19v-8M12 19v-5M16 19V9M20 19V7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "search":
      return (
        <svg {...common}>
          <path
            d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M21 21l-4.3-4.3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "arrowLeft":
      return (
        <svg {...common}>
          <path
            d="M15 18 9 12l6-6"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "x":
      return (
        <svg {...common}>
          <path
            d="M18 6 6 18M6 6l12 12"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "dot":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="7" fill="currentColor" opacity="0.35" />
          <circle cx="12" cy="12" r="4.2" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
}

