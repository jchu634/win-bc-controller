import type { SVGProps } from "react";
const SvgXboxButtonView = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="m28 43 1 1h15l1-1V30l-1-1H29l-1 1zm-8-8 1 1h5v-3h-3v-9.05h11V27h3v-5l-1-1H21l-1 1zm36-3q0 10-7.05 16.95Q42 56 32 56q-9.95 0-17-7.05Q8 42 8 32q0-9.95 7-17 7.05-7 17-7 10 0 16.95 7Q56 22.05 56 32m-14 0v9H31v-9z"
    />
  </svg>
);
export default SvgXboxButtonView;
