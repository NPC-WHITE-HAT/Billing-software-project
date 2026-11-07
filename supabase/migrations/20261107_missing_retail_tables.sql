-- Qelanto Business OS: create the eight missing retail tables.
-- Prerequisites: the existing profiles, businesses, business_members,
-- branches, and business_settings tables have the expected core columns;
-- PostgreSQL 15+ is required for column-list ON DELETE SET NULL.
--
-- Apply 20261107_security_onboarding_hardening.sql immediately afterward. This
-- migration intentionally installs no onboarding RPC and no authenticated
-- access policies. The new tables remain RLS-enabled and inaccessible to
-- client roles until the reviewed hardening migration installs their policies.

BEGIN;

DO $$
DECLARE
    missing_columns TEXT;
    incompatible_columns TEXT;
BEGIN
    IF current_setting('server_version_num')::INTEGER < 150000 THEN
        RAISE EXCEPTION 'This migration requires PostgreSQL 15 or later.';
    END IF;

    SELECT string_agg(format('%I.%I', required.table_name, required.column_name), ', ')
    INTO missing_columns
    FROM (
        VALUES
            ('profiles', 'id'), ('profiles', 'email'), ('profiles', 'full_name'),
            ('businesses', 'id'), ('businesses', 'name'), ('businesses', 'category'),
            ('businesses', 'phone'), ('businesses', 'email'), ('businesses', 'address'),
            ('businesses', 'city'), ('businesses', 'state'), ('businesses', 'pincode'),
            ('businesses', 'gstin'), ('businesses', 'currency'), ('businesses', 'timezone'),
            ('businesses', 'owner_id'), ('businesses', 'created_at'), ('businesses', 'updated_at'),
            ('business_members', 'business_id'), ('business_members', 'user_id'),
            ('business_members', 'role'), ('business_members', 'created_at'),
            ('branches', 'id'), ('branches', 'business_id'), ('branches', 'name'),
            ('branches', 'phone'), ('branches', 'address'), ('branches', 'is_main'),
            ('business_settings', 'business_id'), ('business_settings', 'invoice_prefix'),
            ('business_settings', 'invoice_sequence'), ('business_settings', 'tax_rate'),
            ('business_settings', 'tax_label'), ('business_settings', 'allow_negative_stock'),
            ('business_settings', 'whatsapp_enabled')
    ) AS required(table_name, column_name)
    LEFT JOIN information_schema.columns AS actual
        ON actual.table_schema = 'public'
       AND actual.table_name = required.table_name
       AND actual.column_name = required.column_name
    WHERE actual.column_name IS NULL;

    IF missing_columns IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot create retail tables; required existing columns are missing: %', missing_columns;
    END IF;

    SELECT string_agg(
        format('%I.%I (expected uuid, found %s)', required.table_name, required.column_name, actual.data_type),
        ', '
    )
    INTO incompatible_columns
    FROM (
        VALUES
            ('businesses', 'id'),
            ('branches', 'id'), ('branches', 'business_id')
    ) AS required(table_name, column_name)
    JOIN information_schema.columns AS actual
        ON actual.table_schema = 'public'
       AND actual.table_name = required.table_name
       AND actual.column_name = required.column_name
    WHERE actual.data_type <> 'uuid';

    IF incompatible_columns IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot create tenant-safe foreign keys; incompatible existing columns: %', incompatible_columns;
    END IF;
END;
$$;

-- 1. Categories depend on the existing businesses table.
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT categories_business_id_name_key UNIQUE (business_id, name)
);

-- 2. Products depend on businesses and categories.
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    sku TEXT NOT NULL,
    selling_price NUMERIC(12, 2) NOT NULL CHECK (selling_price >= 0),
    purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (purchase_price >= 0),
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT products_business_id_sku_key UNIQUE (business_id, sku)
);

-- 3. Customers depend on businesses.
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    address TEXT,
    whatsapp_consent BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT customers_business_id_phone_key UNIQUE (business_id, phone)
);

-- 4. Invoices depend on businesses, branches, and customers. The original
-- nullable branch/customer relationships retain their SET NULL behavior.
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL,
    customer_name_snapshot TEXT NOT NULL,
    customer_phone_snapshot TEXT,
    subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(12, 2) NOT NULL CHECK (grand_total >= 0),
    payment_status TEXT NOT NULL DEFAULT 'paid'
        CHECK (payment_status IN ('paid', 'partial', 'pending', 'cancelled')),
    status TEXT NOT NULL DEFAULT 'completed'
        CHECK (status IN ('completed', 'cancelled')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT invoices_business_id_invoice_number_key UNIQUE (business_id, invoice_number)
);

