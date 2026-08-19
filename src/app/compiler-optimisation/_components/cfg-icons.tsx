type CfgIconName =
  | "fit"
  | "fullscreen"
  | "exit-fullscreen"
  | "link"
  | "unlink"
  | "minus"
  | "plus"
  | "search";

type CfgIconProps = Readonly<{
  name: CfgIconName;
  className?: string;
}>;

const paths: Readonly<Record<CfgIconName, React.ReactNode>> = {
  fit: (
    <>
      <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
      <path d="M3 8 8 3M21 8l-5-5M3 16l5 5M21 16l-5 5" />
    </>
  ),
  fullscreen: (
    <>
      <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" />
    </>
  ),
  "exit-fullscreen": (
    <>
      <path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5" />
      <path d="m8 8-5-5M16 8l5-5M8 16l-5 5M16 16l5 5" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.1.1l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
      <path d="M14 11a5 5 0 0 0-7.1-.1l-2 2A5 5 0 0 0 12 20l1.1-1.1" />
    </>
  ),
  unlink: (
    <>
      <path d="m18.8 12.2.3-.3a5 5 0 0 0-7.1-7.1l-1.1 1.1M5.2 11.8l-.3.3A5 5 0 0 0 12 19.2l1.1-1.1" />
      <path d="m2 2 20 20M8 12h4" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
};

export function CfgIcon({ name, className = "size-4" }: CfgIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}
