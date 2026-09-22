import type { SVGProps } from "react";
const SvgSteamdeckButtonView = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M29 30v8h12v-8zm-6.1-8h18.2q4.5 0 7.7 2.9Q52 27.85 52 32q0 4.1-3.2 7.05T41.1 42H22.9q-4.5 0-7.7-2.95T12 32q0-4.15 3.2-7.1 3.2-2.9 7.7-2.9m.1 4v8h4v-2h-2v-4h10v-2z"
    />
  </svg>
);
export default SvgSteamdeckButtonView;
