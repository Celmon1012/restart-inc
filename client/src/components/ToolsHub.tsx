import { platformStack } from "@/data/stack";

const hubTools = platformStack.slice(0, 8);

/** Stack logos orbiting the Restart mark. Styles are the .ab-hub rules in styles/solutions.css. */
export default function ToolsHub() {
  return (
    <div className="ab-hub sol-reveal" aria-label="Technologies Restart builds on">
      <span className="ab-ring" aria-hidden="true" />
      <span className="ab-ring inner" aria-hidden="true" />
      <div className="ab-orbit">
        {hubTools.map((tool, i) => (
          <span className="ab-node" style={{ "--a": `${(360 / hubTools.length) * i}deg` } as React.CSSProperties} key={tool.name}>
            <span title={tool.name}><img src={tool.logo} alt={tool.name} /></span>
          </span>
        ))}
      </div>
      <div className="ab-core"><img src="/brand/restart-logo.svg" alt="Restart" /></div>
    </div>
  );
}
