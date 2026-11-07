-- Read-only verification queries for 20261107_security_onboarding_hardening.sql.
-- Run only after applying that migration in a non-production environment first.

-- 1. Required tables must exist with RLS enabled.
WITH required_tables(table_name) AS (
    VALUES
        ('businesses'), ('business_members'), ('branches'), ('business_settings'),
        ('categories'), ('products'), ('customers'), ('invoices'), ('invoice_items'),
        ('payments'), ('inventory_movements'), ('whatsapp_message_logs')
)
SELECT
    required.table_name,
    relation.oid IS NOT NULL AS table_exists,
    relation.relrowsecurity AS rls_enabled,
    relation.relforcerowsecurity AS rls_forced
FROM required_tables AS required
LEFT JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.nspname = 'public'
LEFT JOIN pg_catalog.pg_class AS relation
    ON relation.relnamespace = namespace.oid
   AND relation.relname = required.table_name
ORDER BY required.table_name;

-- 2. Policies currently enforcing access on the scoped tables.
SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename = ANY (ARRAY[
      'businesses', 'business_members', 'branches', 'business_settings',
      'categories', 'products', 'customers', 'invoices', 'invoice_items',
      'payments', 'inventory_movements', 'whatsapp_message_logs'
  ])
ORDER BY tablename, policyname;

-- 3. Effective table privileges. anon should have none; invoice snapshots and
-- inventory movements intentionally cannot be updated/deleted by authenticated.
-- service_role is granted only the webhook status-update columns.
SELECT table_name, role_name,
       has_table_privilege(role_name, format('public.%I', table_name), 'SELECT') AS can_select,
       has_table_privilege(role_name, format('public.%I', table_name), 'INSERT') AS can_insert,
       has_table_privilege(role_name, format('public.%I', table_name), 'UPDATE') AS can_update,
       has_table_privilege(role_name, format('public.%I', table_name), 'DELETE') AS can_delete
FROM (
    SELECT table_name, role_name
    FROM unnest(ARRAY[
        'businesses', 'business_members', 'branches', 'business_settings',
        'categories', 'products', 'customers', 'invoices', 'invoice_items',
        'payments', 'inventory_movements', 'whatsapp_message_logs'
    ]) AS table_names(table_name)
    CROSS JOIN unnest(ARRAY['anon', 'authenticated', 'service_role']) AS roles(role_name)
) AS requested
ORDER BY table_name, role_name;

SELECT
    has_column_privilege('service_role', 'public.whatsapp_message_logs', 'meta_message_id', 'SELECT') AS service_can_filter_webhook_log,
    has_column_privilege('service_role', 'public.whatsapp_message_logs', 'status', 'UPDATE') AS service_can_update_status,
    has_column_privilege('service_role', 'public.whatsapp_message_logs', 'error_message', 'UPDATE') AS service_can_update_error,
    has_column_privilege('service_role', 'public.whatsapp_message_logs', 'updated_at', 'UPDATE') AS service_can_update_timestamp,
    has_table_privilege('service_role', 'public.invoices', 'SELECT') AS service_can_read_invoices;

-- 4. Security-definer procedures: owners, fixed search paths, and execute ACLs.
SELECT
    procedure.proname,
    pg_catalog.pg_get_userbyid(procedure.proowner) AS owner,
    procedure.prosecdef AS security_definer,
    procedure.proconfig AS function_settings,
    procedure.proacl AS execute_acl
FROM pg_catalog.pg_proc AS procedure
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = procedure.pronamespace
WHERE namespace.nspname = 'public'
  AND procedure.proname = ANY (ARRAY[
      'user_has_business_access', 'user_is_business_owner',
      'user_can_manage_business_members', 'create_business_onboarding_atomic',
      'create_invoice_atomic', 'handle_new_user'
  ])
ORDER BY procedure.proname;

SELECT
    has_function_privilege('anon', 'public.create_business_onboarding_atomic(text,text,text,text,text,text,text,text,text,text,numeric)', 'EXECUTE') AS anon_can_onboard,
    has_function_privilege('authenticated', 'public.create_business_onboarding_atomic(text,text,text,text,text,text,text,text,text,text,numeric)', 'EXECUTE') AS authenticated_can_onboard,
    has_function_privilege('anon', 'public.user_has_business_access(uuid)', 'EXECUTE') AS anon_can_check_membership,
    has_function_privilege('authenticated', 'public.user_has_business_access(uuid)', 'EXECUTE') AS authenticated_can_check_membership;

-- 5. Tenant-consistency constraints and validation state.
SELECT
    relation.relname AS table_name,
    constraint_row.conname AS constraint_name,
    constraint_row.contype AS constraint_type,
    constraint_row.convalidated AS validated,
    pg_catalog.pg_get_constraintdef(constraint_row.oid) AS definition
