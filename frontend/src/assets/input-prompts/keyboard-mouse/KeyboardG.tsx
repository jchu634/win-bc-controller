import type { SVGProps } from "react";
const SvgKeyboardG = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M16 8h32q8 0 8 8v32q0 8-8 8H16q-8 0-8-8V16q0-8 8-8m23.25 16.8Q36.45 22 32.5 22t-6.7 2.8Q23 27.55 23 31.5v1.35l.3 2.1q.55 2.35 2.5 4.3Q28.55 42 32.5 42t6.75-2.75q1.85-1.95 2.5-4.25l.05-.15.2-2V32l-1-1H31v4h6.45l-1.05 1.4Q34.75 38 32.5 38t-3.85-1.6q-1.1-1.1-1.45-2.4l-.2-1.35V31.5q0-2.25 1.65-3.85Q30.25 26 32.5 26t3.9 1.65l.45.5 2.85-2.85z"
    />
  </svg>
);
export default SvgKeyboardG;
