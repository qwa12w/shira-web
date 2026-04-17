// js/database.js
// تهيئة اتصال Supabase - نسخة فورية ومضمونة

const SUPABASE_URL = "https://qioiiidrwqvwzkveoxnm.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_yLhyYMSCXttp1e_q_PAovA_zz1xgYDM";

// دالة التهيئة الآمنة
function initSupabaseClient() {
  if (typeof window.supabase === 'undefined') {
    console.warn("⏳ مكتبة Supabase لم تُحمّل بعد، إعادة المحاولة...");
    setTimeout(initSupabaseClient, 100);
    return;
  }
  
  if (!window.supabaseClient) {
    try {
      const { createClient } = window.supabase;
      window.supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log("✅ تم تهيئة عميل Supabase بنجاح");
      
      // إخبار app.js أن التهيئة اكتملت
      window.dispatchEvent(new CustomEvent('supabase:ready'));
    } catch (e) {
      console.error("❌ خطأ في تهيئة Supabase:", e);
    }
  }
}

// ✅ التهيئة الفورية (لأن السكربت في نهاية body)
initSupabaseClient();

// احتياطي: إذا كان هناك تأخير غير متوقع
document.addEventListener("DOMContentLoaded", initSupabaseClient);
