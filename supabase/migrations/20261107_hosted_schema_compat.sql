-- Qelanto Business OS: compatibility additions for the inspected hosted schema.
-- This migration does not drop existing tables, columns, records, or foreign
-- keys. It fills missing branch flags and adds compatibility schema elements.
-- In particular, businesses.created_by is NOT assumed to mean owner_id, and
-- tax_settings/invoice_settings JSONB values are deliberately not transformed.
--
-- Apply before 20261107_missing_retail_tables.sql and
-- 20261107_security_onboarding_hardening.sql.

BEGIN;

DO $$
DECLARE
    missing_columns TEXT;
    incompatible_columns TEXT;
BEGIN
    IF to_regclass('public.profiles') IS NULL
       OR to_regclass('public.businesses') IS NULL
       OR to_regclass('public.business_members') IS NULL
       OR to_regclass('public.branches') IS NULL
       OR to_regclass('public.business_settings') IS NULL THEN
        RAISE EXCEPTION 'Compatibility migration requires the five inspected public tables.';
    END IF;

    IF to_regclass('auth.users') IS NULL THEN
        RAISE EXCEPTION 'Compatibility migration requires auth.users for the owner_id foreign key.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'auth'
          AND table_name = 'users'
          AND column_name = 'id'
          AND data_type = 'uuid'
    ) THEN
        RAISE EXCEPTION 'auth.users.id must exist and have type UUID.';
    END IF;

    SELECT string_agg(format('%I.%I', required.table_name, required.column_name), ', ')
    INTO missing_columns
    FROM (
        VALUES
            ('profiles', 'id'), ('profiles', 'full_name'), ('profiles', 'phone'),
            ('businesses', 'id'), ('businesses', 'slug'), ('businesses', 'created_by'),
            ('business_members', 'id'), ('business_members', 'business_id'),
            ('business_members', 'user_id'), ('business_members', 'role'),
            ('business_members', 'created_at'),
            ('branches', 'id'), ('branches', 'business_id'), ('branches', 'is_primary'),
            ('business_settings', 'business_id'),
            ('business_settings', 'tax_settings'), ('business_settings', 'invoice_settings')
    ) AS required(table_name, column_name)
    LEFT JOIN information_schema.columns AS actual
        ON actual.table_schema = 'public'
       AND actual.table_name = required.table_name
       AND actual.column_name = required.column_name
    WHERE actual.column_name IS NULL;

    IF missing_columns IS NOT NULL THEN
        RAISE EXCEPTION 'Inspected schema does not match the verified baseline; missing columns: %', missing_columns;
    END IF;

    SELECT string_agg(
        format('%I.%I (expected %s, found %s)', required.table_name, required.column_name,
               required.expected_type, actual.data_type),
        ', '
    )
    INTO incompatible_columns
    FROM (
        VALUES
            ('profiles', 'id', 'uuid'),
            ('businesses', 'id', 'uuid'), ('businesses', 'created_by', 'uuid'),
            ('branches', 'id', 'uuid'), ('branches', 'business_id', 'uuid'),
            ('branches', 'is_primary', 'boolean'),
            ('business_settings', 'business_id', 'uuid'),
            ('business_settings', 'tax_settings', 'jsonb'),
            ('business_settings', 'invoice_settings', 'jsonb')
    ) AS required(table_name, column_name, expected_type)
    JOIN information_schema.columns AS actual
        ON actual.table_schema = 'public'
       AND actual.table_name = required.table_name
       AND actual.column_name = required.column_name
    WHERE actual.data_type <> required.expected_type;

    IF incompatible_columns IS NOT NULL THEN
        RAISE EXCEPTION 'Inspected schema has incompatible column types: %', incompatible_columns;
    END IF;

    SELECT string_agg(
        format('%I.%I (expected %s, found %s)', required.table_name, required.column_name,
               required.expected_type, actual.data_type),
        ', '
    )
    INTO incompatible_columns
    FROM (
        VALUES
            ('business_members', 'id', 'uuid'),
            ('business_members', 'business_id', 'uuid'),
            ('business_members', 'user_id', 'uuid'),
            ('business_members', 'role', 'text'),
            ('business_members', 'created_at', 'timestamp with time zone')
    ) AS required(table_name, column_name, expected_type)
    JOIN information_schema.columns AS actual
        ON actual.table_schema = 'public'
       AND actual.table_name = required.table_name
       AND actual.column_name = required.column_name
    WHERE actual.data_type <> required.expected_type;

    IF incompatible_columns IS NOT NULL THEN
        RAISE EXCEPTION 'business_members has incompatible column types: %', incompatible_columns;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'businesses'
          AND column_name = 'slug'
          AND data_type IN ('text', 'character varying')
          AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'public.businesses.slug must be a NOT NULL text or varchar column.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'businesses'
          AND column_name = 'slug'
          AND character_maximum_length IS NOT NULL
          AND character_maximum_length < 32
    ) THEN
        RAISE EXCEPTION 'public.businesses.slug must allow at least 32 characters for UUID-based uniqueness.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'businesses'
          AND column_name = 'created_by'
          AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION 'public.businesses.created_by must remain NOT NULL.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'businesses'
          AND column_name = 'owner_id'
          AND data_type <> 'uuid'
    ) THEN
        RAISE EXCEPTION 'public.businesses.owner_id exists with an incompatible type; review it manually.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'branches'
          AND column_name = 'is_main'
          AND data_type <> 'boolean'
    ) THEN
        RAISE EXCEPTION 'public.branches.is_main exists with an incompatible type; review it manually.';
    END IF;
