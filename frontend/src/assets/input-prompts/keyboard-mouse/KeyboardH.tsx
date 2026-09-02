import type { SVGProps } from "react";
const SvgKeyboardH = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M16 8h32q3.45 0 5.45 1.5Q56 11.45 56 16v32q0 8-8 8H16q-8 0-8-8V16q0-4.55 2.6-6.5Q12.55 8 16 8m8 14v20h4v-8h8v8h4V22h-4v8h-8v-8z"
    />
  </svg>
);
export default SvgKeyboardH;
