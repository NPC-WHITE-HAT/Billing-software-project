-- Qelanto Business OS: tenant isolation, onboarding, and privilege hardening.
-- This migration is additive. It deliberately stops on unexpected policies,
-- missing columns, duplicate keys, or cross-business legacy relationships.

BEGIN;

DO $$
DECLARE
    missing_columns TEXT;
BEGIN
    SELECT string_agg(format('%I.%I', required.table_name, required.column_name), ', ')
    INTO missing_columns
    FROM (
        VALUES
            ('profiles', 'id'), ('profiles', 'email'), ('profiles', 'full_name'),
            ('businesses', 'id'), ('businesses', 'slug'), ('businesses', 'created_by'),
            ('businesses', 'name'), ('businesses', 'category'),
            ('businesses', 'phone'), ('businesses', 'email'), ('businesses', 'address'),
            ('businesses', 'city'), ('businesses', 'state'), ('businesses', 'pincode'),
            ('businesses', 'gstin'), ('businesses', 'currency'), ('businesses', 'timezone'),
            ('businesses', 'owner_id'), ('businesses', 'created_at'),
            ('business_members', 'business_id'), ('business_members', 'user_id'),
            ('business_members', 'role'), ('business_members', 'created_at'),
            ('branches', 'id'), ('branches', 'business_id'), ('branches', 'name'),
            ('branches', 'phone'), ('branches', 'address'), ('branches', 'is_main'),
            ('business_settings', 'business_id'), ('business_settings', 'invoice_prefix'),
            ('business_settings', 'invoice_sequence'), ('business_settings', 'tax_rate'),
            ('business_settings', 'tax_label'), ('business_settings', 'allow_negative_stock'),
            ('business_settings', 'whatsapp_enabled'), ('business_settings', 'tax_settings'),
            ('business_settings', 'invoice_settings'),
            ('categories', 'id'), ('categories', 'business_id'), ('categories', 'name'),
            ('products', 'id'), ('products', 'business_id'), ('products', 'category_id'),
            ('customers', 'id'), ('customers', 'business_id'),
            ('invoices', 'id'), ('invoices', 'business_id'), ('invoices', 'branch_id'),
            ('invoices', 'customer_id'), ('invoices', 'invoice_number'),
            ('invoices', 'customer_name_snapshot'), ('invoices', 'customer_phone_snapshot'),
            ('invoices', 'subtotal'), ('invoices', 'discount_amount'),
            ('invoices', 'tax_amount'), ('invoices', 'tax_rate'), ('invoices', 'grand_total'),
            ('invoice_items', 'invoice_id'), ('invoice_items', 'product_id'),
            ('invoice_items', 'product_name_snapshot'), ('invoice_items', 'sku_snapshot'),
            ('payments', 'business_id'), ('payments', 'invoice_id'),
            ('inventory_movements', 'business_id'), ('inventory_movements', 'product_id'),
            ('whatsapp_message_logs', 'business_id'), ('whatsapp_message_logs', 'invoice_id'),
            ('whatsapp_message_logs', 'customer_id')
    ) AS required(table_name, column_name)
    LEFT JOIN information_schema.columns AS actual
        ON actual.table_schema = 'public'
       AND actual.table_name = required.table_name
       AND actual.column_name = required.column_name
    WHERE actual.column_name IS NULL;

    IF missing_columns IS NOT NULL THEN
        RAISE EXCEPTION 'Onboarding hardening stopped: missing required public columns: %', missing_columns;
    END IF;
END;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.businesses WHERE id IS NULL OR owner_id IS NULL)
       OR EXISTS (SELECT 1 FROM public.business_members WHERE business_id IS NULL OR user_id IS NULL OR role IS NULL)
       OR EXISTS (SELECT 1 FROM public.branches WHERE business_id IS NULL)
       OR EXISTS (SELECT 1 FROM public.business_settings WHERE business_id IS NULL)
       OR EXISTS (SELECT 1 FROM public.categories WHERE business_id IS NULL)
       OR EXISTS (SELECT 1 FROM public.products WHERE business_id IS NULL)
       OR EXISTS (SELECT 1 FROM public.customers WHERE business_id IS NULL)
       OR EXISTS (SELECT 1 FROM public.invoices WHERE business_id IS NULL OR invoice_number IS NULL OR customer_name_snapshot IS NULL)
       OR EXISTS (SELECT 1 FROM public.invoice_items WHERE invoice_id IS NULL OR product_name_snapshot IS NULL OR sku_snapshot IS NULL)
       OR EXISTS (SELECT 1 FROM public.payments WHERE business_id IS NULL OR invoice_id IS NULL)
       OR EXISTS (SELECT 1 FROM public.inventory_movements WHERE business_id IS NULL OR product_id IS NULL)
       OR EXISTS (SELECT 1 FROM public.whatsapp_message_logs WHERE business_id IS NULL OR invoice_id IS NULL) THEN
        RAISE EXCEPTION 'Required tenant keys or invoice snapshots contain NULL values; resolve them before migration.';
    END IF;
    IF EXISTS (
        SELECT 1
        FROM public.business_members
        WHERE role NOT IN ('owner', 'admin', 'manager', 'cashier')
    ) THEN
        RAISE EXCEPTION 'Unsupported business_members roles exist; resolve them before migration.';
    END IF;
END;
$$;

ALTER TABLE public.businesses ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.businesses ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.business_members ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.business_members ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.business_members ALTER COLUMN role SET NOT NULL;
ALTER TABLE public.branches ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.business_settings ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.categories ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.customers ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN invoice_number SET NOT NULL;
ALTER TABLE public.invoices ALTER COLUMN customer_name_snapshot SET NOT NULL;
ALTER TABLE public.invoice_items ALTER COLUMN invoice_id SET NOT NULL;
ALTER TABLE public.invoice_items ALTER COLUMN product_name_snapshot SET NOT NULL;
ALTER TABLE public.invoice_items ALTER COLUMN sku_snapshot SET NOT NULL;
ALTER TABLE public.payments ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.payments ALTER COLUMN invoice_id SET NOT NULL;
ALTER TABLE public.inventory_movements ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.inventory_movements ALTER COLUMN product_id SET NOT NULL;
ALTER TABLE public.whatsapp_message_logs ALTER COLUMN business_id SET NOT NULL;
ALTER TABLE public.whatsapp_message_logs ALTER COLUMN invoice_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conrelid = 'public.business_members'::regclass
          AND conname = 'qelanto_business_members_role_check'
    ) THEN
        ALTER TABLE public.business_members
            ADD CONSTRAINT qelanto_business_members_role_check
            CHECK (role IN ('owner', 'admin', 'manager', 'cashier')) NOT VALID;
    END IF;
