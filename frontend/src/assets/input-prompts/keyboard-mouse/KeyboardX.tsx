import type { SVGProps } from "react";
const SvgKeyboardX = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M16 8h32q8 0 8 8v32q0 8-8 8H16q-8 0-8-8V16q0-8 8-8m7 17 6 7-6 7v1l2.25 2h1.15l5.6-6.5 5.65 6.5h1.1L41 40v-1l-6-7 6-7v-1l-2.25-2h-1.1L32 28.55 26.4 22h-1.15L23 24z"
    />
  </svg>
);
export default SvgKeyboardX;
