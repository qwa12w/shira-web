// ==========================================
// شراع - تطبيق المنصة المتكاملة
// [النسخة النهائية - إصلاح التسجيل والتوجيه التلقائي]
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
  
  if (saved && saved !== 'main-app' && saved !== 'auth-screen') {
    showScreen(saved);
    if (saved === 'admin-panel' && savedTab) {
      document.querySelectorAll('.admin-nav-btn').forEach(function(b) { 
        b.classList.toggle('active', b.dataset.tab === savedTab); 
      });
      document.querySelectorAll('.admin-tab').forEach(function(t) {
        t.classList.add('hidden');
        if (t.id === 'tab-' + savedTab) t.classList.remove('hidden');
      });
    }
  } else {
    showScreen('main-app');
  }
}

// ==========================================
// 5. التحقق من الجلسة ✅ مصحح
// ==========================================
function checkSession() {
  var client = window.supabaseClient;
  if (!client) {
    showScreen('main-app');
    return;
  }
  
  client.auth.getSession().then(function(res) {
    var session = res.data ? res.data.session : null;
    restoreLocation();
    
    if (session) {
      console.log('✅ جلسة نشطة:', session.user.id);
      app.currentUser = session.user;
      
      client.from('profiles').select('*').eq('id', session.user.id).single().then(function(profRes) {
        if (profRes.error) {
          console.error('خطأ في جلب الملف:', profRes.error);
          showScreen('main-app');
          return;
        }
        
        var profile = profRes.data;
        if (!profile) {
          console.log('لا يوجد ملف شخصي');
          showScreen('main-app');
          return;
        }
        
        console.log('الملف الشخصي:', profile);
        
        if (profile.status === 'محظور') {
          showScreen('blocked-screen');
        } else if (profile.status === 'قيد المراجعة' && profile.role !== 'زبون') {
          showScreen('pending-screen');
        } else {
          showUserDashboard(profile).then(function() {
            showScreen('user-dashboard');
          });
        }
      }).catch(function(e) {
         console.error('Profile Error:', e);
         showScreen('main-app');
      });
    } else {
      console.log('لا توجد جلسة نشطة');
      showScreen('main-app');
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
      if (app.currentUser && p.new && p.new.id === app.currentUser.id) {
        if (p.new.status === 'محظور') showScreen('blocked-screen');
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
  
  bind('back-to-main', function() { 
    localStorage.removeItem('shira_screen');
    showScreen('main-app'); 
  });
  bind('back-to-home', function() { 
    localStorage.removeItem('shira_screen');
    showScreen('main-app'); 
  });
  bind('logout-admin', function() { 
    localStorage.removeItem('shira_screen');
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
// 8. المصادقة ✅ مصحح - التوجيه التلقائي
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
  
  if (!phone || !pass) {
    showMsg(msgEl, 'يرجى إدخال الهاتف وكلمة المرور', 'error');
    return;
  }

  if (pass.length < 6) {
    showMsg(msgEl, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
    return;
  }

  var currentRole = app.currentRole || localStorage.getItem('shira_role') || 'زبون';
  console.log('الدور الحالي:', currentRole);

  try {
    if (app.authMode === 'register') {
      // === تسجيل جديد ===
      if (!name) {
        showMsg(msgEl, 'الاسم مطلوب', 'error');
        return;
      }
      
      showMsg(msgEl, 'جاري إنشاء الحساب...', 'success');
      console.log('جاري إنشاء حساب لـ:', phone);
      
      var signUpResult = await client.auth.signUp({
        email: phone + '@shira.app', 
        password: pass,
        options: { data: { phone: phone, name: name, role: currentRole } }
      });
      
      if (signUpResult.error) {
        console.error('خطأ في التسجيل:', signUpResult.error);
        throw signUpResult.error;
      }
      
      if (!signUpResult.data || !signUpResult.data.user) {
        throw new Error('فشل إنشاء الحساب');
      }
      
      var userId = signUpResult.data.user.id;
      console.log('✅ تم إنشاء الحساب في Auth:', userId);
      
      // الحصول على الموقع
      var loc = await getCurrentLocation();
      
      // إنشاء الملف الشخصي
      var profileData = {
        id: userId, 
        name: name, 
        phone: phone, 
        role: currentRole, 
        status: currentRole === 'زبون' ? 'نشط' : 'قيد المراجعة',
        latitude: loc.lat,
        longitude: loc.lng
      };
      
      console.log('بيانات الملف:', profileData);
      
      var profileResult = await client.from('profiles').insert(profileData);
      
      if (profileResult.error) {
        console.error('❌ خطأ في إنشاء الملف:', profileResult.error);
        throw profileResult.error;
      }
      
      console.log('✅ تم إنشاء الملف الشخصي بنجاح');
      
      // رفع الوثائق إذا لزم الأمر
      if (currentRole !== 'زبون') {
        await uploadDocs(userId);
      }
      
      // عرض رسالة النجاح
      var successMsg = '✅ تم إنشاء الحساب بنجاح! ';
      successMsg += (currentRole === 'زبون') ? 'جاري التوجيه...' : 'بانتظار موافقة الإدارة';
      showMsg(msgEl, successMsg, 'success');
      
      // ✅ التوجيه التلقائي الفوري
      setTimeout(function() {
        if (currentRole === 'زبون') {
          // تعيين المستخدم الحالي
          app.currentUser = signUpResult.data.user;
          app.currentRole = currentRole;
          
          // عرض لوحة التحكم مباشرة
          showUserDashboard({ 
            name: name, 
            phone: phone, 
            role: currentRole, 
            latitude: loc.lat, 
            longitude: loc.lng 
          }).then(function() {
            showScreen('user-dashboard');
            localStorage.setItem('shira_screen', 'user-dashboard');
          });
        } else {
          showScreen('pending-screen');
        }
      }, 1000);
      
    } else {
      // === تسجيل دخول ===
      console.log('جاري تسجيل الدخول لـ:', phone);
      showMsg(msgEl, 'جاري تسجيل الدخول...', 'success');
      
      var signInResult = await client.auth.signInWithPassword({ 
        email: phone + '@shira.app', 
        password: pass 
      });
      
      if (signInResult.error) {
        console.error('خطأ في تسجيل الدخول:', signInResult.error);
        throw signInResult.error;
      }
      
      app.currentUser = signInResult.data.user;
      console.log('✅ تم تسجيل الدخول:', app.currentUser.id);
      
      // جلب الملف الشخصي
      var profileResult = await client.from('profiles').select('*').eq('id', app.currentUser.id).single();
      
      if (profileResult.error) {
        console.error('خطأ في جلب الملف:', profileResult.error);
        throw profileResult.error;
      }
      
      var profile = profileResult.data;
      if (!profile) throw new Error('الملف الشخصي غير موجود');
      
      console.log('الملف الشخصي:', profile);
      
      // التحقق من الحالة والتوجيه
      if (profile.status === 'محظور') {
        showScreen('blocked-screen');
      } else if (profile.status === 'قيد المراجعة') {
        showScreen('pending-screen');
      } else {
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
  
  if (role === 'زبون') {
    if (sec) sec.classList.add('hidden');
  } else {
    if (sec) sec.classList.remove('hidden');
    if (role === 'سائق تكسي') { 
      if (veh) veh.classList.remove('hidden'); if (bik) bik.classList.add('hidden'); 
    } else if (role === 'ديلفري') { 
      if (veh) veh.classList.add('hidden'); if (bik) bik.classList.remove('hidden'); 
    } else { 
      if (veh) veh.classList.add('hidden'); if (bik) bik.classList.add('hidden'); 
    }
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
    var n = document.getElementById('dash-user-name');
    var r = document.getElementById('dash-user-role');
    if (n) n.textContent = p.name;
    if (r) r.textContent = p.role;
    
    var c = document.getElementById('dash-content');
    if (c) {
      var canEdit = p.role === 'زبون';
      var serviceOptions = '<label class="service-option"><input type="radio" name="service-type" value="taxi" checked><span>🚗 تكسي</span></label>' +
                           '<label class="service-option"><input type="radio" name="service-type" value="delivery"><span>🏍️ ديلفري</span></label>' +
                           '<label class="service-option"><input type="radio" name="service-type" value="shopping"><span>🛒 تسوق</span></label>';
      
      c.innerHTML = '<div class="welcome-card"><h2>مرحباً ' + p.name + ' 👋</h2><p>لوحة تحكم ' + p.role + ' جاهزة</p>' +
        (canEdit ? '<button id="edit-profile-btn" class="btn-secondary" style="margin-top:1rem;">✏️ تعديل ملفي</button>' : '') +
        '<p style="margin-top:0.5rem;font-size:0.9rem;color:#64748b;">📍 ' + loc.lat.toFixed(4) + ', ' + loc.lng.toFixed(4) + '</p></div>' +
        '<div class="order-section" style="margin-top:2rem;"><h3>🚀 اطلب خدمتك</h3><div class="service-selector"><label>نوع الخدمة:</label><div class="service-options">' + serviceOptions + '</div></div>' +
        '<div class="map-section" style="margin:1rem 0;"><label>📍 الموقع:</label><div id="order-map" style="height:200px;background:#f1f5f9;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#64748b;">جاري التحميل...</div>' +
        '<input type="hidden" id="order-lat" value="' + loc.lat + '"><input type="hidden" id="order-lng" value="' + loc.lng + '">' +
        '<button type="button" id="use-current-location" class="btn-secondary" style="margin-top:0.5rem;">🎯 موقعي الحالي</button></div>' +
        '<div class="form-group"><label>ملاحظات:</label><textarea id="order-notes" rows="2" placeholder="تفاصيل إضافية..."></textarea></div>' +
        '<button id="submit-order" class="btn-primary" style="width:100%;margin-top:1rem;">✅ إرسال الطلب</button><p id="order-msg" class="order-msg hidden"></p></div>' +
        '<div class="tracking-section" style="margin-top:2rem;"><h3>📊 طلباتي</h3><div id="active-orders"></div></div>';
      
      if (typeof L !== 'undefined') initOrderMap(loc.lat, loc.lng);
      bindOrderEvents();
      loadActiveOrders();
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
// 10. لوحة الإدارة
// ==========================================
function handleAdminLogin() {
  var u = document.getElementById('admin-user') ? document.getElementById('admin-user').value : '';
  var p = document.getElementById('admin-pass') ? document.getElementById('admin-pass').value : '';
  var err = document.getElementById('login-error');
  if (u === 'admin' && p === '1234') {
    if (err) err.classList.add('hidden');
    showScreen('admin-panel');
    loadStats();
  } else { if (err) err.classList.remove('hidden'); }
}

function loadStats() {
  var c = window.supabaseClient; if (!c) return Promise.resolve();
  return Promise.all([
    c.from('profiles').select('*', { count: 'exact', head: true }),
    c.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'قيد المراجعة')
  ]).then(function(results) {
    var su = document.getElementById('stat-users');
    var sp = document.getElementById('stat-pending');
    if (su) su.textContent = results[0].count || 0;
    if (sp) sp.textContent = results[1].count || 0;
  });
}

function loadUsersTable() {
  var c = window.supabaseClient; if (!c) return;
  c.from('profiles').select('*').order('created_at', { ascending: false }).then(function(res) {
    var users = res.data;
    var tbody = document.getElementById('users-list');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (users) {
      users.forEach(function(u) {
        var tr = document.createElement('tr');
        var actions = '';
        if (u.status !== 'نشط') actions += '<button class="btn-action" data-act="activate" data-id="' + u.id + '">تفعيل</button>';
        if (u.status !== 'محظور') actions += '<button class="btn-action btn-delete" data-act="block" data-id="' + u.id + '">حظر</button>';
        actions += '<button class="btn-action" data-act="delete" data-id="' + u.id + '">حذف</button>';
        tr.innerHTML = '<td>' + u.name + '</td><td>' + u.phone + '</td><td>' + u.role + '</td><td>' + new Date(u.created_at).toLocaleDateString('ar-IQ') + '</td><td style="color:' + getStatusColor(u.status) + '">' + u.status + '</td><td>' + actions + '</td>';
        tbody.appendChild(tr);
      });
    }
    tbody.onclick = function(e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var id = btn.dataset.id, act = btn.dataset.act;
      if (act === 'activate') changeStatus(id, 'نشط');
      else if (act === 'block') changeStatus(id, 'محظور');
      else if (act === 'delete') deleteUser(id);
    };
  });
}

function changeStatus(id, st) {
  var c = window.supabaseClient; if (!c) return Promise.resolve();
  return c.from('profiles').update({ status: st }).eq('id', id).then(function() { loadUsersTable(); loadStats(); });
}

function deleteUser(id) {
  var c = window.supabaseClient; if (!c) return;
  if (confirm('تأكيد الحذف؟')) {
    c.from('profiles').delete().eq('id', id).then(function() { loadUsersTable(); loadStats(); });
  }
}

function getStatusColor(s) { return s === 'نشط' ? 'green' : s === 'قيد المراجعة' ? 'orange' : 'red'; }

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
// 11. دوال الطلبات والخريطة
// ==========================================
function initOrderMap(lat, lng) {
  var mapEl = document.getElementById('order-map');
  if (!mapEl || typeof L === 'undefined') return;
  mapEl.innerHTML = '';
  var map = L.map('order-map').setView([lat, lng], 13);
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
}

function bindOrderEvents() {
  var locBtn = document.getElementById('use-current-location');
  if (locBtn) locBtn.onclick = function() {
    getCurrentLocation().then(function(loc) {
      document.getElementById('order-lat').value = loc.lat;
      document.getElementById('order-lng').value = loc.lng;
      if (typeof L !== 'undefined') {
        var mapEl = document.getElementById('order-map');
        if (mapEl) { mapEl.innerHTML = ''; initOrderMap(loc.lat, loc.lng); }
      }
      alert('✅ تم تحديث الموقع');
    });
  };
  
  var submitBtn = document.getElementById('submit-order');
  if (submitBtn) submitBtn.onclick = function() {
    var client = window.supabaseClient;
    if (!client || !app.currentUser) return;
    var serviceType = document.querySelector('input[name="service-type"]:checked')?.value;
    var lat = document.getElementById('order-lat')?.value;
    var lng = document.getElementById('order-lng')?.value;
    var notes = document.getElementById('order-notes')?.value || '';
    var msgEl = document.getElementById('order-msg');
    if (!serviceType || !lat || !lng) { showMsg(msgEl, 'يرجى تحديد الخدمة والموقع', 'error'); return; }
    client.from('orders').insert({
      user_id: app.currentUser.id, service_type: serviceType,
      latitude: parseFloat(lat), longitude: parseFloat(lng),
      notes: notes, status: 'pending', created_at: new Date().toISOString()
    }).then(function(res) {
      if (res.error) showMsg(msgEl, 'خطأ: ' + res.error.message, 'error');
      else { showMsg(msgEl, '✅ تم إرسال الطلب', 'success'); setTimeout(function() { loadActiveOrders(); }, 1000); }
    });
  };
  
  var editBtn = document.getElementById('edit-profile-btn');
  if (editBtn) editBtn.onclick = function() { showProfileEditor(); };
}

function showProfileEditor() {
  var c = document.getElementById('dash-content');
  if (!c || !app.currentUser) return;
  var name = app.currentUser.user_metadata ? app.currentUser.user_metadata.name || '' : '';
  var phone = app.currentUser.user_metadata ? app.currentUser.user_metadata.phone || '' : '';
  c.innerHTML = '<div class="welcome-card"><h2>✏️ تعديل ملفي</h2>' +
    '<div class="form-group"><label>الاسم:</label><input type="text" id="edit-name" value="' + name + '"></div>' +
    '<div class="form-group"><label>الهاتف:</label><input type="tel" value="' + phone + '" disabled style="background:#f1f5f9;"></div>' +
    '<div class="form-group"><label>كلمة مرور جديدة (اختياري):</label><input type="password" id="edit-password" placeholder="اتركه فارغاً للإبقاء"></div>' +
    '<button id="save-profile" class="btn-primary">💾 حفظ</button><button id="cancel-edit" class="btn-back" style="margin-right:1rem;">إلغاء</button><p id="profile-msg" class="auth-msg hidden"></p></div>';
  document.getElementById('save-profile').onclick = saveProfile;
  document.getElementById('cancel-edit').onclick = function() { checkSession(); };
}

function saveProfile() {
  var client = window.supabaseClient;
  if (!client || !app.currentUser) return;
  var name = document.getElementById('edit-name')?.value.trim();
  var password = document.getElementById('edit-password')?.value;
  var msgEl = document.getElementById('profile-msg');
  if (!name) { showMsg(msgEl, 'الاسم مطلوب', 'error'); return; }
  client.auth.updateUser({ data: { name: name } }).then(function(metaRes) {
    if (metaRes.error) throw metaRes.error;
    if (password) return client.auth.updateUser({ password: password });
    return Promise.resolve();
  }).then(function() {
    return client.from('profiles').update({ name: name }).eq('id', app.currentUser.id);
  }).then(function(profRes) {
    if (profRes.error) throw profRes.error;
    showMsg(msgEl, '✅ تم الحفظ', 'success');
    setTimeout(function() { checkSession(); }, 1500);
  }).catch(function(err) { console.error(err); showMsg(msgEl, err.message || 'خطأ', 'error'); });
}

function loadActiveOrders() {
  var client = window.supabaseClient;
  if (!client || !app.currentUser) return;
  client.from('orders').select('*').eq('user_id', app.currentUser.id).eq('status', 'pending').order('created_at', { ascending: false }).then(function(res) {
    var orders = res.data;
    var listEl = document.getElementById('active-orders');
    if (!listEl) return;
    if (!orders || orders.length === 0) { listEl.innerHTML = '<p style="color:#64748b;">لا توجد طلبات نشطة</p>'; return; }
    var html = '';
    orders.forEach(function(o) {
      var sName = o.service_type === 'taxi' ? '🚗 تكسي' : o.service_type === 'delivery' ? '🏍️ ديلفري' : '🛒 تسوق';
      html += '<div style="background:#fff;padding:1rem;border-radius:12px;margin:0.5rem 0;border:1px solid #e2e8f0;"><div style="display:flex;justify-content:space-between;align-items:center;"><strong>' + sName + '</strong><span style="background:#f1f5f9;padding:0.25rem 0.75rem;border-radius:20px;font-size:0.85rem;">' + o.status + '</span></div>' +
        '<p style="margin:0.5rem 0;font-size:0.9rem;color:#64748b;">📍 ' + (o.latitude ? o.latitude.toFixed(4) : '') + ', ' + (o.longitude ? o.longitude.toFixed(4) : '') + '</p>';
      if (o.notes) html += '<p style="font-size:0.9rem;">📝 ' + o.notes + '</p>';
      html += '<p style="font-size:0.85rem;color:#94a3b8;">' + new Date(o.created_at).toLocaleString('ar-IQ') + '</p></div>';
    });
    listEl.innerHTML = html;
  });
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
