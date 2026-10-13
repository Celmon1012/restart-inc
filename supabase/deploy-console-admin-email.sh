#!/bin/sh
# Paste into the Coolify terminal of the supabase-edge-functions container (restart-backend service).
# console-admin-email: the console Email page (health checks, test email, sign-in email previews). Owner only.
# Deploy send-email first (deploy-send-email.sh): the previews come from it.
set -e
mkdir -p /home/deno/functions/console-admin-email
cat > /home/deno/functions/console-admin-email/index.ts <<'__RESTART_FN_EOF__'
// Owner-only: the console's Email page. One function, three actions.
//
// POST /functions/v1/console-admin-email
//   { action: "status" }                          -> how mail is set up and whether it should be trusted
//   { action: "test", via: "smtp" | "resend", from?: "hello" | "billing" }
//                                                  -> sends a short test message to the caller's own address
//   { action: "preview", brand?: "restart" }      -> the real sign-in emails rendered with sample data
//
// Two senders exist, and the page keeps them apart:
//   - Sign-in emails (invite, password reset) go through the send-email function and your own SMTP
//     server (SMTP_HOST, port 465).
//   - Everything else (invoices, reminders, client updates, enquiry replies) goes through Resend.
//
// "status" never returns a secret: it reports only whether each setting is present, plus the public
// DNS records mail receivers look at (read through Cloudflare's DNS-over-HTTPS, since a browser
// can't look up DNS). "test" only ever writes to the caller's own address, so it can't be used to
// send mail to anyone else. "preview" asks send-email for its sample emails and sends nothing.
//
// The only external import is mail delivery for the SMTP test, loaded when a test is actually run so
// the other actions keep the usual fast start.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const env = (key: string, fallback = "") => Deno.env.get(key) || fallback;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

// ---- who is calling ------------------------------------------------------------------------

async function caller(jwt: string): Promise<{ id: string; email: string; roles: string[] } | null> {
  const headers = { Authorization: `Bearer ${jwt}`, apikey: SUPABASE_ANON_KEY };
  const [res, rolesRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/auth/v1/user`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/rpc/my_effective_roles`, {
      method: "POST",
      headers: { ...headers, "Content-Profile": "console", "Content-Type": "application/json" },
      body: "{}",
    }).catch(() => null),
  ]);
  if (!res.ok) return null;
  const user = await res.json();
  if (!user?.id) return null;
  let roles: string[] = user.app_metadata?.is_admin ? ["owner"] : [];
  if (rolesRes?.ok) {
    const list = await rolesRes.json().catch(() => null);
    if (Array.isArray(list)) roles = [...new Set([...roles, ...list.filter((x: unknown) => typeof x === "string")])];
  }
  return { id: user.id, email: String(user.email ?? ""), roles };
}

// ---- DNS, read through Cloudflare's DNS-over-HTTPS ------------------------------------------

