// ==========================================
// شراع - تطبيق المنصة المتكاملة
// [تحديث: تفعيل بمدة صلاحية + بيانات إدارة جديدة + ثبات الصفحة]
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
    console.log('✅ تم الاتصال بـ Supabase');
    return window.supabaseClient;
  } catch (e) { console.error('Supabase Init Error:', e); return null; }
}

// ==========================================
// 2. إدارة الموقع الجغرافي
// ==========================================
function restoreLocation() {
  var saved = localStorage.getItem('shira_user_location');
  if (saved) {
    try {
      app.userLocation = JSON.parse(saved);
      return app.userLocation;
    } catch (e) { return null; }
  }
  return null;
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

// ==========================================
// 3. بدء التطبيق
// ==========================================
function bootstrap() {
  var client = initSupabase();
  if (client) startApp();
  else setTimeout(bootstrap, 200);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

// ==========================================
// 4. إدارة الشاشات
// ==========================================
function showScreen(id) {
  document.querySelectorAll('body > div').forEach(function(el) {
    if (el.id !== 'about-modal' && el.id !== 'contact-modal') el.classList.add('hidden');
  });
  var target = document.getElementById(id);
  if (target) {
    target.classList.remove('hidden');
    if (id !== 'main-app' && id !== 'auth-screen') {
      localStorage.setItem('shira_screen', id);
    }
  }
}

function restoreScreen() {
  var saved = localStorage.getItem('shira_screen');
  var savedTab = localStorage.getItem('shira_admin_tab');
  var savedRole = localStorage.getItem('shira_role');
  if (savedRole) app.currentRole = savedRole;
  
  // ✅ إذا كانت المحفوظة هي لوحة الإدارة، ابقَ فيها
  if (saved === 'admin-panel') {
    showScreen('admin-panel');
    if (savedTab) {
      document.querySelectorAll('.admin-nav-btn').forEach(function(b) { 
        b.classList.toggle('active', b.dataset.tab === savedTab); 
      });
      document.querySelectorAll('.admin-tab').forEach(function(t) {
        t.classList.add('hidden');
        if (t.id === 'tab-' + savedTab) t.classList.remove('hidden');
      });
    }
    return;
  }
  
  if (saved && saved !== 'main-app' && saved !== 'auth-screen') {
    showScreen(saved);
  } else {
    showScreen('main-app');
  }
}

// ==========================================
// 5. التحقق من الجلسة ✅ محدث للتحقق من الصلاحية
// ==========================================
function checkSession() {
  // ✅ 1. التحقق من دخول الإدارة أولاً (للثبات عند التحديث)
  if (localStorage.getItem('shira_admin_logged') === 'true') {
    showScreen('admin-panel');
    loadStats();
    return;
  }

  var client = window.supabaseClient;
  if (!client) {
    showScreen('main-app');
    return;
  }
  
  client.auth.getSession().then(function(res) {
    var session = res.data ? res.data.session : null;
    restoreLocation();
    
    if (session) {
      app.currentUser = session.user;
      return client.from('profiles').select('*').eq('id', session.user.id).single();
    }
    return Promise.resolve({ data: null });
  }).then(function(profRes) {
    var profile = profRes.data;
    if (!profile) {
      showScreen('main-app');
      return;
    }
    
    // ✅ 2. التحقق من انتهاء الصلاحية
    if (profile.subscription_expiry && profile.status === 'نشط') {
      var expiryDate = new Date(profile.subscription_expiry);
      if (new Date() > expiryDate) {
        client.from('profiles').update({ status: 'منتهي الصلاحية' }).eq('id', profile.id);
        alert('⚠️ انتهت صلاحية حسابك. يرجى التواصل مع الإدارة للتجديد.');
        showScreen('main-app');
        return;
      }
    }
    
    if (profile.status === 'محظور') showScreen('blocked-screen');
    else if (profile.status === 'قيد المراجعة' && profile.role !== 'زبون') showScreen('pending-screen');
    else if (profile.status === 'منتهي الصلاحية') showScreen('pending-screen');
    else {
      showUserDashboard(profile).then(function() {
        var saved = localStorage.getItem('shira_screen');
        showScreen(saved && saved !== 'main-app' && saved !== 'admin-panel' ? saved : 'user-dashboard');
      });
    }
  }).catch(function(e) { 
    console.error('Session Error:', e); 
    showScreen('main-app'); 
  });
}

// ==========================================
// 6. المزامنة الذكية
// ==========================================
function setupRealtime() {
  var client = window.supabaseClient;
  if (!client) return;
  
  client.channel('profiles_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, function(p) {
      var adminPanel = document.getElementById('admin-panel');
      if (adminPanel && !adminPanel.classList.contains('hidden')) {
        if (p.eventType === 'INSERT' || p.eventType === 'UPDATE') {
          loadStats();
          var tabUsers = document.getElementById('tab-users');
          if (tabUsers && !tabUsers.classList.contains('hidden')) loadUsersTable();
        }
      }
    }).subscribe();
}

// ==========================================
// 7. إعداد الأحداث
// ==========================================
function setupEvents() {
  document.querySelectorAll('.service-card').forEach(function(card) {
    var role = card.dataset.role;
    card.onclick = function() {
      app.currentRole = role;
      localStorage.setItem('shira_role', role);
      showAuthScreen(role);
      showScreen('auth-screen');
    };
  });

  function bind(id, fn) { 
    var el = document.getElementById(id); 
    if (el) el.onclick = fn; 
  }
  
  bind('back-to-main', function() { showScreen('main-app'); });
  bind('back-to-home', function() { showScreen('main-app'); });
  bind('logout-admin', function() { 
    localStorage.removeItem('shira_admin_logged');
    showScreen('main-app'); 
  });
  bind('logout-user', handleLogout);
  bind('login-submit', handleAdminLogin);
  bind('btn-about', function() { 
    var m = document.getElementById('about-modal');
    if (m) m.classList.remove('hidden'); 
  });
  bind('btn-contact', function() { 
    var m = document.getElementById('contact-modal');
    if (m) m.classList.remove('hidden'); 
  });

  document.querySelectorAll('.close-modal').forEach(function(b) { 
    b.onclick = function() {
      var about = document.getElementById('about-modal');
      var contact = document.getElementById('contact-modal');
      if (about) about.classList.add('hidden');
      if (contact) contact.classList.add('hidden');
    };
  });
  
  ['about-modal', 'contact-modal'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.onclick = function(e) { if (e.target === el) el.classList.add('hidden'); };
  });

  bind('logo-container', function() { 
    showScreen('admin-login');
  });

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
      document.querySelectorAll('.admin-tab').forEach(function(t) { 
        t.classList.add('hidden');
        t.classList.remove('active'); 
      });
      var tab = document.getElementById('tab-' + btn.dataset.tab);
      if (tab) {
        tab.classList.remove('hidden');
        tab.classList.add('active');
      }
      localStorage.setItem('shira_admin_tab', btn.dataset.tab);
      if (btn.dataset.tab === 'users') loadUsersTable();
      if (btn.dataset.tab === 'dashboard') loadStats();
    };
  });

  var maintToggle = document.getElementById('maintenance-toggle');
  if (maintToggle) {
    maintToggle.onchange = function(e) {
      var client = window.supabaseClient;
      if (!client) return;
      var val = e.target.checked;
      client.from('settings').select('*').eq('key', 'maintenance').single().then(function(res) {
        if (res.data) {
          client.from('settings').update({ value: val }).eq('key', 'maintenance');
        } else {
          client.from('settings').insert({ key: 'maintenance', value: val });
        }
        alert(val ? 'تم تفعيل الصيانة' : 'تم إيقاف الصيانة');
      });
    };
  }
}

