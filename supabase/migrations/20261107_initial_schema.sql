-- QELANTO BUSINESS OS - MIGRATION 20261107_initial_schema.sql
-- Safe, non-destructive, idempotent migration for Single-Shop Retail Billing MVP

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ====================================================================
-- 1. PROFILES TABLE (linked to auth.users)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    phone TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Trigger to automatically create or update profile on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    )
    ON CONFLICT (id) DO UPDATE
    SET 
        email = EXCLUDED.email,
        full_name = CASE 
            WHEN EXCLUDED.full_name IS NOT NULL AND EXCLUDED.full_name <> '' 
            THEN EXCLUDED.full_name 
            ELSE public.profiles.full_name 
        END,
        updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ====================================================================
-- 2. BUSINESSES TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Retail / Clothing',
    phone TEXT,
    email TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    gstin TEXT,
    currency TEXT NOT NULL DEFAULT 'INR',
    timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Retail / Clothing';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS pincode TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS gstin TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ====================================================================
-- 3. BUSINESS_MEMBERS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.business_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'manager', 'cashier')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (business_id, user_id)
);

ALTER TABLE public.business_members ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.business_members ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE public.business_members ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'owner';
ALTER TABLE public.business_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.business_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Helper function to check if the current user has access to a business
CREATE OR REPLACE FUNCTION public.user_has_business_access(lookup_business_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.business_members bm
        WHERE bm.business_id = lookup_business_id
          AND bm.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ====================================================================
-- 4. BRANCHES TABLE (Main branch for single-shop)
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT 'Main Branch',
    phone TEXT,
    address TEXT,
    is_main BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Main Branch';
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS is_main BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ====================================================================
-- 5. BUSINESS_SETTINGS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.business_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE UNIQUE,
    invoice_prefix TEXT NOT NULL DEFAULT 'INV',
    invoice_sequence INTEGER NOT NULL DEFAULT 1,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    tax_label TEXT NOT NULL DEFAULT 'GST',
    allow_negative_stock BOOLEAN NOT NULL DEFAULT false,
    whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
    whatsapp_phone_number_id TEXT,
    whatsapp_access_token TEXT,
    whatsapp_business_account_id TEXT,
    whatsapp_template_name TEXT DEFAULT 'invoice_notification',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE;
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS invoice_prefix TEXT NOT NULL DEFAULT 'INV';
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS invoice_sequence INTEGER NOT NULL DEFAULT 1;
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS tax_label TEXT NOT NULL DEFAULT 'GST';
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS allow_negative_stock BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS whatsapp_phone_number_id TEXT;
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS whatsapp_access_token TEXT;
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS whatsapp_business_account_id TEXT;
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS whatsapp_template_name TEXT DEFAULT 'invoice_notification';
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- ====================================================================
-- 6. CATEGORIES TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (business_id, name)
);

-- ====================================================================
-- 7. PRODUCTS TABLE
-- ====================================================================
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
    UNIQUE (business_id, sku)
);

-- ====================================================================
-- 8. CUSTOMERS TABLE
-- ====================================================================
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
    UNIQUE (business_id, phone)
);

-- ====================================================================
-- 9. INVOICES TABLE
-- ====================================================================
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
    payment_status TEXT NOT NULL DEFAULT 'paid' CHECK (payment_status IN ('paid', 'partial', 'pending', 'cancelled')),
    status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'cancelled')),
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (business_id, invoice_number)
);

-- ====================================================================
-- 10. INVOICE_ITEMS TABLE (Immutable snapshot of line items)
-- ====================================================================
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

-- ====================================================================
-- 11. PAYMENTS TABLE
-- ====================================================================
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

-- ====================================================================
-- 12. INVENTORY_MOVEMENTS TABLE (Audit trail of stock adjustments)
-- ====================================================================
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

