// ==========================================
// شراع - تطبيق المنصة المتكاملة
// [نسخة محدثة: حفظ الصفحة + الموقع التلقائي + صلاحيات الملف]
// ==========================================

const CONFIG = {
  SUPABASE_URL: "https://qioiiidrwqvwzkveoxnm.supabase.co",
  SUPABASE_KEY: "sb_publishable_yLhyYMSCXttp1e_q_PAovA_zz1xgYDM",
  DEFAULT_LAT: 30.5085,
  DEFAULT_LNG: 47.7835
};

let app = {
  currentUser: null,
  currentRole: null,
  authMode: 'login',
  ready: false,
  userLocation: null
};

// ==========================================
// 1. تهيئة Supabase
// ==========================================
function initSupabase() {
  if (window.supabaseClient) return window.supabaseClient;
  if (typeof window.supabase === 'undefined') {
    setTimeout(initSupabase, 100);
    return null;
  }
  try {
    window.supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    return window.supabaseClient;
  } catch (e) { console.error('Supabase Init Error:', e); return null; }
}

// ==========================================
// 2. إدارة الموقع الجغرافي
// ==========================================
function restoreLocation() {
  const saved = localStorage.getItem('shira_user_location');
  if (saved) {
    try {
      app.userLocation = JSON.parse(saved);
      return app.userLocation;
    } catch (e) { return null; }
  }
  return null;
}

function saveLocation(lat, lng) {
  app.userLocation = { lat, lng, timestamp: Date.now() };
  localStorage.setItem('shira_user_location', JSON.stringify(app.userLocation));
}

async function getCurrentLocation() {
  const saved = restoreLocation();
  if (saved && (Date.now() - saved.timestamp) < 86400000) return saved;
  
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: CONFIG.DEFAULT_LAT, lng: CONFIG.DEFAULT_LNG });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() };
        saveLocation(loc.lat, loc.lng);
        resolve(loc);
      },
      () => resolve(saved || { lat: CONFIG.DEFAULT_LAT, lng: CONFIG.DEFAULT_LNG }),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

// ==========================================
// 3. بدء التطبيق
// ==========================================
function bootstrap() {
  const client = initSupabase();
  if (client) startApp();
  else setTimeout(bootstrap, 200);
}

document.readyState === 'loading' 
  ? document.addEventListener('DOMContentLoaded', bootstrap) 
  : bootstrap();

// ==========================================
// 4. إدارة الشاشات ✅ تحسّن: البقاء في نفس الصفحة
// ==========================================
function showScreen(id) {
  document.querySelectorAll('body > div').forEach(el => {
    if (el.id !== 'about-modal' && el.id !== 'contact-modal') el.classList.add('hidden');
  });
  const target = document.getElementById(id);
  if (target) {
    target.classList.remove('hidden');
    // ✅ حفظ الشاشة الحالية لمنع العودة للرئيسية
    if (id !== 'main-app') localStorage.setItem('shira_screen', id);
  }
}

function restoreScreen() {
  const saved = localStorage.getItem('shira_screen');
  const savedTab = localStorage.getItem('shira_admin_tab');
  
  if (saved && saved !== 'main-app') {
    showScreen(saved);
    if (saved === 'admin-panel' && savedTab) {
      document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === savedTab));
      document.querySelectorAll('.admin-tab').forEach(t => {
        t.classList.add('hidden');
        if (t.id === `tab-${savedTab}`) t.classList.remove('hidden');
      });
    }
  } else {
    showScreen('main-app');
  }
}

// ==========================================
// 5. التحقق من الجلسة ✅ تحسّن: تحميل الموقع + البقاء في الصفحة
// ==========================================
async function checkSession() {
  const client = window.supabaseClient;
  if (!client) return;
  try {
    const res = await client.auth.getSession();
    const session = res.data?.session;
    
    // ✅ استعادة الموقع المحفوظ
    restoreLocation();
    
    if (session) {
      app.currentUser = session.user;
      const profRes = await client.from('profiles').select('*').eq('id', session.user.id).single();
      const profile = profRes.data;
      if (!profile) return;
      
      if (profile.status === 'محظور') showScreen('blocked-screen');
      else if (profile.status === 'قيد المراجعة' && profile.role !== 'زبون') showScreen('pending-screen');
      else { 
        await showUserDashboard(profile);
        // ✅ البقاء في الشاشة المحفوظة أو الانتقال للوحة التحكم
        const saved = localStorage.getItem('shira_screen');
        showScreen(saved && saved !== 'main-app' ? saved : 'user-dashboard');
      }
    } else {
      showScreen('main-app');
    }
  } catch (e) { console.error('Session Error:', e); showScreen('main-app'); }
}

