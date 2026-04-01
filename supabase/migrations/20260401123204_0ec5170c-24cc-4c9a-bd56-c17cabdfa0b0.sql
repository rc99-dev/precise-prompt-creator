
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS unidade text DEFAULT NULL;

ALTER TABLE public.requisitions ADD COLUMN IF NOT EXISTS unidade text DEFAULT NULL;
ALTER TABLE public.requisitions ADD COLUMN IF NOT EXISTS setor text DEFAULT NULL;
