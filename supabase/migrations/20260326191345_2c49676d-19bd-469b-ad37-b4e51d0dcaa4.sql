
-- Step 1: Add new enum values only
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'solicitante';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'aprovador';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'estoquista';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'master';
