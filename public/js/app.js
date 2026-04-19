// ==========================================
// شراع - التطبيق (نسخة التصميم الجديد)
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
  ready: false
};

function initSupabase() {
  if (window.supabaseClient) return window.supabaseClient;
  if (typeof window.supabase === 'undefined') {
    setTimeout(initSupabase, 100);
    return null;
  }
  try {
    window.supabaseClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);
    console.log('✅ Supabase Ready');
    return window.supabaseClient;
  } catch (e) { return null; }
}

function saveLocation(lat, lng) {
  localStorage.setItem('shira_user_location', JSON.stringify({ lat, lng, timestamp: Date.now() }));
}

function getCurrentLocation() {
  var saved = localStorage.getItem('shira_user_location');
  if (saved) {
    try {
      var loc = JSON.parse(saved);
      if (Date.now() - loc.timestamp < 86400000) return Promise.resolve(loc);
    } catch (e) {}
  }
  return new Promise(function(resolve) {
    if (!navigator.geolocation) resolve({ lat: CONFIG.DEFAULT_LAT, lng: CONFIG.DEFAULT_LNG });
    else {
      navigator.geolocation.getCurrentPosition(
        function(pos) {
          var loc = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: Date.now() };
          saveLocation(loc.lat, loc.lng);
          resolve(loc);
        },
        function() { resolve({ lat: CONFIG.DEFAULT_LAT, lng: CONFIG.DEFAULT_LNG }); },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
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
  if (localStorage.getItem('shira_admin_logged') === 'true') {
    showScreen('admin-panel');
    loadStats();
    return;
  }
  if (saved && saved !== 'main-app' && saved !== 'auth-screen') showScreen(saved);
  else showScreen('main-app');
}

function checkSession() {
  var client = window.supabaseClient;
  if (!client) { showScreen('main-app'); return; }
  
  client.auth.getSession().then(function(res) {
    var session = res.data ? res.data.session : null;
    if (session) {
      app.currentUser = session.user;
      return client.from('profiles').select('*').eq('id', session.user.id).single();
    }
    // ✅ التصحيح هنا: إرجاع null بشكل صحيح
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
  }).catch(function(e) { showScreen('main-app'); });
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
      document.querySelectorAll('.admin-tab').forEach(function(t) { t.classList.add('hidden'); });
      document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
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
  msgEl.style.display = 'none';
  
  if (!phone || !pass) { showMsg(msgEl, 'أدخل الهاتف وكلمة المرور'); return; }
  
  var currentRole = app.currentRole || 'زبون';
  try {
    if (app.authMode === 'register') {
      if (!name) { showMsg(msgEl, 'الاسم مطلوب'); return; }
      showMsg(msgEl, 'جاري الإنشاء...');
      
      // ✅ التصحيح هنا: options: {  { ... } }
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
          showUserDashboard({ name: name, phone: phone, role: currentRole })
            .then(function() { showScreen('user-dashboard'); });
        } else { showScreen('pending-screen'); }
      }, 1000);
    } else {
      showMsg(msgEl, 'جاري الدخول...');
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
    showMsg(msgEl, err.message);
  }
}

function uploadDocs(uid) {
  var client = window.supabaseClient;
  if (!client) return Promise.resolve();
  var files = { license: document.getElementById('doc-license'), vehicle: document.getElementById('doc-vehicle') };
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
    if (Object.keys(data).length) return client.from('documents').insert({ 
      user_id: uid, 
      vehicle_type: document.getElementById('vehicle-type').value, 
      vehicle_plate: document.getElementById('vehicle-plate').value 
    });
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
    document.getElementById('dash-user-name').textContent = p.name;
    var c = document.getElementById('dash-content');
    if (c) {
      var initials = p.name ? p.name.charAt(0) : '?';
      c.innerHTML = 
        '<div style="background:#fff; padding:20px; border-radius:20px; text-align:center; margin-bottom:20px;">' +
          '<div style="width:80px; height:80px; background:#f59e0b; border-radius:50%; margin:0 auto 15px; display:flex; align-items:center; justify-content:center; color:#fff; font-size:30px; font-weight:bold;">' + initials + '</div>' +
          '<h3>' + p.name + '</h3><p style="color:#64748b;">📍 ' + loc.lat.toFixed(2) + ', ' + loc.lng.toFixed(2) + '</p>' +
        '</div>' +
        '<div style="display:grid; grid-template-columns:1fr 1fr; gap:15px;">' +
          '<button onclick="alert(\'طلب تكسي\')" style="background:#fff; padding:20px; border-radius:15px; font-size:16px; font-weight:bold; box-shadow:0 4px 10px rgba(0,0,0,0.05);">🚗 تكسي</button>' +
          '<button onclick="alert(\'طلب ديلفري\')" style="background:#fff; padding:20px; border-radius:15px; font-size:16px; font-weight:bold; box-shadow:0 4px 10px rgba(0,0,0,0.05);">🏍️ ديلفري</button>' +
        '</div>';
    }
  });
}

