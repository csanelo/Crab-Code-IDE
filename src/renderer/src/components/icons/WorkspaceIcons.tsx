export type AppIconProps = {
  size?: number | string;
  className?: string;
};

const svgProps = (size: number | string, className?: string) => ({
  viewBox: "0 0 24 24",
  width: size,
  height: size,
  className,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  shapeRendering: "geometricPrecision" as const,
  focusable: "false" as const,
  "aria-hidden": true as const,
});

export function WorkspaceFolderIcon({
  size = 20,
  className,
}: AppIconProps): JSX.Element {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M3 18.5V7a2.5 2.5 0 0 1 2.5-2.5h4.2l2.2 2.2h6.6A2.5 2.5 0 0 1 21 9.2v1.3" />
      <path d="M4.2 19.5h14.1a2.4 2.4 0 0 0 2.3-1.7l1.5-5a1.8 1.8 0 0 0-1.7-2.3H8.1a2.5 2.5 0 0 0-2.4 1.8l-2.1 6.2c-.2.5.2 1 .6 1Z" />
    </svg>
  );
}

export function PrivateRepositoryIcon({
  size = 20,
  className,
}: AppIconProps): JSX.Element {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M3 15.5V7a2.5 2.5 0 0 1 2.5-2.5h4.2l2.2 2.2h6.6A2.5 2.5 0 0 1 21 9.2v1.3" />
      <rect x="11.5" y="14" width="10" height="7.5" rx="2.2" />
      <path d="M14.2 14v-1.3a2.3 2.3 0 0 1 4.6 0V14" />
    </svg>
  );
}

export function ComputerAccessIcon({
  size = 20,
  className,
}: AppIconProps): JSX.Element {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M3 15.5V7a2.5 2.5 0 0 1 2.5-2.5h4.2l2.2 2.2h6.6A2.5 2.5 0 0 1 21 9.2v1" />
      <path d="m12.2 11.8 8.5 3.3-4 1.4-1.5 4.1-3-8.8Z" />
      <path d="m17 17 3.2 3.2" />
    </svg>
  );
}

export function HighAccessIcon({
  size = 20,
  className,
}: AppIconProps): JSX.Element {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M3 15.5V7a2.5 2.5 0 0 1 2.5-2.5h4.2l2.2 2.2h6.6A2.5 2.5 0 0 1 21 9.2v1.3" />
      <rect x="11.5" y="14" width="10" height="7.5" rx="2.2" />
      <path d="M14.2 14v-1.3a2.5 2.5 0 0 1 4.8-1" />
    </svg>
  );
}

export function NormalAccessIcon({
  size = 20,
  className,
}: AppIconProps): JSX.Element {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M3 15.5V7a2.5 2.5 0 0 1 2.5-2.5h4.2l2.2 2.2h6.6A2.5 2.5 0 0 1 21 9.2v1.3" />
      <rect x="11.5" y="14" width="10" height="7.5" rx="2.2" />
      <path d="M14.2 14v-1.3a2.3 2.3 0 0 1 4.6 0V14" />
    </svg>
  );
}

export function ChangesCodeIcon({
  size = 19,
  className,
}: AppIconProps): JSX.Element {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M5 3.5h8l4 4v4.2M13 3.5v4h4M10.5 20.5H5a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z" />
      <path d="m14.5 14.2-2.3 2.3 2.3 2.3M19.5 14.2l2.3 2.3-2.3 2.3M18.1 13.3l-2.2 6.4" />
    </svg>
  );
}

export function SessionChatIcon({
  size = 20,
  className,
}: AppIconProps): JSX.Element {
  return (
    <svg {...svgProps(size, className)}>
      <path d="M20.5 12a7.5 7.5 0 0 1-7.7 7.3H8.1L3.5 22l1.4-4.3A7 7 0 0 1 3 12.8v-1.4a7 7 0 0 1 7.2-6.9h3.1a7.1 7.1 0 0 1 7.2 7v.5Z" />
    </svg>
  );
}
