import type { SVGProps } from "react";
const SvgGamecubeDpadHorizontal = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="#E73246"
      d="M41 23h11q4 0 4 4v10q0 4-4 4H41v-7h9v-4h-9zM23 41H12q-4 0-4-4V27q0-4 4-4h11v7h-9v4h9z"
    />
    <path
      fill="currentColor"
      d="M23 41V12q0-4 4-4h10q4 0 4 4v40q0 4-4 4H27q-4 0-4-4zm11-27h-4v9h4zm0 27h-4v9h4z"
    />
  </svg>
);
export default SvgGamecubeDpadHorizontal;
