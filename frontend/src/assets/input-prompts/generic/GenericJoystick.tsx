import type { SVGProps } from "react";
const SvgGenericJoystick = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M35 41q0 1.25-.9 2.1-.85.9-2.1.9t-2.15-.9Q29 42.25 29 41v-7.35q-1.6-.4-3-1.2-1.3-.8-2.45-1.95Q20 26.95 20 22t3.55-8.45Q27.05 10 32 10t8.5 3.55Q44 17.05 44 22t-3.5 8.5q-1.15 1.15-2.5 1.95-1.4.8-3 1.2zm11 3q.3 4.6-4.9 7.7h.05Q37.4 54 32 54q-5.35 0-9.15-2.3Q17.7 48.6 18 44q-.3-4.6 4.85-7.65v-.05q1.45-.9 3.15-1.4v2.3l-1.1.55Q22 39.5 22 42t2.9 4.25Q27.85 48 32 48t7.05-1.75Q42 44.5 42 42t-2.95-4.25L38 37.2v-2.3q1.7.55 3.15 1.45l-.05-.05q5.2 3.1 4.9 7.7"
    />
  </svg>
);
export default SvgGenericJoystick;
