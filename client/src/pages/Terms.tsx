import { Link } from "wouter";
import LegalPageLayout, { type LegalSection } from "@/components/LegalPageLayout";

const LAST_UPDATED = "24 September 2026";

const sections: LegalSection[] = [
  {
    id: "agreement",
    heading: "These terms and how they apply",
    body: (
      <>
        <p>
          These Terms of Service (<strong>"Terms"</strong>) are a legal agreement between you and{" "}
          <strong>Restart Inc.</strong> (<strong>"Restart"</strong>, <strong>"we"</strong>,{" "}
          <strong>"us"</strong>), a company registered in Nigeria with its office in Lagos. They govern
          your use of our websites (<a href="https://restart.ng">restart.ng</a> and{" "}
          <a href="https://console.restart.ng">console.restart.ng</a>) and any client workspace or
          console access we provide.
        </p>
        <p>
          By using our websites or the console, you agree to these Terms. If you are agreeing on
          behalf of an organisation, you confirm you have authority to bind that organisation.
        </p>
        <div className="legal-callout">
          <p>
            <strong>These Terms do not replace your service agreement.</strong> Engineering services
            are delivered under a separate signed statement of work, master services agreement, or
            proposal acceptance. Where that document conflicts with these Terms, the signed document
            prevails for the services it covers.
          </p>
        </div>
      </>
    ),
  },
  {
    id: "definitions",
    heading: "Definitions",
    body: (
      <ul>
        <li>
          <strong>"Client"</strong> means an organisation that has engaged Restart to deliver services.
        </li>
        <li>
          <strong>"Console"</strong> means the client workspace at console.restart.ng, including
          delivery tracking, systems status, billing, and support features.
        </li>
        <li>
          <strong>"Deliverables"</strong> means software, documentation, infrastructure configuration, or
          other materials Restart produces for a Client under a statement of work.
        </li>
        <li>
          <strong>"Services"</strong> means engineering, architecture, AI, commerce, and advisory work
          Restart performs.
        </li>
        <li>
          <strong>"Statement of Work"</strong> or <strong>"SOW"</strong> means the document describing
          scope, deliverables, timeline, and fees for a specific engagement.
        </li>
        <li>
          <strong>"You"</strong> means the individual or organisation using our websites, the Console,
          or the Services.
        </li>
      </ul>
    ),
  },
  {
    id: "console-access",
    heading: "Console access and account security",
    body: (
      <>
        <p>
          Access to the Console is provided to Clients and their authorised personnel. You are
          responsible for keeping your credentials confidential and for all activity under your
          account.
        </p>
        <ul>
          <li>Do not share login credentials; we support individual accounts with role-based access.</li>
          <li>Tell us immediately at <a href="mailto:support@restart.ng">support@restart.ng</a> if you suspect unauthorised access.</li>
          <li>We may suspend access to protect the platform, your data, or other clients, and will tell you why.</li>
          <li>We may add, change, or retire Console features, and will give reasonable notice of changes that materially affect how you work.</li>
        </ul>
      </>
    ),
  },
  {
    id: "acceptable-use",
    heading: "Acceptable use",
    body: (
      <>
        <p>You agree not to use our websites, the Console, or the Services to:</p>
        <ul>
          <li>break any applicable law, including the Nigeria Data Protection Act 2023 and the Cybercrimes Act 2015;</li>
          <li>attempt to gain unauthorised access to any system, account, or data, or to probe or scan our infrastructure without written permission;</li>
          <li>interfere with or disrupt the integrity or performance of our platforms, including through denial-of-service attempts, load testing without agreement, or automated scraping;</li>
          <li>reverse engineer, decompile, or attempt to derive source code from any part of the platform, except where that restriction is prohibited by law;</li>
          <li>resell, sublicense, or provide the Console to third parties as a service without our written agreement;</li>
          <li>upload malicious code, or content that infringes another person's rights, is defamatory, or is unlawful;</li>
          <li>submit data you do not have the right to submit — including personal data you are not lawfully permitted to share with us.</li>
        </ul>
        <p>
          Where you make a claim or submission through our forms, you confirm the information is
          accurate and that you are entitled to provide it.
        </p>
      </>
    ),
  },
  {
    id: "services",
    heading: "Engineering services and scope",
    body: (
      <>
        <p>
          Services are delivered under a signed SOW or an accepted written proposal. The SOW sets out
          the deliverables, assumptions, dependencies, timeline, fees, and acceptance criteria for the
          engagement. Anything not listed in the SOW is out of scope.
        </p>
        <p>
          <strong>Change control.</strong> If you request work beyond the agreed scope, we will
          describe the impact on timeline and cost in writing before proceeding. Work continues on the
          original scope until the change is agreed.
        </p>
        <p>
          <strong>Your responsibilities.</strong> Timely delivery depends on you providing access,
          information, decisions, and feedback within the agreed timeframes. Delays in these will move
          associated dates accordingly, and we will tell you when that happens.
        </p>
        <p>
          <strong>Estimates.</strong> Any timeline or effort estimate is given in good faith based on
          information available at the time. Where we become aware it is no longer realistic, we will
          tell you as soon as we know, not at the deadline.
        </p>
      </>
    ),
  },
  {
    id: "fees",
    heading: "Fees, invoicing, and payment",
    body: (
      <>
        <p>
          Fees, currency, and payment milestones are set out in the SOW or invoice. Unless stated
          otherwise there:
        </p>
        <ul>
          <li>
            we issue invoices at the milestones or intervals described in the SOW;
          </li>
          <li>
            invoices are payable within <strong>14 days</strong> of the invoice date;
          </li>
          <li>
            fees are exclusive of value added tax and any other applicable taxes and duties, which are
            added where required by law;
          </li>
          <li>
            amounts not paid by the due date may attract interest at <strong>2% per month</strong> or
            the maximum rate permitted by Nigerian law, whichever is lower;
          </li>
          <li>
            we may suspend work or Console access where undisputed invoices remain unpaid after written
            notice, and will resume promptly once the account is cleared.
          </li>
        </ul>
        <p>
          <strong>Disputed invoices.</strong> If you dispute an invoice in good faith, tell us in
          writing within 14 days, setting out the basis and the amount in dispute. You agree to pay the
          undisputed balance, and we will resolve the dispute promptly without suspending work for the
          disputed portion while it is being discussed.
        </p>
        <div className="legal-callout">
          <p>
            Nothing in this section limits your rights as a consumer under the Federal Competition and
            Consumer Protection Act 2018, including the right to clear and transparent pricing without
            hidden charges.
          </p>
        </div>
      </>
    ),
  },
  {
    id: "ip",
    heading: "Intellectual property",
    body: (
      <>
        <p>
          <strong>Your materials.</strong> You retain all rights to data, content, trademarks, and
          materials you provide to us. You grant us a limited licence to use them only as needed to
          deliver the Services.
        </p>
        <p>
          <strong>Deliverables.</strong> On full payment of all fees for the relevant engagement,
          Restart assigns to you the intellectual property rights in the bespoke Deliverables created
          specifically for you under that SOW.
        </p>
        <p>
          <strong>What is not assigned.</strong> Restart retains ownership of:
        </p>
        <ul>
          <li>pre-existing materials, tools, libraries, and frameworks we owned or developed before, or independently of, your engagement;</li>
          <li>generic know-how, techniques, architecture patterns, and internal accelerators used across our engagements;</li>
          <li>third-party and open-source components, which remain under their own licences.</li>
        </ul>
        <p>
          Where Restart's pre-existing or reusable components are embedded in your Deliverables, we
          grant you a perpetual, non-exclusive, worldwide, royalty-free licence to use, modify, and
          distribute them as part of those Deliverables.
        </p>
        <p>
          <strong>Our websites.</strong> The design, content, branding, and code of our marketing site
          and Console remain our property. You may not copy or reuse them apart from normal browsing and
          the Console access we grant.
        </p>
        <p>
          <strong>Publicity.</strong> We will not name you as a client or publish a case study about your
          engagement without your written permission.
        </p>
      </>
    ),
  },
  {
    id: "confidentiality",
    heading: "Confidentiality",
    body: (
      <>
        <p>
          Each party may receive information that the other treats as confidential — including
          architecture, source code, business metrics, and personal data. The receiving party agrees to:
        </p>
        <ul>
          <li>use it only to perform its obligations under the agreement;</li>
          <li>protect it with at least the same care it applies to its own confidential information, and no less than reasonable care;</li>
          <li>restrict access to personnel and subcontractors who need it and are under equivalent confidentiality obligations;</li>
          <li>return or securely destroy it on request or at the end of the engagement, subject to legal retention obligations.</li>
        </ul>
        <p>
          These obligations do not apply to information that is or becomes public without breach, was
          already lawfully known to the receiving party, is independently developed without reference to
          the confidential information, or must be disclosed by law or a competent authority — in which
          case the receiving party will give advance notice where lawfully permitted.
        </p>
        <p>
          Confidentiality obligations survive the end of the engagement for <strong>three years</strong>,
          and indefinitely for source code and personal data.
        </p>
      </>
    ),
  },
  {
    id: "data-protection",
    heading: "Data protection",
    body: (
      <>
        <p>
          Our handling of personal data is described in our{" "}
          <Link href="/privacy">Privacy Policy</Link>, which forms part of these Terms.
        </p>
        <p>
          Where we process personal data on your behalf as part of an engagement, we act as a data
          processor and you act as the data controller. You are responsible for ensuring you have a
          lawful basis to share the data with us and to instruct the processing. We will process it only
          on your documented instructions, apply appropriate security measures, and assist you with your
          own obligations under the <strong>Nigeria Data Protection Act 2023</strong>.
        </p>
        <p>
          Where an engagement involves personal data belonging to individuals outside Nigeria, you are
          responsible for identifying any additional requirements that apply, including lawful transfer
          mechanisms, and we will work with you in good faith to meet them.
        </p>
      </>
    ),
  },
  {
    id: "warranties",
    heading: "Warranties and disclaimers",
    body: (
      <>
        <p>
          We warrant that:
        </p>
        <ul>
          <li>we will perform the Services with the reasonable skill and care expected of a competent engineering firm;</li>
          <li>we have the right to enter into the agreement and to grant the rights we grant under it;</li>
          <li>to our knowledge, Deliverables we create do not infringe the intellectual property rights of third parties;</li>
          <li>we will comply with applicable Nigerian law in delivering the Services.</li>
        </ul>
        <p>
          <strong>Website content.</strong> Our websites are provided on an "as available" basis. We work
          to keep them accurate and available, but we do not warrant that they will be uninterrupted,
          error-free, or free of harmful components, or that any content is complete or current. Technical
          writing and Insights articles describe our professional perspective and are not advice for your
          specific circumstances — see section 13.
        </p>
        <p>
          To the extent permitted by law, we exclude all other warranties, whether express or implied,
          including implied warranties of merchantability and fitness for a particular purpose. Nothing
          in these Terms excludes or limits any warranty or right that Nigerian law does not allow to be
          excluded.
        </p>
      </>
    ),
  },
  {
    id: "liability",
    heading: "Limitation of liability",
    body: (
      <>
        <p>
          Nothing in these Terms limits liability for death or personal injury caused by negligence,
          fraud or fraudulent misrepresentation, wilful misconduct, or any liability that cannot lawfully
          be limited.
        </p>
        <p>
          Subject to that:
        </p>
        <ul>
          <li>
            neither party is liable for indirect or consequential loss, loss of profit, loss of revenue,
            loss of anticipated savings, or loss of business opportunity, however arising;
          </li>
          <li>
            our total aggregate liability arising out of or in connection with an engagement is limited
            to the <strong>total fees paid by you to us under the relevant SOW in the twelve months
            preceding the event giving rise to the claim</strong>;
          </li>
          <li>
            our total aggregate liability arising out of your use of our websites or the Console, where
            no SOW applies, is limited to <strong>NGN 1,000,000</strong>.
          </li>
        </ul>
        <p>
          These limits apply whether the claim arises in contract, tort (including negligence),
          statute, or otherwise, and even if a limited remedy is found to have failed its essential
          purpose.
        </p>
        <div className="legal-callout">
          <p>
            If you are a consumer, these limits apply only to the extent permitted by the Federal
            Competition and Consumer Protection Act 2018, and nothing here removes a consumer right that
            cannot lawfully be excluded.
          </p>
        </div>
      </>
    ),
  },
  {
    id: "indemnity",
    heading: "Indemnities",
    body: (
      <>
        <p>
          <strong>Your indemnity.</strong> You agree to indemnify Restart against third-party claims
          arising from data or materials you provided to us that you did not have the right to provide,
          from your use of the Deliverables in breach of the agreement or applicable law, or from your
          breach of section 4 (Acceptable use).
        </p>
        <p>
          <strong>Our indemnity.</strong> We agree to indemnify you against third-party claims that
          bespoke Deliverables we created for you infringe their intellectual property rights, provided
          you tell us promptly, allow us to control the defence, and give reasonable assistance. Our
          sole obligation for such a claim is to procure the right for you to continue using the
          affected Deliverable, modify it so it is non-infringing, or replace it with an equivalent
          non-infringing deliverable.
        </p>
        <p>
          Our indemnity does not apply where the claim arises from your materials, modifications you or
          a third party made, use in combination with something we did not supply, or your failure to
          use an updated version we provided.
        </p>
      </>
    ),
  },
  {
    id: "third-party",
    heading: "Third-party services and external links",
    body: (
      <>
        <p>
          Engagements frequently rely on third-party platforms, APIs, and open-source software. Their
          terms and availability are outside our control, and we are not responsible for their
          performance, changes, or discontinuation. Where we know a dependency carries material risk, we
          will flag it during scoping and architecture.
        </p>
        <p>
          Our websites and Insights articles may link to external sites. Those links are provided for
          convenience; we do not control their content and are not responsible for it.
        </p>
      </>
    ),
  },
  {
    id: "no-advice",
    heading: "No professional advice",
    body: (
      <p>
        Content on our websites — including Insights articles, architecture discussion, and any code
        examples — reflects our professional perspective for general information. It is not legal,
        financial, security, or compliance advice, and it is not a substitute for assessment of your own
        systems and circumstances. Decisions you make based on our published content are yours. If you
        need advice for your situation, engage us under a SOW or consult a suitably qualified adviser.
      </p>
    ),
  },
  {
    id: "term",
    heading: "Term, suspension, and termination",
    body: (
      <>
        <p>
          <strong>Term.</strong> These Terms apply while you use our websites or the Console, and
          continue for as long as any SOW remains in effect.
        </p>
        <p>
          <strong>Termination for convenience.</strong> Either party may end an engagement for
          convenience on <strong>30 days'</strong> written notice. Where an SOW specifies a different
          notice period, the SOW applies.
        </p>
        <p>
          <strong>Termination for cause.</strong> Either party may end the agreement immediately if the
          other commits a material breach that is not remedied within 14 days of written notice, becomes
          insolvent or unable to pay its debts, or does anything that brings the other into disrepute.
        </p>
        <p>
          <strong>Effect of termination.</strong> On termination, you pay for work performed and
          commitments properly incurred up to the date of termination. We will deliver work in progress
          and hand over materials as agreed in the SOW. Sections that by their nature should survive —
          including confidentiality, intellectual property, data protection, liability, and governing law
          — continue to apply.
        </p>
      </>
    ),
  },
  {
    id: "disputes",
    heading: "Governing law and dispute resolution",
    body: (
      <>
        <p>
          These Terms and any dispute arising out of or in connection with them are governed by the laws
          of the <strong>Federal Republic of Nigeria</strong>.
        </p>
        <p>
          <strong>Talk to us first.</strong> Before starting formal proceedings, both parties agree to
          attempt to resolve the dispute in good faith by escalating it to a senior representative of
          each party, who will meet, physically or remotely, within 14 days of a written request. This
          step does not prevent either party from seeking urgent interim relief.
        </p>
        <p>
          <strong>Arbitration.</strong> If the dispute is not resolved within 30 days of that escalation,
          it will be referred to and finally resolved by arbitration in <strong>Lagos, Nigeria</strong>{" "}
          under the <strong>Arbitration and Mediation Act 2023</strong>. The tribunal will consist of a
          single arbitrator appointed by agreement between the parties, or, failing agreement within 14
          days, appointed in accordance with that Act. The seat of arbitration is Lagos, the language is
          English, and the award is final and binding.
        </p>
        <p>
          We choose arbitration deliberately: it keeps commercial matters confidential, which matters
          when a dispute involves architecture, source code, or client systems.
        </p>
        <p>
          <strong>Consumer disputes.</strong> If you are a consumer, nothing in this section prevents you
          from bringing a claim before a competent court or from referring a matter to the Federal
          Competition and Consumer Protection Commission.
        </p>
      </>
    ),
  },
  {
    id: "changes",
    heading: "Changes to these terms",
    body: (
      <p>
        We may update these Terms to reflect changes in our services, technology, or the law. When we
        make a material change, we will update the date at the top of this page and, where you hold
        Console access, notify you by email before the change takes effect. If you continue to use the
        Console or our websites after that date, the updated Terms apply. Changes do not alter the terms
        of an SOW already in effect unless both parties agree in writing.
      </p>
    ),
  },
  {
    id: "general",
    heading: "General",
    body: (
      <>
        <p>
          <strong>Entire agreement.</strong> These Terms, together with any SOW and our Privacy Policy,
          are the entire agreement between the parties on their subject matter and supersede prior
          discussions and proposals on that subject.
        </p>
        <p>
          <strong>Assignment.</strong> Neither party may assign the agreement without the other's written
          consent, except to a successor in connection with a merger or sale of substantially all
          assets.
        </p>
        <p>
          <strong>Subcontracting.</strong> We may engage subcontractors to deliver Services, and remain
          responsible for their work and for imposing equivalent confidentiality, security, and data
          protection obligations on them.
        </p>
        <p>
          <strong>Severability.</strong> If a provision is found unenforceable, the rest of these Terms
          remain in full force, and the unenforceable provision is replaced by one that achieves its
          intended purpose as closely as the law allows.
        </p>
        <p>
          <strong>No waiver.</strong> Failing to enforce a provision is not a waiver of it, and no waiver
          is effective unless given in writing.
        </p>
        <p>
          <strong>Force majeure.</strong> Neither party is liable for delay or failure caused by events
          beyond its reasonable control, including infrastructure or power failures, network outages,
          industrial action, or government action. The affected party will notify the other promptly and
          use reasonable efforts to mitigate.
        </p>
        <p>
          <strong>Notices.</strong> Formal notices to us should be sent to{" "}
          <a href="mailto:legal@restart.ng">legal@restart.ng</a>. We will send formal notices to the
          contact details registered on your account.
        </p>
      </>
    ),
  },
  {
    id: "contact",
    heading: "Contact",
    body: (
      <>
        <p>For questions about these Terms, or to raise a formal notice, contact us at:</p>
        <p>
          Restart Inc.
          <br />
          Attention: Legal
          <br />
          Lagos, Nigeria
          <br />
          <a href="mailto:legal@restart.ng">legal@restart.ng</a> ·{" "}
          <a href="tel:+2349060114747">+234 906 011 4747</a>
        </p>
      </>
    ),
  },
];

