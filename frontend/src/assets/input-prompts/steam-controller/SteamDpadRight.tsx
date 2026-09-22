import type { SVGProps } from "react";
const SvgSteamDpadRight = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="#E73246"
      d="M36 28h12q1.65 0 2.85 1.2Q52 30.35 52 32t-1.15 2.85Q49.65 36 48 36H36z"
    />
    <path
      fill="currentColor"
      d="M36 28V16q0-1.65-1.15-2.85Q33.65 12 32 12t-2.8 1.15Q28 14.35 28 16v12H16q-1.65 0-2.8 1.2Q12 30.35 12 32t1.2 2.85Q14.35 36 16 36h12v12q0 1.65 1.2 2.8Q30.35 52 32 52t2.85-1.2Q36 49.65 36 48V36h12q1.65 0 2.85-1.15Q52 33.65 52 32t-1.15-2.8Q49.65 28 48 28zM32 8q9.95 0 17 7.05Q56 22 56 32q0 9.95-7 17-7.05 7-17 7-10 0-16.95-7Q8 41.95 8 32q0-10 7.05-16.95Q22 8 32 8"
    />
  </svg>
);
export default SvgSteamDpadRight;