function showMsg(el, txt, type) {
  el.textContent = txt;
  el.style.display = 'block';
  el.style.color = type === 'success' ? '#10b981' : '#ef4444';
}

function handleAdminLogin() {
  var u = document.getElementById('admin-user').value.trim();
  var p = document.getElementById('admin-pass').value;
  var err = document.getElementById('login-error');
  if (u === 'علي' && p === 'جنده') {
    localStorage.setItem('shira_admin_logged', 'true');
    err.style.display = 'none';
    showScreen('admin-panel');
    loadStats();
  } else { err.style.display = 'block'; }
}

function loadStats() {
  var c = window.supabaseClient; if (!c) return;
  c.from('profiles').select('*', { count: 'exact', head: true }).then(function(r) { document.getElementById('stat-users').textContent = r.count||0; });
  c.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'قيد المراجعة').then(function(r) { document.getElementById('stat-pending').textContent = r.count||0; });
}

function showActivationModal(userId) {
  var months = prompt("عدد الأشهر للتفعيل:", "1");
  if (!months) return;
  
  var expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + parseInt(months));
  
  var client = window.supabaseClient;
  client.from('profiles').update({ status: 'نشط', subscription_expiry: expiryDate.toISOString() }).eq('id', userId).then(function(res) {
    if (res.error) alert('❌ خطأ: ' + res.error.message);
    else { alert('✅ تم التفعيل لمدة ' + months + ' أشهر'); loadUsersTable(); }
  });
}

function loadUsersTable() {
  var c = window.supabaseClient; if (!c) return;
  c.from('profiles').select('*').order('created_at', { ascending: false }).then(function(res) {
    if (res.error) return;
    var tbody = document.getElementById('users-list'); if (!tbody) return; tbody.innerHTML = '';
    if (res.data) {
      res.data.forEach(function(u) {
        var tr = document.createElement('tr');
        var actions = '';
        if (u.status === 'قيد المراجعة') actions = '<button onclick="showActivationModal(\'' + u.id + '\')" class="btn-sm" style="background:#fef3c7; color:#d97706;">⏳ تفعيل</button>';
        else if (u.status === 'نشط') actions = '<button class="btn-sm" style="background:#fee2e2; color:#ef4444;">🚫 حظر</button>';
        tr.innerHTML = '<td>' + u.name + '</td><td>' + u.phone + '</td><td>' + u.role + '</td><td>' + u.status + '</td><td>' + actions + '</td>';
        tbody.appendChild(tr);
      });
    }
  });
}

function handleLogout() {
  var c = window.supabaseClient; if (c) c.auth.signOut();
  app.currentUser = null; localStorage.removeItem('shira_screen'); showScreen('main-app');
}

function startApp() {
  if (app.ready) return; app.ready = true;
  restoreScreen(); checkSession(); setupEvents();
}

window.showActivationModal = showActivationModal;
