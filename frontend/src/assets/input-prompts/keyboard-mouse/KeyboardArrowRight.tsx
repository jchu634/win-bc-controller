import type { SVGProps } from "react";
const SvgKeyboardArrowRight = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="m42 32-8-8h-2v4H22v8h10v4h2zm6 24H16q-8 0-8-8V16q0-8 8-8h32q8 0 8 8v32q0 8-8 8"
    />
  </svg>
);
export default SvgKeyboardArrowRight;