END;
$$;

-- Add only application/security-migration columns that may be absent.
-- Existing values and unrelated columns are left untouched.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS email TEXT;

ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS owner_id UUID,
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Retail / Clothing',
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS city TEXT,
    ADD COLUMN IF NOT EXISTS state TEXT,
    ADD COLUMN IF NOT EXISTS pincode TEXT,
    ADD COLUMN IF NOT EXISTS gstin TEXT,
    ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR',
    ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.branches
    ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Main Branch',
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS address TEXT,
    ADD COLUMN IF NOT EXISTS is_main BOOLEAN,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.business_settings
    ADD COLUMN IF NOT EXISTS invoice_prefix TEXT NOT NULL DEFAULT 'INV',
    ADD COLUMN IF NOT EXISTS invoice_sequence INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS tax_label TEXT NOT NULL DEFAULT 'GST',
    ADD COLUMN IF NOT EXISTS allow_negative_stock BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- The onboarding RPC omits membership id and created_at. Require defaults
-- only when those existing columns are NOT NULL.
DO $$
DECLARE
    missing_defaults TEXT;
BEGIN
    SELECT string_agg(format('%I.%I', actual.table_name, actual.column_name), ', ')
    INTO missing_defaults
    FROM information_schema.columns AS actual
    WHERE actual.table_schema = 'public'
      AND actual.table_name = 'business_members'
      AND actual.column_name = ANY (ARRAY['id', 'created_at'])
      AND actual.is_nullable = 'NO'
      AND actual.column_default IS NULL
      AND actual.is_identity = 'NO'
      AND actual.is_generated = 'NEVER';

    IF missing_defaults IS NOT NULL THEN
        RAISE EXCEPTION 'business_members onboarding-omitted NOT NULL columns lack defaults: %', missing_defaults;
    END IF;
END;
$$;

-- Fail closed if the onboarding INSERTs would omit any existing mandatory
-- column lacking a database default.
DO $$
DECLARE
    uncovered_columns TEXT;
BEGIN
    SELECT string_agg(format('%I.%I', actual.table_name, actual.column_name), ', ')
    INTO uncovered_columns
    FROM information_schema.columns AS actual
    LEFT JOIN (
        VALUES
            ('businesses', 'id'), ('businesses', 'name'), ('businesses', 'slug'),
            ('businesses', 'category'), ('businesses', 'phone'), ('businesses', 'email'),
            ('businesses', 'address'), ('businesses', 'city'), ('businesses', 'state'),
            ('businesses', 'pincode'), ('businesses', 'gstin'), ('businesses', 'currency'),
            ('businesses', 'timezone'), ('businesses', 'owner_id'),
            ('businesses', 'created_by'), ('businesses', 'created_at'),
            ('businesses', 'updated_at'),
            ('branches', 'id'), ('branches', 'business_id'), ('branches', 'name'),
            ('branches', 'phone'), ('branches', 'address'), ('branches', 'is_primary'),
            ('branches', 'is_main'), ('branches', 'created_at'), ('branches', 'updated_at'),
            ('business_settings', 'id'), ('business_settings', 'business_id'),
            ('business_settings', 'invoice_prefix'), ('business_settings', 'invoice_sequence'),
            ('business_settings', 'tax_rate'), ('business_settings', 'tax_label'),
            ('business_settings', 'allow_negative_stock'), ('business_settings', 'whatsapp_enabled'),
            ('business_settings', 'tax_settings'), ('business_settings', 'invoice_settings'),
            ('business_settings', 'created_at'), ('business_settings', 'updated_at')
    ) AS supplied(table_name, column_name)
        ON supplied.table_name = actual.table_name
       AND supplied.column_name = actual.column_name
    WHERE actual.table_schema = 'public'
      AND actual.table_name = ANY (ARRAY['businesses', 'branches', 'business_settings'])
      AND actual.is_nullable = 'NO'
      AND actual.column_default IS NULL
      AND actual.is_identity = 'NO'
      AND actual.is_generated = 'NEVER'
      AND supplied.column_name IS NULL;

    IF uncovered_columns IS NOT NULL THEN
        RAISE EXCEPTION 'Onboarding does not supply required columns without defaults: %', uncovered_columns;
    END IF;
