
-- Fix the permissive INSERT policy on notifications to require authenticated user
DROP POLICY IF EXISTS "System inserts notifications" ON public.notifications;
CREATE POLICY "Authenticated inserts notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