// ==========================================
// 8. المصادقة
// ==========================================
async function handleAuth(e) {
  e.preventDefault();
  
  var client = window.supabaseClient;
  if (!client) {
    showMsg(document.getElementById('auth-msg'), 'جاري الاتصال... يرجى الانتظار', 'error');
    return;
  }
  
  var phoneEl = document.getElementById('auth-phone');
  var passEl = document.getElementById('auth-password');
  var nameEl = document.getElementById('auth-name');
  var msgEl = document.getElementById('auth-msg');
  
  var phone = phoneEl ? phoneEl.value.trim() : '';
  var pass = passEl ? passEl.value : '';
  var name = nameEl ? nameEl.value.trim() : '';
  
  if (msgEl) msgEl.classList.add('hidden');
  if (!phone || !pass) { showMsg(msgEl, 'يرجى إدخال الهاتف وكلمة المرور', 'error'); return; }
  if (pass.length < 6) { showMsg(msgEl, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error'); return; }

  var currentRole = app.currentRole || localStorage.getItem('shira_role') || 'زبون';

  try {
    if (app.authMode === 'register') {
      if (!name) { showMsg(msgEl, 'الاسم مطلوب', 'error'); return; }
      showMsg(msgEl, 'جاري إنشاء الحساب...', 'success');
      
      var signUpResult = await client.auth.signUp({
        email: phone + '@shira.app', 
        password: pass,
        options: {  { phone: phone, name: name, role: currentRole } }
      });
      
      if (signUpResult.error) throw signUpResult.error;
      if (!signUpResult.data || !signUpResult.data.user) throw new Error('فشل إنشاء الحساب');
      
      var userId = signUpResult.data.user.id;
      var loc = await getCurrentLocation();
      
      var profileData = {
        id: userId, name: name, phone: phone, role: currentRole,
        status: currentRole === 'زبون' ? 'نشط' : 'قيد المراجعة',
        latitude: loc.lat, longitude: loc.lng
      };
      
      var profileResult = await client.from('profiles').insert(profileData);
      if (profileResult.error) throw profileResult.error;
      
      if (currentRole !== 'زبون') await uploadDocs(userId);
      
      var successMsg = '✅ تم إنشاء الحساب بنجاح! ';
      successMsg += (currentRole === 'زبون') ? 'جاري التوجيه...' : 'بانتظار موافقة الإدارة';
      showMsg(msgEl, successMsg, 'success');
      
      setTimeout(function() {
        if (currentRole === 'زبون') {
          app.currentUser = signUpResult.data.user;
          app.currentRole = currentRole;
          showUserDashboard({ name: name, phone: phone, role: currentRole, latitude: loc.lat, longitude: loc.lng })
            .then(function() { showScreen('user-dashboard'); localStorage.setItem('shira_screen', 'user-dashboard'); });
        } else { showScreen('pending-screen'); }
      }, 1000);
      
    } else {
      showMsg(msgEl, 'جاري تسجيل الدخول...', 'success');
      var signInResult = await client.auth.signInWithPassword({ email: phone + '@shira.app', password: pass });
      if (signInResult.error) throw signInResult.error;
      
      app.currentUser = signInResult.data.user;
      var profileResult = await client.from('profiles').select('*').eq('id', app.currentUser.id).single();
      if (profileResult.error) throw profileResult.error;
      
      var profile = profileResult.data;
      if (!profile) throw new Error('الملف الشخصي غير موجود');
      
      if (profile.status === 'محظور') showScreen('blocked-screen');
      else if (profile.status === 'قيد المراجعة') showScreen('pending-screen');
      else {
        await showUserDashboard(profile);
        showScreen('user-dashboard');
      }
    }
  } catch (err) {
    console.error('❌ خطأ في المصادقة:', err);
    showMsg(msgEl, err.message || 'حدث خطأ، حاول مرة أخرى', 'error');
  }
}

function uploadDocs(uid) {
  var client = window.supabaseClient;
  if (!client) return Promise.resolve();
  
  var files = {
    license: document.getElementById('doc-license'),
    personal: document.getElementById('doc-personal'),
    vehicle: document.getElementById('doc-vehicle'),
    bike: document.getElementById('doc-bike')
  };
  
  var data = {};
  var promises = [];
  
  Object.keys(files).forEach(function(k) {
    var inp = files[k];
    if (inp && inp.files && inp.files[0]) {
      var f = inp.files[0];
      var path = uid + '/' + k + '_' + Date.now() + '.' + f.name.split('.').pop();
      promises.push(client.storage.from('shira-docs').upload(path, f).then(function(up) {
        if (!up.error) {
          var urlRes = client.storage.from('shira-docs').getPublicUrl(path);
          data[k + '_image'] = urlRes.data.publicUrl;
        }
      }));
    }
  });
  
  return Promise.all(promises).then(function() {
    var vehicleTypeEl = document.getElementById('vehicle-type');
    var vehicleColorEl = document.getElementById('vehicle-color');
    var vehiclePlateEl = document.getElementById('vehicle-plate');
    var bikeRegisteredEl = document.getElementById('bike-registered');
    
    if (vehicleTypeEl && vehicleTypeEl.value) data.vehicle_type = vehicleTypeEl.value;
    if (vehicleColorEl && vehicleColorEl.value) data.vehicle_color = vehicleColorEl.value;
    if (vehiclePlateEl && vehiclePlateEl.value) data.vehicle_plate = vehiclePlateEl.value;
    if (bikeRegisteredEl && bikeRegisteredEl.value !== undefined) data.bike_registered = bikeRegisteredEl.value === 'true';
    
    if (Object.keys(data).length) return client.from('documents').insert({ user_id: uid });
    return Promise.resolve();
  });
}

// ==========================================
// 9. لوحة المستخدم
// ==========================================
function showAuthScreen(role) {
  app.currentRole = role;
  var titleEl = document.getElementById('auth-role-title');
  if (titleEl) titleEl.textContent = 'تسجيل ' + role;
  updateAuthForm();
  
  var sec = document.getElementById('documents-section');
  var veh = document.getElementById('vehicle-section');
  var bik = document.getElementById('bike-section');
  
  if (role === 'زبون') { if (sec) sec.classList.add('hidden'); }
  else {
    if (sec) sec.classList.remove('hidden');
    if (role === 'سائق تكسي') { if (veh) veh.classList.remove('hidden'); if (bik) bik.classList.add('hidden'); }
    else if (role === 'ديلفري') { if (veh) veh.classList.add('hidden'); if (bik) bik.classList.remove('hidden'); }
    else { if (veh) veh.classList.add('hidden'); if (bik) bik.classList.add('hidden'); }
  }
}

function updateAuthForm() {
  var ng = document.getElementById('name-group');
  var sb = document.getElementById('auth-submit');
  if (app.authMode === 'register') { 
    if (ng) ng.classList.remove('hidden'); if (sb) sb.textContent = 'إنشاء حساب'; 
  } else { 
    if (ng) ng.classList.add('hidden'); if (sb) sb.textContent = 'تسجيل الدخول'; 
  }
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
            '<div><div style="color:#fff;font-weight:600;font-size:0.95rem;">' + p.name + '</div>' +
            '<div style="color:rgba(255,255,255,0.8);font-size:0.75rem;">📍 ' + loc.lat.toFixed(3) + ', ' + loc.lng.toFixed(3) + '</div></div>' +
          '</div>' +
          '<div style="display:flex;gap:0.5rem;">' +
            '<button onclick="contactAdmin()" style="background:rgba(255,255,255,0.2);border:none;color:#fff;width:38px;height:38px;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.1rem;backdrop-filter:blur(10px);">📞</button>' +
            '<button onclick="handleLogout()" style="background:rgba(255,80,80,0.3);border:none;color:#fff;width:38px;height:38px;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.1rem;backdrop-filter:blur(10px);">🚪</button>' +
          '</div>' +
        '</div>' +
        '<div class="profile-mini-card" style="background:#fff;border-radius:20px;padding:1.5rem;margin-bottom:1rem;box-shadow:0 8px 24px rgba(0,0,0,0.06);">' +
          '<div style="display:flex;align-items:center;justify-content:space-between;">' +
            '<div style="display:flex;align-items:center;gap:1rem;">' +
              '<div style="width:60px;height:60px;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);border-radius:18px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:1.5rem;font-weight:bold;">' + initials + '</div>' +
              '<div><h3 style="margin:0;font-size:1.15rem;">' + p.name + '</h3>' +
              '<span style="display:inline-block;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:0.3rem 1rem;border-radius:20px;font-size:0.8rem;">👤 ' + p.role + '</span></div>' +
            '</div>' +
            '<button onclick="showProfileEditor()" style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;border:none;width:42px;height:42px;border-radius:14px;cursor:pointer;font-size:1.2rem;">✏️</button>' +
          '</div>' +
          '<div style="display:flex;align-items:center;gap:0.5rem;margin-top:1rem;padding-top:1rem;border-top:1px solid #f0f0f0;">' +
            '<span>📱</span><span style="color:#718096;direction:ltr;">' + p.phone + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="services-grid-3d" style="display:grid;grid-template-columns:repeat(2,1fr);gap:0.8rem;padding:0.5rem;margin-bottom:1rem;">' +
          '<button onclick="requestService(\'taxi\')" style="background:linear-gradient(145deg,#667eea 0%,#5a67d8 100%);color:#fff;border:none;padding:1.2rem 0.8rem;border-radius:20px;cursor:pointer;box-shadow:0 8px 0 #4c51bf;">' +
            '<div style="font-size:2.2rem;">🚗</div><div style="font-weight:700;">طلب تكسي</div></button>' +
          '<button onclick="requestService(\'delivery\')" style="background:linear-gradient(145deg,#f093fb 0%,#e056a0 100%);color:#fff;border:none;padding:1.2rem 0.8rem;border-radius:20px;cursor:pointer;box-shadow:0 8px 0 #c0448a;">' +
            '<div style="font-size:2.2rem;">🏍️</div><div style="font-weight:700;">طلب ديلفري</div></button>' +
          '<button onclick="requestService(\'shopping\')" style="background:linear-gradient(145deg,#4facfe 0%,#3a8fd9 100%);color:#fff;border:none;padding:1.2rem 0.8rem;border-radius:20px;cursor:pointer;box-shadow:0 8px 0 #2d7bc0;">' +
            '<div style="font-size:2.2rem;">🛒</div><div style="font-weight:700;">تسوق</div></button>' +
          '<button onclick="shareWithShira()" style="background:linear-gradient(145deg,#43e97b 0%,#38c96a 100%);color:#fff;border:none;padding:1.2rem 0.8rem;border-radius:20px;cursor:pointer;box-shadow:0 8px 0 #2db85a;">' +
            '<div style="font-size:2.2rem;">⛵</div><div style="font-weight:700;">مشاركة شراع</div></button>' +
        '</div>' +
        '<div class="map-section-3d" style="background:#fff;border-radius:20px;padding:1rem;margin-bottom:1rem;">' +
          '<div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:0.75rem;"><span>📍</span><span style="font-weight:600;">موقعك الحالي</span></div>' +
          '<div id="order-map" style="height:200px;background:#f7fafc;border-radius:16px;border:2px solid #e2e8f0;"></div>' +
          '<input type="hidden" id="order-lat" value="' + loc.lat + '">' +
          '<input type="hidden" id="order-lng" value="' + loc.lng + '">' +
          '<button onclick="updateLocation()" style="width:100%;margin-top:0.75rem;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;border:none;padding:0.8rem;border-radius:14px;cursor:pointer;font-weight:600;">🔄 تحديث الموقع</button>' +
        '</div>';
      
      if (typeof L !== 'undefined') setTimeout(function() { initOrderMap(loc.lat, loc.lng); }, 200);
      
      window.requestService = function(type) {
        if (confirm('هل تريد طلب الخدمة؟')) createOrder(type);
      };
      window.shareWithShira = function() { alert('شكراً لمشاركتك مع شراع! ⛵'); };
      window.contactAdmin = function() { alert('📞 للتواصل:\nsupport@shira.app'); };
      window.updateLocation = function() {
        getCurrentLocation().then(function(loc) {
          document.getElementById('order-lat').value = loc.lat;
          document.getElementById('order-lng').value = loc.lng;
          if (typeof L !== 'undefined') { var m = document.getElementById('order-map'); if(m){m.innerHTML='';initOrderMap(loc.lat,loc.lng);} }
          alert('✅ تم تحديث الموقع');
        });
      };
      window.createOrder = function(serviceType) {
        var client = window.supabaseClient;
        if (!client || !app.currentUser) return;
        client.from('orders').insert({
          user_id: app.currentUser.id, service_type: serviceType,
          latitude: parseFloat(document.getElementById('order-lat').value),
          longitude: parseFloat(document.getElementById('order-lng').value),
          status: 'pending', created_at: new Date().toISOString()
        }).then(function(res) {
          alert(res.error ? 'حدث خطأ: ' + res.error.message : '✅ تم إرسال الطلب بنجاح!');
        });
      };
    }
  });
}

