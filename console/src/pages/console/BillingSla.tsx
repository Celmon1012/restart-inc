import { useState } from "react";
import { Link } from "wouter";
import { ConsoleTopBar } from "@/components/ConsoleTopBar";
import { MARKETING_URL } from "@/lib/site";
import {
  CreditCard,
  Shield,
  ChevronLeft,
  CheckCircle2,
  Download,
  ArrowUpRight,
  Zap,
  Clock,
  FileText,
  Calendar,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";

export default function BillingSla() {
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  const handleDownloadInvoice = (invId: string) => {
    setIsDownloading(invId);
    setTimeout(() => {
      setIsDownloading(null);
      toast.success(`Downloaded tax receipt & SLA audit report for ${invId}`);
    }, 800);
  };

  return (
    <div className="dash-shell">
      <ConsoleTopBar />

      <main className="dash-main container">
        {/* Breadcrumb Back Link */}
        <div className="console-breadcrumb">
          <Link href="/dashboard" className="breadcrumb-back">
            <ChevronLeft size={14} />
            <span>Back to Dashboard</span>
          </Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current">Billing & SLA Contract</span>
        </div>

        {/* Header Row */}
        <div className="dash-header-row">
          <div>
            <span className="dash-kicker">COMMITTED CAPACITY & ENTERPRISE SLA GUARANTEES</span>
            <h1>Billing & SLA Contract</h1>
            <p>Active engineering retainers, bare-metal server cluster commitments, and legally binding uptime guarantees.</p>
          </div>
          <div className="dash-header-meta">
            <div className="meta-box">
              <span className="meta-title">COMMITTED SLA</span>
              <span className="meta-val text-teal">99.99% UPTIME</span>
            </div>
            <div className="meta-box">
              <span className="meta-title">ESCALATION SLA</span>
              <span className="meta-val text-white">&lt;15 min P1</span>
            </div>
          </div>
        </div>

        {/* SLA Tier Hero Overview */}
        <div className="sla-hero-banner">
          <div className="sla-tier-info">
            <div className="sla-badge">
              <Shield size={14} className="text-teal" />
              <span>ACTIVE ENTERPRISE RETAINER · PROJECT #04 SENIOR DEDICATED</span>
            </div>
            <h2>Enterprise Dedicated Systems Project</h2>
            <p>
              Dedicated senior architectural project providing 24/7 proactive telemetry monitoring, bare-metal infrastructure
              management, Anthropic MCP agentic pipelines, and zero-downtime cutovers.
            </p>
            <div className="sla-pills-row">
              <span className="sla-pill"><CheckCircle2 size={13} className="text-teal" /> 99.99% Financial Uptime Guarantee</span>
              <span className="sla-pill"><CheckCircle2 size={13} className="text-teal" /> &lt;15 Min P1 Response Commitment</span>
              <span className="sla-pill"><CheckCircle2 size={13} className="text-teal" /> 4 Dedicated Senior Engineers</span>
            </div>
          </div>

          <div className="sla-billing-box">
            <span className="b-label">MONTHLY PROJECT RETAINER</span>
            <div className="b-price">
              <span className="currency">$</span>
              <span className="val">24,500</span>
              <span className="freq">/month</span>
            </div>
            <div className="b-sub">Next renewal: Oct 01, 2026 · Auto-renew via ACH Wire</div>
            <a href={`${MARKETING_URL}/start-project`} className="dash-action-btn mt-4 w-full text-center justify-center">
              <span>Request Scope Expansion</span>
              <ArrowUpRight size={14} />
            </a>
          </div>
        </div>

        <div className="console-grid-layout mt-6">
          {/* Col 1: SLA Performance & Contract Parameters */}
          <div className="console-col">
            <div className="console-card">
              <div className="card-top-header">
                <span className="card-kicker">CONTRACTUAL SLA METRICS (SEPTEMBER 2026)</span>
                <span className="status-live-pill">
                  <span className="status-dot-active" />
                  100% COMPLIANT
                </span>
              </div>

              <div className="sla-metrics-list">
                <div className="sla-metric-row">
                  <div>
                    <strong>Rolling 30-Day Production Uptime</strong>
                    <p>Contractual minimum: 99.99% · Unplanned downtime: 0s</p>
                  </div>
                  <div className="metric-score text-teal">99.994%</div>
                </div>

                <div className="sla-metric-row">
                  <div>
                    <strong>P1 Outage Mean Response Time</strong>
                    <p>Contractual commitment: &lt;15 minutes</p>
                  </div>
                  <div className="metric-score text-teal">3.4 min</div>
                </div>

                <div className="sla-metric-row">
                  <div>
                    <strong>Queue Recovery & Backpressure Flush</strong>
                    <p>Burst resilience target: &lt;1,000ms</p>
                  </div>
                  <div className="metric-score text-teal">259 ms</div>
                </div>

                <div className="sla-metric-row">
                  <div>
                    <strong>Anthropic MCP Semantic Evaluation Pass Rate</strong>
                    <p>Deterministic regression threshold: &gt;98.0%</p>
                  </div>
                  <div className="metric-score text-teal">99.4%</div>
                </div>
              </div>
            </div>

            {/* Payment Method Card */}
            <div className="console-card mt-6">
              <div className="card-top-header">
                <span className="card-kicker">AUTHORIZED PAYMENT METHOD</span>
                <CreditCard size={15} className="text-teal" />
              </div>

              <div className="payment-method-box">
                <div className="pm-icon">
                  <CreditCard size={20} className="text-white" />
                </div>
                <div className="pm-details">
                  <strong>JPMorgan Chase Corporate Wire / ACH</strong>
                  <span>Routing: ••••4812 · Account ending in ••••9021</span>
                  <span className="text-[11px] text-[#78849b]">Verified for recurring automated SLA retainer settlements</span>
                </div>
                <span className="badge-teal">DEFAULT</span>
              </div>
            </div>
          </div>

          {/* Col 2: Invoices & Tax Receipts */}
          <div className="console-col">
            <div className="console-card">
              <div className="card-top-header">
                <span className="card-kicker">INVOICE & AUDIT HISTORY</span>
                <span className="meta-tag">PAID IN FULL</span>
              </div>

              <div className="invoices-list">
                {[
                  {
                    id: "INV-2026-0901",
                    date: "Sep 01, 2026",
                    period: "September 2026 Retainer + Sprint 04",
                    amount: "$24,500.00",
                    status: "PAID"
                  },
                  {
                    id: "INV-2026-0801",
                    date: "Aug 01, 2026",
                    period: "August 2026 Retainer + Sprint 03 (MCP Engine)",
                    amount: "$24,500.00",
                    status: "PAID"
                  },
                  {
                    id: "INV-2026-0701",
                    date: "Jul 01, 2026",
                    period: "July 2026 Retainer + Bare-Metal Cloud Core",
                    amount: "$24,500.00",
                    status: "PAID"
                  }
                ].map((inv) => (
                  <div key={inv.id} className="invoice-row">
                    <div className="inv-left">
                      <div className="inv-title">
                        <strong>{inv.id}</strong>
                        <span className="inv-tag">{inv.status}</span>
                      </div>
                      <p className="inv-desc">{inv.period}</p>
                      <span className="inv-date">{inv.date}</span>
                    </div>
                    <div className="inv-right">
                      <span className="inv-amount">{inv.amount}</span>
                      <button
                        onClick={() => handleDownloadInvoice(inv.id)}
                        className="inv-dl-btn"
                        title="Download PDF Invoice & SLA Audit"
                      >
                        <Download size={13} />
                        <span>{isDownloading === inv.id ? "Downloading..." : "PDF"}</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 pt-4 border-t border-white/5 flex justify-between items-center text-[12px] text-[#78849b]">
                <span>Questions regarding invoices or escrow?</span>
                <a href="mailto:billing@restart.ng" className="text-teal hover:underline flex items-center gap-1">
                  Contact Billing Team
                  <ArrowUpRight size={12} />
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
