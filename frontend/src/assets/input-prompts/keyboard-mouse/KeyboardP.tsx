import type { SVGProps } from "react";
const SvgKeyboardP = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="m25 22-1 1v19h4v-6h6.2q1.55-.05 2.8-.8l1.1-.8v-.05l.1-.1.05-.05 1.35-1.9.4-2.3v-2q0-2.5-1.75-4.25l-.05-.05-1.2-.9q-1.25-.75-2.8-.8zm3 4h6q.8 0 1.4.6h.05q.55.55.55 1.4v2.4l-.55.95-.1.1-.45.35-.85.2H28zM16 8h32q8 0 8 8v32q0 8-8 8H16q-8 0-8-8V16q0-8 8-8"
    />
  </svg>
);
export default SvgKeyboardP;
