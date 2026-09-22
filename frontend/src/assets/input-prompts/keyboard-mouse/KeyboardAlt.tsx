import type { SVGProps } from "react";
const SvgKeyboardAlt = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M56 22v20q0 4.9-3 6.8-1.9 1.2-5 1.2H16q-3.1 0-5-1.2-3-1.9-3-6.8V22q0-8 8-8h32q8 0 8 8M43 38V28h3v-3h-9v3h3v10zm-24-9.25V38h3v-4h2v4h3v-9.25q0-1.6-1.25-2.7Q24.55 25 23 25q-1.6 0-2.75 1.05h-.05q-1.2 1.1-1.2 2.7M29 25v13h8v-3h-5V25zm-7 3.75.2-.45.05-.05q.3-.25.75-.25l.8.3.2.45V31h-2z"
    />
  </svg>
);
export default SvgKeyboardAlt;
