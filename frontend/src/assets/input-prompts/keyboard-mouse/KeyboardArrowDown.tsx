import type { SVGProps } from "react";
const SvgKeyboardArrowDown = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M8 48V16q0-8 8-8h32q8 0 8 8v32q0 8-8 8H16q-8 0-8-8m24-6 8-8v-2h-4V22h-8v10h-4v2z"
    />
  </svg>
);
export default SvgKeyboardArrowDown;