function showMsg(el, txt, type) {
  if (!el) return;
  el.textContent = txt;
  el.className = 'auth-msg ' + (type === 'error' ? 'error' : 'success');
  el.classList.remove('hidden');
}

// ==========================================
// 10. لوحة الإدارة ✅ محدثة بالكامل
// ==========================================
function handleAdminLogin() {
  var u = document.getElementById('admin-user').value.trim();
  var p = document.getElementById('admin-pass').value;
  var err = document.getElementById('login-error');
  
  // ✅ تغيير بيانات الدخول
  if (u === 'علي' && p === 'جنده') {
    localStorage.setItem('shira_admin_logged', 'true');
    if (err) err.classList.add('hidden');
    showScreen('admin-panel');
    localStorage.setItem('shira_screen', 'admin-panel');
    loadStats();
  } else {
    if (err) err.classList.remove('hidden');
  }
}

function loadStats() {
  var c = window.supabaseClient; 
  if (!c) return;
  Promise.all([
    c.from('profiles').select('*', { count: 'exact', head: true }),
    c.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'قيد المراجعة')
  ]).then(function(results) {
    var su = document.getElementById('stat-users');
    var sp = document.getElementById('stat-pending');
    if (su) su.textContent = results[0].count || 0;
    if (sp) sp.textContent = results[1].count || 0;
  }).catch(function(err) { console.error('Stats Error:', err); });
}