END;
$$;
ALTER TABLE public.business_members VALIDATE CONSTRAINT qelanto_business_members_role_check;

-- Only policies from the two checked-in migrations and this migration may be
-- replaced. An unknown policy can be permissive, so require manual review.
DO $$
DECLARE
    unknown_policies TEXT;
BEGIN
    SELECT string_agg(format('%I.%I (%I)', schemaname, tablename, policyname), ', ')
    INTO unknown_policies
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (ARRAY[
          'businesses', 'business_members', 'branches', 'business_settings',
          'categories', 'products', 'customers', 'invoices', 'invoice_items',
          'payments', 'inventory_movements', 'whatsapp_message_logs'
      ])
      AND NOT (
          (tablename = 'branches' AND policyname IN (
              'Admins can delete branches',
              'Admins can insert branches',
              'Admins can update branches',
              'Members can view branches'
          ))
          OR (tablename = 'business_members' AND policyname = 'Members can view business members')
          OR (tablename = 'business_settings' AND policyname IN (
              'Admins can update business settings',
              'Members can view business settings'
          ))
          OR (tablename = 'businesses' AND policyname IN (
              'Admins can update their businesses',
              'Members can view their businesses'
          ))
      )
      AND policyname <> ALL (ARRAY[
          'businesses_select_member', 'businesses_insert_authenticated', 'businesses_update_owner',
          'business_members_select', 'business_members_insert',
          'branches_access', 'business_settings_access', 'categories_access',
          'products_access', 'customers_access', 'invoices_access',
          'invoice_items_access', 'payments_access', 'inventory_movements_access',
          'whatsapp_logs_access',
          'qelanto_businesses_select', 'qelanto_businesses_update',
          'qelanto_members_select', 'qelanto_members_insert', 'qelanto_members_update',
          'qelanto_members_delete',
          'qelanto_branches_select', 'qelanto_branches_insert', 'qelanto_branches_update',
          'qelanto_branches_delete',
          'qelanto_settings_select', 'qelanto_settings_insert', 'qelanto_settings_update',
          'qelanto_settings_delete',
          'qelanto_categories_select', 'qelanto_categories_insert', 'qelanto_categories_update',
          'qelanto_categories_delete',
          'qelanto_products_select', 'qelanto_products_insert', 'qelanto_products_update',
          'qelanto_products_delete',
          'qelanto_customers_select', 'qelanto_customers_insert', 'qelanto_customers_update',
          'qelanto_customers_delete',
          'qelanto_invoices_select', 'qelanto_invoices_insert', 'qelanto_invoices_update',
          'qelanto_items_select', 'qelanto_items_insert',
          'qelanto_payments_select', 'qelanto_payments_insert', 'qelanto_payments_update',
          'qelanto_payments_delete',
          'qelanto_movements_select', 'qelanto_movements_insert',
          'qelanto_whatsapp_logs_select', 'qelanto_whatsapp_logs_insert',
          'qelanto_whatsapp_logs_update', 'qelanto_whatsapp_logs_delete'
      ]);

    IF unknown_policies IS NOT NULL THEN
        RAISE EXCEPTION 'Onboarding hardening stopped: review existing policies before proceeding: %', unknown_policies;
    END IF;
END;
$$;

-- Check duplicates before ensuring the natural-key constraints.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.business_members
        GROUP BY business_id, user_id HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate business_members (business_id, user_id) rows exist; resolve them before migration.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.business_settings
        GROUP BY business_id HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate business_settings business_id rows exist; resolve them before migration.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.categories
        GROUP BY business_id, name HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate categories (business_id, name) rows exist; resolve them before migration.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.products
        GROUP BY business_id, sku HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate products (business_id, sku) rows exist; resolve them before migration.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.customers
        GROUP BY business_id, phone HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate customers (business_id, phone) rows exist; resolve them before migration.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM public.invoices
        GROUP BY business_id, invoice_number HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate invoices (business_id, invoice_number) rows exist; resolve them before migration.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.products AS product
        JOIN public.categories AS category ON category.id = product.category_id
        WHERE product.category_id IS NOT NULL
          AND category.business_id <> product.business_id
    ) OR EXISTS (
        SELECT 1
        FROM public.invoices AS invoice
        JOIN public.branches AS branch ON branch.id = invoice.branch_id
        WHERE invoice.branch_id IS NOT NULL
          AND branch.business_id <> invoice.business_id
    ) OR EXISTS (
        SELECT 1
        FROM public.invoices AS invoice
        JOIN public.customers AS customer ON customer.id = invoice.customer_id
        WHERE invoice.customer_id IS NOT NULL
          AND customer.business_id <> invoice.business_id
    ) OR EXISTS (
        SELECT 1
        FROM public.payments AS payment
        JOIN public.invoices AS invoice ON invoice.id = payment.invoice_id
        WHERE invoice.business_id <> payment.business_id
    ) OR EXISTS (
        SELECT 1
        FROM public.inventory_movements AS movement
        JOIN public.products AS product ON product.id = movement.product_id
        WHERE product.business_id <> movement.business_id
    ) OR EXISTS (
        SELECT 1
        FROM public.whatsapp_message_logs AS log
        JOIN public.invoices AS invoice ON invoice.id = log.invoice_id
        WHERE invoice.business_id <> log.business_id
    ) OR EXISTS (
        SELECT 1
        FROM public.whatsapp_message_logs AS log
        JOIN public.customers AS customer ON customer.id = log.customer_id
        WHERE log.customer_id IS NOT NULL
          AND customer.business_id <> log.business_id
    ) OR EXISTS (
        SELECT 1
        FROM public.invoice_items AS item
        JOIN public.invoices AS invoice ON invoice.id = item.invoice_id
        JOIN public.products AS product ON product.id = item.product_id
        WHERE item.product_id IS NOT NULL
          AND product.business_id <> invoice.business_id
    ) THEN
        RAISE EXCEPTION 'Cross-business legacy relationships exist; correct them before migration.';
    END IF;
