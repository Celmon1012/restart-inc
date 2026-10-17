// Gates every :hover rule behind (hover: hover) and (pointer: fine) so a tap on a
// phone never leaves a stuck hover state. Plain PostCSS plugin object: no imports,
// so it works from either Vite config. Rules already inside a hover media query
// (Tailwind's hover: variant) and keyframes are left alone.
const GATE = "(hover: hover) and (pointer: fine)";

function splitSelectors(selector: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of selector) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const isHover = (s: string) => /:hover\b/.test(s) && !/:not\([^)]*:hover/.test(s);

function insideGateOrKeyframes(node: any): boolean {
  for (let p = node.parent; p && p.type !== "root"; p = p.parent) {
    if (p.type !== "atrule") continue;
    if (/keyframes$/i.test(p.name)) return true;
    if (p.name === "media" && /hover\s*:\s*hover/.test(p.params)) return true;
  }
  return false;
}

export default function hoverGate() {
  return {
    postcssPlugin: "restart-hover-gate",
    Once(root: any, { AtRule }: any) {
      root.walkRules((rule: any) => {
        if (insideGateOrKeyframes(rule)) return;
        const parts = splitSelectors(rule.selector);
        const hover = parts.filter(isHover);
        if (!hover.length) return;
        const rest = parts.filter((s) => !isHover(s));
        const gated = rule.clone({ selector: hover.join(", ") });
        const media = new AtRule({ name: "media", params: GATE });
        media.append(gated);
        rule.after(media);
        if (rest.length) rule.selector = rest.join(", ");
        else rule.remove();
      });
    },
  };
}
hoverGate.postcss = true;
