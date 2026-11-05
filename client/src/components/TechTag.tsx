import { techLogo } from "@/data/stack";

/** A tag with its tool's logo in front when we have one, as in the stack marquee. */
export default function TechTag({ name }: { name: string }) {
  const logo = techLogo(name);
  return (
    <span>
      {logo && <img src={logo} alt="" />}
      {name}
    </span>
  );
}