END;
$$;

-- The original SQL creates these natural keys. Ensure they also exist where
-- CREATE TABLE IF NOT EXISTS previously skipped an incomplete table.
CREATE UNIQUE INDEX IF NOT EXISTS business_members_business_id_user_id_key
    ON public.business_members (business_id, user_id);
CREATE UNIQUE INDEX IF NOT EXISTS business_settings_business_id_key
    ON public.business_settings (business_id);
CREATE UNIQUE INDEX IF NOT EXISTS categories_business_id_name_key
    ON public.categories (business_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS products_business_id_sku_key
    ON public.products (business_id, sku);
CREATE UNIQUE INDEX IF NOT EXISTS customers_business_id_phone_key
    ON public.customers (business_id, phone);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_business_id_invoice_number_key
    ON public.invoices (business_id, invoice_number);

-- Candidate keys required for tenant-preserving foreign keys.
CREATE UNIQUE INDEX IF NOT EXISTS qelanto_branches_business_id_id_key
    ON public.branches (business_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS qelanto_categories_business_id_id_key
    ON public.categories (business_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS qelanto_products_business_id_id_key
    ON public.products (business_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS qelanto_customers_business_id_id_key
    ON public.customers (business_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS qelanto_invoices_business_id_id_key
    ON public.invoices (business_id, id);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.products'::regclass AND conname = 'qelanto_products_category_business_fk') THEN
        ALTER TABLE public.products
            ADD CONSTRAINT qelanto_products_category_business_fk
            FOREIGN KEY (business_id, category_id)
            REFERENCES public.categories (business_id, id)
            ON DELETE SET NULL (category_id) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.invoices'::regclass AND conname = 'qelanto_invoices_branch_business_fk') THEN
        ALTER TABLE public.invoices
            ADD CONSTRAINT qelanto_invoices_branch_business_fk
            FOREIGN KEY (business_id, branch_id)
            REFERENCES public.branches (business_id, id)
            ON DELETE SET NULL (branch_id) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.invoices'::regclass AND conname = 'qelanto_invoices_customer_business_fk') THEN
        ALTER TABLE public.invoices
            ADD CONSTRAINT qelanto_invoices_customer_business_fk
            FOREIGN KEY (business_id, customer_id)
            REFERENCES public.customers (business_id, id)
            ON DELETE SET NULL (customer_id) NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.payments'::regclass AND conname = 'qelanto_payments_invoice_business_fk') THEN
        ALTER TABLE public.payments
            ADD CONSTRAINT qelanto_payments_invoice_business_fk
            FOREIGN KEY (business_id, invoice_id)
            REFERENCES public.invoices (business_id, id) ON DELETE CASCADE NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.inventory_movements'::regclass AND conname = 'qelanto_movements_product_business_fk') THEN
        ALTER TABLE public.inventory_movements
            ADD CONSTRAINT qelanto_movements_product_business_fk
            FOREIGN KEY (business_id, product_id)
            REFERENCES public.products (business_id, id) ON DELETE CASCADE NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.whatsapp_message_logs'::regclass AND conname = 'qelanto_whatsapp_invoice_business_fk') THEN
        ALTER TABLE public.whatsapp_message_logs
            ADD CONSTRAINT qelanto_whatsapp_invoice_business_fk
            FOREIGN KEY (business_id, invoice_id)
            REFERENCES public.invoices (business_id, id) ON DELETE CASCADE NOT VALID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_constraint WHERE conrelid = 'public.whatsapp_message_logs'::regclass AND conname = 'qelanto_whatsapp_customer_business_fk') THEN
        ALTER TABLE public.whatsapp_message_logs
            ADD CONSTRAINT qelanto_whatsapp_customer_business_fk
            FOREIGN KEY (business_id, customer_id)
            REFERENCES public.customers (business_id, id)
            ON DELETE SET NULL (customer_id) NOT VALID;
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_constraint AS constraint_row
        WHERE constraint_row.conrelid = 'public.invoice_items'::regclass
          AND constraint_row.contype = 'f'
          AND constraint_row.confrelid = 'public.invoices'::regclass
          AND constraint_row.conkey = ARRAY[(
              SELECT attribute.attnum
              FROM pg_catalog.pg_attribute AS attribute
              WHERE attribute.attrelid = 'public.invoice_items'::regclass
                AND attribute.attname = 'invoice_id'
          )]::SMALLINT[]
          AND constraint_row.confkey = ARRAY[(
              SELECT attribute.attnum
              FROM pg_catalog.pg_attribute AS attribute
              WHERE attribute.attrelid = 'public.invoices'::regclass
                AND attribute.attname = 'id'
          )]::SMALLINT[]
    ) THEN
        ALTER TABLE public.invoice_items
            ADD CONSTRAINT qelanto_invoice_items_invoice_fk
            FOREIGN KEY (invoice_id)
            REFERENCES public.invoices (id) ON DELETE CASCADE NOT VALID;
    END IF;
    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_constraint AS constraint_row
        WHERE constraint_row.conrelid = 'public.invoice_items'::regclass
          AND constraint_row.contype = 'f'
          AND constraint_row.confrelid = 'public.products'::regclass
          AND constraint_row.conkey = ARRAY[(
              SELECT attribute.attnum
              FROM pg_catalog.pg_attribute AS attribute
              WHERE attribute.attrelid = 'public.invoice_items'::regclass
                AND attribute.attname = 'product_id'
          )]::SMALLINT[]
          AND constraint_row.confkey = ARRAY[(
              SELECT attribute.attnum
              FROM pg_catalog.pg_attribute AS attribute
              WHERE attribute.attrelid = 'public.products'::regclass
                AND attribute.attname = 'id'
          )]::SMALLINT[]
    ) THEN
        ALTER TABLE public.invoice_items
            ADD CONSTRAINT qelanto_invoice_items_product_fk
            FOREIGN KEY (product_id)
            REFERENCES public.products (id) ON DELETE SET NULL NOT VALID;
    END IF;
END;
$$;

ALTER TABLE public.products VALIDATE CONSTRAINT qelanto_products_category_business_fk;
ALTER TABLE public.invoices VALIDATE CONSTRAINT qelanto_invoices_branch_business_fk;
ALTER TABLE public.invoices VALIDATE CONSTRAINT qelanto_invoices_customer_business_fk;
ALTER TABLE public.payments VALIDATE CONSTRAINT qelanto_payments_invoice_business_fk;
ALTER TABLE public.inventory_movements VALIDATE CONSTRAINT qelanto_movements_product_business_fk;
ALTER TABLE public.whatsapp_message_logs VALIDATE CONSTRAINT qelanto_whatsapp_invoice_business_fk;
ALTER TABLE public.whatsapp_message_logs VALIDATE CONSTRAINT qelanto_whatsapp_customer_business_fk;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conrelid = 'public.invoice_items'::regclass
          AND conname = 'qelanto_invoice_items_invoice_fk'
    ) THEN
        ALTER TABLE public.invoice_items VALIDATE CONSTRAINT qelanto_invoice_items_invoice_fk;
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conrelid = 'public.invoice_items'::regclass
          AND conname = 'qelanto_invoice_items_product_fk'
    ) THEN
        ALTER TABLE public.invoice_items VALIDATE CONSTRAINT qelanto_invoice_items_product_fk;
    END IF;
