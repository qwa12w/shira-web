// ==========================================
// شراع - تطبيق المنصة المتكاملة
// [النسخة النهائية المصححة]
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
    if (id !== 'main-app') localStorage.setItem('shira_screen', id);
  }
}

function restoreScreen() {
  var saved = localStorage.getItem('shira_screen');
  var savedTab = localStorage.getItem('shira_admin_tab');
  
  if (saved && saved !== 'main-app') {
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
// 5. التحقق من الجلسة
// ==========================================
function checkSession() {
  var client = window.supabaseClient;
  if (!client) return Promise.resolve();
  
  return client.auth.getSession().then(function(res) {
    var session = res.data ? res.data.session : null;
    restoreLocation();
    
    if (session) {
      app.currentUser = session.user;
      return client.from('profiles').select('*').eq('id', session.user.id).single();
    }
    return Promise.resolve({ data: null });
  }).then(function(profRes) {
    var profile = profRes.data;
    if (!profile) return;
    
    if (profile.status === 'محظور') showScreen('blocked-screen');
    else if (profile.status === 'قيد المراجعة' && profile.role !== 'زبون') showScreen('pending-screen');
    else { 
      return showUserDashboard(profile).then(function() {
        var saved = localStorage.getItem('shira_screen');
        showScreen(saved && saved !== 'main-app' ? saved : 'user-dashboard');
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
  bind('logout-admin', function() { showScreen('main-app'); });
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
    localStorage.setItem('shira_screen', 'admin-login');
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
function handleAuth(e) {
  e.preventDefault();
  var client = window.supabaseClient;
  var phone = document.getElementById('auth-phone') ? document.getElementById('auth-phone').value.trim() : '';
  var pass = document.getElementById('auth-password') ? document.getElementById('auth-password').value : '';
  var name = document.getElementById('auth-name') ? document.getElementById('auth-name').value.trim() : '';
  var msgEl = document.getElementById('auth-msg');
  if (msgEl) msgEl.classList.add('hidden');

  if (app.authMode === 'register') {
    if (!name) { showMsg(msgEl, 'الاسم مطلوب', 'error'); return Promise.resolve(); }
    
    return getCurrentLocation().then(function(loc) {
      return client.auth.signUp({
        email: phone + '@shira.app', 
        password: pass,
        options: { data: { phone: phone, name: name, role: app.currentRole } }
      }).then(function(signUpRes) {
        if (signUpRes.error) throw signUpRes.error;
        
        return client.from('profiles').insert({
          id: signUpRes.data.user.id, 
          name: name, 
          phone: phone, 
          role: app.currentRole,
          status: app.currentRole === 'زبون' ? 'نشط' : 'قيد المراجعة',
          latitude: loc.lat, 
          longitude: loc.lng
        }).then(function() {
          if (app.currentRole !== 'زبون') return uploadDocs(signUpRes.data.user.id);
          return Promise.resolve();
        }).then(function() {
          showMsg(msgEl, 'تم الإنشاء! ' + (app.currentRole === 'زبون' ? 'جاري التوجيه...' : 'بانتظار الموافقة'), 'success');
          
          setTimeout(function() {
            if (app.currentRole === 'زبون') {
              showUserDashboard({ name: name, phone: phone, role: app.currentRole, latitude: loc.lat, longitude: loc.lng });
              showScreen('user-dashboard');
              localStorage.setItem('shira_screen', 'user-dashboard');
            } else {
              showScreen('pending-screen');
            }
          }, 1500);
        });
      });
    }).catch(function(err) {
      console.error(err);
      showMsg(msgEl, err.message || 'خطأ', 'error');
    });
  } else {
    return client.auth.signInWithPassword({ 
      email: phone + '@shira.app', 
      password: pass 
    }).then(function(signInRes) {
      if (signInRes.error) throw signInRes.error;
      
      app.currentUser = signInRes.data.user;
      return client.from('profiles').select('*').eq('id', app.currentUser.id).single();
    }).then(function(pRes) {
      var profile = pRes.data;
      if (!profile) throw new Error('ملف غير موجود');
      
      if (profile.status === 'محظور') showScreen('blocked-screen');
      else if (profile.status === 'قيد المراجعة') showScreen('pending-screen');
      else { 
        return showUserDashboard(profile).then(function() {
          var saved = localStorage.getItem('shira_screen');
          showScreen(saved && saved !== 'main-app' ? saved : 'user-dashboard');
        });
      }
    }).catch(function(err) {
      console.error(err);
      showMsg(msgEl, err.message || 'خطأ', 'error');
    });
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
    
    if (Object.keys(data).length) {
      return client.from('documents').insert({ user_id: uid });
    }
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
      if (veh) veh.classList.remove('hidden'); 
      if (bik) bik.classList.add('hidden'); 
    } else if (role === 'ديلفري') { 
      if (veh) veh.classList.add('hidden'); 
      if (bik) bik.classList.remove('hidden'); 
    } else { 
      if (veh) veh.classList.add('hidden'); 
      if (bik) bik.classList.add('hidden'); 
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
      
      var serviceOptions = '';
      serviceOptions += '<label class="service-option"><input type="radio" name="service-type" value="taxi" checked><span>🚗 تكسي</span></label>';
      serviceOptions += '<label class="service-option"><input type="radio" name="service-type" value="delivery"><span>🏍️ ديلفري</span></label>';
      serviceOptions += '<label class="service-option"><input type="radio" name="service-type" value="shopping"><span>🛒 تسوق</span></label>';
      
      c.innerHTML = 
        '<div class="welcome-card">' +
          '<h2>مرحباً ' + p.name + ' 👋</h2>' +
          '<p>لوحة تحكم ' + p.role + ' جاهزة</p>' +
          (canEdit ? '<button id="edit-profile-btn" class="btn-secondary" style="margin-top:1rem;">✏️ تعديل ملفي</button>' : '') +
          '<p style="margin-top:0.5rem;font-size:0.9rem;color:#64748b;">📍 ' + loc.lat.toFixed(4) + ', ' + loc.lng.toFixed(4) + '</p>' +
        '</div>' +
        '<div class="order-section" style="margin-top:2rem;">' +
          '<h3>🚀 اطلب خدمتك</h3>' +
          '<div class="service-selector">' +
            '<label>نوع الخدمة:</label>' +
            '<div class="service-options">' + serviceOptions + '</div>' +
          '</div>' +
          '<div class="map-section" style="margin:1rem 0;">' +
            '<label>📍 الموقع:</label>' +
            '<div id="order-map" style="height:200px;background:#f1f5f9;border-radius:12px;display:flex;align-items:center;justify-content:center;color:#64748b;">جاري التحميل...</div>' +
            '<input type="hidden" id="order-lat" value="' + loc.lat + '">' +
            '<input type="hidden" id="order-lng" value="' + loc.lng + '">' +
            '<button type="button" id="use-current-location" class="btn-secondary" style="margin-top:0.5rem;">🎯 موقعي الحالي</button>' +
          '</div>' +
          '<div class="form-group"><label>ملاحظات:</label><textarea id="order-notes" rows="2" placeholder="تفاصيل إضافية..."></textarea></div>' +
          '<button id="submit-order" class="btn-primary" style="width:100%;margin-top:1rem;">✅ إرسال الطلب</button>' +
          '<p id="order-msg" class="order-msg hidden"></p>' +
        '</div>' +
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
  } else { 
    if (err) err.classList.remove('hidden'); 
  }
}

function loadStats() {
  var c = window.supabaseClient; 
  if (!c) return Promise.resolve();
  
  return Promise.all([
    c.from('profiles').select('*', { count: 'exact', head: true }),
    c.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'قيد المراجعة')
  ]).then(function(results) {
    var u = results[0];
    var p = results[1];
    var su = document.getElementById('stat-users');
    var sp = document.getElementById('stat-pending');
    if (su) su.textContent = u.count || 0;
    if (sp) sp.textContent = p.count || 0;
  });
}

function loadUsersTable() {
  var c = window.supabaseClient; 
  if (!c) return;
  
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
        
        tr.innerHTML = '<td>' + u.name + '</td><td>' + u.phone + '</td><td>' + u.role + '</td><td>' + 
          new Date(u.created_at).toLocaleDateString('ar-IQ') + '</td><td style="color:' + getStatusColor(u.status) + '">' + 
          u.status + '</td><td>' + actions + '</td>';
        tbody.appendChild(tr);
      });
    }
    
    tbody.onclick = function(e) {
      var btn = e.target.closest('button[data-act]');
      if (!btn) return;
      var id = btn.dataset.id;
      var act = btn.dataset.act;
      if (act === 'activate') changeStatus(id, 'نشط');
      else if (act === 'block') changeStatus(id, 'محظور');
      else if (act === 'delete') deleteUser(id);
    };
  });
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
  return s === 'نشط' ? 'green' : s === 'قيد المراجعة' ? 'orange' : 'red'; 
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
    var latEl = document.getElementById('order-lat');
    var lngEl = document.getElementById('order-lng');
    if (latEl) latEl.value = pos.lat;
    if (lngEl) lngEl.value = pos.lng;
  });
  
  map.on('click', function(e) {
    marker.setLatLng(e.latlng);
    var latEl = document.getElementById('order-lat');
    var lngEl = document.getElementById('order-lng');
    if (latEl) latEl.value = e.latlng.lat;
    if (lngEl) lngEl.value = e.latlng.lng;
  });
}

