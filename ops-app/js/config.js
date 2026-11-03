// Supabase connection. While these are empty the app runs in demo mode:
// data stays in this browser only, and the login screen lets you pick who you are.
// The anon key is public by design (the database rules in supabase/schema.sql protect the data).
export const SUPABASE_URL = 'https://nfpxripdgwrtpqyjqelu.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mcHhyaXBkZ3dydHBxeWpxZWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2OTYyMDUsImV4cCI6MjEwOTI3MjIwNX0.8LDICmTNxND-v08xMGdbEusRiG8u9IrC7RCvCAlrnIo';

export const DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY;
