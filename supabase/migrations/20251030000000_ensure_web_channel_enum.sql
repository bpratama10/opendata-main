-- Ensure WEB channel enum value exists for telemetry downloads
-- This migration is idempotent and safe to run multiple times

DO $$
BEGIN
    -- Check if 'WEB' already exists in the enum
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'download_channel' AND e.enumlabel = 'WEB'
    ) THEN
        -- If 'WEB' doesn't exist, check if we should rename 'portal' or add new value
        IF EXISTS (
            SELECT 1 FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = 'download_channel' AND e.enumlabel = 'portal'
        ) THEN
            -- Rename 'portal' to 'WEB' for backwards compatibility
            ALTER TYPE public.download_channel RENAME VALUE 'portal' TO 'WEB';
            RAISE NOTICE 'Renamed portal to WEB in download_channel enum';
        ELSE
            -- Add 'WEB' as a new value if neither exists
            ALTER TYPE public.download_channel ADD VALUE IF NOT EXISTS 'WEB';
            RAISE NOTICE 'Added WEB to download_channel enum';
        END IF;
    ELSE
        RAISE NOTICE 'WEB already exists in download_channel enum';
    END IF;

    -- Similarly ensure 'API' exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'download_channel' AND e.enumlabel = 'API'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = 'download_channel' AND e.enumlabel = 'api'
        ) THEN
            ALTER TYPE public.download_channel RENAME VALUE 'api' TO 'API';
            RAISE NOTICE 'Renamed api to API in download_channel enum';
        END IF;
    END IF;

    -- Similarly ensure 'DIRECT' exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum e
        JOIN pg_type t ON e.enumtypid = t.oid
        WHERE t.typname = 'download_channel' AND e.enumlabel = 'DIRECT'
    ) THEN
        IF EXISTS (
            SELECT 1 FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = 'download_channel' AND e.enumlabel = 'internal'
        ) THEN
            ALTER TYPE public.download_channel RENAME VALUE 'internal' TO 'DIRECT';
            RAISE NOTICE 'Renamed internal to DIRECT in download_channel enum';
        END IF;
    END IF;
END $$;

COMMENT ON TYPE public.download_channel IS 'Download channel types: WEB (web portal), API (API access), DIRECT (direct/internal access)';