export default function Terms() {
  return (
    <LegalPageLayout
      title="Terms of Service"
      eyebrow="LEGAL"
      summary="The terms governing your use of Restart Inc.'s websites, client console, and engineering services — including scope, fees, intellectual property, and dispute resolution."
      seoDescription="Restart Inc. Terms of Service — the terms governing use of our websites, client console, and engineering services under Nigerian law."
      path="/terms"
      lastUpdated={LAST_UPDATED}
      sections={sections}
      intro={
        <div className="legal-intro">
          <p>
            <strong>In plain terms:</strong> using our websites or console means accepting these terms.
            Engineering work is governed by the specific statement of work you sign, and where the two
            differ, your signed document wins.
          </p>
          <p>
            We assign you ownership of the bespoke work we build and are paid for. We keep our
            pre-existing tools and know-how, but you get a perpetual licence to use whatever is embedded
            in your system. We will not name you publicly as a client without your written permission.
            Disputes are resolved confidentially by arbitration in Lagos under Nigerian law.
          </p>
        </div>
      }
      afterword={
        <div className="legal-review-note">
          <strong>Note</strong>
          <p>
            This document is a carefully prepared template covering the arrangements typical of an
            engineering engagement under Nigerian law. Before you rely on it, have it reviewed by a
            Nigerian-qualified lawyer against your actual contracting practice — particularly the
            limitation of liability cap, the arbitration clause, and whether you treat any Client as a
            consumer. Once reviewed, replace this note with nothing. If you would like, we can also
            produce a matching Master Services Agreement and Data Processing Agreement.
          </p>
        </div>
      }
    />
  );
}
