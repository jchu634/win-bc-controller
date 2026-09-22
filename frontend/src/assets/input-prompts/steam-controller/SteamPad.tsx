import type { SVGProps } from "react";
const SvgSteamPad = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M46.85 17.15Q40.75 11 32 11q-8.7 0-14.85 6.15T11 32q0 8.75 6.15 14.85Q23.3 53 32 53q8.75 0 14.85-6.15Q53 40.75 53 32q0-8.7-6.15-14.85M56 32q0 10-7.05 16.95Q42 56 32 56q-9.95 0-17-7.05Q8 42 8 32q0-9.95 7-17 5.45-5.45 12.7-6.65L32 8l4.35.35q7.2 1.2 12.6 6.65Q56 22.05 56 32"
    />
  </svg>
);
export default SvgSteamPad;
