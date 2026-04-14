// 🔗 قاعدة بيانات مجانية: Supabase (مجاني تماماً، PostgreSQL)
const SUPABASE_URL = 'https://qioiiidrwqvwzkveoxnm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpb2lpaWRyd3F2d3prdmVveG5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyMDQzNTUsImV4cCI6MjA5MTc4MDM1NX0.NpsoJx30JBHPxzjup256ad7hg3u5WV4zuj-LpIr-uss';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
