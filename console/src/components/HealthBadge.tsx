import { deliveryHealth, HEALTH_LABEL } from "@/lib/deliverables";

export function HealthBadge({ status, dueAt }: { status: string; dueAt: string | null | undefined }) {
  const health = deliveryHealth(status, dueAt);
  if (!health) return null;
  return <span className={`health-badge ${health}`}>{HEALTH_LABEL[health]}</span>;
}
