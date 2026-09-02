import type { SVGProps } from "react";
const SvgGenericButtonPressed = (props: SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={64} height={64} viewBox="0 0 64 64" {...props}>
    <path
      fill="currentColor"
      d="M32 22q7.65 0 12.95 3.7l.15.15q7.2 4.8 6.9 12v2.3q.3 7.2-6.9 12.05l-.15.1Q39.65 56 32 56t-12.95-3.7l.05.05q-7.4-4.85-7.1-12.2v-2.3q-.3-7.35 7.1-12.2l.6-.3Q24.8 22 32 22m0 2q-6.3 0-10.7 3.05V27q-5.5 3.6-5.3 9-.2 5.4 5.3 9 4.4 3 10.7 3t10.65-3l.05-.05q5.5-3.6 5.3-8.95.2-5.35-5.3-8.95l-.05-.05Q38.3 24 32 24m12 14q0 3.35-3.55 5.65Q37 46 32 46t-8.5-2.35Q20 41.35 20 38t3.5-5.65Q27 30 32 30t8.45 2.35Q44 34.65 44 38"
    />
  </svg>
);
export default SvgGenericButtonPressed;