// ==========================================
// 6. المزامنة الذكية
// ==========================================
function setupRealtime() {
  const client = window.supabaseClient;
  if (!client) return;
  
  client.channel('profiles_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (p) => {
      if (!document.getElementById('admin-panel')?.classList.contains('hidden')) {
        if (['INSERT', 'UPDATE'].includes(p.eventType)) {
          loadStats();
          if (!document.getElementById('tab-users')?.classList.contains('hidden')) loadUsersTable();
        }
      }
      if (app.currentUser && p.new?.id === app.currentUser.id) {
        if (p.new?.status === 'محظور') showScreen('blocked-screen');
      }
    }).subscribe();
}

// ==========================================
// 7. إعداد الأحداث
// ==========================================
function setupEvents() {
  document.querySelectorAll('.service-card').forEach(card => {
    const role = card.dataset.role;
    card.onclick = () => {
      app.currentRole = role;
      showAuthScreen(role);
      showScreen('auth-screen');
    };
  });

  const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  bind('back-to-main', () => showScreen('main-app'));
  bind('back-to-home', () => showScreen('main-app'));
  bind('logout-admin', () => showScreen('main-app'));
  bind('logout-user', handleLogout);
  bind('login-submit', handleAdminLogin);
  bind('btn-about', () => document.getElementById('about-modal')?.classList.remove('hidden'));
  bind('btn-contact', () => document.getElementById('contact-modal')?.classList.remove('hidden'));

  document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => {
    document.getElementById('about-modal')?.classList.add('hidden');
    document.getElementById('contact-modal')?.classList.add('hidden');
  });
  ['about-modal', 'contact-modal'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.onclick = (e) => { if (e.target === el) el.classList.add('hidden'); };
  });

  bind('logo-container', () => showScreen('admin-login'));

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      app.authMode = tab.dataset.mode;
      updateAuthForm();
    };
  });

  const form = document.getElementById('auth-form');
  if (form) form.onsubmit = handleAuth;

  document.querySelectorAll('.admin-nav-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('hidden'));
      const tab = document.getElementById(`tab-${btn.dataset.tab}`);
      if (tab) tab.classList.remove('hidden');
      localStorage.setItem('shira_admin_tab', btn.dataset.tab);
      if (btn.dataset.tab === 'users') loadUsersTable();
      if (btn.dataset.tab === 'dashboard') loadStats();
    };
  });

  const maintToggle = document.getElementById('maintenance-toggle');
  if (maintToggle) {
    maintToggle.onchange = async (e) => {
      const client = window.supabaseClient;
      if (!client) return;
      const val = e.target.checked;
      const res = await client.from('settings').select('*').eq('key', 'maintenance').single();
      if (res.data) await client.from('settings').update({ value: val }).eq('key', 'maintenance');
      else await client.from('settings').insert({ key: 'maintenance', value: val });
      alert(val ? 'تم تفعيل الصيانة' : 'تم إيقاف الصيانة');
    };
  }
}

