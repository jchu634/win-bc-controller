import type { SVGProps } from "react";
const SvgKeyboardArrowUp = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M56 16v32q0 8-8 8H16q-8 0-8-8V16q0-8 8-8h32q8 0 8 8m-24 6-8 8v2h4v10h8V32h4v-2z"
    />
  </svg>
);
export default SvgKeyboardArrowUp;