END;
$$;

-- Remove the stored WhatsApp bearer token. All WhatsApp credentials are
-- supplied by server-only environment variables; identifiers/settings may remain.
ALTER TABLE public.business_settings
    DROP COLUMN IF EXISTS whatsapp_access_token;

CREATE OR REPLACE FUNCTION public.user_has_business_access(lookup_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT auth.uid() IS NOT NULL
       AND EXISTS (
            SELECT 1
            FROM public.business_members AS bm
            WHERE bm.business_id = lookup_business_id
              AND bm.user_id = auth.uid()
       )
$$;

CREATE OR REPLACE FUNCTION public.user_is_business_owner(lookup_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT auth.uid() IS NOT NULL
       AND EXISTS (
            SELECT 1
            FROM public.businesses AS business
            WHERE business.id = lookup_business_id
              AND business.owner_id = auth.uid()
       )
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_business_members(lookup_business_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
    SELECT public.user_is_business_owner(lookup_business_id)
       OR EXISTS (
            SELECT 1
            FROM public.business_members AS bm
            WHERE bm.business_id = lookup_business_id
              AND bm.user_id = auth.uid()
              AND bm.role = 'admin'
       )
$$;

ALTER FUNCTION public.user_has_business_access(UUID) OWNER TO postgres;
ALTER FUNCTION public.user_is_business_owner(UUID) OWNER TO postgres;
ALTER FUNCTION public.user_can_manage_business_members(UUID) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.user_has_business_access(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_is_business_owner(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_can_manage_business_members(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_has_business_access(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_business_owner(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_manage_business_members(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_business_tenant_key()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF TG_TABLE_NAME = 'business_members' THEN
        IF NEW.business_id IS DISTINCT FROM OLD.business_id
           OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            RAISE EXCEPTION 'Business membership identity cannot be changed.';
        END IF;
    ELSIF NEW.business_id IS DISTINCT FROM OLD.business_id THEN
        RAISE EXCEPTION 'A row cannot be moved between businesses.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_business_owner_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
        RAISE EXCEPTION 'Business ownership cannot be changed through a row update.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_invoice_item_business()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    invoice_business_id UUID;
    product_business_id UUID;
BEGIN
    SELECT invoice.business_id
    INTO invoice_business_id
    FROM public.invoices AS invoice
    WHERE invoice.id = NEW.invoice_id;

    IF invoice_business_id IS NULL THEN
        RAISE EXCEPTION 'Invoice does not exist or is not accessible.';
    END IF;

    IF NEW.product_id IS NOT NULL THEN
        SELECT product.business_id
        INTO product_business_id
        FROM public.products AS product
        WHERE product.id = NEW.product_id;

        IF product_business_id IS NULL OR product_business_id <> invoice_business_id THEN
            RAISE EXCEPTION 'Invoice item product must belong to the invoice business.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.guard_invoice_snapshot_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
    IF NEW.invoice_number IS DISTINCT FROM OLD.invoice_number
       OR NEW.customer_name_snapshot IS DISTINCT FROM OLD.customer_name_snapshot
       OR NEW.customer_phone_snapshot IS DISTINCT FROM OLD.customer_phone_snapshot
       OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
       OR NEW.discount_amount IS DISTINCT FROM OLD.discount_amount
       OR NEW.tax_amount IS DISTINCT FROM OLD.tax_amount
       OR NEW.tax_rate IS DISTINCT FROM OLD.tax_rate
       OR NEW.grand_total IS DISTINCT FROM OLD.grand_total THEN
        RAISE EXCEPTION 'Invoice number, customer, and amount snapshots are immutable.';
    END IF;
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'business_members', 'branches', 'business_settings', 'categories',
        'products', 'customers', 'invoices', 'payments',
        'inventory_movements', 'whatsapp_message_logs'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS qelanto_guard_tenant_key ON public.%I', table_name);
        EXECUTE format(
            'CREATE TRIGGER qelanto_guard_tenant_key BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_business_tenant_key()',
            table_name
        );
    END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS qelanto_guard_invoice_item_business ON public.invoice_items;
CREATE TRIGGER qelanto_guard_invoice_item_business
    BEFORE INSERT OR UPDATE ON public.invoice_items
    FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_item_business();

DROP TRIGGER IF EXISTS qelanto_guard_invoice_snapshot ON public.invoices;
CREATE TRIGGER qelanto_guard_invoice_snapshot
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.guard_invoice_snapshot_immutable();

DROP TRIGGER IF EXISTS qelanto_guard_business_owner_id ON public.businesses;
CREATE TRIGGER qelanto_guard_business_owner_id
    BEFORE UPDATE OF owner_id ON public.businesses
    FOR EACH ROW EXECUTE FUNCTION public.guard_business_owner_id();

-- The memberships query runs as the trusted function owner to avoid RLS
-- recursion. One transaction-scoped lock serializes repeat/concurrent signup.
CREATE OR REPLACE FUNCTION public.create_business_onboarding_atomic(
    p_name TEXT,
    p_category TEXT,
    p_phone TEXT,
    p_email TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_pincode TEXT DEFAULT NULL,
    p_gstin TEXT DEFAULT NULL,
    p_invoice_prefix TEXT DEFAULT 'INV',
    p_tax_rate NUMERIC DEFAULT 0.00
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
    current_user_id UUID;
    existing_business_id UUID;
    new_business_id UUID;
    new_business_slug TEXT;
    slug_base TEXT;
    slug_max_length INTEGER;
    slug_prefix_length INTEGER;
    business_count INTEGER;
BEGIN
    current_user_id := auth.uid();
    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required.';
    END IF;

    IF NULLIF(pg_catalog.btrim(p_name), '') IS NULL
       OR pg_catalog.char_length(pg_catalog.btrim(p_name)) < 2 THEN
        RAISE EXCEPTION 'Business name must contain at least two characters.';
    END IF;
    IF NULLIF(pg_catalog.btrim(p_phone), '') IS NULL
       OR pg_catalog.char_length(pg_catalog.btrim(p_phone)) < 7 THEN
        RAISE EXCEPTION 'A valid business phone number is required.';
    END IF;
    IF p_tax_rate IS NULL OR p_tax_rate < 0 OR p_tax_rate > 100 THEN
        RAISE EXCEPTION 'Tax rate must be between 0 and 100.';
    END IF;
    IF pg_catalog.char_length(COALESCE(NULLIF(pg_catalog.btrim(p_invoice_prefix), ''), 'INV')) > 12 THEN
        RAISE EXCEPTION 'Invoice prefix must be at most 12 characters.';
    END IF;

    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('qelanto-onboarding:' || current_user_id::TEXT, 0)
    );

    SELECT bm.business_id
    INTO existing_business_id
    FROM public.business_members AS bm
    JOIN public.businesses AS business
      ON business.id = bm.business_id
     AND business.owner_id = current_user_id
    WHERE bm.user_id = current_user_id
    ORDER BY bm.created_at, bm.business_id
    LIMIT 1;

    IF existing_business_id IS NULL
       AND EXISTS (
            SELECT 1
            FROM public.business_members AS bm
            WHERE bm.user_id = current_user_id
       ) THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', FALSE,
            'message', 'Your account already belongs to a business but does not own it. Contact the business owner.'
        );
    END IF;

    IF existing_business_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.branches AS branch
            WHERE branch.business_id = existing_business_id
              AND branch.name = 'Main Branch'
        ) THEN
            INSERT INTO public.branches (
                id, business_id, name, phone, address,
                is_primary, is_main, created_at, updated_at
            )
            VALUES (
                pg_catalog.gen_random_uuid(),
                existing_business_id,
                'Main Branch',
                p_phone,
                p_address,
                TRUE,
                TRUE,
                pg_catalog.now(),
                pg_catalog.now()
            );
        END IF;

        INSERT INTO public.business_settings (
            business_id, invoice_prefix, invoice_sequence, tax_rate,
            tax_label, allow_negative_stock, whatsapp_enabled,
            tax_settings, invoice_settings, created_at, updated_at
        ) VALUES (
            existing_business_id,
            pg_catalog.upper(COALESCE(NULLIF(pg_catalog.btrim(p_invoice_prefix), ''), 'INV')),
            1, p_tax_rate, 'GST', FALSE, FALSE,
            '{}'::JSONB, '{}'::JSONB, pg_catalog.now(), pg_catalog.now()
        )
        ON CONFLICT (business_id) DO NOTHING;

        INSERT INTO public.categories (business_id, name, description)
        VALUES
            (existing_business_id, 'Men''s Wear', 'Shirts, Trousers, Jeans, Ethnic'),
            (existing_business_id, 'Women''s Wear', 'Sarees, Kurtis, Tops, Dresses'),
            (existing_business_id, 'Kids Wear', 'Children apparel and sets'),
            (existing_business_id, 'Accessories', 'Belts, Wallets, Caps, Socks'),
            (existing_business_id, 'General / Miscellaneous', 'Uncategorized items')
        ON CONFLICT (business_id, name) DO NOTHING;

        RETURN pg_catalog.jsonb_build_object(
            'success', TRUE,
            'business_id', existing_business_id,
            'message', 'User already belongs to a business.'
        );
    END IF;

    -- Recover only businesses explicitly owned by this authenticated user,
    -- covering partial records from the old non-atomic application fallback.
    SELECT count(*)::INTEGER, (pg_catalog.array_agg(business.id ORDER BY business.created_at, business.id))[1]
    INTO business_count, existing_business_id
    FROM public.businesses AS business
    WHERE business.owner_id = current_user_id;

    IF business_count > 1 THEN
        RAISE EXCEPTION 'Multiple owned businesses exist without membership; contact an administrator.';
    END IF;

    IF existing_business_id IS NOT NULL THEN
        INSERT INTO public.business_members (business_id, user_id, role)
        VALUES (existing_business_id, current_user_id, 'owner')
        ON CONFLICT (business_id, user_id) DO NOTHING;

        IF NOT EXISTS (
            SELECT 1 FROM public.branches AS branch
            WHERE branch.business_id = existing_business_id
        ) THEN
            INSERT INTO public.branches (
                id, business_id, name, phone, address,
                is_primary, is_main, created_at, updated_at
            )
            VALUES (
                pg_catalog.gen_random_uuid(),
                existing_business_id,
                'Main Branch',
                p_phone,
                p_address,
                TRUE,
                TRUE,
                pg_catalog.now(),
                pg_catalog.now()
            );
        END IF;

        INSERT INTO public.business_settings (
            business_id, invoice_prefix, invoice_sequence, tax_rate,
            tax_label, allow_negative_stock, whatsapp_enabled,
            tax_settings, invoice_settings, created_at, updated_at
        ) VALUES (
            existing_business_id,
            pg_catalog.upper(COALESCE(NULLIF(pg_catalog.btrim(p_invoice_prefix), ''), 'INV')),
            1, p_tax_rate, 'GST', FALSE, FALSE,
            '{}'::JSONB, '{}'::JSONB, pg_catalog.now(), pg_catalog.now()
        )
        ON CONFLICT (business_id) DO NOTHING;

        INSERT INTO public.categories (business_id, name, description)
        VALUES
            (existing_business_id, 'Men''s Wear', 'Shirts, Trousers, Jeans, Ethnic'),
            (existing_business_id, 'Women''s Wear', 'Sarees, Kurtis, Tops, Dresses'),
            (existing_business_id, 'Kids Wear', 'Children apparel and sets'),
            (existing_business_id, 'Accessories', 'Belts, Wallets, Caps, Socks'),
            (existing_business_id, 'General / Miscellaneous', 'Uncategorized items')
        ON CONFLICT (business_id, name) DO NOTHING;

        RETURN pg_catalog.jsonb_build_object(
            'success', TRUE,
            'business_id', existing_business_id,
            'message', 'Existing owned business membership and defaults were ensured.'
        );
    END IF;

    SELECT character_maximum_length
    INTO slug_max_length
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'businesses'
      AND column_name = 'slug';

    IF slug_max_length IS NOT NULL AND slug_max_length < 32 THEN
        RAISE EXCEPTION 'public.businesses.slug must allow at least 32 characters for a unique slug.';
    END IF;

    new_business_id := pg_catalog.gen_random_uuid();
    slug_base := pg_catalog.btrim(
        pg_catalog.lower(
            pg_catalog.regexp_replace(
                pg_catalog.btrim(p_name),
                '[^a-zA-Z0-9]+',
                '-',
                'g'
            )
        ),
        '-'
    );
    slug_prefix_length := CASE
        WHEN slug_max_length IS NULL THEN 80
        ELSE GREATEST(slug_max_length - 33, 0)
    END;
    slug_base := pg_catalog.btrim(pg_catalog.left(slug_base, slug_prefix_length), '-');
    new_business_slug := CASE
        WHEN slug_base = '' THEN pg_catalog.replace(new_business_id::TEXT, '-', '')
        ELSE slug_base || '-' || pg_catalog.replace(new_business_id::TEXT, '-', '')
    END;

    INSERT INTO public.businesses (
        id, name, slug, category, phone, email, address, city, state, pincode, gstin,
        currency, timezone, owner_id, created_by, created_at, updated_at
    ) VALUES (
        new_business_id,
        pg_catalog.btrim(p_name),
        new_business_slug,
        COALESCE(NULLIF(pg_catalog.btrim(p_category), ''), 'Retail / Clothing'),
        pg_catalog.btrim(p_phone),
        NULLIF(pg_catalog.btrim(p_email), ''),
        NULLIF(pg_catalog.btrim(p_address), ''),
        NULLIF(pg_catalog.btrim(p_city), ''),
        NULLIF(pg_catalog.btrim(p_state), ''),
        NULLIF(pg_catalog.btrim(p_pincode), ''),
        NULLIF(pg_catalog.btrim(p_gstin), ''),
        'INR',
        'Asia/Kolkata',
        current_user_id,
        current_user_id,
        pg_catalog.now(),
        pg_catalog.now()
    )
    RETURNING id INTO new_business_id;

    INSERT INTO public.business_members (business_id, user_id, role)
    VALUES (new_business_id, current_user_id, 'owner');

    INSERT INTO public.branches (
        id, business_id, name, phone, address,
        is_primary, is_main, created_at, updated_at
    )
    VALUES (
        pg_catalog.gen_random_uuid(),
        new_business_id,
        'Main Branch',
        pg_catalog.btrim(p_phone),
        NULLIF(pg_catalog.btrim(p_address), ''),
        TRUE,
        TRUE,
        pg_catalog.now(),
        pg_catalog.now()
    );

    INSERT INTO public.business_settings (
        business_id, invoice_prefix, invoice_sequence, tax_rate,
        tax_label, allow_negative_stock, whatsapp_enabled,
        tax_settings, invoice_settings, created_at, updated_at
    ) VALUES (
        new_business_id,
        pg_catalog.upper(COALESCE(NULLIF(pg_catalog.btrim(p_invoice_prefix), ''), 'INV')),
        1, p_tax_rate, 'GST', FALSE, FALSE,
        '{}'::JSONB, '{}'::JSONB, pg_catalog.now(), pg_catalog.now()
    );

    INSERT INTO public.categories (business_id, name, description)
    VALUES
        (new_business_id, 'Men''s Wear', 'Shirts, Trousers, Jeans, Ethnic'),
        (new_business_id, 'Women''s Wear', 'Sarees, Kurtis, Tops, Dresses'),
        (new_business_id, 'Kids Wear', 'Children apparel and sets'),
        (new_business_id, 'Accessories', 'Belts, Wallets, Caps, Socks'),
        (new_business_id, 'General / Miscellaneous', 'Uncategorized items');

    RETURN pg_catalog.jsonb_build_object(
        'success', TRUE,
        'business_id', new_business_id
    );
END;
$$;

ALTER FUNCTION public.create_business_onboarding_atomic(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC
) OWNER TO postgres;
ALTER FUNCTION public.create_business_onboarding_atomic(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC
) SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.create_business_onboarding_atomic(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_business_onboarding_atomic(
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC
) TO authenticated;

-- Harden the invoice RPC only when its exact local-schema signature exists.
DO $$
BEGIN
    IF pg_catalog.to_regprocedure(
        'public.create_invoice_atomic(uuid,uuid,text,text,jsonb,text,text,numeric,text)'
    ) IS NOT NULL THEN
        ALTER FUNCTION public.create_invoice_atomic(
            UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, NUMERIC, TEXT
        ) OWNER TO postgres;
        ALTER FUNCTION public.create_invoice_atomic(
            UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, NUMERIC, TEXT
        ) SET search_path = pg_catalog, public;
        REVOKE ALL ON FUNCTION public.create_invoice_atomic(
            UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, NUMERIC, TEXT
        ) FROM PUBLIC, anon;
        GRANT EXECUTE ON FUNCTION public.create_invoice_atomic(
            UUID, UUID, TEXT, TEXT, JSONB, TEXT, TEXT, NUMERIC, TEXT
        ) TO authenticated;
    END IF;
END;
$$;

-- Profile trigger function only needs trigger invocation, never direct RPC use.
ALTER FUNCTION public.handle_new_user() OWNER TO postgres;
ALTER FUNCTION public.handle_new_user() SET search_path = pg_catalog, public;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

-- Replace only the policy names reviewed in the checked-in migrations.
DROP POLICY IF EXISTS businesses_select_member ON public.businesses;
DROP POLICY IF EXISTS businesses_insert_authenticated ON public.businesses;
DROP POLICY IF EXISTS businesses_update_owner ON public.businesses;
DROP POLICY IF EXISTS business_members_select ON public.business_members;
DROP POLICY IF EXISTS business_members_insert ON public.business_members;
DROP POLICY IF EXISTS branches_access ON public.branches;
DROP POLICY IF EXISTS business_settings_access ON public.business_settings;
DROP POLICY IF EXISTS categories_access ON public.categories;
DROP POLICY IF EXISTS products_access ON public.products;
DROP POLICY IF EXISTS customers_access ON public.customers;
DROP POLICY IF EXISTS invoices_access ON public.invoices;
DROP POLICY IF EXISTS invoice_items_access ON public.invoice_items;
DROP POLICY IF EXISTS payments_access ON public.payments;
DROP POLICY IF EXISTS inventory_movements_access ON public.inventory_movements;
DROP POLICY IF EXISTS whatsapp_logs_access ON public.whatsapp_message_logs;

DROP POLICY IF EXISTS "Admins can delete branches" ON public.branches;
DROP POLICY IF EXISTS "Admins can insert branches" ON public.branches;
DROP POLICY IF EXISTS "Admins can update branches" ON public.branches;
DROP POLICY IF EXISTS "Members can view branches" ON public.branches;
DROP POLICY IF EXISTS "Members can view business members" ON public.business_members;
DROP POLICY IF EXISTS "Admins can update business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Members can view business settings" ON public.business_settings;
DROP POLICY IF EXISTS "Admins can update their businesses" ON public.businesses;
DROP POLICY IF EXISTS "Members can view their businesses" ON public.businesses;

DROP POLICY IF EXISTS qelanto_businesses_select ON public.businesses;
DROP POLICY IF EXISTS qelanto_businesses_update ON public.businesses;
DROP POLICY IF EXISTS qelanto_members_select ON public.business_members;
DROP POLICY IF EXISTS qelanto_members_insert ON public.business_members;
DROP POLICY IF EXISTS qelanto_members_update ON public.business_members;
DROP POLICY IF EXISTS qelanto_members_delete ON public.business_members;
DROP POLICY IF EXISTS qelanto_branches_select ON public.branches;
DROP POLICY IF EXISTS qelanto_branches_insert ON public.branches;
DROP POLICY IF EXISTS qelanto_branches_update ON public.branches;
DROP POLICY IF EXISTS qelanto_branches_delete ON public.branches;
DROP POLICY IF EXISTS qelanto_settings_select ON public.business_settings;
DROP POLICY IF EXISTS qelanto_settings_insert ON public.business_settings;
DROP POLICY IF EXISTS qelanto_settings_update ON public.business_settings;
DROP POLICY IF EXISTS qelanto_settings_delete ON public.business_settings;
DROP POLICY IF EXISTS qelanto_categories_select ON public.categories;
DROP POLICY IF EXISTS qelanto_categories_insert ON public.categories;
DROP POLICY IF EXISTS qelanto_categories_update ON public.categories;
DROP POLICY IF EXISTS qelanto_categories_delete ON public.categories;
DROP POLICY IF EXISTS qelanto_products_select ON public.products;
DROP POLICY IF EXISTS qelanto_products_insert ON public.products;
DROP POLICY IF EXISTS qelanto_products_update ON public.products;
DROP POLICY IF EXISTS qelanto_products_delete ON public.products;
DROP POLICY IF EXISTS qelanto_customers_select ON public.customers;
DROP POLICY IF EXISTS qelanto_customers_insert ON public.customers;
DROP POLICY IF EXISTS qelanto_customers_update ON public.customers;
DROP POLICY IF EXISTS qelanto_customers_delete ON public.customers;
DROP POLICY IF EXISTS qelanto_invoices_select ON public.invoices;
DROP POLICY IF EXISTS qelanto_invoices_insert ON public.invoices;
DROP POLICY IF EXISTS qelanto_invoices_update ON public.invoices;
DROP POLICY IF EXISTS qelanto_items_select ON public.invoice_items;
DROP POLICY IF EXISTS qelanto_items_insert ON public.invoice_items;
DROP POLICY IF EXISTS qelanto_payments_select ON public.payments;
DROP POLICY IF EXISTS qelanto_payments_insert ON public.payments;
DROP POLICY IF EXISTS qelanto_payments_update ON public.payments;
DROP POLICY IF EXISTS qelanto_payments_delete ON public.payments;
DROP POLICY IF EXISTS qelanto_movements_select ON public.inventory_movements;
DROP POLICY IF EXISTS qelanto_movements_insert ON public.inventory_movements;
DROP POLICY IF EXISTS qelanto_whatsapp_logs_select ON public.whatsapp_message_logs;
DROP POLICY IF EXISTS qelanto_whatsapp_logs_insert ON public.whatsapp_message_logs;
DROP POLICY IF EXISTS qelanto_whatsapp_logs_update ON public.whatsapp_message_logs;
DROP POLICY IF EXISTS qelanto_whatsapp_logs_delete ON public.whatsapp_message_logs;

CREATE POLICY qelanto_businesses_select ON public.businesses
    FOR SELECT TO authenticated
    USING (public.user_has_business_access(id));
CREATE POLICY qelanto_businesses_update ON public.businesses
    FOR UPDATE TO authenticated
    USING (public.user_is_business_owner(id))
    WITH CHECK (public.user_is_business_owner(id));
CREATE POLICY qelanto_members_select ON public.business_members
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.user_has_business_access(business_id));
CREATE POLICY qelanto_members_insert ON public.business_members
    FOR INSERT TO authenticated
    WITH CHECK (
        public.user_can_manage_business_members(business_id)
        AND (user_id <> auth.uid() OR public.user_is_business_owner(business_id))
        AND (
            role <> 'owner'
            OR (user_id = auth.uid() AND public.user_is_business_owner(business_id))
        )
    );
CREATE POLICY qelanto_members_update ON public.business_members
    FOR UPDATE TO authenticated
    USING (
        public.user_can_manage_business_members(business_id)
        AND (role <> 'owner' OR public.user_is_business_owner(business_id))
    )
    WITH CHECK (
        public.user_can_manage_business_members(business_id)
        AND (role <> 'owner' OR (user_id = auth.uid() AND public.user_is_business_owner(business_id)))
    );
CREATE POLICY qelanto_members_delete ON public.business_members
    FOR DELETE TO authenticated
    USING (
        public.user_can_manage_business_members(business_id)
        AND role <> 'owner'
    );

CREATE POLICY qelanto_branches_select ON public.branches
    FOR SELECT TO authenticated USING (public.user_has_business_access(business_id));
CREATE POLICY qelanto_branches_insert ON public.branches
    FOR INSERT TO authenticated WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY qelanto_branches_update ON public.branches
    FOR UPDATE TO authenticated USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY qelanto_branches_delete ON public.branches
    FOR DELETE TO authenticated USING (public.user_has_business_access(business_id));

CREATE POLICY qelanto_settings_select ON public.business_settings
    FOR SELECT TO authenticated USING (public.user_is_business_owner(business_id));
CREATE POLICY qelanto_settings_insert ON public.business_settings
    FOR INSERT TO authenticated WITH CHECK (public.user_is_business_owner(business_id));
CREATE POLICY qelanto_settings_update ON public.business_settings
    FOR UPDATE TO authenticated USING (public.user_is_business_owner(business_id))
    WITH CHECK (public.user_is_business_owner(business_id));
CREATE POLICY qelanto_settings_delete ON public.business_settings
    FOR DELETE TO authenticated USING (public.user_is_business_owner(business_id));

CREATE POLICY qelanto_categories_select ON public.categories
    FOR SELECT TO authenticated USING (public.user_has_business_access(business_id));
CREATE POLICY qelanto_categories_insert ON public.categories
    FOR INSERT TO authenticated WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY qelanto_categories_update ON public.categories
    FOR UPDATE TO authenticated USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY qelanto_categories_delete ON public.categories
    FOR DELETE TO authenticated USING (public.user_has_business_access(business_id));

CREATE POLICY qelanto_products_select ON public.products
    FOR SELECT TO authenticated USING (public.user_has_business_access(business_id));
CREATE POLICY qelanto_products_insert ON public.products
    FOR INSERT TO authenticated WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY qelanto_products_update ON public.products
    FOR UPDATE TO authenticated USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY qelanto_products_delete ON public.products
    FOR DELETE TO authenticated USING (public.user_has_business_access(business_id));

CREATE POLICY qelanto_customers_select ON public.customers
    FOR SELECT TO authenticated USING (public.user_has_business_access(business_id));
CREATE POLICY qelanto_customers_insert ON public.customers
    FOR INSERT TO authenticated WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY qelanto_customers_update ON public.customers
    FOR UPDATE TO authenticated USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY qelanto_customers_delete ON public.customers
    FOR DELETE TO authenticated USING (public.user_has_business_access(business_id));

CREATE POLICY qelanto_invoices_select ON public.invoices
    FOR SELECT TO authenticated USING (public.user_has_business_access(business_id));
CREATE POLICY qelanto_invoices_insert ON public.invoices
    FOR INSERT TO authenticated WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY qelanto_invoices_update ON public.invoices
    FOR UPDATE TO authenticated USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));

CREATE POLICY qelanto_items_select ON public.invoice_items
    FOR SELECT TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.invoices AS invoice
        WHERE invoice.id = invoice_items.invoice_id
          AND public.user_has_business_access(invoice.business_id)
    ));
CREATE POLICY qelanto_items_insert ON public.invoice_items
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.invoices AS invoice
        WHERE invoice.id = invoice_items.invoice_id
          AND public.user_has_business_access(invoice.business_id)
    ));

CREATE POLICY qelanto_payments_select ON public.payments
    FOR SELECT TO authenticated USING (public.user_has_business_access(business_id));
CREATE POLICY qelanto_payments_insert ON public.payments
    FOR INSERT TO authenticated WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY qelanto_payments_update ON public.payments
    FOR UPDATE TO authenticated USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY qelanto_payments_delete ON public.payments
    FOR DELETE TO authenticated USING (public.user_has_business_access(business_id));

CREATE POLICY qelanto_movements_select ON public.inventory_movements
    FOR SELECT TO authenticated USING (public.user_has_business_access(business_id));
CREATE POLICY qelanto_movements_insert ON public.inventory_movements
    FOR INSERT TO authenticated WITH CHECK (public.user_has_business_access(business_id));

CREATE POLICY qelanto_whatsapp_logs_select ON public.whatsapp_message_logs
    FOR SELECT TO authenticated USING (public.user_has_business_access(business_id));
CREATE POLICY qelanto_whatsapp_logs_insert ON public.whatsapp_message_logs
    FOR INSERT TO authenticated WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY qelanto_whatsapp_logs_update ON public.whatsapp_message_logs
    FOR UPDATE TO authenticated USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));
