import type { SVGProps } from "react";
const SvgKeyboardInsert = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M16 8h32q8 0 8 8v32q0 8-8 8H16q-8 0-8-8V16q0-8 8-8m25 20h4v-3h-4q-1.6 0-2.8 1.2T37 29t1.2 2.8 2.75 1.2h.1q.35 0 .65.3l.3.7-.3.7-.7.3h-4v3h4q1.6 0 2.8-1.2T45 34t-1.2-2.8-2.75-1.2h-.1l-.65-.3q-.3-.3-.3-.7t.3-.7.7-.3M23 38V25h-3v13zm12 0V25h-3v7l-4-7h-3v13h3v-7l4 7z"
    />
  </svg>
);
export default SvgKeyboardInsert;
