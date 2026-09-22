import type { SVGProps } from "react";
const SvgKeyboardFunction = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M23 40v-6h7v-4h-7v-3h7v-4H19v17zm10 0h3v-7.65L42 40h3V27h-3v7.75L36 27h-3zM48 8q8 0 8 8v32q0 8-8 8H16q-8 0-8-8V16q0-8 8-8z"
    />
  </svg>
);
export default SvgKeyboardFunction;
