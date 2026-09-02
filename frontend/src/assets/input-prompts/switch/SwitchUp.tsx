import type { SVGProps } from "react";
const SvgSwitchUp = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M56 32q0 10-7.05 16.95Q42 56 32 56q-9.95 0-17-7.05Q8 42 8 32q0-9.95 7-17 7.05-7 17-7 10 0 16.95 7Q56 22.05 56 32m-34.75 4.2q-.35.6-.2 1.25.1.7.6 1.1l1.2.45h18.3q.7 0 1.2-.45.5-.4.65-1.1.1-.65-.3-1.2L33.6 21.9q-.3-.55-.9-.8-.65-.15-1.25 0-.6.25-.95.75z"
    />
  </svg>
);
export default SvgSwitchUp;
