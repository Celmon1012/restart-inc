import { Server, Database, Boxes, Paperclip } from "lucide-react";
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

// Lago (our billing engine) has no simple-icons listing, so its mark is
// vendored here directly -- traced from https://www.getlago.com's own
// dark-mode wordmark (white on dark, same as their real usage).
const LAGO_PATH_LAYERS = [
  {
    opacity: 1,
    d: "M298.75 215.714c-3.214 20.893-12.857 39.822-28.036 55-15.178 15.179-34.107 24.822-55 28.036 0-.179-.178-.357-.178-.536v-.178c-.179-.358-.179-.536-.357-1.072l-.536-1.607c-.893-2.5-1.429-5.357-1.964-8.214v-.179c0-.357-.179-.714-.179-1.071v-.179c0-.357-.178-.714-.178-.893v-.357c0-.357-.179-.714-.179-1.25-.179-.893-.179-1.786-.179-2.857v-1.25c0-1.071-.178-2.143-.178-3.393 0-35.357 28.928-64.286 64.286-64.286h4.642c.893 0 1.965.179 2.858.358.357 0 .892 0 1.428.178.357 0 .714.179.893.179h.178c.358 0 .715 0 1.072.178h.179c2.857.536 5.535 1.25 8.392 2.143l1.608.536c.357.178.535.178.892.357h.179c0 .179.179.357.357.357Z"
  },
  {
    opacity: 0.6,
    d: "M300 201.071h-.179c-1.607-.535-3.214-.893-4.821-1.428-.179 0-.357-.179-.714-.179-1.429-.357-2.857-.714-4.465-.893h-.178c-.357 0-.893-.178-1.25-.178h-.357c-.536 0-1.072-.179-1.429-.179-.536 0-1.25-.178-1.607-.178-1.071-.179-2.321-.179-3.393-.358h-5.893c-43.393 0-78.571 35.179-78.571 78.572 0 1.25 0 2.5.178 3.928v.893c0 .357 0 .715.179 1.072.179 1.071.179 2.321.357 3.393 0 .535.179 1.071.179 1.607 0 .535.178 1.071.178 1.428.179.715.179 1.25.357 1.786.536 3.393 1.429 6.786 2.5 10.179v.178c-22.142.357-43.214-6.607-60.892-19.821v-4.286c0-74.821 60.892-135.714 135.714-135.714h4.286c13.214 16.785 20 38.035 19.821 60.178Z"
  },
  {
    opacity: 0.3,
    d: "M267.321 125.893c-.714 0-1.607.178-2.321.178-1.25 0-2.322.179-3.572.358-.357 0-.892 0-1.25.178-.357 0-.535 0-.892.179-2.143.178-4.286.535-6.429.893-1.607.178-3.036.535-4.643.714-.893.178-1.964.357-2.857.536-1.071.178-2.143.535-3.393.714-.357.178-.893.178-1.25.357-.714.179-1.607.357-2.321.536-.357 0-.536.178-.893.178-.893.179-1.786.357-2.5.715-.357.178-.893.178-1.25.357-.714.178-1.25.357-1.964.535-.536.179-1.072.358-1.429.536-.893.179-1.607.536-2.321.714-.179 0-.358.179-.536.179-1.072.357-2.143.714-3.214 1.25-1.25.357-2.322.893-3.393 1.25-.715.179-1.429.536-1.965.893-.714.178-1.25.536-1.964.714-1.071.536-2.321.893-3.393 1.429-1.964.893-3.928 1.785-5.893 2.857-2.5 1.25-4.821 2.5-7.321 3.928-.714.536-1.607.893-2.321 1.429-.893.536-1.786 1.071-2.858 1.786-.892.535-1.785 1.071-2.5 1.607-.714.536-1.607 1.071-2.321 1.607l-2.143 1.607c-1.786 1.25-3.393 2.5-5 3.75-.714.536-1.25 1.072-1.964 1.607-1.072.893-2.322 1.965-3.393 2.857-.893.715-1.786 1.608-2.679 2.322-.714.536-1.25 1.25-1.964 1.786-2.143 2.142-4.286 4.107-6.428 6.428-.715.714-1.25 1.25-1.786 1.964-.893.893-1.607 1.786-2.322 2.679-1.071 1.071-1.964 2.321-2.857 3.393-.535.714-1.071 1.25-1.607 1.964-1.25 1.607-2.5 3.393-3.75 5L152.857 190c-.536.714-1.071 1.607-1.607 2.321-.536.893-1.072 1.608-1.607 2.5-.536.893-1.25 1.786-1.786 2.858-.536.714-.893 1.607-1.429 2.321-1.428 2.321-2.678 4.821-3.928 7.143-1.072 1.964-1.964 3.928-2.857 5.893-.536 1.071-1.072 2.143-1.429 3.393-.178.535-.536 1.25-.714 1.964-.357.714-.536 1.428-.893 1.964-.536 1.072-.893 2.322-1.25 3.393-.357 1.071-.714 2.143-1.25 3.214 0 .179-.179.357-.179.536-.357.714-.535 1.607-.714 2.321-.178.536-.357 1.072-.536 1.429-.178.714-.357 1.25-.535 1.964-.179.357-.179.893-.357 1.25-.179.893-.536 1.786-.715 2.5 0 .179-.178.536-.178.893-.179.714-.357 1.607-.536 2.322 0 .357-.179.714-.357 1.25-.179 1.071-.536 2.142-.714 3.392-.179.893-.358 1.786-.536 2.858-.357 1.607-.536 3.035-.714 4.642-.358 2.143-.536 4.286-.893 6.429 0 .357 0 .536-.179.893 0 .357 0 .714-.178 1.25-.179 1.25-.179 2.321-.358 3.571 0 .715-.178 1.607-.178 2.322-16.786-17.679-25.893-40.893-26.25-65.536-.357-26.25 9.464-51.25 27.5-70.179.536-.714 1.25-1.25 1.786-1.785l1.785-1.786C149.821 109.821 174.286 100 200 100h1.25c24.643.357 47.857 9.464 66.071 25.893Z"
  }
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

function LagoSvg({ size }: { size: number }) {
  return (
    <svg viewBox="100 100 200 200" width={size} height={size} fill="currentColor" role="img" aria-label="Lago">
      {LAGO_PATH_LAYERS.map((layer) => (
        <path key={layer.opacity} d={layer.d} opacity={layer.opacity} />
      ))}
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
    if (/billing|lago/i.test(resource.name)) return <LagoSvg size={size} />;
    const brand = SERVICE_NAME_BRAND.find((b) => b.match.test(resource.name))?.icon;
    if (brand) return <BrandSvg icon={brand} size={size} />;
    return <Boxes size={size} className={className} />;
  }

  if (/paperclip/i.test(resource.name)) return <Paperclip size={size} className={className} />;

  return <Server size={size} className={className} />;
}