// ==========================================
// 8. المصادقة ✅ تحسّن: إنشاء الحساب + التوجيه + حفظ الموقع
// ==========================================
async function handleAuth(e) {
  e.preventDefault();
  const client = window.supabaseClient;
  const phone = document.getElementById('auth-phone')?.value.trim();
  const pass = document.getElementById('auth-password')?.value;
  const name = document.getElementById('auth-name')?.value.trim();
  const msgEl = document.getElementById('auth-msg');
  if (msgEl) msgEl.classList.add('hidden');

  try {
    if (app.authMode === 'register') {
      if (!name) throw new Error('الاسم مطلوب');
      
      const res = await client.auth.signUp({
        email: `${phone}@shira.app`, password: pass,
        options: {  { phone, name, role: app.currentRole } }
      });
      if (res.error) throw res.error;

      // ✅ تحديد الموقع أولاً
      const loc = await getCurrentLocation();
      
      await client.from('profiles').insert({
        id: res.data.user.id, name, phone, role: app.currentRole,
        status: app.currentRole === 'زبون' ? 'نشط' : 'قيد المراجعة',
        latitude: loc.lat, longitude: loc.lng
      });

      if (app.currentRole !== 'زبون') await uploadDocs(res.data.user.id);

      showMsg(msgEl, 'تم الإنشاء! ' + (app.currentRole === 'زبون' ? 'جاري التوجيه...' : 'بانتظار الموافقة'), 'success');
      
      // ✅ التوجيه الفوري مع حفظ الشاشة
      setTimeout(async () => {
        if (app.currentRole === 'زبون') {
          await showUserDashboard({ name, phone, role: app.currentRole, latitude: loc.lat, longitude: loc.lng });
          showScreen('user-dashboard');
          localStorage.setItem('shira_screen', 'user-dashboard');
        } else {
          showScreen('pending-screen');
        }
      }, 1500);
    } else {
      const res = await client.auth.signInWithPassword({ email: `${phone}@shira.app`, password: pass });
      if (res.error) throw res.error;

      app.currentUser = res.data.user;
      const pRes = await client.from('profiles').select('*').eq('id', app.currentUser.id).single();
      const profile = pRes.data;
      if (!profile) throw new Error('ملف غير موجود');

      if (profile.status === 'محظور') showScreen('blocked-screen');
      else if (profile.status === 'قيد المراجعة') showScreen('pending-screen');
      else { 
        await showUserDashboard(profile);
        // ✅ البقاء في الشاشة المحفوظة
        const saved = localStorage.getItem('shira_screen');
        showScreen(saved && saved !== 'main-app' ? saved : 'user-dashboard');
      }
    }
  } catch (err) {
    console.error(err);
    showMsg(msgEl, err.message || 'خطأ', 'error');
  }
}

async function uploadDocs(uid) {
  const client = window.supabaseClient;
  if (!client) return;
  const files = {
    license: document.getElementById('doc-license'),
    personal: document.getElementById('doc-personal'),
    vehicle: document.getElementById('doc-vehicle'),
    bike: document.getElementById('doc-bike')
  };
  const data = {};
  for (const [k, inp] of Object.entries(files)) {
    if (inp?.files?.[0]) {
      const f = inp.files[0];
      const path = `${uid}/${k}_${Date.now()}.${f.name.split('.').pop()}`;
      const up = await client.storage.from('shira-docs').upload(path, f);
      if (!up.error) {
        const urlRes = client.storage.from('shira-docs').getPublicUrl(path);
        data[`${k}_image`] = urlRes.data.publicUrl;
      }
    }
  }
  if (document.getElementById('vehicle-type')?.value) data.vehicle_type = document.getElementById('vehicle-type').value;
  if (document.getElementById('bike-registered')?.value) data.bike_registered = document.getElementById('bike-registered').value === 'true';
  if (Object.keys(data).length) await client.from('documents').insert({ user_id: uid, ...data });
}

// ==========================================
// 9. لوحة المستخدم ✅ تحسّن: واجهة الطلبات + صلاحيات التعديل
// ==========================================
function showAuthScreen(role) {
  app.currentRole = role;
  document.getElementById('auth-role-title').textContent = `تسجيل ${role}`;
  updateAuthForm();
  const sec = document.getElementById('documents-section');
  const veh = document.getElementById('vehicle-section');
  const bik = document.getElementById('bike-section');
  if (role === 'زبون') sec?.classList.add('hidden');
  else {
    sec?.classList.remove('hidden');
    if (role === 'سائق تكسي') { veh?.classList.remove('hidden'); bik?.classList.add('hidden'); }
    else if (role === 'ديلفري') { veh?.classList.add('hidden'); bik?.classList.remove('hidden'); }
    else { veh?.classList.add('hidden'); bik?.classList.add('hidden'); }
  }
}

