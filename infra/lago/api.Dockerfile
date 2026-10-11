# Lago API with two licence gates removed, nothing else: manual payments, and API key
# creation with per-key permissions. Overlays single lines on the stock image, so there
# is no source build. Each step fails the build if upstream's line is not found.
# Keep the tag in lockstep with front.Dockerfile and the Coolify service.
FROM getlago/api:v1.53.0

# Manual payments ("Record a payment").
RUN f=app/services/payments/manual_create_service.rb \
 && grep -q 'return result.forbidden_failure! if !License.premium?' $f \
 && sed -i '/return result.forbidden_failure! if !License.premium?/d' $f \
 && ! grep -q 'License.premium?' $f

# Creating API keys beyond the first one.
RUN f=app/services/api_keys/create_service.rb \
 && grep -q 'return result.forbidden_failure! unless License.premium?' $f \
 && sed -i '/return result.forbidden_failure! unless License.premium?/d' $f \
 && ! grep -q 'License.premium?' $f

# Per-key permissions: always on for this one integration (other premium
# integrations keep requiring a licence), so keys are actually restricted when
# scoped rather than the setting being saved and ignored.
RUN f=app/models/organization.rb \
 && grep -q 'License.premium? && premium_integrations.include?(premium_integration)' $f \
 && sed -i 's/License.premium? && premium_integrations.include?(premium_integration)/premium_integration == "api_permissions" || (License.premium? \&\& premium_integrations.include?(premium_integration))/' $f \
 && grep -q 'premium_integration == "api_permissions"' $f

# Billing entity timezone and email settings: allowed without a licence. Both were guarded
# by one check in assign_premium_attributes. The invoice emails themselves are also gated on
# License.premium?, so that check is lifted from the invoice.finalized sending paths too.
# Payment receipts stay behind their own premium integration.
RUN f=app/services/billing_entities/update_service.rb \
 && grep -q 'return unless License.premium?' $f \
 && sed -i '/def assign_premium_attributes/,/^    end/ { /return unless License.premium?/d }' $f \
 && ! grep -A6 'def assign_premium_attributes' $f | grep -q 'License.premium?'
RUN files=$(grep -rl 'email_settings.include?' app/services) \
 && sed -z -i 's/License\.premium? &&\(\s*\)\([a-z_]*\.billing_entity\.email_settings\.include?\)/\1\2/g' $files \
 && ! grep -rPzq 'License\.premium\? &&\s*[a-z_]*\.billing_entity\.email_settings' app/services

# Manual "Request overdue payment" (payment requests).
RUN f=app/services/payment_requests/create_service.rb \
 && grep -q 'return result.forbidden_failure! unless License.premium?' $f \
 && sed -i '/return result.forbidden_failure! unless License.premium?/d' $f \
 && ! grep -q 'License.premium?' $f

# Credit notes: creating one and the estimate shown before it.
RUN f=app/services/credit_notes/create_service.rb \
 && grep -q '^      License.premium?$' $f \
 && sed -i '/def should_create_credit_note?/,/^    end/ s/^      License.premium?$/      true/' $f \
 && ! grep -q 'License.premium?' $f
RUN f=app/services/credit_notes/estimate_service.rb \
 && grep -q 'return result.forbidden_failure! unless License.premium?' $f \
 && sed -i '/return result.forbidden_failure! unless License.premium?/d' $f \
 && ! grep -q 'License.premium?' $f

# Add an entity: no limit on billing entities (the licensed "enterprise" tier's rule instead of
# the single entity an unlicensed install gets), and a new entity keeps its timezone, email
# settings and grace period instead of dropping them without a licence.
RUN f=app/models/organization.rb \
 && grep -q 'MULTI_ENTITIES_MAX\[:default\] - billing_entities.active.count' $f \
 && sed -i 's/MULTI_ENTITIES_MAX\[:default\] - billing_entities.active.count/MULTI_ENTITIES_MAX[:enterprise]/' $f \
 && ! grep -q 'MULTI_ENTITIES_MAX\[:default\] - billing_entities' $f
RUN f=app/services/billing_entities/create_service.rb \
 && grep -q '^        if License.premium?$' $f \
 && sed -i 's/^        if License.premium?$/        if true/' $f \
 && ! grep -q 'License.premium?' $f

# Bug in upstream v1.53.0, not a licence gate: the payment-link flow (PaymentIntents::FetchService)
# reads provider_session_id from the provider's result, but only Stripe's result defines it, so
# "Open payment link" raises NoMethodError for Flutterwave (and Adyen). Read it only if present.
RUN f=app/services/payment_intents/fetch_service.rb \
 && grep -q 'provider_session_id: payment_url_result.provider_session_id' $f \
 && sed -i 's/provider_session_id: payment_url_result.provider_session_id/provider_session_id: (payment_url_result.provider_session_id if payment_url_result.respond_to?(:provider_session_id))/' $f \
 && grep -q 'respond_to?(:provider_session_id)' $f

# Bug in upstream v1.53.0, not a licence gate: the Flutterwave payment link is created for the
# invoice's FULL total, ignoring payments already recorded (a NGN 1,500,000 invoice with NGN
# 1,000,000 paid asked for 1,500,000). Charge the amount still due. The tx_ref is also made
# unique per link, because Flutterwave refuses a tx_ref that already has a successful payment,
# so a second part-payment on the same invoice would otherwise fail. The webhook identifies the
# invoice from meta.lago_invoice_id, not tx_ref, so this is safe.
RUN f=app/services/invoices/payments/flutterwave_service.rb \
 && grep -q 'Money.from_cents(invoice.total_amount_cents, invoice.currency).to_f' $f \
 && grep -q 'tx_ref: invoice.id,' $f \
 && sed -i 's/Money.from_cents(invoice.total_amount_cents, invoice.currency).to_f/Money.from_cents(invoice.total_due_amount_cents, invoice.currency).to_f/' $f \
 && sed -i 's/tx_ref: invoice.id,/tx_ref: "#{invoice.id}-#{SecureRandom.hex(4)}",/' $f \
 && grep -q 'invoice.total_due_amount_cents' $f && grep -q 'SecureRandom.hex(4)' $f

# Plan overrides: a per-customer price (or name, description, trial) on a subscription, e.g. the
# subscription fee of a standard plan set to the amount agreed with one client. Three gates:
# creating a subscription with plan_overrides, updating one, and the override service itself.
# Overrides of individual charges through their own endpoints (and charge filters) stay gated.
RUN f=app/services/subscriptions/create_service.rb \
 && grep -q 'return result.forbidden_failure! if !License.premium? && params.key?(:plan_overrides)' $f \
 && sed -i '/return result.forbidden_failure! if !License.premium? && params.key?(:plan_overrides)/d' $f \
 && ! grep -q 'forbidden_failure! if !License.premium? && params.key?(:plan_overrides)' $f
RUN f=app/services/subscriptions/update_service.rb \
 && grep -q 'return result.forbidden_failure! if !License.premium? && params.key?(:plan_overrides)' $f \
 && sed -i '/return result.forbidden_failure! if !License.premium? && params.key?(:plan_overrides)/d' $f \
 && ! grep -q 'forbidden_failure! if !License.premium? && params.key?(:plan_overrides)' $f
RUN f=app/services/plans/override_service.rb \
 && grep -q 'return result.forbidden_failure! unless License.premium?' $f \
 && sed -i '/return result.forbidden_failure! unless License.premium?/d' $f \
 && ! grep -q 'forbidden_failure! unless License.premium?' $f
