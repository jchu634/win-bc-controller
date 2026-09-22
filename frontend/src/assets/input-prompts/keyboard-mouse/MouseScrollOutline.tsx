import type { SVGProps } from "react";
const SvgMouseScrollOutline = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M47 38v-7h-9.05q-.3 1.85-1.7 3.25Q34.5 36 32 36t-4.25-1.75q-1.4-1.4-1.65-3.25H17v7q0 5.35 3.85 9.2Q24.65 51 30 51h4q5.35 0 9.2-3.8Q47 43.35 47 38M21.5 10h21q7.5.25 7.5 8v20q0 6.6-4.7 11.3T34 54h-4q-6.6 0-11.3-4.7T14 38V18q0-7.75 7.5-8M17 18v10h9v-6q0-2.5 1.75-4.25 1-1 2.25-1.4V13h-8q-5 0-5 5m25-5h-8v3.35q1.25.4 2.25 1.4Q38 19.5 38 22v6h9V18q0-5-5-5"
    />
  </svg>
);
export default SvgMouseScrollOutline;