function updateAuthForm() {
  const ng = document.getElementById('name-group');
  const sb = document.getElementById('auth-submit');
  if (app.authMode === 'register') { ng?.classList.remove('hidden'); if(sb) sb.textContent = 'إنشاء حساب'; }
  else { ng?.classList.add('hidden'); if(sb) sb.textContent = 'تسجيل الدخول'; }
}

async function showUserDashboard(p) {
  const n = document.getElementById('dash-user-name');
  const r = document.getElementById('dash-user-role');
  if (n) n.textContent = p.name;
  if (r) r.textContent = p.role;
  
  const c = document.getElementById('dash-content');
  if (c) {
    const canEdit = p.role === 'زبون';
    const loc = await getCurrentLocation();
    
    c.innerHTML = `
      <div class="welcome-card">
        <h2>مرحباً ${p.name} 👋</h2>
        <p>لوحة تحكم ${p.role} جاهزة</p>
        ${canEdit ? `<button id="edit-profile-btn" class="btn-secondary" style="margin-top:1rem;">✏️ تعديل ملفي</button>` : ''}
        <p style="margin-top:0.5rem;font-size:0.9rem;color:#64748b;">📍 ${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</p>
      </div>
      <div class="order-section" style="margin-top:2rem;">
        <h3>🚀 اطلب خدمتك</h3>
        <div class="service-selector">
          <label>نوع الخدمة:</label>
          <div class="service-options">
            <label class="service-option"><input type="radio" name="service-type" value="taxi" checked><span>🚗 تكسي</span></label>
            <label class="service-option"><input type="radio" name="service-type" value="delivery"><span>🏍️ ديلفري</span></label>
            <label class="service-option"><input type="radio" name="service-type" value="shopping"><span>🛒 تسوق</span></label>
          </div>
        </div>
        <div class="map-section" style="margin:1rem 0;">
          <label>📍 الموقع:</label>
          <div id="order-map" style="height:200px;background:#f1f5f9;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#64748b;">جاري التحميل...</div>
          <input type="hidden" id="order-lat" value="${loc.lat}">
          <input type="hidden" id="order-lng" value="${loc.lng}">
          <button type="button" id="use-current-location" class="btn-secondary" style="margin-top:0.5rem;">🎯 موقعي الحالي</button>
        </div>
        <div class="form-group"><label>ملاحظات:</label><textarea id="order-notes" rows="2" placeholder="تفاصيل إضافية..."></textarea></div>
        <button id="submit-order" class="btn-primary" style="width:100%;margin-top:1rem;">✅ إرسال الطلب</button>
        <p id="order-msg" class="order-msg hidden"></p>
      </div>
      <div class="tracking-section" style="margin-top:2rem;"><h3>📊 طلباتي</h3><div id="active-orders"></div></div>
    `;
    
    if (typeof L !== 'undefined') initOrderMap(loc.lat, loc.lng);
    bindOrderEvents();
    loadActiveOrders();
  }
}

function showMsg(el, txt, type) {
  if (!el) return;
  el.textContent = txt;
  el.className = `auth-msg ${type === 'error' ? 'error' : 'success'}`;
  el.classList.remove('hidden');
}

// ==========================================
// 10. لوحة الإدارة
// ==========================================
async function handleAdminLogin() {
  const u = document.getElementById('admin-user')?.value;
  const p = document.getElementById('admin-pass')?.value;
  const err = document.getElementById('login-error');
  if (u === 'admin' && p === '1234') {
    if (err) err.classList.add('hidden');
    showScreen('admin-panel');
    loadStats();
  } else { if (err) err.classList.remove('hidden'); }
}

async function loadStats() {
  const c = window.supabaseClient; if (!c) return;
  const u = await c.from('profiles').select('*', { count: 'exact', head: true });
  const p = await c.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'قيد المراجعة');
  const su = document.getElementById('stat-users');
  const sp = document.getElementById('stat-pending');
  if (su) su.textContent = u.count || 0;
  if (sp) sp.textContent = p.count || 0;
}