// ✅ عرض نافذة اختيار مدة التفعيل
function showActivationModal(userId) {
  var modal = document.createElement('div');
  modal.id = 'activation-modal';
  modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:9999;';
  modal.innerHTML = 
    '<div style="background:#fff;padding:2rem;border-radius:20px;width:90%;max-width:350px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,0.2);">' +
      '<h3 style="margin:0 0 1rem 0;">⏳ مدة تفعيل الحساب</h3>' +
      '<select id="activation-months" style="width:100%;padding:0.8rem;margin-bottom:1rem;border:2px solid #e2e8f0;border-radius:12px;font-size:1rem;">' +
        '<option value="1">شهر واحد</option>' +
        '<option value="2">شهرين</option>' +
        '<option value="3">3 أشهر</option>' +
        '<option value="4">4 أشهر</option>' +
        '<option value="6">6 أشهر</option>' +
        '<option value="12">سنة كاملة</option>' +
      '</select>' +
      '<div style="display:flex;gap:0.5rem;">' +
        '<button onclick="confirmActivation(\'' + userId + '\')" style="flex:1;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;border:none;padding:0.8rem;border-radius:12px;cursor:pointer;font-weight:600;">✅ تأكيد التفعيل</button>' +
        '<button onclick="document.getElementById(\'activation-modal\').remove()" style="flex:1;background:#edf2f7;color:#4a5568;border:none;padding:0.8rem;border-radius:12px;cursor:pointer;font-weight:600;">إلغاء</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(modal);
}

