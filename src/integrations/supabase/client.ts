import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = "https://dpbsqdznqggfognozsiz.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwYnNxZHpucWdnZm9nbm96c2l6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NTAyMzUsImV4cCI6MjA5MjAyNjIzNX0.JUf4x7i7yZSwZPHU8poWjspp8YS7zjvvJOecKnEp9BY";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
