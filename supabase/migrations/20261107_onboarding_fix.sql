-- ====================================================================
-- QELANTO BUSINESS OS: ADDITIVE MIGRATION FOR ONBOARDING & CORE SCHEMA
-- Migration: 20261107_onboarding_fix.sql
-- Description: Non-destructive additive migration adding missing columns to
--              businesses, business_settings, branches, profiles,
--              creating the atomic onboarding RPC, and reloading schema cache.
-- ====================================================================

-- 1. PROFILES TABLE: Ensure email column exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. BUSINESSES TABLE: Add missing fields for onboarding
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS pincode TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS gstin TEXT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Retail / Clothing';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata';
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id) ON DELETE RESTRICT;
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.businesses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 3. BUSINESS_MEMBERS TABLE: Add updated_at and unique constraint
ALTER TABLE public.business_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'business_members_business_id_user_id_key'
    ) THEN
        ALTER TABLE public.business_members ADD CONSTRAINT business_members_business_id_user_id_key UNIQUE (business_id, user_id);
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

-- 4. BRANCHES TABLE: Add is_main and updated_at
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS is_main BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 5. BUSINESS_SETTINGS TABLE: Add settings columns
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();
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
ALTER TABLE public.business_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 6. REMAINING RETAIL TABLES (IF NOT ALREADY EXISTING)
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (business_id, name)
);

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

-- 7. HELPER FUNCTION: user_has_business_access
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

-- 8. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_settings ENABLE ROW LEVEL SECURITY;

-- Grant permissions to authenticated
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Businesses: Allow authenticated users to insert their own business
DROP POLICY IF EXISTS "businesses_insert_authenticated" ON public.businesses;
CREATE POLICY "businesses_insert_authenticated" ON public.businesses
    FOR INSERT TO authenticated
    WITH CHECK (owner_id = auth.uid() OR owner_id IS NULL);

DROP POLICY IF EXISTS "businesses_select_member" ON public.businesses;
CREATE POLICY "businesses_select_member" ON public.businesses
    FOR SELECT TO authenticated
    USING (public.user_has_business_access(id) OR owner_id = auth.uid());

DROP POLICY IF EXISTS "businesses_update_owner" ON public.businesses;
CREATE POLICY "businesses_update_owner" ON public.businesses
    FOR UPDATE TO authenticated
    USING (owner_id = auth.uid() OR public.user_has_business_access(id));

-- Business Members
DROP POLICY IF EXISTS "business_members_insert" ON public.business_members;
CREATE POLICY "business_members_insert" ON public.business_members
    FOR INSERT TO authenticated
    WITH CHECK (user_id = auth.uid() OR public.user_has_business_access(business_id));

DROP POLICY IF EXISTS "business_members_select" ON public.business_members;
CREATE POLICY "business_members_select" ON public.business_members
    FOR SELECT TO authenticated
    USING (user_id = auth.uid() OR public.user_has_business_access(business_id));

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

-- 9. ATOMIC ONBOARDING STORED PROCEDURE
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
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_existing_biz_id UUID;
    v_business_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User is not authenticated';
    END IF;

    -- Check if user already owns or belongs to an active business
    SELECT business_id INTO v_existing_biz_id
    FROM public.business_members
    WHERE user_id = v_user_id
    LIMIT 1;

    IF v_existing_biz_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'business_id', v_existing_biz_id,
            'message', 'User already has an active store'
        );
    END IF;

    -- 1. Insert into businesses
    INSERT INTO public.businesses (
        name,
        category,
        phone,
        email,
        address,
        city,
        state,
        pincode,
        gstin,
        currency,
        timezone,
        owner_id
    ) VALUES (
        p_name,
        COALESCE(p_category, 'Retail / Clothing'),
        p_phone,
        p_email,
        p_address,
        p_city,
        p_state,
        p_pincode,
        p_gstin,
        'INR',
        'Asia/Kolkata',
        v_user_id
    ) RETURNING id INTO v_business_id;

    -- 2. Insert into business_members as owner
    INSERT INTO public.business_members (
        business_id,
        user_id,
        role
    ) VALUES (
        v_business_id,
        v_user_id,
        'owner'
    );

    -- 3. Create Main Branch
    INSERT INTO public.branches (
        business_id,
        name,
        phone,
        address,
        is_main
    ) VALUES (
        v_business_id,
        'Main Branch',
        p_phone,
        p_address,
        true
    );

    -- 4. Create default settings
    INSERT INTO public.business_settings (
        business_id,
        invoice_prefix,
        invoice_sequence,
        tax_rate,
        tax_label,
        allow_negative_stock,
        whatsapp_enabled
    ) VALUES (
        v_business_id,
        COALESCE(NULLIF(p_invoice_prefix, ''), 'INV'),
        1,
        COALESCE(p_tax_rate, 0.00),
        'GST',
        false,
        false
    );

    -- 5. Seed initial starter categories
    INSERT INTO public.categories (business_id, name, description)
    VALUES 
        (v_business_id, 'Men''s Wear', 'Shirts, Trousers, Jeans, Ethnic'),
        (v_business_id, 'Women''s Wear', 'Sarees, Kurtis, Tops, Dresses'),
        (v_business_id, 'Kids Wear', 'Children apparel and sets'),
        (v_business_id, 'Accessories', 'Belts, Wallets, Caps, Socks'),
        (v_business_id, 'General / Miscellaneous', 'Uncategorized items')
    ON CONFLICT (business_id, name) DO NOTHING;

    RETURN jsonb_build_object(
        'success', true,
        'business_id', v_business_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. NOTIFY POSTGREST TO RELOAD SCHEMA CACHE IMMEDIATELY
NOTIFY pgrst, 'reload schema';

