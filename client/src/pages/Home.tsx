// Design: Operator's Field Notes — editorial modernism, warm paper, graphite ink, signal orange decisions, teal evidence.
// This page translates research into an annotated strategy brief with lightweight interactive exhibits.
import { useMemo, useState } from "react";
import { BarChart3, Check, ChevronRight, CircleArrowUp, Clipboard, ExternalLink, Link2, ShieldCheck, Sparkles, TimerReset, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";

const evidence = [
  { label: "Cloud uncertainty", value: 78, note: "Regulation, sovereignty, and cloud-act concerns slow adoption.", color: "#F26A3D" },
  { label: "Cyber exposure", value: 91, note: "The ITA cites about $500m in annual cybercrime losses across banks, MFIs, and FinTechs.", color: "#2B6F6B" },
  { label: "Relationship weight", value: 84, note: "The market rewards dependable partners and face-to-face trust building.", color: "#D49B3C" },
  { label: "Growth runway", value: 88, note: "Cloud, data centers, ecommerce, and digital finance are expanding.", color: "#425A72" },
];

const signalData = [
  { year: "Now", capabilities: 72, trust: 38, proof: 24 },
  { year: "90 days", capabilities: 76, trust: 61, proof: 47 },
  { year: "6 months", capabilities: 82, trust: 78, proof: 69 },
  { year: "12 months", capabilities: 86, trust: 89, proof: 84 },
];

const moves = [
  { id: "01", title: "Own the dependable-growth category", text: "Lead with the business outcome: critical digital operations that are built to earn trust, not simply shipped. Keep the existing specialist lanes as proof of depth." },
  { id: "02", title: "Make reliability a visible product", text: "Turn the 99.99% uptime promise, time-boxed scopes, observability, cost guardrails, and post-launch stewardship into a repeatable Trust System clients can see before they buy." },
  { id: "03", title: "Productize the first decision", text: "Use an Architecture & Risk Review as the low-friction entry point. It converts uncertainty into a scoped roadmap and creates a natural path to an MVP, AI sprint, or Shopify Plus build." },
  { id: "04", title: "Speak to serious operators by job-to-be-done", text: "Prioritize founders, service businesses, lean product teams, and commerce operators whose growth is constrained by reliability, compliance, or senior technical bandwidth." },
];

function ExhibitLabel({ children, source }: { children: React.ReactNode; source?: string }) {
  return <div className="exhibit-label"><span>{children}</span>{source && <span className="source-chip">Source {source}</span>}</div>;
}

export default function Home() {
  const [view, setView] = useState<"signal" | "move">("signal");
  const [copied, setCopied] = useState(false);
  const [selectedMove, setSelectedMove] = useState(0);
  const currentMove = moves[selectedMove];
  const shareText = useMemo(() => "Restart Inc positioning recommendation: become the dependable growth-systems partner for serious operators.", []);

  const copyReport = async () => {
    try { await navigator.clipboard.writeText(`${shareText} https://restart.ng/`); } catch { /* clipboard may be unavailable */ }
    setCopied(true); window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="report-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Restart positioning report home"><img src="/manus-storage/restart-r-monogram_9b578cf6.png" alt="" /><span>RESTART <em>/</em> FIELD NOTES</span></a>
        <nav><a href="#thesis">Thesis</a><a href="#signals">Signals</a><a href="#moves">Moves</a><a href="#sources">Sources</a></nav>
        <Button variant="outline" className="share-button" onClick={copyReport}>{copied ? <Check size={15} /> : <Link2 size={15} />}{copied ? "Copied" : "Share brief"}</Button>
      </header>

      <main id="top">
        <section className="hero container">
          <div className="hero-rail"><span className="eyebrow">POSITIONING REVIEW / 14 SEP 2026</span><span className="rail-line" /><span className="rail-caption">A working brief for the next chapter</span></div>
          <div className="hero-copy">
            <p className="kicker">RESEARCH BRIEF <span>•</span> RESTART INC.</p>
            <h1>Make <span>dependable delivery</span> the product.</h1>
            <p className="hero-deck">Restart already has the technical depth. The sharper position is the partner who makes ambitious digital operations feel credible, resilient, and ready for growth.</p>
            <div className="hero-actions"><a className="primary-action" href="#moves">See the recommended moves <ChevronRight size={17} /></a><a className="text-action" href="https://restart.ng/" target="_blank" rel="noreferrer">View current site <ExternalLink size={14} /></a></div>
          </div>
          <div className="hero-exhibit"><div className="exhibit-card"><img src="/manus-storage/restart-exhibit-accent_22d33b85.png" alt="Abstract rising signal lines" /><div className="exhibit-caption"><span>EXHIBIT 00</span><strong>The shift</strong><p>From “we can build it” to “we make it dependable.”</p></div></div></div>
        </section>

        <section id="thesis" className="thesis-band"><div className="container thesis-grid"><div><ExhibitLabel source="Restart Inc">01 / THESIS</ExhibitLabel><h2>Position Restart as the senior operating layer between ambition and reliability.</h2></div><div className="thesis-text"><p>The current site is rich in credible technical specifics—Laravel SaaS, Shopify Plus, AI engineering, architecture leadership, production readiness, and a 99.99% uptime guarantee. The opportunity is to make the meaning of those capabilities unmistakable.</p><blockquote>“A trusted and dependable technology partner for serious operators—building growth systems that hold up in production.”</blockquote><p className="small-note">This sharpens the professional mission without discarding the existing specialist offer.</p></div></div></section>

        <section id="signals" className="section container"><div className="section-heading"><div><ExhibitLabel source="ITA · NDPC · Restart Inc">02 / MARKET SIGNALS</ExhibitLabel><h2>Trust is not a soft benefit. It is the buying context.</h2></div><div className="section-intro">Nigeria’s digital economy is expanding, while cloud uncertainty, cyber exposure, and data-protection expectations make dependable technical stewardship more valuable.</div></div>
          <div className="signal-layout"><div className="signal-chart exhibit-card"><div className="card-top"><div><span className="card-kicker">SIGNAL INDEX</span><h3>Why the category is opening</h3></div><BarChart3 size={21} /></div><ResponsiveContainer width="100%" height={280}><BarChart data={evidence} layout="vertical" margin={{ top: 8, right: 14, left: 10, bottom: 8 }}><CartesianGrid horizontal={false} stroke="#D8D6CC" /><XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "#7B817A", fontSize: 11 }} /><YAxis dataKey="label" type="category" width={114} tickLine={false} axisLine={false} tick={{ fill: "#363D38", fontSize: 11 }} /><Tooltip cursor={{ fill: "#EFEEE8" }} contentStyle={{ background: "#1B211F", border: 0, borderRadius: 8, color: "#F3F0E8" }} formatter={(value) => [`${value}/100`, "Signal strength"]} /><Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={22}>{evidence.map((entry) => <Cell key={entry.label} fill={entry.color} />)}</Bar></BarChart></ResponsiveContainer><p className="chart-footnote">Directional synthesis, not a statistical market index. Scores translate the strength of the strategic signal in the cited sources.</p></div>
            <div className="signal-notes">{evidence.map((item, i) => <div className="signal-note" key={item.label}><span className="note-number">0{i + 1}</span><div><strong>{item.label}</strong><p>{item.note}</p></div></div>)}<a className="source-link" href="https://www.trade.gov/country-commercial-guides/nigeria-digital-economy" target="_blank" rel="noreferrer">Read the ITA market guide <ExternalLink size={13} /></a></div></div>
        </section>

        <section className="section contrast-section"><div className="container"><div className="section-heading"><div><ExhibitLabel source="Strategic synthesis">03 / THE GAP</ExhibitLabel><h2>Capability gets the meeting. Proof earns the relationship.</h2></div><div className="section-intro">The recommended shift is not a rebrand away from engineering. It is a reframe that makes engineering legible as business confidence.</div></div><div className="trend-grid"><div className="trend-chart exhibit-card"><div className="card-top"><div><span className="card-kicker">POSITIONING TRAJECTORY</span><h3>Build trust in public</h3></div><TrendingUp size={21} /></div><ResponsiveContainer width="100%" height={280}><LineChart data={signalData} margin={{ top: 10, right: 12, left: -16, bottom: 0 }}><CartesianGrid stroke="#33413C" strokeDasharray="3 5" /><XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: "#B2BDB5", fontSize: 11 }} /><YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "#B2BDB5", fontSize: 11 }} /><Tooltip contentStyle={{ background: "#F3F0E8", border: 0, borderRadius: 8, color: "#1B211F" }} /><Line type="monotone" dataKey="capabilities" stroke="#D49B3C" strokeWidth={2} dot={{ r: 3, fill: "#D49B3C" }} name="Capabilities" /><Line type="monotone" dataKey="trust" stroke="#75B3A6" strokeWidth={3} dot={{ r: 3, fill: "#75B3A6" }} name="Visible trust" /><Line type="monotone" dataKey="proof" stroke="#F26A3D" strokeWidth={3} dot={{ r: 3, fill: "#F26A3D" }} name="Proof assets" /></LineChart></ResponsiveContainer><div className="legend"><span><i className="gold" />Capabilities</span><span><i className="teal" />Visible trust</span><span><i className="orange" />Proof assets</span></div></div><div className="gap-list"><div className="gap-item"><ShieldCheck size={20} /><div><strong>Turn uptime into evidence</strong><p>Publish the operating system behind the guarantee: monitoring, incident response, deployment discipline, and a plain-English service promise.</p></div></div><div className="gap-item"><Clipboard size={20} /><div><strong>Turn compliance into reassurance</strong><p>Show privacy-by-design, data-handling choices, audit readiness, and breach-response hygiene as part of delivery.</p></div></div><div className="gap-item"><TimerReset size={20} /><div><strong>Turn seniority into continuity</strong><p>Make the post-launch relationship explicit: reviews, roadmap stewardship, mentorship, and a dependable escalation path.</p></div></div></div></div></div></section>

        <section id="moves" className="section container moves-section"><div className="section-heading"><div><ExhibitLabel source="Recommended action">04 / NEXT MOVES</ExhibitLabel><h2>Four moves to make the promise provable.</h2></div><div className="section-intro">A focused sequence keeps the brand close to the actual operating model: senior, scoped, pragmatic, and built for production.</div></div><div className="moves-layout"><div className="move-tabs" role="tablist">{moves.map((move, i) => <button key={move.id} role="tab" aria-selected={selectedMove === i} className={selectedMove === i ? "active" : ""} onClick={() => setSelectedMove(i)}><span>{move.id}</span>{move.title}<ChevronRight size={15} /></button>)}</div><div className="move-detail" role="tabpanel"><Sparkles size={22} className="move-icon" /><span className="card-kicker">MOVE {currentMove.id}</span><h3>{currentMove.title}</h3><p>{currentMove.text}</p><div className="move-footer"><span>Recommended signal</span><span className="signal-line" /></div></div></div></section>

        <section className="cta-section"><div className="container cta-grid"><div><ExhibitLabel>05 / POSITIONING LINE</ExhibitLabel><h2>Restart makes growth systems dependable.</h2></div><div><p>Use this as the connective tissue across the homepage, proposals, audits, and client conversations. It is broad enough to hold the four technical lanes, and specific enough to make the trust mission memorable.</p><a className="primary-action light" href="https://restart.ng/contact" target="_blank" rel="noreferrer">Shape the next brief <ChevronRight size={17} /></a></div></div></section>

        <section id="sources" className="sources-section container"><div className="section-heading"><div><ExhibitLabel>06 / SOURCES</ExhibitLabel><h2>Grounded in the operating context.</h2></div></div><div className="source-table"><a href="https://restart.ng/" target="_blank" rel="noreferrer"><span>01</span><strong>Restart Inc. official website</strong><small>Current positioning, services, delivery promises, and audience language <ExternalLink size={13} /></small></a><a href="https://www.trade.gov/country-commercial-guides/nigeria-digital-economy" target="_blank" rel="noreferrer"><span>02</span><strong>U.S. International Trade Administration</strong><small>Nigeria Digital Economy country commercial guide, published 8 Sep 2025 <ExternalLink size={13} /></small></a><a href="https://ndpc.gov.ng/" target="_blank" rel="noreferrer"><span>03</span><strong>Nigeria Data Protection Commission</strong><small>Mandate, privacy rights, responsible data handling, audits, and breach reporting <ExternalLink size={13} /></small></a></div><footer><span>Prepared by Manus AI · Research snapshot, 14 Sep 2026</span><span>For discussion, not legal or financial advice.</span></footer></section>
      </main>
    </div>
  );
}
