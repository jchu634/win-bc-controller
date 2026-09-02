import type { SVGProps } from "react";
const SvgSwitchButtons = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M56 32q0 3.3-2.4 5.65Q51.25 40 48 40q-3.3 0-5.65-2.35T40 32q0-3.25 2.35-5.6Q44.7 24 48 24q3.25 0 5.6 2.4Q56 28.75 56 32M40 16q0 3.3-2.4 5.65Q35.25 24 32 24q-3.3 0-5.65-2.35T24 16q0-3.25 2.35-5.6Q28.7 8 32 8q3.25 0 5.6 2.4Q40 12.75 40 16M24 32q0 3.3-2.4 5.65Q19.25 40 16 40q-3.3 0-5.65-2.35T8 32q0-3.25 2.35-5.6Q12.7 24 16 24q3.25 0 5.6 2.4Q24 28.75 24 32m16 16q0 3.3-2.4 5.65Q35.25 56 32 56q-3.3 0-5.65-2.35T24 48q0-3.25 2.35-5.6Q28.7 40 32 40q3.25 0 5.6 2.4Q40 44.75 40 48"
    />
  </svg>
);
export default SvgSwitchButtons;
