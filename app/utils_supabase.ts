import { createClient } from '@supabase/supabase-js';

// Use environment variables or hardcoded values for your Supabase project
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "https://hcbholnyeweazguqhpjk.supabase.co";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhjYmhvbG55ZXdlYXpndXFocGprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc5NzQzNTYsImV4cCI6MjA2MzU1MDM1Nn0.ceDuwv5xq_k5haT-lZ_Qu3mh4aMuLKvmh3r2Y4f7QHU";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);