async function loadUsersTable() {
  const c = window.supabaseClient; if (!c) return;
  const res = await c.from('profiles').select('*').order('created_at', { ascending: false });
  const users = res.data;
  const tbody = document.getElementById('users-list');
  if (!tbody) return;
  tbody.innerHTML = '';
  users?.forEach(u => {
    tbody.innerHTML += `<tr><td>${u.name}</td><td>${u.phone}</td><td>${u.role}</td><td>${new Date(u.created_at).toLocaleDateString('ar-IQ')}</td><td style="color:${getStatusColor(u.status)}">${u.status}</td><td>${u.status!=='نشط'?'<button class="btn-action" data-act="activate" data-id="${u.id}">تفعيل</button>':''}${u.status!=='محظور'?'<button class="btn-action btn-delete" data-act="block" data-id="${u.id}">حظر</button>':''}<button class="btn-action" data-act="delete" data-id="${u.id}">حذف</button></td></tr>`;
  });
  tbody.onclick = (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const id = btn.dataset.id, act = btn.dataset.act;
    if (act === 'activate') changeStatus(id, 'نشط');
    else if (act === 'block') changeStatus(id, 'محظور');
    else if (act === 'delete') deleteUser(id);
  };
}

async function changeStatus(id, st) {
  const c = window.supabaseClient; if (!c) return;
  await c.from('profiles').update({ status: st }).eq('id', id);
  loadUsersTable(); loadStats();
}

async function deleteUser(id) {
  const c = window.supabaseClient; if (!c) return;
  if (confirm('تأكيد الحذف؟')) {
    await c.from('profiles').delete().eq('id', id);
    loadUsersTable(); loadStats();
  }
}

function getStatusColor(s) { return s === 'نشط' ? 'green' : s === 'قيد المراجعة' ? 'orange' : 'red'; }

async function handleLogout() {
  const c = window.supabaseClient;
  if (c) await c.auth.signOut();
  app.currentUser = null; app.currentRole = null;
  localStorage.removeItem('shira_screen');
  localStorage.removeItem('shira_admin_tab');
  showScreen('main-app');
}

