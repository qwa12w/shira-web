// 🚀 وظائف منصة شراع

// 1. تسجيل مستخدم جديد
async function registerUser(phone, name, role = 'client') {
  const { data, error } = await db.from('users').insert([
    { phone, name, role }
  ]).select();
  
  if (error) {
    console.error('❌ خطأ في التسجيل:', error);
    return null;
  }
  console.log('✅ تم التسجيل:', data[0]);
  return data[0];
}

// 2. طلب توصيل/تاكسي
async function createOrder(clientId, type, pickupLat, pickupLng, dropoffLat, dropoffLng) {
  const { data, error } = await db.from('orders').insert([
    {
      client_id: clientId,
      type,
      pickup_lat: pickupLat,
      pickup_lng: pickupLng,
      dropoff_lat: dropoffLat,
      dropoff_lng: dropoffLng,
      status: 'pending'
    }
  ]).select();
  
  if (error) {
    console.error('❌ خطأ في الطلب:', error);
    return null;
  }
  console.log('✅ تم إنشاء الطلب:', data[0]);
  return data[0];
}

// 3. جلب الطلبات النشطة
async function getActiveOrders() {
  const { data, error } = await db.from('orders')
    .select('*, users(name), drivers(plate_number)')
    .eq('status', 'pending');
  
  if (error) {
    console.error('❌ خطأ:', error);
    return [];
  }
  return data;
}

// جعل الدوال متاحة عالمياً
window.ShiraApp = { registerUser, createOrder, getActiveOrders };
console.log('✅ وظائف شراع جاهزة! استخدم: window.ShiraApp');