async function dns(name: string, type: "TXT" | "MX" | "A" | "PTR"): Promise<string[]> {
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`, {
      headers: { accept: "application/dns-json" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const answers: Array<{ type: number; data: string }> = data?.Answer ?? [];
    const want = { TXT: 16, MX: 15, A: 1, PTR: 12 }[type];
    return answers
      .filter((a) => a.type === want)
      // TXT answers come back quoted and possibly split in pieces; join them.
      .map((a) => (type === "TXT" ? a.data.replace(/^"|"$/g, "").replace(/"\s+"/g, "") : a.data.replace(/\.$/, "")));
  } catch {
    return [];
  }
}

type Status = "pass" | "warn" | "fail";
interface Check {
  id: string;
  group: "setup" | "dns" | "reachability";
  label: string;
  status: Status;
  detail: string;
}

const domainOf = (address: string) => (address.match(/@([^>\s]+)>?\s*$/)?.[1] ?? "").toLowerCase();
const addressOf = (from: string) => from.match(/<([^>]+)>/)?.[1] ?? from;
const reverseName = (ip: string) => ip.split(".").reverse().join(".") + ".in-addr.arpa";

async function reachable(hostname: string, port: number): Promise<boolean> {
  try {
    const conn = await Promise.race([
      Deno.connect({ hostname, port }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 5000)),
    ]);
    conn.close();
    return true;
  } catch {
    return false;
  }
}

async function resendDomainCheck(domain: string): Promise<Check> {
  const base = { id: "resend-domain", group: "setup" as const, label: `Resend has verified ${domain}` };
  const key = env("RESEND_API_KEY");
  if (!key) return { ...base, status: "fail", detail: "No Resend key is set, so nothing can be checked or sent." };
  try {
    const headers = { Authorization: `Bearer ${key}` };
    const res = await fetch("https://api.resend.com/domains", { headers, signal: AbortSignal.timeout(8000) });
    if (res.status === 401 || res.status === 403) {
      return { ...base, status: "warn", detail: "This Resend key can only send, so the domain's status can't be read. Use the test email below: it is the real check." };
    }
    if (!res.ok) return { ...base, status: "warn", detail: `Resend answered ${res.status} when asked about domains.` };
    const list: Array<{ id: string; name: string; status: string }> = (await res.json())?.data ?? [];
    const d = list.find((x) => x.name === domain);
    if (!d) return { ...base, status: "fail", detail: `${domain} isn't added in Resend. Add it at resend.com/domains and publish the records it shows, or every Resend email is refused.` };
    if (d.status === "verified") return { ...base, status: "pass", detail: "Resend will send mail from this domain." };
    // Say which records Resend is still unhappy with.
    let which = "";
    try {
      const detail = await fetch(`https://api.resend.com/domains/${d.id}`, { headers, signal: AbortSignal.timeout(8000) });
      const records: Array<{ record?: string; name?: string; status?: string }> = (await detail.json())?.records ?? [];
      const bad = records.filter((r) => r.status && r.status !== "verified").map((r) => `${r.record ?? "record"} ${r.name ?? ""}`.trim());
      if (bad.length) which = ` Not yet verified: ${bad.join("; ")}.`;
    } catch {
      // the headline is enough
    }
    return { ...base, status: "fail", detail: `Resend reports ${domain} as "${d.status}", so it refuses every email from it (invoices, reminders, client updates, enquiry replies).${which} Open resend.com/domains, compare each record with the one in Cloudflare, fix any difference, then press Verify.` };
  } catch (err) {
    return { ...base, status: "warn", detail: `Couldn't reach Resend: ${(err as Error).message}` };
  }
}

