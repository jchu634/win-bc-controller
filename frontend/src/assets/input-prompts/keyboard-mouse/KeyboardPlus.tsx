import type { SVGProps } from "react";
const SvgKeyboardPlus = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M40 30h-6v-6h-4v6h-6v4h6v6h4v-6h6zM16 8h32q8 0 8 8v32q0 4.9-3 6.8-1.9 1.2-5 1.2H16q-3.1 0-5-1.2-3-1.9-3-6.8V16q0-8 8-8"
    />
  </svg>
);
export default SvgKeyboardPlus;
