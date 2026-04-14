// 🔄 تحديث الصفحة لعرض البيانات من قاعدة البيانات
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // اختبار الاتصال
    const { data, error } = await db.from('users').select('*').limit(1);
    
    if (error) {
      console.error('❌ خطأ في الاتصال:', error);
      document.getElementById('timestamp').innerHTML = '⚠️ خطأ في الاتصال بقاعدة البيانات';
    } else {
      console.log('✅ متصل بقاعدة البيانات:', data);
      document.getElementById('timestamp').innerHTML = `✅ متصل بقاعدة البيانات | ${new Date().toLocaleTimeString('ar-IQ')}`;
    }
  } catch (err) {
    console.error('❌ خطأ:', err);
  }
});