// ✅ تنفيذ التفعيل مع حساب تاريخ الانتهاء
function confirmActivation(userId) {
  var months = parseInt(document.getElementById('activation-months').value);
  var expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + months);
  
  var client = window.supabaseClient;
  client.from('profiles').update({ 
    status: 'نشط', 
    subscription_expiry: expiryDate.toISOString() 
  }).eq('id', userId).then(function(res) {
    document.getElementById('activation-modal').remove();
    if (res.error) alert('خطأ: ' + res.error.message);
    else {
      alert('✅ تم تفعيل الحساب لمدة ' + months + ' شهر/أشهر');
      loadUsersTable();
      loadStats();
    }
  });
}

function loadUsersTable() {
  var c = window.supabaseClient; 
  if (!c) return;
  
  c.from('profiles').select('*').order('created_at', { ascending: false }).then(function(res) {
    if (res.error) { console.error('Users Error:', res.error); return; }
    var users = res.data;
    var tbody = document.getElementById('users-list');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (users) {
      users.forEach(function(u) {
        var tr = document.createElement('tr');
        var actions = '';
        
        // ✅ زر التفعيل يفتح نافذة المدة
        if (u.status === 'قيد المراجعة' || u.status === 'منتهي الصلاحية') {
          actions += '<button class="btn-action" onclick="showActivationModal(\'' + u.id + '\')">⏳ تفعيل</button>';
        }
        if (u.status === 'نشط') {
          actions += '<button class="btn-action btn-delete" onclick="changeStatus(\'' + u.id + '\', \'محظور\')">🚫 حظر</button>';
        }
        if (u.status === 'محظور') {
          actions += '<button class="btn-action" onclick="changeStatus(\'' + u.id + '\', \'نشط\')">✅ تفعيل</button>';
        }
        actions += '<button class="btn-action" onclick="deleteUser(\'' + u.id + '\')">🗑️ حذف</button>';
        
        var expiryText = u.subscription_expiry ? 'ينتهي: ' + new Date(u.subscription_expiry).toLocaleDateString('ar-IQ') : '-';
        
        tr.innerHTML = 
          '<td>' + u.name + '</td>' +
          '<td>' + u.phone + '</td>' +
          '<td>' + u.role + '</td>' +
          '<td style="font-size:0.8rem;color:#64748b;">' + expiryText + '</td>' +
          '<td style="color:' + getStatusColor(u.status) + '">' + u.status + '</td>' +
          '<td>' + actions + '</td>';
        tbody.appendChild(tr);
      });
    }
  }).catch(function(err) { console.error('Load Users Error:', err); });
}