END;
$$;

-- Validate types of both newly added and pre-existing application columns.
DO $$
DECLARE
    incompatible_columns TEXT;
BEGIN
    SELECT string_agg(
        format('%I.%I (expected %s, found %s)', required.table_name, required.column_name,
               required.expected_type, actual.data_type),
        ', '
    )
    INTO incompatible_columns
    FROM (
        VALUES
            ('profiles', 'email', 'text'),
            ('businesses', 'owner_id', 'uuid'), ('businesses', 'name', 'text'),
            ('businesses', 'category', 'text'), ('businesses', 'phone', 'text'),
            ('businesses', 'email', 'text'), ('businesses', 'address', 'text'),
            ('businesses', 'city', 'text'), ('businesses', 'state', 'text'),
            ('businesses', 'pincode', 'text'), ('businesses', 'gstin', 'text'),
            ('businesses', 'currency', 'text'), ('businesses', 'timezone', 'text'),
            ('businesses', 'created_at', 'timestamp with time zone'),
            ('businesses', 'updated_at', 'timestamp with time zone'),
            ('branches', 'name', 'text'), ('branches', 'phone', 'text'),
            ('branches', 'address', 'text'), ('branches', 'is_main', 'boolean'),
            ('branches', 'created_at', 'timestamp with time zone'),
            ('branches', 'updated_at', 'timestamp with time zone'),
            ('business_settings', 'invoice_prefix', 'text'),
            ('business_settings', 'invoice_sequence', 'integer'),
            ('business_settings', 'tax_rate', 'numeric'),
            ('business_settings', 'tax_label', 'text'),
            ('business_settings', 'allow_negative_stock', 'boolean'),
            ('business_settings', 'whatsapp_enabled', 'boolean'),
            ('business_settings', 'created_at', 'timestamp with time zone'),
            ('business_settings', 'updated_at', 'timestamp with time zone')
    ) AS required(table_name, column_name, expected_type)
    JOIN information_schema.columns AS actual
        ON actual.table_schema = 'public'
       AND actual.table_name = required.table_name
       AND actual.column_name = required.column_name
    WHERE actual.data_type <> required.expected_type;

    IF incompatible_columns IS NOT NULL THEN
        RAISE EXCEPTION 'Application compatibility columns have incompatible types: %', incompatible_columns;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'business_settings'
          AND column_name = 'tax_rate'
          AND (numeric_precision <> 5 OR numeric_scale <> 2)
    ) THEN
        RAISE EXCEPTION 'public.business_settings.tax_rate must be NUMERIC(5,2); existing values were not converted.';
    END IF;
END;
$$;

-- Reconcile only missing values. If both fields are set inconsistently, stop
-- rather than silently choosing one. Both fields remain available to old and
-- new application code and are kept in sync by the trigger below.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.branches
        WHERE is_main IS NOT NULL
          AND is_primary IS NOT NULL
          AND is_main IS DISTINCT FROM is_primary
    ) THEN
        RAISE EXCEPTION 'branches.is_primary and is_main contain conflicting values; reconcile them explicitly.';
    END IF;

    UPDATE public.branches
    SET is_main = COALESCE(is_main, is_primary, TRUE),
        is_primary = COALESCE(is_primary, is_main, TRUE)
    WHERE is_main IS NULL OR is_primary IS NULL;

    ALTER TABLE public.branches
        ALTER COLUMN is_main DROP DEFAULT,
        ALTER COLUMN is_primary DROP DEFAULT,
        ALTER COLUMN is_main SET NOT NULL;
    ALTER TABLE public.branches
        ALTER COLUMN is_primary SET NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.qelanto_sync_branch_primary_flags()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
