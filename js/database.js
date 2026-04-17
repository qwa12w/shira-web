// js/database.js
// تهيئة اتصال Supabase
const SUPABASE_URL = "https://qioiiidrwqvwzkveoxnm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yLhyYMSCXttp1e_q_PAovA_zz1xgYDM";

// تهيئة العميل بعد تحميل المكتبة
document.addEventListener("DOMContentLoaded", () => {
  const { createClient } = window.supabase;
  window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  console.log("✅ تم الاتصال بـ Supabase بنجاح");
});
