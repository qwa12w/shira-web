// ==========================================
// شراع - تطبيق المنصة المتكاملة
// [النسخة النظيفة - قبل مشكلة التفعيل]
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
    console.log('✅ تم الاتصال بـ Supabase');
    return window.supabaseClient;
  } catch (e) { console.error('Supabase Init Error:', e); return null; }
}

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

function checkSession() {
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
    return Promise.resolve({  null });
  }).then(function(profRes) {
    var profile = profRes.data;
    if (!profile) {
      showScreen('main-app');
      return;
    }
    
    if (profile.status === 'محظور') showScreen('blocked-screen');
    else if (profile.status === 'قيد المراجعة' && profile.role !== 'زبون') showScreen('pending-screen');
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

async function handleAuth(e) {
  e.preventDefault();
  
  var client = window.supabaseClient;
  if (!client) {
    showMsg(document.getElementById('auth-msg'), 'جاري الاتصال...', 'error');
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
  if (!phone || !pass) { showMsg(msgEl, 'أدخل الهاتف وكلمة المرور', 'error'); return; }

  var currentRole = app.currentRole || localStorage.getItem('shira_role') || 'زبون';

  try {
    if (app.authMode === 'register') {
      if (!name) { showMsg(msgEl, 'الاسم مطلوب', 'error'); return; }
      
      var signUpResult = await client.auth.signUp({
        email: phone + '@shira.app', 
        password: pass,
        options: { data: { phone: phone, name: name, role: currentRole } }
      });
      
      if (signUpResult.error) throw signUpResult.error;
      
      var userId = signUpResult.data.user.id;
      var loc = await getCurrentLocation();
      
      await client.from('profiles').insert({
        id: userId, name: name, phone: phone, role: currentRole,
        status: currentRole === 'زبون' ? 'نشط' : 'قيد المراجعة',
        latitude: loc.lat, longitude: loc.lng
      });
      
      if (currentRole !== 'زبون') await uploadDocs(userId);
      
      showMsg(msgEl, '✅ تم إنشاء الحساب', 'success');
      
      setTimeout(function() {
        if (currentRole === 'زبون') {
          app.currentUser = signUpResult.data.user;
          showScreen('user-dashboard');
        } else { showScreen('pending-screen'); }
      }, 1000);
      
    } else {
      var signInResult = await client.auth.signInWithPassword({ 
        email: phone + '@shira.app', password: pass 
      });
      
      if (signInResult.error) throw signInResult.error;
      
      app.currentUser = signInResult.data.user;
      var profileResult = await client.from('profiles').select('*')
        .eq('id', app.currentUser.id).single();
      
      if (profileResult.error) throw profileResult.error;
      
      var profile = profileResult.data;
      if (profile.status === 'محظور') showScreen('blocked-screen');
      else if (profile.status === 'قيد المراجعة') showScreen('pending-screen');
      else {
        await showUserDashboard(profile);
        showScreen('user-dashboard');
      }
    }
  } catch (err) {
    showMsg(msgEl, err.message, 'error');
  }
}

function uploadDocs(uid) {
  var client = window.supabaseClient;
  if (!client) return Promise.resolve();
  
  var files = {
    license: document.getElementById('doc-license'),
    personal: document.getElementById('doc-personal'),
    vehicle: document.getElementById('doc-vehicle')
  };
  
  var data = {};
  var promises = [];
  
  Object.keys(files).forEach(function(k) {
    var inp = files[k];
    if (inp && inp.files && inp.files[0]) {
      var f = inp.files[0];
      var path = uid + '/' + k + '_' + Date.now();
      promises.push(client.storage.from('shira-docs').upload(path, f).then(function(up) {
        if (!up.error) {
          data[k] = client.storage.from('shira-docs').getPublicUrl(path).data.publicUrl;
        }
      }));
    }
  });
  
  return Promise.all(promises).then(function() {
    if (Object.keys(data).length) {
      return client.from('documents').insert({ 
        user_id: uid,
        vehicle_type: document.getElementById('vehicle-type').value,
        vehicle_plate: document.getElementById('vehicle-plate').value
      });
    }
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
    if (role === 'سائق تكسي') { if (veh) veh.classList.remove('hidden'); }
    else { if (veh) veh.classList.add('hidden'); }
  }
}

function updateAuthForm() {
  var ng = document.getElementById('name-group');
  var sb = document.getElementById('auth-submit');
  if (app.authMode === 'register') { 
    if (ng) ng.classList.remove('hidden'); 
    if (sb) sb.textContent = 'إنشاء حساب'; 
  } else { 
    if (ng) ng.classList.add('hidden'); 
    if (sb) sb.textContent = 'تسجيل الدخول'; 
  }
}

function showUserDashboard(p) {
  return getCurrentLocation().then(function(loc) {
    document.getElementById('dash-user-name').textContent = p.name;
    document.getElementById('dash-user-role').textContent = p.role;
    
    var c = document.getElementById('dash-content');
    if (c) {
      c.innerHTML = '<div style="padding:20px;text-align:center;"><h3>مرحباً ' + p.name + '</h3><p>📍 الموقع: ' + loc.lat.toFixed(2) + ', ' + loc.lng.toFixed(2) + '</p></div>';
    }
  });
}

function showMsg(el, txt, type) {
  if (!el) return;
  el.textContent = txt;
  el.className = 'auth-msg ' + (type === 'error' ? 'error' : 'success');
  el.classList.remove('hidden');
}

function handleAdminLogin() {
  var u = document.getElementById('admin-user').value.trim();
  var p = document.getElementById('admin-pass').value;
  var err = document.getElementById('login-error');
  
  if (u === 'علي' && p === 'جنده') {
    localStorage.setItem('shira_admin_logged', 'true');
    if (err) err.classList.add('hidden');
    showScreen('admin-panel');
    loadStats();
  } else {
    if (err) err.classList.remove('hidden');
  }
}

function loadStats() {
  var c = window.supabaseClient; 
  if (!c) return;
  
  c.from('profiles').select('*', { count: 'exact', head: true }).then(function(res) {
    document.getElementById('stat-users').textContent = res.count || 0;
  });
  
  c.from('profiles').select('*', { count: 'exact', head: true })
    .eq('status', 'قيد المراجعة').then(function(res) {
    document.getElementById('stat-pending').textContent = res.count || 0;
  });
}

// ⚠️ هذه الدالة هي المشكلة - لن تعمل بدون سياسة RLS
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

function startApp() {
  if (app.ready) return;
  app.ready = true;
  restoreScreen();
  checkSession();
  setupRealtime();
  setupEvents();
}

window.showActivationModal = showActivationModal;
