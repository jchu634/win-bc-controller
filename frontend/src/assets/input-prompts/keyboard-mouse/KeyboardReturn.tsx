import type { SVGProps } from "react";
const SvgKeyboardReturn = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M48 8q8 0 8 8v32q0 8-8 8H16q-8 0-8-8V36q0-8 8-8h12V16q0-8 8-8h12M29 41l6 6h2v-4h7.1q1.2-.05 2-.9.85-.8.9-2V29h-4v10h-6v-4h-2z"
    />
  </svg>
);
export default SvgKeyboardReturn;
