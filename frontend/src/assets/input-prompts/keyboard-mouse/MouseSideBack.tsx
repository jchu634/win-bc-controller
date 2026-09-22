import type { SVGProps } from "react";
const SvgMouseSideBack = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M39 10h10q1.75 0 2.9.6Q54 11.75 54 15v10H43v-6q0-2.5-1.75-4.25-1-1-2.25-1.4zM20 28h11.1q.25 1.85 1.65 3.25Q34.5 33 37 33t4.25-1.75q1.4-1.4 1.7-3.25H54v9.5q-.2 6.75-5 11.5-4.75 4.8-11.5 5h-1q-6.75-.2-11.55-5Q20.2 44.25 20 37.5zm5-18h10v3.35q-1.25.4-2.25 1.4Q31 16.5 31 19v6H20V15q0-3.25 2.15-4.4 1.1-.6 2.85-.6m9.9 6.9q.85-.9 2.1-.9t2.15.9q.85.85.85 2.1v8l-.15 1-.7 1.15q-.9.85-2.15.85t-2.1-.85q-.5-.5-.7-1.15l-.2-1v-8q0-1.25.9-2.1M11 10h4q2 0 2 2v11q0 2-2 2h-4q-2 0-2-2V12q0-2 2-2"
    />
    <path
      fill="#E73246"
      d="M11 28h4q2 0 2 2v11q0 2-2 2h-4q-2 0-2-2V30q0-2 2-2"
    />
  </svg>
);
export default SvgMouseSideBack;