CREATE POLICY qelanto_whatsapp_logs_delete ON public.whatsapp_message_logs
    FOR DELETE TO authenticated USING (public.user_has_business_access(business_id));

-- Remove the old blanket authenticated table grants from these business tables.
REVOKE ALL PRIVILEGES ON TABLE
    public.profiles, public.businesses, public.business_members, public.branches, public.business_settings,
    public.categories, public.products, public.customers, public.invoices,
    public.invoice_items, public.payments, public.inventory_movements,
    public.whatsapp_message_logs
FROM PUBLIC, anon, authenticated;

GRANT SELECT, UPDATE ON TABLE public.profiles TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.businesses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.business_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.branches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.business_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.invoices TO authenticated;
GRANT SELECT, INSERT ON TABLE public.invoice_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payments TO authenticated;
GRANT SELECT, INSERT ON TABLE public.inventory_movements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_message_logs TO authenticated;

REVOKE ALL PRIVILEGES ON TABLE
    public.profiles, public.businesses, public.business_members, public.branches,
    public.business_settings, public.categories, public.products, public.customers,
    public.invoices, public.invoice_items, public.payments, public.inventory_movements,
    public.whatsapp_message_logs
FROM service_role;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT (meta_message_id) ON TABLE public.whatsapp_message_logs TO service_role;
GRANT UPDATE (status, error_message, updated_at) ON TABLE public.whatsapp_message_logs TO service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
