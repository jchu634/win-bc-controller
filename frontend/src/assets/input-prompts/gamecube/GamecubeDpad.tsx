import type { SVGProps } from "react";
const SvgGamecubeDpad = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M41 30v4h9v-4zm-7-16h-4v9h4zm-7-6h10q4 0 4 4v11h11q4 0 4 4v10q0 4-4 4H41v11q0 4-4 4H27q-4 0-4-4V41H12q-4 0-4-4V27q0-4 4-4h11V12q0-4 4-4M14 30v4h9v-4zm20 11h-4v9h4z"
    />
  </svg>
);
export default SvgGamecubeDpad;
