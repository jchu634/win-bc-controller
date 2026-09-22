import type { SVGProps } from "react";
const SvgKeyboardAny = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M48 8q8 0 8 8v32q0 8-8 8H16q-8 0-8-8V16q0-8 8-8zm-1.75 16.2-2.75 4.1-2.75-4.1-2.5 1.65 3.75 5.6V38h3v-6.55l3.75-5.6zM20 28.75l.2-.45.05-.05q.3-.25.75-.25t.8.3l.2.45V31h-2zm-3 0V38h3v-4h2v4h3v-9.25q0-1.6-1.25-2.7Q22.55 25 21 25q-1.6 0-2.75 1.05h-.05q-1.2 1.1-1.2 2.7M37 38V25h-3v7l-4-7h-3v13h3v-7l4 7z"
    />
  </svg>
);
export default SvgKeyboardAny;
