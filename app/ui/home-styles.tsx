import { indigo } from './home-colors.ts'

/**
 * Head-only landing-page declarations. Rendered through Document's `head` prop
 * so the style element stays in <head> instead of inside HomePage's body <div>.
 */
export function HomeStyles() {
  return () => (
    <style>{`
      :root {
        --home-accent-indigo: ${indigo[600]};
        --home-accent-indigo-soft: ${indigo[400]};
        --home-accent-amber: #b45309;
        --home-accent-emerald: #047857;
        --home-text-muted: #5f6672;
      }
      [data-theme="dark"] {
        --home-accent-indigo: #a5b4fc;
        --home-accent-indigo-soft: #c7d2fe;
        --home-accent-amber: #fcd34d;
        --home-accent-emerald: #6ee7b7;
        --home-text-muted: #a3aab2;
      }
      @keyframes fadeSlideUp { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
      @keyframes pulse-dim { 0%,100%{opacity:.6} 50%{opacity:1} }
      @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
      @keyframes gradientShift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after {
          animation: none !important;
          transition: none !important;
        }
      }
    `}</style>
  )
}
