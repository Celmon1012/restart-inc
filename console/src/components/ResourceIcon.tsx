import { Server, Database, Boxes } from "lucide-react";
import {
  siSupabase,
  siN8n,
  siChatwoot,
  siCaldotcom,
  siPostgresql,
  siRedis,
  siMysql,
  siMongodb,
  siMariadb
} from "simple-icons";
import type { Resource } from "@/lib/resources";

interface SimpleIcon {
  path: string;
  hex: string;
  title: string;
}

// Matched by name, not Coolify's service_type -- we don't have visibility
// into what slug Coolify actually assigns each one-click service, and the
// resource name is already reliable enough for the handful of well-known
// services we run (restart-n8n, chatwoot-ng, supabase-backend, calcom).
// Nothing here for Evolution API: it has no listing in simple-icons.
const SERVICE_NAME_BRAND: Array<{ match: RegExp; icon: SimpleIcon }> = [
  { match: /supabase/i, icon: siSupabase },
  { match: /n8n/i, icon: siN8n },
  { match: /chatwoot/i, icon: siChatwoot },
  { match: /cal ?com/i, icon: siCaldotcom }
];

const DATABASE_TYPE_BRAND: Record<string, SimpleIcon> = {
  "standalone-postgresql": siPostgresql,
  "standalone-redis": siRedis,
  "standalone-mysql": siMysql,
  "standalone-mongodb": siMongodb,
  "standalone-mariadb": siMariadb
};

function BrandSvg({ icon, size }: { icon: SimpleIcon; size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={`#${icon.hex}`}
      role="img"
      aria-label={icon.title}
    >
      <path d={icon.path} />
    </svg>
  );
}

export function ResourceIcon({
  resource,
  size = 15,
  className
}: {
  resource: Resource;
  size?: number;
  className?: string;
}) {
  if (resource.kind === "database") {
    const brand = DATABASE_TYPE_BRAND[resource.databaseType];
    if (brand) return <BrandSvg icon={brand} size={size} />;
    return <Database size={size} className={className} />;
  }

  if (resource.kind === "service") {
    const brand = SERVICE_NAME_BRAND.find((b) => b.match.test(resource.name))?.icon;
    if (brand) return <BrandSvg icon={brand} size={size} />;
    return <Boxes size={size} className={className} />;
  }

  return <Server size={size} className={className} />;
}
