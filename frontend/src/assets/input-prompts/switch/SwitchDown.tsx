import type { SVGProps } from "react";
const SvgSwitchDown = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M56 32q0 10-7.05 16.95Q42 56 32 56q-9.95 0-17-7.05Q8 42 8 32q0-9.95 7-17 7.05-7 17-7 10 0 16.95 7Q56 22.05 56 32m-13.25-4.2q.35-.6.2-1.25-.05-.7-.6-1.1-.5-.45-1.15-.45H22.85q-.7 0-1.2.45-.5.4-.65 1.1-.1.65.3 1.2l9.1 14.4q.35.55.95.75t1.2 0 1-.7z"
    />
  </svg>
);
export default SvgSwitchDown;