function changeStatus(id, st) {
  var c = window.supabaseClient; 
  if (!c) return Promise.resolve();
  return c.from('profiles').update({ status: st }).eq('id', id).then(function() { 
    loadUsersTable(); 
    loadStats(); 
  });
}

function deleteUser(id) {
  var c = window.supabaseClient; 
  if (!c) return;
  if (confirm('تأكيد الحذف؟')) {
    c.from('profiles').delete().eq('id', id).then(function() { 
      loadUsersTable(); 
      loadStats(); 
    });
  }
}

function getStatusColor(s) { 
  return s === 'نشط' ? 'green' : s === 'قيد المراجعة' ? 'orange' : s === 'محظور' ? 'red' : '#64748b'; 
}

function handleLogout() {
  var c = window.supabaseClient;
  if (c) c.auth.signOut();
  app.currentUser = null; 
  app.currentRole = null;
  localStorage.removeItem('shira_screen');
  localStorage.removeItem('shira_admin_tab');
  showScreen('main-app');
}

// ==========================================
// 11. دوال الخريطة وتعديل الملف
// ==========================================
function initOrderMap(lat, lng) {
  var mapEl = document.getElementById('order-map');
  if (!mapEl || typeof L === 'undefined') return;
  mapEl.innerHTML = '';
  var map = L.map('order-map').setView([lat, lng], 14);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);
  var marker = L.marker([lat, lng], { draggable: true }).addTo(map);
  marker.on('dragend', function() {
    var pos = marker.getLatLng();
    document.getElementById('order-lat').value = pos.lat;
    document.getElementById('order-lng').value = pos.lng;
  });
  map.on('click', function(e) {
    marker.setLatLng(e.latlng);
    document.getElementById('order-lat').value = e.latlng.lat;
    document.getElementById('order-lng').value = e.latlng.lng;
  });
  setTimeout(function() { map.invalidateSize(); }, 300);
}

