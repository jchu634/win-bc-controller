import type { SVGProps } from "react";
const SvgKeyboardI = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M16 8h32q8 0 8 8v32q0 8-8 8H16q-8 0-8-8V16q0-8 8-8m14 14v20h4V22z"
    />
  </svg>
);
export default SvgKeyboardI;
