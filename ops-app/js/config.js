// Supabase connection. While these are empty the app runs in demo mode:
// data stays in this browser only, and the login screen lets you pick who you are.
// The anon key is public by design (the database rules in supabase/schema.sql protect the data).
export const SUPABASE_URL = 'https://nfpxripdgwrtpqyjqelu.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mcHhyaXBkZ3dydHBxeWpxZWx1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2OTYyMDUsImV4cCI6MjEwOTI3MjIwNX0.8LDICmTNxND-v08xMGdbEusRiG8u9IrC7RCvCAlrnIo';

// Public half of the phone-notification key pair. The private half is the VAPID_PRIVATE_KEY
// environment variable in Netlify, never in the code.
export const VAPID_PUBLIC_KEY = 'BC3VJ-k5UO3AGYgP3ZQkFDLtZc_p5nMNX3sA-FSkU6ZII-2lFQR7mbmmxifLBiVLB86U_yiNLA5Lihll7aiIXU8';

// ?demo in the address runs the demo store, for trying things without touching real data
export const DEMO = !SUPABASE_URL || !SUPABASE_ANON_KEY || new URLSearchParams(location.search).has('demo');