DECLARE
    is_main_changed BOOLEAN;
    is_primary_changed BOOLEAN;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.is_main IS NOT NULL
           AND NEW.is_primary IS NOT NULL
           AND NEW.is_main IS DISTINCT FROM NEW.is_primary THEN
            RAISE EXCEPTION 'branches.is_main and is_primary must have the same value.';
        END IF;

        NEW.is_main := COALESCE(NEW.is_main, NEW.is_primary, TRUE);
        NEW.is_primary := NEW.is_main;
        RETURN NEW;
    END IF;

    is_main_changed := NEW.is_main IS DISTINCT FROM OLD.is_main;
    is_primary_changed := NEW.is_primary IS DISTINCT FROM OLD.is_primary;

    IF is_main_changed AND is_primary_changed THEN
        IF NEW.is_main IS DISTINCT FROM NEW.is_primary THEN
            RAISE EXCEPTION 'branches.is_main and is_primary cannot be updated to conflicting values.';
        END IF;
    ELSIF is_main_changed THEN
        NEW.is_primary := NEW.is_main;
    ELSIF is_primary_changed THEN
        NEW.is_main := NEW.is_primary;
    ELSIF NEW.is_main IS DISTINCT FROM NEW.is_primary THEN
        RAISE EXCEPTION 'branches.is_main and is_primary are inconsistent.';
    END IF;

    RETURN NEW;
END;
$$;

DO $$
DECLARE
    existing_trigger_function OID;
    expected_trigger_function OID;
BEGIN
    expected_trigger_function :=
        to_regprocedure('public.qelanto_sync_branch_primary_flags()')::OID;

    IF expected_trigger_function IS NULL THEN
        RAISE EXCEPTION 'Expected branch synchronization function is missing.';
    END IF;

    SELECT trigger_row.tgfoid
    INTO existing_trigger_function
    FROM pg_catalog.pg_trigger AS trigger_row
    WHERE trigger_row.tgrelid = 'public.branches'::regclass
      AND trigger_row.tgname = 'qelanto_sync_branch_primary_flags'
      AND NOT trigger_row.tgisinternal;

    IF existing_trigger_function IS NOT NULL
       AND existing_trigger_function <> expected_trigger_function THEN
        RAISE EXCEPTION 'A conflicting branches.qelanto_sync_branch_primary_flags trigger already exists.';
    END IF;

    IF existing_trigger_function IS NULL THEN
        CREATE TRIGGER qelanto_sync_branch_primary_flags
            BEFORE INSERT OR UPDATE OF is_main, is_primary ON public.branches
            FOR EACH ROW
            EXECUTE FUNCTION public.qelanto_sync_branch_primary_flags();
    END IF;
END;
$$;

-- A unique slug index is required so slug generation is protected by a
-- database-enforced uniqueness constraint as well as a UUID-derived suffix.
DO $$
DECLARE
    slug_column_attnum SMALLINT;
BEGIN
    SELECT attnum INTO slug_column_attnum
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.businesses'::regclass
      AND attname = 'slug'
      AND NOT attisdropped;

    IF EXISTS (
        SELECT 1
        FROM public.businesses
        GROUP BY slug
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate businesses.slug values exist; resolve them before adding uniqueness.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_index AS index_row
        WHERE index_row.indrelid = 'public.businesses'::regclass
          AND index_row.indisunique
          AND index_row.indisvalid
          AND index_row.indisready
          AND index_row.indpred IS NULL
          AND index_row.indnkeyatts = 1
          AND index_row.indkey[0] = slug_column_attnum
    ) THEN
        IF to_regclass('public.qelanto_businesses_slug_key') IS NOT NULL THEN
            RAISE EXCEPTION 'public.qelanto_businesses_slug_key exists but does not uniquely index businesses.slug.';
        END IF;

        CREATE UNIQUE INDEX qelanto_businesses_slug_key
            ON public.businesses (slug);
    END IF;
END;
$$;

