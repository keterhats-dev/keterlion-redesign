// Supabase connection. While these are empty the app runs in demo mode:
// data stays in this browser only, and the login screen lets you pick who you are.
// The anon key is public by design (the database rules in supabase/schema.sql protect the data).
export const SUPABASE_URL = '';
export const SUPABASE_ANON_KEY = '';

export const DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;