async function readStatus() {
  const smtpHost = env("SMTP_HOST");
  const smtpPort = Number(env("SMTP_TLS_PORT", "465"));
  const smtpFrom = env("SMTP_ADMIN_EMAIL");
  const senderName = env("SMTP_SENDER_NAME", "Restart Inc.");
  const resendFrom = env("RESEND_FROM", "Restart Inc <hello@restart.ng>");
  const billingFrom = env("BILLING_FROM", "Restart Billing <billing@restart.ng>");
  const selector = env("EMAIL_DKIM_SELECTOR", "mail");
  const domain = domainOf(smtpFrom) || domainOf(addressOf(resendFrom)) || "restart.ng";

  const config = {
    domain,
    signIn: { via: "Your own mail server (SMTP)", host: smtpHost || null, port: smtpPort, from: smtpFrom ? `${senderName} <${smtpFrom}>` : null },
    other: { via: "Resend", general: resendFrom, billing: billingFrom },
  };

  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);

  // -- settings present (never the values of secrets)
  add({ id: "smtp-config", group: "setup", label: "Mail server settings", status: smtpHost && env("SMTP_USER") && env("SMTP_PASS") && smtpFrom ? "pass" : "fail", detail: smtpHost && env("SMTP_USER") && env("SMTP_PASS") && smtpFrom ? `Host ${smtpHost}, port ${smtpPort}, sending as ${smtpFrom}.` : "SMTP_HOST, SMTP_USER, SMTP_PASS or SMTP_ADMIN_EMAIL is missing on the edge runtime, so sign-in emails can't be sent." });
  add({ id: "hook", group: "setup", label: "Sign-in email hook secret", status: env("SEND_EMAIL_HOOK_SECRET") ? "pass" : "fail", detail: env("SEND_EMAIL_HOOK_SECRET") ? "The send-email function can verify requests from the auth service." : "SEND_EMAIL_HOOK_SECRET is missing, so send-email rejects every request and sign-in emails fail." });
  add({ id: "resend-config", group: "setup", label: "Resend API key", status: env("RESEND_API_KEY") ? "pass" : "fail", detail: env("RESEND_API_KEY") ? "Invoices, reminders and client updates can be sent." : "RESEND_API_KEY is missing, so invoices, reminders and client updates can't be sent." });
  const fromDomains = [domainOf(smtpFrom), domainOf(addressOf(resendFrom)), domainOf(addressOf(billingFrom))].filter(Boolean);
  const aligned = fromDomains.length > 0 && fromDomains.every((d) => d === fromDomains[0]);
  add({ id: "alignment", group: "setup", label: "Sender addresses on one domain", status: aligned ? "pass" : "warn", detail: aligned ? `Every sender is on ${fromDomains[0]}, so the same SPF, DKIM and DMARC records cover them.` : `Senders use different domains (${[...new Set(fromDomains)].join(", ")}). Each needs its own records.` });

  // -- DNS, in parallel
  const [spfTxt, rootA, rootMx, dkimSmtp, dkimResend, dmarcTxt, sendTxt, sendMx, smtpA] = await Promise.all([
    dns(domain, "TXT"),
    dns(domain, "A"),
    dns(domain, "MX"),
    dns(`${selector}._domainkey.${domain}`, "TXT"),
    dns(`resend._domainkey.${domain}`, "TXT"),
    dns(`_dmarc.${domain}`, "TXT"),
    dns(`send.${domain}`, "TXT"),
    dns(`send.${domain}`, "MX"),
    smtpHost ? dns(smtpHost, "A") : Promise.resolve([] as string[]),
  ]);

  // SPF
  const spfRecords = spfTxt.filter((t) => t.toLowerCase().startsWith("v=spf1"));
  if (spfRecords.length === 0) add({ id: "spf", group: "dns", label: "SPF", status: "fail", detail: `${domain} has no SPF record, so receivers can't tell which servers may send for it.` });
  else if (spfRecords.length > 1) add({ id: "spf", group: "dns", label: "SPF", status: "fail", detail: `${domain} has ${spfRecords.length} SPF records. There must be exactly one, or SPF fails everywhere.` });
  else {
    const spf = spfRecords[0];
    const strict = /\s-all\s*$/.test(spf) || /\s~all\s*$/.test(spf);
    add({ id: "spf", group: "dns", label: "SPF", status: strict ? "pass" : "warn", detail: strict ? spf : `${spf}. It should end in -all or ~all.` });

    // does it allow the mail server that sends sign-in emails?
    const ip = smtpA[0];
    if (ip) {
      const tokens = spf.split(/\s+/);
      let allowed = tokens.includes(`ip4:${ip}`);
      if (!allowed && tokens.includes("a")) allowed = rootA.includes(ip);
      if (!allowed && tokens.includes("mx")) {
        const mxHosts = await Promise.all(rootMx.map((m) => dns(m.split(/\s+/).pop() ?? "", "A")));
        allowed = mxHosts.flat().includes(ip);
      }
      add({ id: "spf-ip", group: "dns", label: "SPF allows the sign-in mail server", status: allowed ? "pass" : "fail", detail: allowed ? `${smtpHost} (${ip}) is covered by the SPF record.` : `${smtpHost} (${ip}) is not covered by the SPF record, so sign-in emails can fail SPF and land in spam.` });
    }
  }

  // DKIM
  const dkimOk = (records: string[]) => records.some((t) => /v=dkim1/i.test(t) && /p=[A-Za-z0-9+/=]{20,}/.test(t)) || records.some((t) => /p=[A-Za-z0-9+/=]{20,}/.test(t));
  add({ id: "dkim-smtp", group: "dns", label: `DKIM for sign-in emails (selector "${selector}")`, status: dkimOk(dkimSmtp) ? "pass" : "fail", detail: dkimOk(dkimSmtp) ? "A public key is published. Whether your mail server actually signs with it shows in a message's headers (DKIM: pass)." : `No key at ${selector}._domainkey.${domain}. Sign-in emails can't be DKIM-signed, which is a common cause of spam placement.` });
  add({ id: "dkim-resend", group: "dns", label: "DKIM key for Resend published", status: dkimOk(dkimResend) ? "pass" : "fail", detail: dkimOk(dkimResend) ? "A key is published. It must also match the one Resend expects: see the next check, which asks Resend itself." : `No key at resend._domainkey.${domain}. Add the DKIM record Resend shows for the domain, or its mail is unsigned.` });
  const sendOk = sendTxt.some((t) => /amazonses\.com/.test(t)) && sendMx.some((m) => /amazonses\.com/.test(m));
  add({ id: "resend-path", group: "dns", label: "Resend return path (send." + domain + ")", status: sendOk ? "pass" : "warn", detail: sendOk ? "SPF and MX for the bounce subdomain are in place." : `Records for send.${domain} are missing or incomplete, so bounces and SPF alignment for Resend mail may fail.` });

  add(await resendDomainCheck(domain));

  // DMARC
  const dmarc = dmarcTxt.find((t) => /^v=dmarc1/i.test(t));
  if (!dmarc) add({ id: "dmarc", group: "dns", label: "DMARC", status: "fail", detail: `No DMARC record at _dmarc.${domain}. Gmail and Yahoo expect one from anyone sending in volume.` });
  else {
    const policy = dmarc.match(/p=(\w+)/i)?.[1]?.toLowerCase();
    const hasReports = /rua=/i.test(dmarc);
    add({ id: "dmarc", group: "dns", label: "DMARC", status: policy === "none" ? "warn" : hasReports ? "pass" : "warn", detail: `${dmarc}${policy === "none" ? ". Policy is none, so failures aren't acted on." : ""}${hasReports ? "" : ". There's no rua= address, so you never receive reports showing who sends mail as your domain."}` });
  }

  // MX and reverse DNS
  add({ id: "mx", group: "dns", label: "Inbound mail (MX)", status: rootMx.length > 0 ? "pass" : "warn", detail: rootMx.length > 0 ? rootMx.join(", ") : `${domain} has no MX record, so replies can't reach it and some receivers distrust the domain.` });
  if (smtpA[0]) {
    const ptr = await dns(reverseName(smtpA[0]), "PTR");
    const confirmed = ptr.length > 0 ? (await dns(ptr[0], "A")).includes(smtpA[0]) : false;
    add({ id: "ptr", group: "dns", label: "Reverse DNS of the mail server", status: confirmed ? "pass" : ptr.length ? "warn" : "fail", detail: confirmed ? `${smtpA[0]} resolves back to ${ptr[0]}, and that name points to the same address.` : ptr.length ? `${smtpA[0]} resolves to ${ptr[0]}, but that name doesn't point back to the same address.` : `${smtpA[0]} has no reverse DNS name. Many receivers reject or spam-box mail from such addresses. Set it with the server provider.` });
  }

  // reachability
  if (smtpHost) {
    const up = await reachable(smtpHost, smtpPort);
    add({ id: "smtp-up", group: "reachability", label: "Mail server accepts connections", status: up ? "pass" : "fail", detail: up ? `${smtpHost}:${smtpPort} answered.` : `Couldn't connect to ${smtpHost}:${smtpPort} from the edge runtime.` });
  }

  return { config, checks, summary: { fail: checks.filter((c) => c.status === "fail").length, warn: checks.filter((c) => c.status === "warn").length, pass: checks.filter((c) => c.status === "pass").length } };
}

