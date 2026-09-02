import type { SVGProps } from "react";
const SvgXboxDpadVertical = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="#E73246"
      d="M41 41v11q0 4-4 4H27q-4 0-4-4V41zM23 23V12q0-4 4-4h10q4 0 4 4v11z"
    />
    <path
      fill="currentColor"
      d="M23 23h29q4 0 4 4v10q0 4-4 4H12q-4 0-4-4V27q0-4 4-4z"
    />
  </svg>
);
export default SvgXboxDpadVertical;
