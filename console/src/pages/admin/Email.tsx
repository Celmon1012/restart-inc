// Email: how Restart's mail is set up, whether receivers should trust it, a test button, and the
// real sign-in emails rendered as they go out. Owner only.
//
// Two senders exist and this page keeps them apart:
//   Sign-in emails (invite, password reset)  -> the send-email function -> your own mail server (SMTP)
//   Everything else (invoices, reminders, client updates, enquiry replies) -> Resend
// Nothing secret is shown: the function reports only whether each setting is present, plus the
// public DNS records that mail receivers read. Wording lives in code (send-email and the functions
// listed below), so this page is a view and a test, not an editor.

import { useState } from "react";
import { toast } from "sonner";
import { ConsoleLayout } from "@/components/ConsoleLayout";
import { ErrorAlert, LoadingState, StatusRegion } from "@/components/AsyncStates";
import { useAsyncResource } from "@/hooks/useAsyncResource";
import { invokeFunction } from "@/lib/functions";

type Status = "pass" | "warn" | "fail";

interface Check {
  id: string;
  group: "setup" | "dns" | "reachability";
  label: string;
  status: Status;
  detail: string;
}

interface EmailStatus {
  config: {
    domain: string;
    signIn: { via: string; host: string | null; port: number; from: string | null };
    other: { via: string; general: string; billing: string };
  };
  checks: Check[];
  summary: { fail: number; warn: number; pass: number };
}