// ---- test message --------------------------------------------------------------------------

const recent: number[] = [];

function testMessage(via: string, from: string) {
  const when = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const text = `This is a test message from the Restart console's Email page.\n\nSent ${when}\nPath: ${via}\nFrom: ${from}\n\nIf you are reading this in your inbox rather than spam, this path is working. Nothing needs doing.`;
  const html = `<!doctype html><html lang="en"><body style="margin:0;padding:24px;background:#F3F4F4;font-family:Helvetica,Arial,sans-serif;color:#0B0B0C;"><div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;"><h1 style="margin:0 0 12px;font-size:20px;letter-spacing:0;">Email test</h1><p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#4A4F55;">This is a test message from the Restart console's Email page.</p><p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:#6B7178;">Sent ${when}<br>Path: ${via}<br>From: ${from.replace(/</g, "&lt;")}</p><p style="margin:0;font-size:13px;line-height:1.6;color:#6B7178;">If you are reading this in your inbox rather than spam, this path is working. Nothing needs doing.</p></div></body></html>`;
  return { text, html };
}

async function sendTest(to: string, via: "smtp" | "resend", fromKey: "hello" | "billing") {
  const now = Date.now();
  while (recent.length && now - recent[0] > 60_000) recent.shift();
  if (recent.length >= 5) throw new Error("That's five test emails in the last minute. Wait a moment before sending another.");
  recent.push(now);

  if (via === "smtp") {
    const host = env("SMTP_HOST");
    const sender = env("SMTP_ADMIN_EMAIL");
    if (!host || !env("SMTP_USER") || !env("SMTP_PASS") || !sender) throw new Error("The mail server settings aren't complete (SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_ADMIN_EMAIL).");
    const from = `${env("SMTP_SENDER_NAME", "Restart Inc.")} <${sender}>`;
    const { text, html } = testMessage("sign-in emails, your own mail server (SMTP)", from);
    const { SMTPClient } = await import("https://deno.land/x/denomailer@1.6.0/mod.ts");
    const client = new SMTPClient({ connection: { hostname: host, port: Number(env("SMTP_TLS_PORT", "465")), tls: true, auth: { username: env("SMTP_USER"), password: env("SMTP_PASS") } } });
    try {
      await client.send({ from, to, subject: "Restart console: mail server test", content: text, html });
    } finally {
      try {
        await client.close();
      } catch {
        // The message was already handed over; a failure while hanging up is not worth reporting.
      }
    }
    return { via: "smtp", from };
  }

  const key = env("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY isn't set on the edge runtime.");
  const from = fromKey === "billing" ? env("BILLING_FROM", "Restart Billing <billing@restart.ng>") : env("RESEND_FROM", "Restart Inc <hello@restart.ng>");
  const { text, html } = testMessage(`everything else (Resend, ${fromKey} sender)`, from);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject: "Restart console: Resend test", text, html }),
  });
  if (!res.ok) throw new Error(`Resend refused it (${res.status}): ${(await res.text()).slice(0, 300)}`);
  return { via: "resend", from };
}

