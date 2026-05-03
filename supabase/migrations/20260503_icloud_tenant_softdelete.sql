-- Phase 1.5 follow-on (Joey 2026-05-03): soft-delete the joeygermani11
-- @icloud.com "Test" tenant. Same pattern as the dogfood-consolidation
-- migration's test 4 + Nexpura HQ — preserve audit history, detach the
-- user from the tenant.
--
-- Surfaced post-deploy: when the dogfood-consolidation migration added
-- the free_forever_dogfood_only CHECK constraint, only one row was
-- blocking it (this iCloud tenant with is_free_forever=true). It got
-- flipped to false in that migration but the tenant itself was left
-- in place. Joey's cleanup pass closes the loop: it's a Joey-test
-- tenant with no real customer use, so soft-delete keeps the platform
-- tenant inventory clean.

BEGIN;

UPDATE tenants
   SET deleted_at = NOW()
 WHERE id = '5400f9c2-06a8-4986-adcf-17ae00476b59'
   AND deleted_at IS NULL;

UPDATE users
   SET tenant_id = NULL
 WHERE email = 'joeygermani11@icloud.com'
   AND tenant_id = '5400f9c2-06a8-4986-adcf-17ae00476b59';

COMMIT;
