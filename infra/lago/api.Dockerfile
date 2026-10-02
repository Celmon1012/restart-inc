# Lago API with manual payments unlocked. Overlays one guard line on the stock image,
# so there is no source build: the base is exactly what runs today.
# Keep the tag in lockstep with front.Dockerfile and the Coolify service.
FROM getlago/api:v1.53.0

RUN f=app/services/payments/manual_create_service.rb \
 && grep -q 'return result.forbidden_failure! if !License.premium?' $f \
 && sed -i '/return result.forbidden_failure! if !License.premium?/d' $f \
 && ! grep -q 'License.premium?' $f