// ---- preview -------------------------------------------------------------------------------

async function preview(brand: string) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email?preview=1`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ brand }),
  });
  if (res.status === 401) throw new Error("The send-email function didn't accept the preview request. Deploy its latest version (it adds preview mode).");
  if (!res.ok) throw new Error(`send-email couldn't render the previews (${res.status}). If it hasn't been updated yet, deploy its latest version.`);
  return res.json();
}

// ---- entry ---------------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);
  const who = await caller(authHeader.replace(/^Bearer\s+/i, ""));
  if (!who) return json({ error: "Unauthorized" }, 401);
  if (!who.roles.includes("owner")) return json({ error: "Owners only" }, 403);

  const body = await req.json().catch(() => ({}));
  try {
    switch (body?.action) {
      case "status":
        return json(await readStatus());
      case "test": {
        if (!who.email) return json({ error: "Your account has no email address to send to." }, 400);
        const via = body.via === "resend" ? "resend" : body.via === "smtp" ? "smtp" : null;
        if (!via) return json({ error: "via must be smtp or resend" }, 400);
        const sent = await sendTest(who.email, via, body.from === "billing" ? "billing" : "hello");
        return json({ sent: true, to: who.email, ...sent });
      }
      case "preview":
        return json(await preview(body.brand === "breadmaker" ? "breadmaker" : "restart"));
      default:
        return json({ error: "Unknown action" }, 400);
    }
  } catch (err) {
    return json({ error: (err as Error).message }, 400);
  }
});
__RESTART_FN_EOF__
ls -l /home/deno/functions/console-admin-email/index.ts