FROM pg_catalog.pg_constraint AS constraint_row
JOIN pg_catalog.pg_class AS relation ON relation.oid = constraint_row.conrelid
JOIN pg_catalog.pg_namespace AS namespace ON namespace.oid = relation.relnamespace
WHERE namespace.nspname = 'public'
  AND constraint_row.conname LIKE 'qelanto\_%' ESCAPE '\'
ORDER BY table_name, constraint_name;

-- 6. These mismatch counts should all be zero.
SELECT 'product_category' AS relationship, count(*) AS mismatches
FROM public.products AS product
JOIN public.categories AS category ON category.id = product.category_id
WHERE product.category_id IS NOT NULL AND product.business_id <> category.business_id
UNION ALL
SELECT 'invoice_branch', count(*)
FROM public.invoices AS invoice
JOIN public.branches AS branch ON branch.id = invoice.branch_id
WHERE invoice.branch_id IS NOT NULL AND invoice.business_id <> branch.business_id
UNION ALL
SELECT 'invoice_customer', count(*)
FROM public.invoices AS invoice
JOIN public.customers AS customer ON customer.id = invoice.customer_id
WHERE invoice.customer_id IS NOT NULL AND invoice.business_id <> customer.business_id
UNION ALL
SELECT 'invoice_item_product', count(*)
FROM public.invoice_items AS item
JOIN public.invoices AS invoice ON invoice.id = item.invoice_id
JOIN public.products AS product ON product.id = item.product_id
WHERE item.product_id IS NOT NULL AND invoice.business_id <> product.business_id
UNION ALL
SELECT 'payment_invoice', count(*)
FROM public.payments AS payment
JOIN public.invoices AS invoice ON invoice.id = payment.invoice_id
WHERE payment.business_id <> invoice.business_id
UNION ALL
SELECT 'inventory_product', count(*)
FROM public.inventory_movements AS movement
JOIN public.products AS product ON product.id = movement.product_id
WHERE movement.business_id <> product.business_id
UNION ALL
SELECT 'whatsapp_invoice', count(*)
FROM public.whatsapp_message_logs AS log
JOIN public.invoices AS invoice ON invoice.id = log.invoice_id
WHERE log.business_id <> invoice.business_id
UNION ALL
SELECT 'whatsapp_customer', count(*)
FROM public.whatsapp_message_logs AS log
JOIN public.customers AS customer ON customer.id = log.customer_id
WHERE log.customer_id IS NOT NULL AND log.business_id <> customer.business_id
ORDER BY relationship;

-- 7. Expected natural-key uniqueness and onboarding defaults.
SELECT 'business_member_duplicates' AS check_name, count(*) AS violations
FROM (
    SELECT business_id, user_id FROM public.business_members
    GROUP BY business_id, user_id HAVING count(*) > 1
) AS duplicates
UNION ALL
SELECT 'business_settings_duplicates', count(*)
FROM (
    SELECT business_id FROM public.business_settings
    GROUP BY business_id HAVING count(*) > 1
) AS duplicates
UNION ALL
SELECT 'category_duplicates', count(*)
FROM (
    SELECT business_id, name FROM public.categories
    GROUP BY business_id, name HAVING count(*) > 1
) AS duplicates
UNION ALL
SELECT 'product_sku_duplicates', count(*)
FROM (
    SELECT business_id, sku FROM public.products
    GROUP BY business_id, sku HAVING count(*) > 1
) AS duplicates
UNION ALL
SELECT 'customer_phone_duplicates', count(*)
FROM (
    SELECT business_id, phone FROM public.customers
    GROUP BY business_id, phone HAVING count(*) > 1
) AS duplicates
UNION ALL
SELECT 'invoice_number_duplicates', count(*)
FROM (
    SELECT business_id, invoice_number FROM public.invoices
    GROUP BY business_id, invoice_number HAVING count(*) > 1
) AS duplicates
UNION ALL
SELECT 'businesses_missing_owner_membership', count(*)
FROM public.businesses AS business
WHERE NOT EXISTS (
    SELECT 1 FROM public.business_members AS member
    WHERE member.business_id = business.id
      AND member.user_id = business.owner_id
      AND member.role = 'owner'
)
ORDER BY check_name;

SELECT
    business.id AS business_id,
    count(DISTINCT branch.id) AS branch_count,
    count(DISTINCT settings.business_id) AS settings_count,
    count(DISTINCT category.id) AS starter_category_count
FROM public.businesses AS business
LEFT JOIN public.branches AS branch
    ON branch.business_id = business.id AND branch.name = 'Main Branch'
LEFT JOIN public.business_settings AS settings ON settings.business_id = business.id
LEFT JOIN public.categories AS category
    ON category.business_id = business.id
   AND category.name IN (
       'Men''s Wear', 'Women''s Wear', 'Kids Wear',
       'Accessories', 'General / Miscellaneous'
   )
GROUP BY business.id
ORDER BY business.id;

-- 8. The access token column must no longer exist.
SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'business_settings'
      AND column_name = 'whatsapp_access_token'
) AS whatsapp_access_token_column_still_exists;
