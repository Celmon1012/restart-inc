import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowUpRight, Github, Linkedin, Mail, Phone } from "lucide-react";
import { faqs } from "@/data/faqs";
import { platformStack } from "@/data/stack";

/*
 * Closing sections shared by the Solutions and Case Studies pages. Styles live
 * in styles/solutions.css (.sol-*), so the importing page must load that file.
 */

export function FaqSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  return (
    <section className="sol-section sol-wrap" id="faq">
      <div className="sol-head sol-reveal">
        <span className="sol-eyebrow">FAQS</span>
        <h2 className="sol-h2">Good questions. <span>Useful answers.</span></h2>
      </div>
      <div className="sol-faq">
        {faqs.map(([question, answer], i) => {
          const open = openFaq === i;
          return (
            <div className={`sol-faq-item sol-reveal ${open ? "open" : ""}`} key={question}>
              <button type="button" aria-expanded={open} aria-controls={`sol-faq-${i}`} onClick={() => setOpenFaq(open ? null : i)}>
                <span>{question}</span>
                <span className="sol-faq-icon" aria-hidden="true" />
              </button>
              <div className="sol-faq-body" id={`sol-faq-${i}`} role="region">
                <div><p>{answer}</p></div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function ContactSection({ eyebrow, heading, lede }: { eyebrow: string; heading: ReactNode; lede: string }) {
  return (
    <section className="sol-wrap" id="contact">
      <div className="sol-contact sol-reveal">
        <div className="sol-hero-art" aria-hidden="true"><span className="sol-orb a" /><span className="sol-orb b" /></div>
        <div className="sol-contact-copy">
          <span className="sol-eyebrow">{eyebrow}</span>
          <h2 className="sol-h2">{heading}</h2>
          <p className="sol-lede">{lede}</p>
          <ul className="sol-contact-list">
            <li><a href="mailto:hello@restart.ng"><span><Mail size={16} /></span>hello@restart.ng</a></li>
            <li><a href="tel:+2349060114747"><span><Phone size={16} /></span>+234 906 011 4747</a></li>
          </ul>
        </div>
        <div className="sol-contact-card">
          <h3>Tell us what you’re building</h3>
          <p>A short note on the system and the constraint is enough. We reply quickly with whether it is a fit.</p>
          <div className="sol-contact-actions">
            <Link href="/start-project" className="button solid">Start a project <ArrowUpRight size={15} /></Link>
            <Link href="/contact" className="button outline">Send a message</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export function SignOff() {
  return (
    <section className="sol-sign" aria-label="Restart">
      <span className="sol-watermark" aria-hidden="true">Restart</span>
      <div className="sol-sign-inner sol-reveal">
        <p>Follow the work</p>
        <div className="sol-socials">
          <a href="https://www.linkedin.com/company/restart-inc-ng" target="_blank" rel="noreferrer"><Linkedin size={15} />LinkedIn</a>
          <a href="https://github.com/Restart-inc" target="_blank" rel="noreferrer"><Github size={15} />GitHub</a>
        </div>
      </div>
    </section>
  );
}

export function StackMarquee({ label = "Built on tools you could hire for" }: { label?: string }) {
  return (
    <div className="sol-marquee-wrap sol-reveal">
      <span className="sol-marquee-label">{label}</span>
      <div className="sol-marquee">
        <div className="sol-marquee-track">
          {[0, 1].map((copy) => platformStack.map((item) => (
            <span className="sol-marquee-item" key={`${copy}-${item.name}`} aria-hidden={copy === 1 ? "true" : undefined}>
              <img src={item.logo} alt="" />{item.name}
            </span>
          )))}
        </div>
      </div>
    </div>
  );
}