function showProfileEditor() {
  var c = document.getElementById('dash-content');
  if (!c || !app.currentUser) return;
  var name = app.currentUser.user_metadata ? app.currentUser.user_metadata.name || '' : '';
  var phone = app.currentUser.user_metadata ? app.currentUser.user_metadata.phone || '' : '';
  
  c.innerHTML = 
    '<div style="background:#fff;border-radius:24px;padding:1.5rem;margin:1rem;box-shadow:0 12px 32px rgba(0,0,0,0.08);">' +
      '<h2 style="margin:0 0 1.5rem 0;text-align:center;">✏️ تعديل الملف</h2>' +
      '<div style="margin-bottom:1rem;"><label style="display:block;margin-bottom:0.4rem;color:#4a5568;">الاسم</label>' +
      '<input type="text" id="edit-name" value="' + name + '" style="width:100%;padding:0.85rem;border:2px solid #e2e8f0;border-radius:14px;"></div>' +
      '<div style="margin-bottom:1rem;"><label style="display:block;margin-bottom:0.4rem;color:#4a5568;">الهاتف</label>' +
      '<input type="tel" value="' + phone + '" disabled style="width:100%;padding:0.85rem;border:2px solid #e2e8f0;border-radius:14px;background:#f7fafc;"></div>' +
      '<div style="margin-bottom:1.5rem;"><label style="display:block;margin-bottom:0.4rem;color:#4a5568;">كلمة مرور جديدة (اختياري)</label>' +
      '<input type="password" id="edit-password" placeholder="اتركه فارغاً للإبقاء" style="width:100%;padding:0.85rem;border:2px solid #e2e8f0;border-radius:14px;"></div>' +
      '<div style="display:flex;gap:0.75rem;">' +
      '<button id="save-profile" style="flex:1;background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);color:#fff;padding:0.9rem;border:none;border-radius:14px;cursor:pointer;font-weight:600;">💾 حفظ</button>' +
      '<button id="cancel-edit" style="flex:1;background:#edf2f7;color:#4a5568;padding:0.9rem;border:none;border-radius:14px;cursor:pointer;font-weight:600;">إلغاء</button>' +
      '</div><p id="profile-msg" class="auth-msg hidden" style="margin-top:1rem;text-align:center;"></p></div>';
  
  document.getElementById('save-profile').onclick = saveProfile;
  document.getElementById('cancel-edit').onclick = function() { checkSession(); };
}

function saveProfile() {
  var client = window.supabaseClient;
  if (!client || !app.currentUser) return;
  var name = document.getElementById('edit-name').value.trim();
  var password = document.getElementById('edit-password').value;
  var msgEl = document.getElementById('profile-msg');
  if (!name) { showMsg(msgEl, 'الاسم مطلوب', 'error'); return; }
  
  client.auth.updateUser({  { name: name } }).then(function(metaRes) {
    if (metaRes.error) throw metaRes.error;
    if (password) return client.auth.updateUser({ password: password });
    return Promise.resolve();
  }).then(function() {
    return client.from('profiles').update({ name: name }).eq('id', app.currentUser.id);
  }).then(function(profRes) {
    if (profRes.error) throw profRes.error;
    showMsg(msgEl, '✅ تم الحفظ بنجاح', 'success');
    setTimeout(function() { checkSession(); }, 1500);
  }).catch(function(err) { console.error(err); showMsg(msgEl, err.message || 'خطأ', 'error'); });
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

window.updateUserStatus = changeStatus;
window.deleteUser = deleteUser;
