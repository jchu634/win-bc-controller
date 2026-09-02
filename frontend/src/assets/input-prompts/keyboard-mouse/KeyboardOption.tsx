import type { SVGProps } from "react";
const SvgKeyboardOption = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M48 8q8 0 8 8v32q0 8-8 8H16q-8 0-8-8V16q0-8 8-8zM29.25 22H20v4h6.75l8.05 16H44v-4h-6.75zM44 22h-8v4h8z"
    />
  </svg>
);
export default SvgKeyboardOption;
