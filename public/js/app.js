// ==========================================
// شراع - تطبيق المنصة المتكاملة
// ==========================================

var CONFIG = {
  SUPABASE_URL: "https://qioiiidrwqvwzkveoxnm.supabase.co",
  SUPABASE_KEY: "sb_publishable_yLhyYMSCXttp1e_q_PAovA_zz1xgYDM",
  DEFAULT_LAT: 30.5085,
  DEFAULT_LNG: 47.7835
};

var app = {
  currentUser: null,
  currentRole: null,
  authMode: 'login',
  ready: false,
  userLocation: null
};

function initSupabase() {
  if (window.supabaseClient) return window.supabaseClient;
  if (typeof window.supabase === 'undefined') {
    setTimeout(initSupabase, 100);
    return null;
  }
  try {
    window.supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    console.log('✅ تم الاتصال');
    return window.supabaseClient;
  } catch (e) { return null; }
}

function restoreLocation() {
  var saved = localStorage.getItem('shira_user_location');
  return saved ? JSON.parse(saved) : null;
}

function saveLocation(lat, lng) {
  app.userLocation = { lat: lat, lng: lng, timestamp: Date.now() };
  localStorage.setItem('shira_user_location', JSON.stringify(app.userLocation));
}

function getCurrentLocation() {
  var saved = restoreLocation();
  if (saved && (Date.now() - saved.timestamp) < 86400000) return Promise.resolve(saved);
  return new Promise(function(resolve) {
    if (!navigator.geolocation) {
      resolve({ lat: CONFIG.DEFAULT_LAT, lng: CONFIG.DEFAULT_LNG });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function(pos) {
        var loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() };
        saveLocation(loc.lat, loc.lng);
        resolve(loc);
      },
      function() { resolve(saved || { lat: CONFIG.DEFAULT_LAT, lng: CONFIG.DEFAULT_LNG }); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

function bootstrap() {
  var client = initSupabase();
  if (client) startApp();
  else setTimeout(bootstrap, 200);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap);
else bootstrap();

function showScreen(id) {
  document.querySelectorAll('body > div').forEach(function(el) {
    if (el.id !== 'about-modal' && el.id !== 'contact-modal') el.classList.add('hidden');
  });
  var target = document.getElementById(id);
  if (target) {
    target.classList.remove('hidden');
    if (id !== 'main-app' && id !== 'auth-screen') localStorage.setItem('shira_screen', id);
  }
}

function restoreScreen() {
  var saved = localStorage.getItem('shira_screen');
  var savedTab = localStorage.getItem('shira_admin_tab');
  var savedRole = localStorage.getItem('shira_role');
  if (savedRole) app.currentRole = savedRole;
  
  if (saved === 'admin-panel') {
    showScreen('admin-panel');
    if (savedTab) {
      document.querySelectorAll('.admin-nav-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.tab === savedTab); });
      document.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.add('hidden'); if (t.id === 'tab-' + savedTab) t.classList.remove('hidden'); });
    }
    return;
  }
  if (saved && saved !== 'main-app' && saved !== 'auth-screen') showScreen(saved);
  else showScreen('main-app');
}

function checkSession() {
  if (localStorage.getItem('shira_admin_logged') === 'true') {
    showScreen('admin-panel');
    loadStats();
    return;
  }
  var client = window.supabaseClient;
  if (!client) { showScreen('main-app'); return; }
  
  client.auth.getSession().then(function(res) {
    var session = res.data ? res.data.session : null;
    if (session) {
      app.currentUser = session.user;
      return client.from('profiles').select('*').eq('id', session.user.id).single();
    }
    // ✅ التصحيح الصحيح
    return Promise.resolve({ data: null });
  }).then(function(profRes) {
    var profile = profRes.data;
    if (!profile) { showScreen('main-app'); return; }
    
    if (profile.status === 'محظور') showScreen('blocked-screen');
    else if (profile.status === 'قيد المراجعة' && profile.role !== 'زبون') showScreen('pending-screen');
    else {
      showUserDashboard(profile).then(function() {
        var saved = localStorage.getItem('shira_screen');
        showScreen(saved && saved !== 'main-app' && saved !== 'admin-panel' ? saved : 'user-dashboard');
      });
    }
  }).catch(function(e) { console.error(e); showScreen('main-app'); });
}

function setupEvents() {
  document.querySelectorAll('.service-card').forEach(function(card) {
    card.onclick = function() {
      app.currentRole = card.dataset.role;
      localStorage.setItem('shira_role', app.currentRole);
      showAuthScreen(app.currentRole);
      showScreen('auth-screen');
    };
  });

  function bind(id, fn) { var el = document.getElementById(id); if (el) el.onclick = fn; }
  
  bind('back-to-main', function() { showScreen('main-app'); });
  bind('back-to-home', function() { showScreen('main-app'); });
  bind('logout-admin', function() { localStorage.removeItem('shira_admin_logged'); showScreen('main-app'); });
  bind('logout-user', handleLogout);
  bind('login-submit', handleAdminLogin);
  bind('logo-container', function() { showScreen('admin-login'); });

  document.querySelectorAll('.auth-tab').forEach(function(tab) {
    tab.onclick = function() {
      document.querySelectorAll('.auth-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      app.authMode = tab.dataset.mode;
      updateAuthForm();
    };
  });

  var form = document.getElementById('auth-form');
  if (form) form.onsubmit = handleAuth;

  document.querySelectorAll('.admin-nav-btn').forEach(function(btn) {
    btn.onclick = function() {
      document.querySelectorAll('.admin-nav-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      document.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.add('hidden'); t.classList.remove('active'); });
      var tab = document.getElementById('tab-' + btn.dataset.tab);
      if (tab) { tab.classList.remove('hidden'); tab.classList.add('active'); }
      localStorage.setItem('shira_admin_tab', btn.dataset.tab);
      if (btn.dataset.tab === 'users') loadUsersTable();
    };
  });
}

async function handleAuth(e) {
  e.preventDefault();
  var client = window.supabaseClient;
  if (!client) return;
  
  var phone = document.getElementById('auth-phone').value.trim();
  var pass = document.getElementById('auth-password').value;
  var name = document.getElementById('auth-name').value.trim();
  var msgEl = document.getElementById('auth-msg');
  if (msgEl) msgEl.classList.add('hidden');
  
  if (!phone || !pass) { showMsg(msgEl, 'أدخل الهاتف وكلمة المرور', 'error'); return; }
  
  var currentRole = app.currentRole || 'زبون';
  try {
    if (app.authMode === 'register') {
      if (!name) { showMsg(msgEl, 'الاسم مطلوب', 'error'); return; }
      showMsg(msgEl, 'جاري الإنشاء...', 'success');
      
      // ✅ التصحيح الصحيح
      var res = await client.auth.signUp({
        email: phone + '@shira.app',
        password: pass,
        options: {  { phone: phone, name: name, role: currentRole } }
      });
      if (res.error) throw res.error;
      
      var userId = res.data.user.id;
      var loc = await getCurrentLocation();
      await client.from('profiles').insert({
        id: userId, name: name, phone: phone, role: currentRole,
        status: currentRole === 'زبون' ? 'نشط' : 'قيد المراجعة',
        latitude: loc.lat, longitude: loc.lng
      });
      
      if (currentRole !== 'زبون') await uploadDocs(userId);
      
      showMsg(msgEl, '✅ تم الإنشاء', 'success');
      setTimeout(function() {
        if (currentRole === 'زبون') {
          app.currentUser = res.data.user;
          showUserDashboard({ name: name, phone: phone, role: currentRole, latitude: loc.lat, longitude: loc.lng })
            .then(function() { showScreen('user-dashboard'); });
        } else { showScreen('pending-screen'); }
      }, 1000);
    } else {
      showMsg(msgEl, 'جاري الدخول...', 'success');
      var res = await client.auth.signInWithPassword({ email: phone + '@shira.app', password: pass });
      if (res.error) throw res.error;
      app.currentUser = res.data.user;
      var prof = await client.from('profiles').select('*').eq('id', app.currentUser.id).single();
      if (prof.error) throw prof.error;
      var p = prof.data;
      if (p.status === 'محظور') showScreen('blocked-screen');
      else if (p.status === 'قيد المراجعة') showScreen('pending-screen');
      else { await showUserDashboard(p); showScreen('user-dashboard'); }
    }
  } catch (err) {
    showMsg(document.getElementById('auth-msg'), err.message, 'error');
  }
}

function uploadDocs(uid) {
  var client = window.supabaseClient;
  if (!client) return Promise.resolve();
  var files = { license: document.getElementById('doc-license'), personal: document.getElementById('doc-personal'), vehicle: document.getElementById('doc-vehicle') };
  var data = {}, promises = [];
  Object.keys(files).forEach(function(k) {
    var inp = files[k];
    if (inp && inp.files && inp.files[0]) {
      var f = inp.files[0], path = uid + '/' + k + '_' + Date.now();
      promises.push(client.storage.from('shira-docs').upload(path, f).then(function() {
        data[k] = client.storage.from('shira-docs').getPublicUrl(path).data.publicUrl;
      }));
    }
  });
  return Promise.all(promises).then(function() {
    if (Object.keys(data).length) return client.from('documents').insert({ user_id: uid, vehicle_type: document.getElementById('vehicle-type').value, vehicle_plate: document.getElementById('vehicle-plate').value });
  });
}

function showAuthScreen(role) {
  app.currentRole = role;
  document.getElementById('auth-role-title').textContent = 'تسجيل ' + role;
  updateAuthForm();
  var sec = document.getElementById('documents-section');
  var veh = document.getElementById('vehicle-section');
  if (role === 'زبون') { if (sec) sec.classList.add('hidden'); }
  else {
    if (sec) sec.classList.remove('hidden');
    if (role === 'سائق تكسي') { if (veh) veh.classList.remove('hidden'); } else { if (veh) veh.classList.add('hidden'); }
  }
}

function updateAuthForm() {
  var ng = document.getElementById('name-group');
  var sb = document.getElementById('auth-submit');
  if (app.authMode === 'register') { if (ng) ng.classList.remove('hidden'); if (sb) sb.textContent = 'إنشاء حساب'; }
  else { if (ng) ng.classList.add('hidden'); if (sb) sb.textContent = 'تسجيل الدخول'; }
}

function showUserDashboard(p) {
  return getCurrentLocation().then(function(loc) {
    var n = document.getElementById('dash-user-name');
    var r = document.getElementById('dash-user-role');
    if (n) n.textContent = p.name;
    if (r) r.textContent = p.role;
    
    var c = document.getElementById('dash-content');
    if (c) {
      var initials = p.name ? p.name.charAt(0) : '?';
      c.innerHTML = 
        '<div class="top-bar" style="display:flex;justify-content:space-between;align-items:center;padding:1rem 1.2rem;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:0 0 24px 24px;margin:-1rem -1rem 1rem -1rem;box-shadow:0 8px 32px rgba(102,126,234,0.4);">' +
          '<div style="display:flex;align-items:center;gap:0.75rem;cursor:pointer;" onclick="showProfileEditor()">' +
            '<div style="width:42px;height:42px;background:rgba(255,255,255,0.25);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:1.1rem;border:2px solid rgba(255,255,255,0.5);backdrop-filter:blur(10px);">' + initials + '</div>' +
            '<div><div style="color:#fff;font-weight:600;font-size:0.95rem;">' + p.name + '</div><div style="color:rgba(255,255,255,0.8);font-size:0.75rem;">📍 ' + loc.lat.toFixed(3) + ', ' + loc.lng.toFixed(3) + '</div></div>' +
          '</div>' +
          '<div style="display:flex;gap:0.5rem;"><button onclick="contactAdmin()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:38px;height:38px;border-radius:12px;cursor:pointer;">📞</button>' +
          '<button onclick="handleLogout()" style="background:rgba(255,80,80,0.3);border:none;color:#fff;width:38px;height:38px;border-radius:12px;cursor:pointer;">🚪</button></div>' +
        '</div>' +
        '<div class="profile-mini-card" style="background:#fff;border-radius:20px;padding:1.5rem;margin-bottom:1rem;box-shadow:0 8px 24px rgba(0,0,0,0.06);">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<div style="display:flex;align-items:center;gap:1rem;"><div style="width:60px;height:60px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:18px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.5rem;font-weight:bold;">' + initials + '</div>' +
            '<div><h3 style="margin:0;font-size:1.15rem;">' + p.name + '</h3><span style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:0.3rem 1rem;border-radius:20px;font-size:0.8rem;">👤 ' + p.role + '</span></div></div>' +
            '<button onclick="showProfileEditor()" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;border:none;width:42px;height:42px;border-radius:14px;cursor:pointer;font-size:1.2rem;">✏️</button>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:0.5rem;margin-top:1rem;padding-top:1rem;border-top:1px solid #f0f0f0;"><span>📱</span><span style="color:#718096;direction:ltr;">' + p.phone + '</span></div>' +
        '</div>' +
        '<div class="services-grid-3d" style="display:grid;grid-template-columns:repeat(2,1fr);gap:0.8rem;padding:0.5rem;margin-bottom:1rem;">' +
          '<button onclick="requestService(\'taxi\')" style="background:linear-gradient(145deg,#667eea 0%,#5a67d8 100%);color:#fff;border:none;padding:1.2rem 0.8rem;border-radius:20px;cursor:pointer;box-shadow:0 8px 0 #4c51bf;"><div style="font-size:2.2rem;">🚗</div><div style="font-weight:700;">طلب تكسي</div></button>' +
          '<button onclick="requestService(\'delivery\')" style="background:linear-gradient(145deg,#f093fb 0%,#e056a0 100%);color:#fff;border:none;padding:1.2rem 0.8rem;border-radius:20px;cursor:pointer;box-shadow:0 8px 0 #c0448a;"><div style="font-size:2.2rem;">🏍️</div><div style="font-weight:700;">طلب ديلفري</div></button>' +
          '<button onclick="requestService(\'shopping\')" style="background:linear-gradient(145deg,#4facfe 0%,#3a8fd9 100%);color:#fff;border:none;padding:1.2rem 0.8rem;border-radius:20px;cursor:pointer;box-shadow:0 8px 0 #2d7bc0;"><div style="font-size:2.2rem;">🛒</div><div style="font-weight:700;">تسوق</div></button>' +
          '<button onclick="shareWithShira()" style="background:linear-gradient(145deg,#43e97b 0%,#38c96a 100%);color:#fff;border:none;padding:1.2rem 0.8rem;border-radius:20px;cursor:pointer;box-shadow:0 8px 0 #2db85a;"><div style="font-size:2.2rem;">⛵</div><div style="font-weight:700;">مشاركة شراع</div></button>' +
        '</div>' +
        '<div class="map-section-3d" style="background:#fff;border-radius:20px;padding:1rem;margin-bottom:1rem;">' +
          '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;"><span>📍</span><span style="font-weight:600;">موقعك الحالي</span></div>' +
          '<div id="order-map" style="height:200px;background:#f7fafc;border-radius:16px;border:2px solid #e2e8f0;"></div>' +
          '<input type="hidden" id="order-lat" value="' + loc.lat + '"><input type="hidden" id="order-lng" value="' + loc.lng + '">' +
          '<button onclick="updateLocation()" style="width:100%;margin-top:0.75rem;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;border:none;padding:0.8rem;border-radius:14px;cursor:pointer;font-weight:600;">🔄 تحديث الموقع</button>' +
        '</div>';
      
      if (typeof L !== 'undefined') setTimeout(function() { initOrderMap(loc.lat, loc.lng); }, 200);
      
      window.requestService = function(type) { if (confirm('هل تريد طلب الخدمة؟')) createOrder(type); };
      window.shareWithShira = function() { alert('شكراً لمشاركتك مع شراع! ⛵'); };
      window.contactAdmin = function() { alert('📞 support@shira.app'); };
      window.updateLocation = function() { getCurrentLocation().then(function(loc) { document.getElementById('order-lat').value = loc.lat; document.getElementById('order-lng').value = loc.lng; if(typeof L!=='undefined'){var m=document.getElementById('order-map');if(m){m.innerHTML='';initOrderMap(loc.lat,loc.lng);}} alert('✅ تم التحديث'); }); };
      window.createOrder = function(serviceType) { var client=window.supabaseClient; if(!client||!app.currentUser)return; client.from('orders').insert({user_id:app.currentUser.id,service_type:serviceType,latitude:parseFloat(document.getElementById('order-lat').value),longitude:parseFloat(document.getElementById('order-lng').value),status:'pending',created_at:new Date().toISOString()}).then(function(res){alert(res.error?'خطأ: '+res.error.message:'✅ تم الإرسال');}); };
    }
  });
}

function showMsg(el, txt, type) { if (!el) return; el.textContent = txt; el.className = 'auth-msg ' + (type === 'error' ? 'error' : 'success'); el.classList.remove('hidden'); }

function handleAdminLogin() {
  var u = document.getElementById('admin-user').value.trim();
  var p = document.getElementById('admin-pass').value;
  var err = document.getElementById('login-error');
  if (u === 'علي' && p === 'جنده') {
    localStorage.setItem('shira_admin_logged', 'true');
    if (err) err.classList.add('hidden');
    showScreen('admin-panel');
    localStorage.setItem('shira_screen', 'admin-panel');
    loadStats();
  } else { if (err) err.classList.remove('hidden'); }
}

function loadStats() {
  var c = window.supabaseClient; if (!c) return;
  c.from('profiles').select('*', { count: 'exact', head: true }).then(function(r) { var el=document.getElementById('stat-users'); if(el) el.textContent=r.count||0; });
  c.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'قيد المراجعة').then(function(r) { var el=document.getElementById('stat-pending'); if(el) el.textContent=r.count||0; });
}

function showActivationModal(userId) {
  var months = prompt("عدد الأشهر للتفعيل:", "1");
  if (!months) return;
  
  var expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + parseInt(months));
  
  var client = window.supabaseClient;
  
  client.from('profiles').update({ 
    status: 'نشط', 
    subscription_expiry: expiryDate.toISOString() 
  }).eq('id', userId).then(function(res) {
    if (res.error) {
      alert('❌ خطأ: ' + res.error.message);
    } else {
      alert('✅ تم التفعيل لمدة ' + months + ' أشهر');
      loadUsersTable();
    }
  });
}

function loadUsersTable() {
  var c = window.supabaseClient; 
  if (!c) return;
  
  c.from('profiles').select('*').order('created_at', { ascending: false })
    .then(function(res) {
      if (res.error) return;
      
      var tbody = document.getElementById('users-list');
      if (!tbody) return;
      tbody.innerHTML = '';
      
      if (res.data) {
        res.data.forEach(function(u) {
          var tr = document.createElement('tr');
          var actions = '';
          
          if (u.status === 'قيد المراجعة') {
            actions = '<button onclick="showActivationModal(\'' + u.id + '\')">⏳ تفعيل</button>';
          }
          
          tr.innerHTML = '<td>' + u.name + '</td><td>' + u.phone + '</td><td>' + 
            u.role + '</td><td>' + u.status + '</td><td>' + actions + '</td>';
          tbody.appendChild(tr);
        });
      }
    });
}

function handleLogout() {
  var c = window.supabaseClient;
  if (c) c.auth.signOut();
  app.currentUser = null; 
  localStorage.removeItem('shira_screen');
  showScreen('main-app');
}

function initOrderMap(lat, lng) {
  var mapEl = document.getElementById('order-map');
  if (!mapEl || typeof L === 'undefined') return;
  mapEl.innerHTML = '';
  var map = L.map('order-map').setView([lat, lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
  L.marker([lat, lng], { draggable: true }).addTo(map).on('dragend', function(e) { var p=e.target.getLatLng(); document.getElementById('order-lat').value=p.lat; document.getElementById('order-lng').value=p.lng; });
  setTimeout(function() { map.invalidateSize(); }, 300);
}

function showProfileEditor() {
  var c = document.getElementById('dash-content'); if (!c || !app.currentUser) return;
  var name = app.currentUser.user_metadata ? app.currentUser.user_metadata.name || '' : '';
  c.innerHTML = '<div style="background:#fff;border-radius:24px;padding:1.5rem;margin:1rem;box-shadow:0 12px 32px rgba(0,0,0,0.08);">' +
    '<h2 style="margin:0 0 1.5rem 0;text-align:center;">✏️ تعديل الملف</h2>' +
    '<div style="margin-bottom:1rem;"><label style="display:block;margin-bottom:0.4rem;color:#4a5568;">الاسم</label>' +
    '<input type="text" id="edit-name" value="' + name + '" style="width:100%;padding:0.85rem;border:2px solid #e2e8f0;border-radius:14px;"></div>' +
    '<div style="display:flex;gap:0.75rem;">' +
    '<button id="save-profile" style="flex:1;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:0.9rem;border:none;border-radius:14px;cursor:pointer;font-weight:600;">💾 حفظ</button>' +
    '<button onclick="checkSession()" style="flex:1;background:#edf2f7;color:#4a5568;padding:0.9rem;border:none;border-radius:14px;cursor:pointer;font-weight:600;">إلغاء</button>' +
    '</div></div>';
  document.getElementById('save-profile').onclick = function() {
    var client = window.supabaseClient; if(!client||!app.currentUser)return;
    var n = document.getElementById('edit-name').value.trim(); if(!n)return;
    // ✅ التصحيح الصحيح
    client.auth.updateUser({  { name: n } }).then(function() { return client.from('profiles').update({name:n}).eq('id',app.currentUser.id); })
      .then(function(){ alert('✅ تم الحفظ'); checkSession(); });
  };
}

function startApp() {
  if (app.ready) return; app.ready = true;
  restoreScreen(); checkSession(); setupEvents();
}

window.showActivationModal = showActivationModal;