// ==========================================
// 11. دوال الطلبات والخريطة ✅ جديدة
// ==========================================
function initOrderMap(lat, lng) {
  const mapEl = document.getElementById('order-map');
  if (!mapEl || typeof L === 'undefined') return;
  mapEl.innerHTML = '';
  const map = L.map('order-map').setView([lat, lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
  let marker = L.marker([lat, lng], { draggable: true }).addTo(map);
  marker.on('dragend', () => {
    const pos = marker.getLatLng();
    document.getElementById('order-lat').value = pos.lat;
    document.getElementById('order-lng').value = pos.lng;
  });
  map.on('click', (e) => {
    marker.setLatLng(e.latlng);
    document.getElementById('order-lat').value = e.latlng.lat;
    document.getElementById('order-lng').value = e.latlng.lng;
  });
}

function bindOrderEvents() {
  const locBtn = document.getElementById('use-current-location');
  if (locBtn) locBtn.onclick = async () => {
    const loc = await getCurrentLocation();
    document.getElementById('order-lat').value = loc.lat;
    document.getElementById('order-lng').value = loc.lng;
    if (typeof L !== 'undefined') {
      const mapEl = document.getElementById('order-map');
      if (mapEl) { mapEl.innerHTML = ''; initOrderMap(loc.lat, loc.lng); }
    }
    alert('✅ تم تحديث الموقع');
  };
  
  const submitBtn = document.getElementById('submit-order');
  if (submitBtn) submitBtn.onclick = async () => {
    const client = window.supabaseClient;
    if (!client || !app.currentUser) return;
    const serviceType = document.querySelector('input[name="service-type"]:checked')?.value;
    const lat = document.getElementById('order-lat')?.value;
    const lng = document.getElementById('order-lng')?.value;
    const notes = document.getElementById('order-notes')?.value || '';
    if (!serviceType || !lat || !lng) { showMsg(document.getElementById('order-msg'), 'يرجى تحديد الخدمة والموقع', 'error'); return; }
    const { error } = await client.from('orders').insert({
      user_id: app.currentUser.id, service_type: serviceType,
      latitude: parseFloat(lat), longitude: parseFloat(lng),
      notes: notes, status: 'pending', created_at: new Date().toISOString()
    });
    const msgEl = document.getElementById('order-msg');
    if (error) showMsg(msgEl, 'خطأ: ' + error.message, 'error');
    else { showMsg(msgEl, '✅ تم إرسال الطلب', 'success'); setTimeout(() => loadActiveOrders(), 1000); }
  };
  
  const editBtn = document.getElementById('edit-profile-btn');
  if (editBtn) editBtn.onclick = () => showProfileEditor();
}

function showProfileEditor() {
  const c = document.getElementById('dash-content');
  if (!c || !app.currentUser) return;
  c.innerHTML = `
    <div class="welcome-card">
      <h2>✏️ تعديل ملفي</h2>
      <div class="form-group"><label>الاسم:</label><input type="text" id="edit-name" value="${app.currentUser.user_metadata?.name || ''}"></div>
      <div class="form-group"><label>الهاتف:</label><input type="tel" value="${app.currentUser.user_metadata?.phone || ''}" disabled style="background:#f1f5f9;"></div>
      <div class="form-group"><label>كلمة مرور جديدة (اختياري):</label><input type="password" id="edit-password" placeholder="اتركه فارغاً للإبقاء"></div>
      <button id="save-profile" class="btn-primary">💾 حفظ</button>
      <button id="cancel-edit" class="btn-back" style="margin-right:1rem;">إلغاء</button>
      <p id="profile-msg" class="auth-msg hidden"></p>
    </div>`;
  document.getElementById('save-profile').onclick = saveProfile;
  document.getElementById('cancel-edit').onclick = () => checkSession();
}

async function saveProfile() {
  const client = window.supabaseClient;
  if (!client || !app.currentUser) return;
  const name = document.getElementById('edit-name')?.value.trim();
  const password = document.getElementById('edit-password')?.value;
  const msgEl = document.getElementById('profile-msg');
  if (!name) { showMsg(msgEl, 'الاسم مطلوب', 'error'); return; }
  try {
    const { error: metaError } = await client.auth.updateUser({  { name } });
    if (metaError) throw metaError;
    if (password) { const { error: passError } = await client.auth.updateUser({ password }); if (passError) throw passError; }
    const { error: profError } = await client.from('profiles').update({ name }).eq('id', app.currentUser.id);
    if (profError) throw profError;
    showMsg(msgEl, '✅ تم الحفظ', 'success');
    setTimeout(() => checkSession(), 1500);
  } catch (err) { console.error(err); showMsg(msgEl, err.message || 'خطأ', 'error'); }
}

async function loadActiveOrders() {
  const client = window.supabaseClient;
  if (!client || !app.currentUser) return;
  const {  orders } = await client.from('orders').select('*').eq('user_id', app.currentUser.id).eq('status', 'pending').order('created_at', { ascending: false });
  const listEl = document.getElementById('active-orders');
  if (!listEl) return;
  if (!orders?.length) { listEl.innerHTML = '<p style="color:#64748b;">لا توجد طلبات نشطة</p>'; return; }
  listEl.innerHTML = orders.map(o => `
    <div style="background:#fff;padding:1rem;border-radius:12px;margin:0.5rem 0;border:1px solid #e2e8f0;">
      <div style="display:flex;justify-content:space-between;align-items:center;"><strong>${o.service_type==='taxi'?'🚗 تكسي':o.service_type==='delivery'?'🏍️ ديلفري':'🛒 تسوق'}</strong><span style="background:#f1f5f9;padding:0.25rem 0.75rem;border-radius:20px;font-size:0.85rem;">${o.status}</span></div>
      <p style="margin:0.5rem 0;font-size:0.9rem;color:#64748b;">📍 ${o.latitude?.toFixed(4)}, ${o.longitude?.toFixed(4)}</p>
      ${o.notes ? `<p style="font-size:0.9rem;">📝 ${o.notes}</p>` : ''}
      <p style="font-size:0.85rem;color:#94a3b8;">${new Date(o.created_at).toLocaleString('ar-IQ')}</p>
    </div>`).join('');
}

// ==========================================
// 12. التشغيل
// ==========================================
function startApp() {
  if (app.ready) return;
  app.ready = true;
  restoreScreen();
  checkSession();
  setupRealtime();
  setupEvents();
}

// دوال عامة
window.updateUserStatus = changeStatus;
window.deleteUser = deleteUser;
