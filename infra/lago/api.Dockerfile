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
