// Unlocks "Record a payment" (manual payments) in the self-hosted Lago front end.
// Upstream gates it behind the premium licence flag in several places; only the
// record-payment code paths are touched -- credit notes, audit logs and the rest
// of the premium-gated UI keep their upstream behaviour.
// Run from the root of getlago/lago-front at tag v1.53.0. Fails loudly if upstream
// changed, so a version bump can't silently ship an unpatched or half-patched build.
import { readFileSync, writeFileSync } from 'node:fs'

const KEY = 'text_1737471851634wpeojigr27w' // "Record a payment"

const edit = (file, fn) => {
  const before = readFileSync(file, 'utf8')
  const after = fn(before)
  if (after === before) throw new Error(`patch-front: nothing changed in ${file}`)
  writeFileSync(file, after)
  console.log(`patched ${file}`)
}

// From the record-payment entry up to the premium dialog fallback, treat the licence as present.
const unlockBlock = (src) => {
  const start = src.indexOf(KEY)
  if (start === -1) throw new Error('record-payment key not found')
  const m = /(openPremiumWarningDialog\(\)|premiumWarningDialog\.open\(\))/.exec(src.slice(start))
  if (!m) throw new Error('premium dialog fallback not found')
  const end = start + m.index + m[0].length
  return (
    src.slice(0, start) +
    src.slice(start, end).replaceAll('isPremium', '(isPremium || true)') +
    src.slice(end)
  )
}

edit('src/components/invoices/InvoicePaymentList.tsx', (s) =>
  s.replace('const { isPremium } = useCurrentUser()', 'useCurrentUser()\n  const isPremium = true'),
)
edit('src/components/customers/CustomerPaymentsTab.tsx', (s) =>
  s.replace(
    "hasPermissions(['paymentsCreate']) && isPremium",
    "hasPermissions(['paymentsCreate']) && (isPremium || true)",
  ),
)
for (const f of [
  'src/components/customers/CustomerInvoicesList.tsx',
  'src/components/invoices/InvoicesList.tsx',
  'src/pages/CustomerInvoiceDetails.tsx',
  'src/pages/PaymentsPage.tsx',
]) {
  edit(f, unlockBlock)
}

// API keys: creating more than the first key, and scoping a key's permissions,
// are licence-gated upstream. The API side is patched in api.Dockerfile.
edit('src/components/developers/apiKeys/ApiKeys.tsx', (s) =>
  s.replace(
    'const showPremiumAddApiKeyState = !isPremium &&',
    'const showPremiumAddApiKeyState = !(isPremium || true) &&',
  ),
)
edit('src/pages/developers/ApiKeysForm.tsx', (s) =>
  s.replace(
    /const hasAccessToApiPermissionsPremiumAddOn = !!premiumIntegrations\?\.includes\(\s*PremiumIntegrationTypeEnum\.ApiPermissions,?\s*\)/,
    'const hasAccessToApiPermissionsPremiumAddOn = !!premiumIntegrations?.includes(PremiumIntegrationTypeEnum.ApiPermissions) || true',
  ),
)

// Billing entity timezone (the Edit button on Settings > General) and the manual
// "Request overdue payment" page: both flags are licence-gated upstream. The API
// side is patched in api.Dockerfile.
edit('src/pages/settings/BillingEntity/sections/general/TimezoneBlock.tsx', (s) =>
  s.replace('const { isPremium } = useCurrentUser()', 'useCurrentUser()\n  const isPremium = true'),
)
edit('src/pages/CustomerRequestOverduePayment/index.tsx', (s) =>
  s.replace('const hasDunningIntegration = !!isPremium', 'const hasDunningIntegration = !!(isPremium || true)'),
)

// Email scenarios (Settings > Email scenarios): the switches check the licence flag.
for (const f of [
  'src/pages/settings/BillingEntity/sections/BillingEntityEmailScenarios.tsx',
  'src/pages/settings/BillingEntity/sections/BillingEntityEmailScenariosConfig.tsx',
]) {
  edit(f, (s) => s.replace(/: isPremium(\s*\n)/, ': (isPremium || true)$1'))
}

// Credit notes: "Issue a credit note" in the invoice list, the invoice page and the
// invoice's credit-note tab. The API side is patched in api.Dockerfile. (The "Add an
// entity" button needs no front-end patch: it follows the API's canCreateBillingEntity.)
const unlockBlockAt = (key) => (src) => {
  const start = src.indexOf(key)
  if (start === -1) throw new Error(`key ${key} not found`)
  const m = /(openPremiumWarningDialog\(\)|premiumWarningDialog\.open\(\))/.exec(src.slice(start))
  if (!m) throw new Error('premium dialog fallback not found')
  const end = start + m.index + m[0].length
  return src.slice(0, start) + src.slice(start, end).replaceAll('isPremium', '(isPremium || true)') + src.slice(end)
}
const CREDIT_NOTE_KEY = 'text_636bdef6565341dcb9cfb127' // "Issue a credit note"
edit('src/pages/CustomerInvoiceDetails.tsx', unlockBlockAt(CREDIT_NOTE_KEY))
edit('src/components/customers/CustomerInvoicesList.tsx', (s) =>
  s
    .replace('canIssueCreditNote(invoice) && !isPremium', 'canIssueCreditNote(invoice) && !(isPremium || true)')
    .replace('canIssueCreditNote(invoice) && isPremium', 'canIssueCreditNote(invoice) && (isPremium || true)'),
)
edit('src/components/invoices/InvoicesList.tsx', (s) => s.replace('if (!isPremium) {', 'if (!(isPremium || true)) {'))
edit('src/components/invoices/InvoiceCreditNoteList.tsx', (s) => s.replace('{isPremium ? (', '{(isPremium || true) ? ('))

// Plan overrides on a subscription (e.g. a per-client subscription fee). The API side is patched
// in api.Dockerfile. Every "Edit" action on the subscription's plan goes through
// useSubscriptionPremiumGate, the plan tab shows an "Unlock plan overrides" upsell banner, and
// the create/edit subscription form masks the override sections and only renders the fee and
// charge editors for premium users.
edit('src/hooks/plans/useSubscriptionPremiumGate.ts', (s) =>
  s.replace('const isGated = isInSubscriptionForm && !isPremium', 'const isGated = isInSubscriptionForm && !(isPremium || true)'),
)
edit('src/components/subscriptions/details-v2/SubscriptionDetailsV2Plan.tsx', (s) =>
  s.replace('if (!isPremium) {', 'if (!(isPremium || true)) {'),
)
edit('src/pages/subscriptions/CreateSubscription.tsx', (src) => {
  const start = src.indexOf('{/* Premium upsell (non-premium users) */}')
  if (start === -1) throw new Error('subscription form: premium upsell marker not found')
  const m = /<PlanFormProvider/.exec(src.slice(start))
  if (!m) throw new Error('subscription form: PlanFormProvider not found')
  const end = start + m.index
  return src.slice(0, start) + src.slice(start, end).replaceAll('isPremium', '(isPremium || true)') + src.slice(end)
})
