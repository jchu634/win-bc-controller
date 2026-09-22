import type { SVGProps } from "react";
const SvgKeyboardW = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M16 8h32q8 0 8 8v32q0 8-8 8H16q-8 0-8-8V16q0-8 8-8m15 14-3 9-3-9h-4v2l6 18h2l3-9 3 9h2l6-18v-2h-4l-3 9-3-9z"
    />
  </svg>
);
export default SvgKeyboardW;
