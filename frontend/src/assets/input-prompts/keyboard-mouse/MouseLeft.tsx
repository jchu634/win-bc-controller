import type { SVGProps } from "react";
const SvgMouseLeft = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M34 10h10q1.75 0 2.9.6Q49 11.75 49 15v10H38v-6q0-2.5-1.75-4.25-1-1-2.25-1.4zm-4.1 6.9q.85-.9 2.1-.9t2.15.9q.85.85.85 2.1v8l-.15 1-.7 1.15q-.9.85-2.15.85t-2.1-.85q-.5-.5-.7-1.15l-.2-1v-8q0-1.25.9-2.1M15 28h11.1q.25 1.85 1.65 3.25Q29.5 33 32 33t4.25-1.75q1.4-1.4 1.7-3.25H49v9.5q-.2 6.75-5 11.5-4.75 4.8-11.5 5h-1q-6.75-.2-11.55-5Q15.2 44.25 15 37.5z"
    />
    <path
      fill="#E73246"
      d="M20 10h10v3.35q-1.25.4-2.25 1.4Q26 16.5 26 19v6H15V15q0-3.25 2.15-4.4 1.1-.6 2.85-.6"
    />
  </svg>
);
export default SvgMouseLeft;