function bindOrderEvents() {
  var locBtn = document.getElementById('use-current-location');
  if (locBtn) locBtn.onclick = function() {
    getCurrentLocation().then(function(loc) {
      var latEl = document.getElementById('order-lat');
      var lngEl = document.getElementById('order-lng');
      if (latEl) latEl.value = loc.lat;
      if (lngEl) lngEl.value = loc.lng;
      if (typeof L !== 'undefined') {
        var mapEl = document.getElementById('order-map');
        if (mapEl) { 
          mapEl.innerHTML = ''; 
          initOrderMap(loc.lat, loc.lng); 
        }
      }
      alert('✅ تم تحديث الموقع');
    });
  };
  
  var submitBtn = document.getElementById('submit-order');
  if (submitBtn) submitBtn.onclick = function() {
    var client = window.supabaseClient;
    if (!client || !app.currentUser) return;
    
    var serviceTypeEl = document.querySelector('input[name="service-type"]:checked');
    var latEl = document.getElementById('order-lat');
    var lngEl = document.getElementById('order-lng');
    var notesEl = document.getElementById('order-notes');
    
    var serviceType = serviceTypeEl ? serviceTypeEl.value : '';
    var lat = latEl ? latEl.value : '';
    var lng = lngEl ? lngEl.value : '';
    var notes = notesEl ? notesEl.value || '' : '';
    
    var msgEl = document.getElementById('order-msg');
    
    if (!serviceType || !lat || !lng) { 
      showMsg(msgEl, 'يرجى تحديد الخدمة والموقع', 'error'); 
      return; 
    }
    
    client.from('orders').insert({
      user_id: app.currentUser.id, 
      service_type: serviceType,
      latitude: parseFloat(lat), 
      longitude: parseFloat(lng),
      notes: notes, 
      status: 'pending', 
      created_at: new Date().toISOString()
    }).then(function(res) {
      if (res.error) showMsg(msgEl, 'خطأ: ' + res.error.message, 'error');
      else { 
        showMsg(msgEl, '✅ تم إرسال الطلب', 'success'); 
        setTimeout(function() { loadActiveOrders(); }, 1000); 
      }
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
  
  c.innerHTML = 
    '<div class="welcome-card">' +
      '<h2>✏️ تعديل ملفي</h2>' +
      '<div class="form-group"><label>الاسم:</label><input type="text" id="edit-name" value="' + name + '"></div>' +
      '<div class="form-group"><label>الهاتف:</label><input type="tel" value="' + phone + '" disabled style="background:#f1f5f9;"></div>' +
      '<div class="form-group"><label>كلمة مرور جديدة (اختياري):</label><input type="password" id="edit-password" placeholder="اتركه فارغاً للإبقاء"></div>' +
      '<button id="save-profile" class="btn-primary">💾 حفظ</button>' +
      '<button id="cancel-edit" class="btn-back" style="margin-right:1rem;">إلغاء</button>' +
      '<p id="profile-msg" class="auth-msg hidden"></p>' +
    '</div>';
    
  document.getElementById('save-profile').onclick = saveProfile;
  document.getElementById('cancel-edit').onclick = function() { checkSession(); };
}

function saveProfile() {
  var client = window.supabaseClient;
  if (!client || !app.currentUser) return;
  
  var nameEl = document.getElementById('edit-name');
  var passwordEl = document.getElementById('edit-password');
  var msgEl = document.getElementById('profile-msg');
  
  var name = nameEl ? nameEl.value.trim() : '';
  var password = passwordEl ? passwordEl.value : '';
  
  if (!name) { 
    showMsg(msgEl, 'الاسم مطلوب', 'error'); 
    return; 
  }
  
  client.auth.updateUser({ data: { name: name } }).then(function(metaRes) {
    if (metaRes.error) throw metaRes.error;
    
    if (password) { 
      return client.auth.updateUser({ password: password }).then(function(passRes) { 
        if (passRes.error) throw passRes.error; 
      });
    }
    return Promise.resolve();
  }).then(function() {
    return client.from('profiles').update({ name: name }).eq('id', app.currentUser.id);
  }).then(function(profRes) {
    if (profRes.error) throw profRes.error;
    showMsg(msgEl, '✅ تم الحفظ', 'success');
    setTimeout(function() { checkSession(); }, 1500);
  }).catch(function(err) { 
    console.error(err); 
    showMsg(msgEl, err.message || 'خطأ', 'error'); 
  });
}

function loadActiveOrders() {
  var client = window.supabaseClient;
  if (!client || !app.currentUser) return;
  
  client.from('orders').select('*').eq('user_id', app.currentUser.id).eq('status', 'pending').order('created_at', { ascending: false }).then(function(res) {
    var orders = res.data;
    var listEl = document.getElementById('active-orders');
    
    if (!listEl) return;
    
    if (!orders || orders.length === 0) { 
      listEl.innerHTML = '<p style="color:#64748b;">لا توجد طلبات نشطة</p>'; 
      return; 
    }
    
    var html = '';
    orders.forEach(function(o) {
      var serviceName = o.service_type === 'taxi' ? '🚗 تكسي' : o.service_type === 'delivery' ? '🏍️ ديلفري' : '🛒 تسوق';
      html += '<div style="background:#fff;padding:1rem;border-radius:12px;margin:0.5rem 0;border:1px solid #e2e8f0;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;"><strong>' + serviceName + '</strong>' +
        '<span style="background:#f1f5f9;padding:0.25rem 0.75rem;border-radius:20px;font-size:0.85rem;">' + o.status + '</span></div>' +
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

// دوال عامة
window.updateUserStatus = changeStatus;
window.deleteUser = deleteUser;
