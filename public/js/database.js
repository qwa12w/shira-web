// 🔗 قاعدة بيانات مجانية: Supabase (مجاني تماماً، PostgreSQL)
// 1. افتح https://supabase.com → أنشئ مشروع مجاني
// 2. من لوحة المشروع: انسخ Project URL و anon public key
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_KEY = 'YOUR_ANON_KEY';
const db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