-- Ownership is explicit and independent of created_by. Do not infer the
-- business owner from the creator; map any existing business owner separately.
DO $$
DECLARE
    owner_column_attnum SMALLINT;
    auth_id_attnum SMALLINT;
    has_expected_fk BOOLEAN;
    has_conflicting_fk BOOLEAN;
    owner_fk_name TEXT;
BEGIN
    SELECT attnum INTO owner_column_attnum
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'public.businesses'::regclass
      AND attname = 'owner_id'
      AND NOT attisdropped;

    SELECT attnum INTO auth_id_attnum
    FROM pg_catalog.pg_attribute
    WHERE attrelid = 'auth.users'::regclass
      AND attname = 'id'
      AND NOT attisdropped;

    SELECT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_constraint AS constraint_row
        WHERE constraint_row.conrelid = 'public.businesses'::regclass
          AND constraint_row.contype = 'f'
          AND constraint_row.conkey = ARRAY[owner_column_attnum]::SMALLINT[]
          AND constraint_row.confrelid = 'auth.users'::regclass
          AND constraint_row.confkey = ARRAY[auth_id_attnum]::SMALLINT[]
          AND constraint_row.confdeltype = 'r'
    ) INTO has_expected_fk;

    SELECT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_constraint AS constraint_row
        WHERE constraint_row.conrelid = 'public.businesses'::regclass
          AND constraint_row.contype = 'f'
          AND constraint_row.conkey = ARRAY[owner_column_attnum]::SMALLINT[]
          AND (
              constraint_row.confrelid <> 'auth.users'::regclass
              OR constraint_row.confkey <> ARRAY[auth_id_attnum]::SMALLINT[]
              OR constraint_row.confdeltype <> 'r'
          )
    ) INTO has_conflicting_fk;

    IF has_conflicting_fk THEN
        RAISE EXCEPTION 'businesses.owner_id has a conflicting foreign key; preserve and review it manually.';
    END IF;

    IF NOT has_expected_fk THEN
        ALTER TABLE public.businesses
            ADD CONSTRAINT qelanto_businesses_owner_id_fkey
            FOREIGN KEY (owner_id)
            REFERENCES auth.users(id)
            ON DELETE RESTRICT
            NOT VALID;
    END IF;

    FOR owner_fk_name IN
        SELECT constraint_row.conname
        FROM pg_catalog.pg_constraint AS constraint_row
        WHERE constraint_row.conrelid = 'public.businesses'::regclass
          AND constraint_row.contype = 'f'
          AND constraint_row.conkey = ARRAY[owner_column_attnum]::SMALLINT[]
          AND constraint_row.confrelid = 'auth.users'::regclass
          AND constraint_row.confkey = ARRAY[auth_id_attnum]::SMALLINT[]
          AND constraint_row.confdeltype = 'r'
          AND NOT constraint_row.convalidated
    LOOP
        EXECUTE format(
            'ALTER TABLE public.businesses VALIDATE CONSTRAINT %I',
            owner_fk_name
        );
    END LOOP;

    IF EXISTS (
        SELECT 1 FROM public.businesses
        WHERE owner_id IS NULL
    ) THEN
        RAISE EXCEPTION 'Business owner mapping required: set owner_id explicitly for each business. created_by is not copied.';
    END IF;
END;
$$;

ALTER TABLE public.businesses
    ALTER COLUMN owner_id SET NOT NULL;

COMMENT ON COLUMN public.businesses.owner_id IS
    'Authoritative business owner; intentionally distinct from created_by.';
COMMENT ON COLUMN public.businesses.created_by IS
    'Retained existing field; not automatically mapped to owner_id.';
COMMENT ON COLUMN public.branches.is_main IS
    'Synchronized with is_primary by qelanto_sync_branch_primary_flags.';

-- Check existing settings uniqueness before creating the index needed by the
-- onboarding RPC's future ON CONFLICT (business_id) operation.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM public.business_settings
        GROUP BY business_id
        HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Duplicate business_settings.business_id values exist; resolve them before adding uniqueness.';
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS business_settings_business_id_key
    ON public.business_settings (business_id);
CREATE INDEX IF NOT EXISTS idx_businesses_owner
    ON public.businesses (owner_id);
CREATE INDEX IF NOT EXISTS idx_branches_biz
    ON public.branches (business_id);

NOTIFY pgrst, 'reload schema';

COMMIT;
