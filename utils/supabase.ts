import { createClient } from '@supabase/supabase-js';

// Use environment variables or hardcoded values for your Supabase project
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://zcnavyhdotofxjkxgcyl.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpjbmF2eWhkb3RvZnhqa3hnY3lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0NDcwNTgsImV4cCI6MjA2ODAyMzA1OH0.CguCy9o44JlOdKGsQBv4-K7NIzScOOYb92RXKVfhLpI";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