-- 5. Invoice items depend on invoices and products. Product/customer/invoice
-- values are retained as snapshots by the original schema.
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name_snapshot TEXT NOT NULL,
    sku_snapshot TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0),
    total_price NUMERIC(12, 2) NOT NULL CHECK (total_price >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Payments depend on businesses and invoices.
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'card')),
    reference_number TEXT,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Inventory movements depend on businesses and products.
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('sale', 'restock', 'adjustment', 'return')),
    quantity_delta INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    reference_id UUID,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. WhatsApp logs depend on businesses, invoices, and optional customers.
-- No credential/token columns are stored in this table.
CREATE TABLE IF NOT EXISTS public.whatsapp_message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    recipient_phone TEXT NOT NULL,
    template_name TEXT NOT NULL,
    meta_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Composite candidate keys are required for tenant-preserving foreign keys.
-- These names match the reviewed hardening migration.
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

-- Composite relationships prevent valid IDs from crossing business tenants.
-- The nullable child key only is nulled when an optional parent is deleted.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conrelid = 'public.products'::regclass
          AND conname = 'qelanto_products_category_business_fk'
    ) THEN
        ALTER TABLE public.products
            ADD CONSTRAINT qelanto_products_category_business_fk
            FOREIGN KEY (business_id, category_id)
            REFERENCES public.categories (business_id, id)
            ON DELETE SET NULL (category_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conrelid = 'public.invoices'::regclass
          AND conname = 'qelanto_invoices_branch_business_fk'
    ) THEN
        ALTER TABLE public.invoices
            ADD CONSTRAINT qelanto_invoices_branch_business_fk
            FOREIGN KEY (business_id, branch_id)
            REFERENCES public.branches (business_id, id)
            ON DELETE SET NULL (branch_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conrelid = 'public.invoices'::regclass
          AND conname = 'qelanto_invoices_customer_business_fk'
    ) THEN
        ALTER TABLE public.invoices
            ADD CONSTRAINT qelanto_invoices_customer_business_fk
            FOREIGN KEY (business_id, customer_id)
            REFERENCES public.customers (business_id, id)
            ON DELETE SET NULL (customer_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conrelid = 'public.payments'::regclass
          AND conname = 'qelanto_payments_invoice_business_fk'
    ) THEN
        ALTER TABLE public.payments
            ADD CONSTRAINT qelanto_payments_invoice_business_fk
            FOREIGN KEY (business_id, invoice_id)
            REFERENCES public.invoices (business_id, id)
            ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conrelid = 'public.inventory_movements'::regclass
          AND conname = 'qelanto_movements_product_business_fk'
    ) THEN
        ALTER TABLE public.inventory_movements
            ADD CONSTRAINT qelanto_movements_product_business_fk
            FOREIGN KEY (business_id, product_id)
            REFERENCES public.products (business_id, id)
            ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conrelid = 'public.whatsapp_message_logs'::regclass
          AND conname = 'qelanto_whatsapp_invoice_business_fk'
    ) THEN
        ALTER TABLE public.whatsapp_message_logs
            ADD CONSTRAINT qelanto_whatsapp_invoice_business_fk
            FOREIGN KEY (business_id, invoice_id)
            REFERENCES public.invoices (business_id, id)
            ON DELETE CASCADE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_catalog.pg_constraint
        WHERE conrelid = 'public.whatsapp_message_logs'::regclass
          AND conname = 'qelanto_whatsapp_customer_business_fk'
    ) THEN
        ALTER TABLE public.whatsapp_message_logs
            ADD CONSTRAINT qelanto_whatsapp_customer_business_fk
            FOREIGN KEY (business_id, customer_id)
            REFERENCES public.customers (business_id, id)
            ON DELETE SET NULL (customer_id);
    END IF;
END;
$$;

-- Safe to rerun: all target tables are newly introduced and all indexes are
-- idempotently named. Do not repair an existing partial table here; inspect it
-- and reconcile it separately rather than silently assuming its columns.
CREATE INDEX IF NOT EXISTS idx_categories_biz ON public.categories (business_id);
CREATE INDEX IF NOT EXISTS idx_products_biz ON public.products (business_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products (business_id, sku);
CREATE INDEX IF NOT EXISTS idx_customers_biz ON public.customers (business_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers (business_id, phone);
CREATE INDEX IF NOT EXISTS idx_invoices_biz ON public.invoices (business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices (customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments (invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_biz ON public.payments (business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_prod ON public.inventory_movements (product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_biz ON public.inventory_movements (business_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_biz ON public.whatsapp_message_logs (business_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_inv ON public.whatsapp_message_logs (invoice_id);

-- Fail closed until the separate hardening migration installs RLS policies and
-- the minimum authenticated/service_role grants.
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE
    public.categories, public.products, public.customers, public.invoices,
    public.invoice_items, public.payments, public.inventory_movements,
    public.whatsapp_message_logs
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
