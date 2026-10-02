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