-- ====================================================================
-- 13. WHATSAPP_MESSAGE_LOGS TABLE
-- ====================================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_message_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    recipient_phone TEXT NOT NULL,
    template_name TEXT NOT NULL,
    meta_message_id TEXT,
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'read', 'failed')),
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ====================================================================
-- INDEXES FOR PERFORMANCE
-- ====================================================================
CREATE INDEX IF NOT EXISTS idx_businesses_owner ON public.businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_business_members_user ON public.business_members(user_id);
CREATE INDEX IF NOT EXISTS idx_business_members_biz ON public.business_members(business_id);
CREATE INDEX IF NOT EXISTS idx_branches_biz ON public.branches(business_id);
CREATE INDEX IF NOT EXISTS idx_categories_biz ON public.categories(business_id);
CREATE INDEX IF NOT EXISTS idx_products_biz ON public.products(business_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(business_id, sku);
CREATE INDEX IF NOT EXISTS idx_customers_biz ON public.customers(business_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(business_id, phone);
CREATE INDEX IF NOT EXISTS idx_invoices_biz ON public.invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_biz ON public.payments(business_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_prod ON public.inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_biz ON public.inventory_movements(business_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_biz ON public.whatsapp_message_logs(business_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_inv ON public.whatsapp_message_logs(invoice_id);

-- ====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
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

-- Grant usage on schema public to authenticated and anon
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Profiles: Users can read and update their own profile
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Businesses: Members can select, Owners can insert/update
DROP POLICY IF EXISTS "businesses_select_member" ON public.businesses;
CREATE POLICY "businesses_select_member" ON public.businesses
    FOR SELECT TO authenticated
    USING (public.user_has_business_access(id) OR owner_id = auth.uid());

DROP POLICY IF EXISTS "businesses_insert_authenticated" ON public.businesses;
CREATE POLICY "businesses_insert_authenticated" ON public.businesses
    FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "businesses_update_owner" ON public.businesses;
CREATE POLICY "businesses_update_owner" ON public.businesses
    FOR UPDATE TO authenticated
    USING (owner_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.business_members bm 
        WHERE bm.business_id = id AND bm.user_id = auth.uid() AND bm.role IN ('owner', 'admin')
    ));

-- Business Members: Members can view members of their business
DROP POLICY IF EXISTS "business_members_select" ON public.business_members;
CREATE POLICY "business_members_select" ON public.business_members
    FOR SELECT TO authenticated
    USING (public.user_has_business_access(business_id) OR user_id = auth.uid());

DROP POLICY IF EXISTS "business_members_insert" ON public.business_members;
CREATE POLICY "business_members_insert" ON public.business_members
    FOR INSERT TO authenticated
    WITH CHECK (
        -- Allow creator to add self during onboarding, or owner/admin to add others
        user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM public.business_members bm 
            WHERE bm.business_id = business_members.business_id 
              AND bm.user_id = auth.uid() 
              AND bm.role IN ('owner', 'admin')
        )
    );

-- Branches
DROP POLICY IF EXISTS "branches_access" ON public.branches;
CREATE POLICY "branches_access" ON public.branches
    FOR ALL TO authenticated
    USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));

-- Business Settings
DROP POLICY IF EXISTS "business_settings_access" ON public.business_settings;
CREATE POLICY "business_settings_access" ON public.business_settings
    FOR ALL TO authenticated
    USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));

-- Categories
DROP POLICY IF EXISTS "categories_access" ON public.categories;
CREATE POLICY "categories_access" ON public.categories
    FOR ALL TO authenticated
    USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));

-- Products
DROP POLICY IF EXISTS "products_access" ON public.products;
CREATE POLICY "products_access" ON public.products
    FOR ALL TO authenticated
    USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));

-- Customers
DROP POLICY IF EXISTS "customers_access" ON public.customers;
CREATE POLICY "customers_access" ON public.customers
    FOR ALL TO authenticated
    USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));

-- Invoices
DROP POLICY IF EXISTS "invoices_access" ON public.invoices;
CREATE POLICY "invoices_access" ON public.invoices
    FOR ALL TO authenticated
    USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));

-- Invoice Items: Access checked via parent invoice
DROP POLICY IF EXISTS "invoice_items_access" ON public.invoice_items;
CREATE POLICY "invoice_items_access" ON public.invoice_items
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.invoices inv
        WHERE inv.id = invoice_items.invoice_id
          AND public.user_has_business_access(inv.business_id)
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.invoices inv
        WHERE inv.id = invoice_items.invoice_id
          AND public.user_has_business_access(inv.business_id)
    ));

-- Payments
DROP POLICY IF EXISTS "payments_access" ON public.payments;
CREATE POLICY "payments_access" ON public.payments
    FOR ALL TO authenticated
    USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));

-- Inventory Movements
DROP POLICY IF EXISTS "inventory_movements_access" ON public.inventory_movements;
CREATE POLICY "inventory_movements_access" ON public.inventory_movements
    FOR ALL TO authenticated
    USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));

-- WhatsApp Message Logs
DROP POLICY IF EXISTS "whatsapp_logs_access" ON public.whatsapp_message_logs;
CREATE POLICY "whatsapp_logs_access" ON public.whatsapp_message_logs
    FOR ALL TO authenticated
    USING (public.user_has_business_access(business_id))
    WITH CHECK (public.user_has_business_access(business_id));

