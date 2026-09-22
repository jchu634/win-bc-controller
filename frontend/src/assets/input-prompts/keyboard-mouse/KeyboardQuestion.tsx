import type { SVGProps } from "react";
const SvgKeyboardQuestion = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M33.95 40q0-.85-.6-1.45-.55-.55-1.4-.55t-1.45.55q-.55.6-.55 1.45t.55 1.4q.6.6 1.45.6t1.4-.6q.6-.55.6-1.4m-4-10v6h4v-2q2.5 0 4.25-1.75T39.95 28q0-2.45-1.75-4.2l-.05-.05Q36.4 22 33.95 22H29.8q-2.35.05-4.05 1.75l-.05.05q-1 1-1.45 2.2l-.15.5 3.85 1.5q0-.8.55-1.35l.1-.1q.55-.55 1.3-.55h4.05q.8 0 1.35.55l.1.1q.55.55.55 1.35t-.6 1.4-1.4.6zM48 8q8 0 8 8v32q0 8-8 8H16q-8 0-8-8V16q0-8 8-8z"
    />
  </svg>
);
export default SvgKeyboardQuestion;
