// 🔄 اختبار الاتصال بـ Supabase
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🔄 جاري الاتصال بـ Supabase...');
  
  try {
    const { data, error } = await db.from('users').select('*').limit(1);
    
    if (error) {
      console.error('❌ خطأ في الاتصال:', error.message);
    } else {
      console.log('✅ نجح! متصل بقاعدة البيانات:', data);
      // تحديث الشريط الأخضر الموجود
      const badge = document.querySelector('.auto-update-badge');
      if (badge) {
        badge.innerHTML = `✅ متصل بقاعدة البيانات | ${new Date().toLocaleTimeString('ar-IQ')}`;
      }
    }
  } catch (err) {
    console.error('❌ خطأ عام:', err.message);
  }
});