-- ====================================================================
-- ATOMIC INVOICE CREATION & STOCK DEDUCTION RPC
-- ====================================================================
CREATE OR REPLACE FUNCTION public.create_invoice_atomic(
    p_business_id UUID,
    p_customer_id UUID,
    p_customer_name TEXT,
    p_customer_phone TEXT,
    p_items JSONB,
    p_payment_method TEXT,
    p_payment_reference TEXT DEFAULT NULL,
    p_discount_amount NUMERIC DEFAULT 0.00,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_settings RECORD;
    v_invoice_number TEXT;
    v_invoice_id UUID;
    v_branch_id UUID;
    v_subtotal NUMERIC(12, 2) := 0.00;
    v_tax_amount NUMERIC(12, 2) := 0.00;
    v_tax_rate NUMERIC(5, 2) := 0.00;
    v_grand_total NUMERIC(12, 2) := 0.00;
    v_item RECORD;
    v_prod RECORD;
    v_item_subtotal NUMERIC(12, 2);
    v_new_stock INTEGER;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not signed in';
    END IF;

    -- Verify business access
    IF NOT public.user_has_business_access(p_business_id) THEN
        RAISE EXCEPTION 'Forbidden: User does not belong to this business';
    END IF;

    -- Lock and retrieve business settings
    SELECT * INTO v_settings
    FROM public.business_settings
    WHERE business_id = p_business_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Business settings not found';
    END IF;

    -- Retrieve Main Branch
    SELECT id INTO v_branch_id
    FROM public.branches
    WHERE business_id = p_business_id
    ORDER BY is_main DESC, created_at ASC
    LIMIT 1;

    -- Generate Invoice Number
    v_invoice_number := v_settings.invoice_prefix || '-' || LPAD(v_settings.invoice_sequence::text, 6, '0');

    -- Increment sequence in settings
    UPDATE public.business_settings
    SET invoice_sequence = invoice_sequence + 1,
        updated_at = now()
    WHERE business_id = p_business_id;

    v_tax_rate := COALESCE(v_settings.tax_rate, 0.00);

    -- Calculate subtotal from items
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        quantity INTEGER,
        unit_price NUMERIC(12, 2)
    )
    LOOP
        v_item_subtotal := ROUND((v_item.quantity * v_item.unit_price)::numeric, 2);
        v_subtotal := v_subtotal + v_item_subtotal;
    END LOOP;

    -- Calculate tax & grand total
    v_subtotal := GREATEST(0.00, v_subtotal);
    v_tax_amount := ROUND(((v_subtotal - COALESCE(p_discount_amount, 0.00)) * (v_tax_rate / 100.00))::numeric, 2);
    v_tax_amount := GREATEST(0.00, v_tax_amount);
    v_grand_total := ROUND((v_subtotal - COALESCE(p_discount_amount, 0.00) + v_tax_amount)::numeric, 2);
    v_grand_total := GREATEST(0.00, v_grand_total);

    -- Insert Invoice
    INSERT INTO public.invoices (
        business_id,
        branch_id,
        customer_id,
        invoice_number,
        customer_name_snapshot,
        customer_phone_snapshot,
        subtotal,
        discount_amount,
        tax_amount,
        tax_rate,
        grand_total,
        payment_status,
        status,
        notes,
        created_by
    ) VALUES (
        p_business_id,
        v_branch_id,
        p_customer_id,
        v_invoice_number,
        p_customer_name,
        p_customer_phone,
        v_subtotal,
        COALESCE(p_discount_amount, 0.00),
        v_tax_amount,
        v_tax_rate,
        v_grand_total,
        'paid',
        'completed',
        p_notes,
        v_user_id
    ) RETURNING id INTO v_invoice_id;

    -- Process items & deduct stock
    FOR v_item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(
        product_id UUID,
        quantity INTEGER,
        unit_price NUMERIC(12, 2)
    )
    LOOP
        -- Lock product row
        SELECT * INTO v_prod
        FROM public.products
        WHERE id = v_item.product_id AND business_id = p_business_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Product % not found in this business', v_item.product_id;
        END IF;

        IF NOT v_settings.allow_negative_stock AND (v_prod.stock_quantity < v_item.quantity) THEN
            RAISE EXCEPTION 'Insufficient stock for product "%" (Available: %, Requested: %)', 
                v_prod.name, v_prod.stock_quantity, v_item.quantity;
        END IF;

        v_new_stock := v_prod.stock_quantity - v_item.quantity;

        -- Update product stock
        UPDATE public.products
        SET stock_quantity = v_new_stock,
            updated_at = now()
        WHERE id = v_prod.id;

        -- Insert line item
        INSERT INTO public.invoice_items (
            invoice_id,
            product_id,
            product_name_snapshot,
            sku_snapshot,
            quantity,
            unit_price,
            total_price
        ) VALUES (
            v_invoice_id,
            v_prod.id,
            v_prod.name,
            v_prod.sku,
            v_item.quantity,
            v_item.unit_price,
            ROUND((v_item.quantity * v_item.unit_price)::numeric, 2)
        );

        -- Record inventory movement
        INSERT INTO public.inventory_movements (
            business_id,
            product_id,
            type,
            quantity_delta,
            previous_stock,
            new_stock,
            reference_id,
            notes,
            created_by
        ) VALUES (
            p_business_id,
            v_prod.id,
            'sale',
            -v_item.quantity,
            v_prod.stock_quantity,
            v_new_stock,
            v_invoice_id,
            'Deduction for invoice ' || v_invoice_number,
            v_user_id
        );
    END LOOP;

    -- Record Payment
    INSERT INTO public.payments (
        business_id,
        invoice_id,
        amount,
        payment_method,
        reference_number,
        paid_at
    ) VALUES (
        p_business_id,
        v_invoice_id,
        v_grand_total,
        p_payment_method,
        p_payment_reference,
        now()
    );

    RETURN jsonb_build_object(
        'success', true,
        'invoice_id', v_invoice_id,
        'invoice_number', v_invoice_number,
        'grand_total', v_grand_total
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