interface PreviewMessage {
  type: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

const GROUP_LABEL: Record<Check["group"], string> = { setup: "Settings", dns: "Domain records", reachability: "Reachability" };
const STATUS_LABEL: Record<Status, string> = { pass: "OK", warn: "IMPROVE", fail: "FIX" };
const STATUS_CLASS: Record<Status, string> = { pass: "", warn: "warning", fail: "down" };

const TYPE_LABEL: Record<string, string> = {
  invite: "Team invitation",
  recovery: "Password reset",
  signup: "Confirm email",
  magiclink: "Sign-in link",
  email_change: "Email change",
  "email_change (2nd email)": "Email change (to the new address)",
  reauthentication: "Verification code",
  password_changed_notification: "Password changed notice",
};

// The emails that don't go through send-email. Wording is in each function's code.
const OTHER_EMAILS = [
  { name: "Invoice issued", when: "A new invoice is finalised in billing", from: "billing@", where: "lago-webhook function" },
  { name: "Payment reminder", when: "An invoice is overdue", from: "billing@", where: "console-billing-reminders function" },
  { name: "Client update", when: "You approve a drafted update on a milestone", from: "hello@", where: "console-deliverable-send function" },
  { name: "Lead follow-up", when: "You approve an agent-drafted reply to a lead", from: "hello@", where: "console-agent-send function" },
  { name: "Enquiry confirmation", when: "Someone submits a brief or scorecard on the website", from: "hello@", where: "console-inquiry-notify function" },
];

const TEST_PATHS = [
  { value: "smtp", label: "Sign-in emails (your mail server)" },
  { value: "resend-hello", label: "Everything else, hello@ (Resend)" },
  { value: "resend-billing", label: "Invoices and reminders, billing@ (Resend)" },
];

function Pill({ status }: { status: Status }) {
  return <span className={`system-healthy-pill ${STATUS_CLASS[status]}`}>{STATUS_LABEL[status]}</span>;
}

export default function AdminEmail() {
  const status = useAsyncResource<EmailStatus>(() => invokeFunction<EmailStatus>("console-admin-email", { body: { action: "status" } }), [], { errorMessage: "Failed to read the email setup" });
  const previews = useAsyncResource<{ messages: PreviewMessage[] }>(() => invokeFunction<{ messages: PreviewMessage[] }>("console-admin-email", { body: { action: "preview" } }), [], { errorMessage: "Failed to load the email previews" });

  const [testPath, setTestPath] = useState("smtp");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [asText, setAsText] = useState(false);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await invokeFunction<{ to: string; from: string }>("console-admin-email", {
        body: { action: "test", via: testPath === "smtp" ? "smtp" : "resend", from: testPath === "resend-billing" ? "billing" : "hello" }
      });
      setTestResult({ ok: true, text: `Sent to ${res.to} from ${res.from}. Check your inbox, and your spam folder: where it lands is the real answer.` });
      toast.success("Test email sent");
    } catch (err) {
      setTestResult({ ok: false, text: (err as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const data = status.data;
  const messages = previews.data?.messages ?? [];
  const current = messages.find((m) => m.type === (picked ?? messages[0]?.type));

  return (
    <ConsoleLayout area="admin" onRefresh={() => { void status.refresh(); void previews.refresh(); }} isRefreshing={status.refreshing || previews.refreshing}>
      <StatusRegion message={status.loading ? "Checking the email setup" : status.error ? `Could not read the email setup: ${status.error}` : "Email setup loaded"} />
      <div className="dash-header-row">
        <div>
          <span className="dash-kicker">SETTINGS</span>
          <h1>Email</h1>
          <p>How Restart's mail is sent, whether receivers should trust it, and what people actually receive.</p>
        </div>
      </div>

      {status.loading ? (
        <LoadingState label="Checking mail settings and DNS…" />
      ) : status.error || !data ? (
        <ErrorAlert message={`Couldn't read the email setup: ${status.error}`} onRetry={status.retry} retryLabel="Try again" />
      ) : (
        <>
          <div className="cp-stats mb-6" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <div>
              <small>NEEDS FIXING</small>
              <strong className={data.summary.fail ? "warn" : undefined}>{data.summary.fail}</strong>
              <em>{data.summary.fail ? "mail may be rejected or lost" : "nothing broken"}</em>
            </div>
            <div>
              <small>WORTH IMPROVING</small>
              <strong>{data.summary.warn}</strong>
              <em>works, but weakens trust</em>
            </div>
            <div>
              <small>PASSING</small>
              <strong>{data.summary.pass}</strong>
              <em>of {data.checks.length} checks on {data.config.domain}</em>
            </div>
          </div>

          <div className="admin-section">
            <h2 className="admin-section-title">How mail is sent</h2>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Email</th><th>Sent through</th><th>From</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Sign-in emails</strong><div className="admin-muted">Invitations, password resets</div></td>
                    <td className="wrap">{data.config.signIn.via}{data.config.signIn.host ? <div className="admin-muted">{data.config.signIn.host}:{data.config.signIn.port}</div> : null}</td>
                    <td className="wrap">{data.config.signIn.from ?? <span className="admin-warn">not set</span>}</td>
                  </tr>
                  <tr>
                    <td><strong>Everything else</strong><div className="admin-muted">Invoices, reminders, client updates, enquiry replies</div></td>
                    <td className="wrap">{data.config.other.via}</td>
                    <td className="wrap">{data.config.other.general}<div className="admin-muted">Billing: {data.config.other.billing}</div></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="admin-muted mt-2">Mail server login, sender names and Resend's key are set on the backend service in Coolify; this page never shows them.</p>
          </div>

          <div className="admin-section">
            <h2 className="admin-section-title">Health checks</h2>
            {(["setup", "dns", "reachability"] as Check["group"][]).map((group) => {
              const rows = data.checks.filter((c) => c.group === group);
              if (rows.length === 0) return null;
              return (
                <div className="admin-table-wrap mb-4" key={group}>
                  <table className="admin-table">
                    <thead>
                      <tr><th style={{ width: 110 }}>{GROUP_LABEL[group]}</th><th /><th /></tr>
                    </thead>
                    <tbody>
                      {rows.map((c) => (
                        <tr key={c.id}>
                          <td><Pill status={c.status} /></td>
                          <td className="wrap" style={{ minWidth: 220 }}><strong>{c.label}</strong></td>
                          <td className="wrap admin-muted" style={{ wordBreak: "break-word" }}>{c.detail}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
            <p className="admin-muted">DNS is read live. A record you just changed can take a few minutes to show here.</p>
          </div>

          <div className="admin-section">
            <h2 className="admin-section-title">Send a test email</h2>
            <div className="admin-toolbar">
              <select value={testPath} onChange={(e) => setTestPath(e.target.value)} aria-label="Which sender to test" disabled={testing}>
                {TEST_PATHS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              <button className="dash-tab-btn active" onClick={() => void runTest()} disabled={testing}>{testing ? "Sending…" : "Send to my address"}</button>
            </div>
            {testResult && (
              <p className={testResult.ok ? "admin-muted" : "admin-warn"} role={testResult.ok ? "status" : "alert"}>{testResult.text}</p>
            )}
            <p className="admin-muted mt-2">A test only ever goes to your own address. If it arrives in spam, send me the message's headers (Show original) and the SPF, DKIM and DMARC lines tell us why.</p>
          </div>
        </>
      )}

      <div className="admin-section">
        <h2 className="admin-section-title">Sign-in emails, as sent</h2>
        {previews.loading ? (
          <LoadingState label="Rendering the emails…" />
        ) : previews.error ? (
          <ErrorAlert message={`Couldn't load the previews: ${previews.error}`} onRetry={previews.retry} retryLabel="Try again" />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, 280px) 1fr", gap: 16, alignItems: "start" }}>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <tbody>
                  {messages.map((m) => (
                    <tr key={m.type} className="clickable" onClick={() => setPicked(m.type)} style={m.type === current?.type ? { background: "rgba(255,255,255,.05)" } : undefined}>
                      <td className="wrap">
                        <strong>{TYPE_LABEL[m.type] ?? m.type}</strong>
                        <div className="admin-muted">{m.subject}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              {current ? (
                <>
                  <div className="admin-toolbar">
                    <span className="admin-muted">Subject: <strong style={{ color: "inherit" }}>{current.subject}</strong></span>
                    <span className="admin-toolbar-spacer" />
                    <button className={`dash-tab-btn ${asText ? "" : "active"}`} onClick={() => setAsText(false)}>Designed</button>
                    <button className={`dash-tab-btn ${asText ? "active" : ""}`} onClick={() => setAsText(true)}>Plain text</button>
                  </div>
                  {asText ? (
                    <pre className="lead-brief" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", margin: 0 }}>{current.text}</pre>
                  ) : (
                    // The email's own HTML, shown with scripts and navigation switched off.
                    <iframe title={`Preview: ${current.subject}`} srcDoc={current.html} sandbox="" style={{ width: "100%", height: 560, border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, background: "#fff" }} />
                  )}
                  <p className="admin-muted mt-2">Sample data, with a placeholder link. The wording is in the send-email function.</p>
                </>
              ) : (
                <div className="dash-empty-state">No emails to show.</div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="admin-section">
        <h2 className="admin-section-title">Other emails</h2>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Email</th><th>When it's sent</th><th>From</th><th>Wording lives in</th></tr>
            </thead>
            <tbody>
              {OTHER_EMAILS.map((e) => (
                <tr key={e.name}>
                  <td><strong>{e.name}</strong></td>
                  <td className="wrap">{e.when}</td>
                  <td className="admin-muted">{e.from}</td>
                  <td className="admin-muted">{e.where}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="admin-muted mt-2">Previews for these aren't built yet. Each is plain text, written in its function.</p>
      </div>
    </ConsoleLayout>
  );
}
