import type { SVGProps } from "react";
const SvgSteamRt = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M14.5 49.5Q8 43 8 33.75v-17.6q0-.8.5-1.35t1.25-.65l43.95-6.1 1.25.2.85.85.2 1.2-3.75 26.5q-1.1 8.2-7.3 13.7l-.1.1Q38.5 56 30.2 56q-9.2 0-15.7-6.5M32 28h4v10h3V28h4v-3H32zm-10 4v-4h3q.85 0 1.4.55.6.6.6 1.45t-.6 1.4q-.55.6-1.35.6zm3 3 1-.1v.1l1 3h3l-1.5-4.5Q30 32.05 30 30t-1.5-3.55Q27.05 25 25 25h-6v13h3v-3z"
    />
  </svg>
);
export default SvgSteamRt;
