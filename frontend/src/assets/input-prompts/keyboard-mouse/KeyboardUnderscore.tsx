import type { SVGProps } from "react";
const SvgKeyboardUnderscore = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M48 56H16q-8 0-8-8V16q0-8 8-8h32q8 0 8 8v32q0 8-8 8M22 41v4h20v-4z"
    />
  </svg>
);
export default SvgKeyboardUnderscore;
