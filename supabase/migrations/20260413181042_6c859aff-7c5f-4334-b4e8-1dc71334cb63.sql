
-- Add status column to profiles (existing users are 'ativo', new ones default to 'pendente')
ALTER TABLE public.profiles ADD COLUMN status text NOT NULL DEFAULT 'pendente';

-- Set all existing profiles to 'ativo'
UPDATE public.profiles SET status = 'ativo';

-- Add custom permissions column
ALTER TABLE public.profiles ADD COLUMN permissoes_customizadas jsonb;
