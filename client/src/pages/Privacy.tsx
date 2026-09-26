import { Link } from "wouter";
import LegalPageLayout, { type LegalSection } from "@/components/LegalPageLayout";

const LAST_UPDATED = "24 September 2026";

const sections: LegalSection[] = [
  {
    id: "who-we-are",
    heading: "Who we are and what this policy covers",
    body: (
      <>
        <p>
          Restart Inc. (<strong>"Restart"</strong>, <strong>"we"</strong>, <strong>"us"</strong>) is a
          technology and engineering firm. Our registered office is in Lagos, Nigeria. We are the{" "}
          <strong>data controller</strong> for the personal data described in this policy.
        </p>
        <p>
          This policy explains how we handle personal data when you visit{" "}
          <a href="https://restart.ng">restart.ng</a>, interact with our client console at{" "}
          <a href="https://console.restart.ng">console.restart.ng</a>, contact us, or engage us to
          deliver engineering services. It applies to prospective clients, clients, their personnel,
          suppliers, and visitors to our websites.
        </p>
        <p>
          We handle personal data in line with the <strong>Nigeria Data Protection Act 2023</strong>{" "}
          (the <strong>"NDPA"</strong>), subsidiary regulations and guidance issued by the Nigeria Data
          Protection Commission (<strong>"NDPC"</strong>), and — where we process data belonging to
          individuals in other jurisdictions — the applicable local law, including the EU/UK General
          Data Protection Regulation where relevant.
        </p>
      </>
    ),
  },
  {
    id: "categories",
    heading: "Personal data we collect",
    body: (
      <>
        <p>
          We try to collect only what we need. The categories of personal data we may process are:
        </p>
        <table className="legal-table">
          <caption>Categories of personal data and their sources</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Examples</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Identity and contact data</td>
              <td>Name, work email, telephone number, company, job title.</td>
            </tr>
            <tr>
              <td>Enquiry and project data</td>
              <td>
                What you tell us about your systems, constraints, timelines, and budget range —
                submitted through our contact form, intake questionnaire, or by email.
              </td>
            </tr>
            <tr>
              <td>Account data</td>
              <td>
                Login credentials, workspace membership, and role for the client console. Passwords
                are never stored in readable form.
              </td>
            </tr>
            <tr>
              <td>Transaction data</td>
              <td>
                Billing contact details, invoices, payment status, and subscription history. Card
                details are handled by our payment providers and never reach our servers.
              </td>
            </tr>
            <tr>
              <td>Technical and usage data</td>
              <td>
                IP address, browser type, device information, referring page, and pages visited,
                collected through server logs and privacy-respecting analytics.
              </td>
            </tr>
            <tr>
              <td>Communications data</td>
              <td>
                Support conversations, emails, and the content of messages you send us, including
                through our support channels.
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          <strong>Data belonging to your customers.</strong> When we deliver engineering work, we may
          process personal data that belongs to <em>your</em> organisation and <em>your</em> users
          (for example, records in a database we are migrating or building against). In that role we
          act as a <strong>data processor</strong> on your instructions, not as a controller. Our
          processing is governed by our contract with you, and we will process that data only on your
          documented instructions. See section 8.
        </p>
      </>
    ),
  },
  {
    id: "lawful-basis",
    heading: "Why we process it and our lawful basis",
    body: (
      <>
        <p>
          Every processing activity must rest on a lawful basis under section 25 of the NDPA. We
          rely on the following:
        </p>
        <table className="legal-table">
          <caption>Purpose of processing and the lawful basis relied upon</caption>
          <thead>
            <tr>
              <th scope="col">Purpose</th>
              <th scope="col">Lawful basis</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Responding to enquiries and scoping potential engagements</td>
              <td>
                <strong>Consent</strong> and, where you are already in discussion with us, our{" "}
                <strong>legitimate interests</strong> in responding to a business request
              </td>
            </tr>
            <tr>
              <td>Delivering contracted services, including the client console</td>
              <td>
                <strong>Performance of a contract</strong> with you or your organisation
              </td>
            </tr>
            <tr>
              <td>Invoicing, billing, and accounting</td>
              <td>
                <strong>Performance of a contract</strong> and our{" "}
                <strong>legal obligations</strong> to maintain financial records
              </td>
            </tr>
            <tr>
              <td>Securing our systems and preventing misuse</td>
              <td>
                Our <strong>legitimate interests</strong> in protecting our infrastructure, you, and
                other clients
              </td>
            </tr>
            <tr>
              <td>Understanding how our websites are used so we can improve them</td>
              <td>
                Our <strong>legitimate interests</strong>, using analytics configured to minimise
                personal data
              </td>
            </tr>
            <tr>
              <td>Meeting tax, regulatory, and lawful authority obligations</td>
              <td><strong>Legal obligation</strong></td>
            </tr>
          </tbody>
        </table>
        <div className="legal-callout">
          <p>
            Where we rely on consent, you may withdraw it at any time by writing to{" "}
            <a href="mailto:privacy@restart.ng">privacy@restart.ng</a>. Withdrawal does not affect
            processing carried out before you withdrew, and it does not remove obligations we have
            under other lawful bases — for example, retaining invoices for tax purposes.
          </p>
        </div>
        <p>
          We do <strong>not</strong> sell personal data, and we do not use it to train machine-learning
          models without a written agreement with you that expressly permits it.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    heading: "Who we share personal data with",
    body: (
      <>
        <p>
          We do not sell or rent personal data. We share it only where necessary, with the following
          categories of recipient, each bound by written contractual confidentiality and data
          protection obligations:
        </p>
        <ul>
          <li>
            <strong>Infrastructure and hosting providers</strong> — the servers and platforms on which
            our websites and the client console run.
          </li>
          <li>
            <strong>Database, authentication, and storage providers</strong> — used to operate client
            workspaces and access controls.
          </li>
          <li>
            <strong>Payment and billing providers</strong> — used to process subscriptions and issue
            invoices.
          </li>
          <li>
            <strong>Communications providers</strong> — email delivery and transactional messaging.
          </li>
          <li>
            <strong>Analytics providers</strong> — configured to minimise personal data and without
            cross-site advertising trackers.
          </li>
          <li>
            <strong>Professional advisers</strong> — accountants, auditors, and lawyers, where
            required.
          </li>
          <li>
            <strong>Authorities</strong> — where we are legally required to disclose, or where
            disclosure is necessary to establish, exercise, or defend legal claims.
          </li>
        </ul>
        <p>
          Some providers process data outside Nigeria. Where that happens we take steps to ensure an
          adequate level of protection, as described in section 7.
        </p>
      </>
    ),
  },
  {
    id: "retention",
    heading: "How long we keep personal data",
    body: (
      <>
        <p>
          We keep personal data only as long as we need it for the purpose we collected it, or as
          required by law. Our standard retention periods are:
        </p>
        <table className="legal-table">
          <caption>Indicative retention periods</caption>
          <thead>
            <tr>
              <th scope="col">Data</th>
              <th scope="col">Retention period</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Enquiries that do not become engagements</td>
              <td>Up to 24 months from last contact, then deleted</td>
            </tr>
            <tr>
              <td>Client account and project records</td>
              <td>Duration of the engagement, plus 6 years</td>
            </tr>
            <tr>
              <td>Invoices and financial records</td>
              <td>6 years, as required for Nigerian tax and company records</td>
            </tr>
            <tr>
              <td>Server and access logs</td>
              <td>Up to 12 months, then deleted or aggregated</td>
            </tr>
            <tr>
              <td>Support conversations</td>
              <td>Duration of the engagement, plus 3 years</td>
            </tr>
          </tbody>
        </table>
        <p>
          Where data is held solely because of a legal obligation, we restrict access to it rather
          than using it for any other purpose.
        </p>
      </>
    ),
  },
  {
    id: "your-rights",
    heading: "Your rights as a data subject",
    body: (
      <>
        <p>
          Under the NDPA you have the following rights in relation to personal data we hold about
          you:
        </p>
        <ul>
          <li>
            <strong>Right to be informed</strong> — to know what we collect and why, which this policy
            sets out.
          </li>
          <li>
            <strong>Right of access</strong> — to obtain confirmation of whether we process your
            personal data, and a copy of it.
          </li>
          <li>
            <strong>Right to rectification</strong> — to have inaccurate, incomplete, or out-of-date
            personal data corrected.
          </li>
          <li>
            <strong>Right to erasure</strong> — to have personal data deleted where we no longer have
            a lawful reason to keep it.
          </li>
          <li>
            <strong>Right to restriction of processing</strong> — to limit how we use your data while a
            question about it is being resolved.
          </li>
          <li>
            <strong>Right to object</strong> — to object to processing based on our legitimate
            interests, and to object at any time to processing for direct marketing.
          </li>
          <li>
            <strong>Right to data portability</strong> — to receive personal data you provided to us in
            a structured, commonly used, machine-readable format.
          </li>
          <li>
            <strong>Right to withdraw consent</strong> — at any time, where consent is our basis for
            processing.
          </li>
          <li>
            <strong>Right not to be subject to a decision based solely on automated processing</strong>{" "}
            — we do not make decisions producing legal or similarly significant effects about you
            through automated processing alone.
          </li>
        </ul>
        <p>
          To exercise any of these rights, write to{" "}
          <a href="mailto:privacy@restart.ng">privacy@restart.ng</a>. We will respond within{" "}
          <strong>30 days</strong>. We may ask you to verify your identity before acting on a request —
          this is a protection for you, not an obstacle. There is no charge for a reasonable request.
        </p>
        <p>
          If you are a user of a system we operate on behalf of one of our clients, that client is the
          controller of your data. Please direct your request to them first; we will assist them in
          responding.
        </p>
      </>
    ),
  },
  {
    id: "transfers",
    heading: "International transfers",
    body: (
      <>
        <p>
          Some of our service providers are located outside Nigeria, so personal data may be
          transferred to and processed in other countries. Where we transfer personal data out of
          Nigeria, we do so in accordance with the NDPA and NDPC guidance, and we ensure an adequate
          level of protection through one or more of the following:
        </p>
        <ul>
          <li>
            transferring to a jurisdiction covered by an adequacy decision or recognised as providing
            adequate protection;
          </li>
          <li>
            putting in place contractual safeguards with the recipient — typically standard
            contractual clauses or an equivalent data processing agreement;
          </li>
          <li>
            relying on a derogation permitted by the NDPA, such as your explicit consent or the
            necessity of the transfer for the performance of a contract with you.
          </li>
        </ul>
        <p>
          You can ask us for more detail about the safeguards that apply to a specific transfer by
          writing to <a href="mailto:privacy@restart.ng">privacy@restart.ng</a>.
        </p>
      </>
    ),
  },
  {
    id: "client-data",
    heading: "Where we act as a processor for our clients",
    body: (
      <>
        <p>
          A significant part of our work involves building, migrating, or operating systems that hold
          other people's personal data. When we do this, we act as a <strong>data processor</strong>{" "}
          and our clients act as <strong>data controllers</strong>.
        </p>
        <p>
          In that capacity we will process personal data only on the client's documented
          instructions. We will:
        </p>
        <ul>
          <li>keep the data confidential and restrict access to personnel who need it to deliver the work;</li>
          <li>implement appropriate technical and organisational security measures, including encryption and access control;</li>
          <li>assist the client in responding to data subject requests and in meeting their own breach-notification and impact-assessment obligations;</li>
          <li>not engage a sub-processor without the client's authorisation, and impose equivalent obligations on any sub-processor we use;</li>
          <li>notify the client without undue delay if we become aware of a personal data breach affecting their data;</li>
          <li>delete or return the data at the end of the engagement, according to the client's instructions and our legal obligations.</li>
        </ul>
        <p>
          Where our contract with a client contains data processing terms, those terms govern to the
          extent of any conflict with this section.
        </p>
      </>
    ),
  },
  {
    id: "security",
    heading: "How we protect personal data",
    body: (
      <>
        <p>
          We apply technical and organisational measures appropriate to the risk, including:
          encryption of data in transit, role-based access control with multi-factor authentication
          for administrative access, least-privilege access to production systems, logging and
          monitoring of privileged actions, encrypted backups, and separation of production and
          development environments.
        </p>
        <p>
          No system is perfectly secure. If a breach occurs that is likely to result in a risk to
          your rights and freedoms, we will notify the NDPC and affected data subjects as required by
          the NDPA, and we will tell you plainly what happened and what we are doing about it.
        </p>
      </>
    ),
  },
  {
    id: "cookies",
    heading: "Cookies and similar technologies",
    body: (
      <>
        <p>
          Our websites use a small number of cookies and equivalent technologies. We group them as
          follows:
        </p>
        <table className="legal-table">
          <caption>Cookie categories used on our websites</caption>
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Purpose</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Strictly necessary</td>
              <td>
                Session handling and security for the client console. Without these the console cannot
                function.
              </td>
            </tr>
            <tr>
              <td>Preference</td>
              <td>Remembering interface settings you have chosen.</td>
            </tr>
            <tr>
              <td>Analytics</td>
              <td>
                Aggregated, non-advertising measurement of how pages are used, so we can improve them.
              </td>
            </tr>
          </tbody>
        </table>
        <p>
          Analytics cookies (Google Analytics 4) are set only after you allow them in the cookie banner. Until
          then, Google Analytics receives only anonymous, cookieless signals (such as a page being viewed) with no
          identifier that links your visits together. You can withdraw that at any time from "Cookie settings" in the site footer, which also removes the
          analytics cookies already set. We do not use advertising or cross-site tracking cookies. You can block or delete cookies
          through your browser settings; strictly necessary cookies may need to remain enabled for the
          client console to work.
        </p>
      </>
    ),
  },
  {
    id: "children",
    heading: "Children",
    body: (
      <p>
        Our services are directed at businesses and professional users. We do not knowingly collect
        personal data from anyone under 18. If you believe a child has provided us with personal
        data, contact us at <a href="mailto:privacy@restart.ng">privacy@restart.ng</a> and we will
        delete it.
      </p>
    ),
  },
  {
    id: "changes",
    heading: "Changes to this policy",
    body: (
      <p>
        We review this policy periodically. When we make a material change, we will update the date at
        the top of this page and, where the change significantly affects how we use your personal
        data, notify you directly by email. Continuing to use our websites after a change takes effect
        means you accept the updated policy.
      </p>
    ),
  },
  {
    id: "contact",
    heading: "How to contact us and how to complain",
    body: (
      <>
        <p>
          For any privacy question, request, or concern, contact our data protection contact at{" "}
          <a href="mailto:privacy@restart.ng">privacy@restart.ng</a>, or write to us at:
        </p>
        <p>
          Restart Inc.
          <br />
          Attention: Data Protection Contact
          <br />
          Lagos, Nigeria
          <br />
          <a href="mailto:hello@restart.ng">hello@restart.ng</a> ·{" "}
          <a href="tel:+2349060114747">+234 906 011 4747</a>
        </p>
        <p>
          If you are not satisfied with how we have handled your request, you have the right to lodge a
          complaint with the <strong>Nigeria Data Protection Commission</strong>. You can also complain
          to a supervisory authority in your own country if you are located outside Nigeria.
        </p>
      </>
    ),
  },
];

export default function Privacy() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      eyebrow="LEGAL"
      summary="How Restart Inc. collects, uses, shares, and protects personal data — and the rights you have over it under the Nigeria Data Protection Act 2023."
      seoDescription="Restart Inc. Privacy Policy — how we collect, use, share, and protect personal data, and your rights under the Nigeria Data Protection Act 2023."
      path="/privacy"
      lastUpdated={LAST_UPDATED}
      sections={sections}
      intro={
        <div className="legal-intro">
          <p>
            <strong>In plain terms:</strong> we collect the minimum we need to respond to you and
            deliver engineering work. We do not sell your data. We do not use it to train AI models
            without your written agreement. When we build systems that hold your customers' data, we
            act on your instructions as a processor, not for our own purposes.
          </p>
          <p>
            The rest of this document sets out the detail required by the Nigeria Data Protection Act
            2023, including our lawful bases, retention periods, and the rights you can exercise.
          </p>
        </div>
      }
    />
  );
}
