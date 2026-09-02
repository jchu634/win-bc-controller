import type { SVGProps } from "react";
const SvgMouseHorizontal = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <g fill="currentColor">
      <path d="m39.8 18 1.85.45q1.35.85 1.35 3.3V27h-6v-1q0-2.1-1.45-3.55-1.1-1.1-2.55-1.35V18zM32 23q1.25 0 2.1.85.9.9.9 2.15v4.1q0 1.15-.9 2-.8.85-1.95.9h-.3q-1.15-.05-2-.9t-.85-2V26q0-1.25.85-2.15.9-.85 2.15-.85m11 12.65V36q-.2 4-3.2 6.85-3.1 3-7.45 3.15h-.65q-4.35-.15-7.5-3.15Q21.25 40 21.05 36l-.05-.3V29h6.1v2q.25 1.45 1.35 2.55Q29.9 35 32 35q2.05 0 3.5-1.45l.05-.05q1.1-1.1 1.35-2.5v-2H43zm-22-13.9q0-2.45 1.4-3.3.7-.45 1.85-.45H31v3.1q-1.4.25-2.5 1.3l-.1.1Q27 23.95 27 26v1h-6zM9 32l6-6h2v12h-2zM55 32l-6 6h-2V26h2z" />
    </g>
  </svg>
);
export default SvgMouseHorizontal;
