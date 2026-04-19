// ==========================================
// شراع - التطبيق (النسخة النهائية المصححة)
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

function bootstrap() {
  var client = initSupabase();
  if (client) startApp();
  else setTimeout(bootstrap, 200);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootstrap);
else bootstrap();

// دالة التنقل بين الشاشات
function showScreen(id) {
  document.querySelectorAll('body > div').forEach(function(el) {
    // نستثني المودالات والشاشات الثابتة
    if (el.id !== 'about-modal' && el.id !== 'contact-modal') el.classList.add('hidden');
  });
  var target = document.getElementById(id);
  if (target) {
    target.classList.remove('hidden');
    if (id !== 'main-app' && id !== 'auth-screen') localStorage.setItem('shira_screen', id);
  }
  window.scrollTo(0, 0);
}

function startApp() {
  if (app.ready) return;
  app.ready = true;
  
  // 1. ربط أزرار الخدمات (تكسي، زبون، ديلفري، بائع)
  document.querySelectorAll('.service-card').forEach(function(card) {
    card.onclick = function() {
      app.currentRole = card.dataset.role;
      localStorage.setItem('shira_role', app.currentRole);
      showAuthScreen(app.currentRole);
      showScreen('auth-screen');
    };
  });
  
  // 2. ربط شعار الإدارة (شراع)
  var logo = document.getElementById('logo-container');
  if (logo) {
    logo.onclick = function() {
      showScreen('admin-login');
    };
  }
  
  // 3. ربط أزرار التسجيل (دخول / حساب جديد)
  document.querySelectorAll('.auth-tab').forEach(function(tab) {
    tab.onclick = function() {
      document.querySelectorAll('.auth-tab').forEach(function(t) { t.classList.remove('active'); });
      tab.classList.add('active');
      app.authMode = tab.dataset.mode;
      updateAuthForm();
    };
  });
  
  // 4. نموذج التسجيل
  var form = document.getElementById('auth-form');
  if (form) form.onsubmit = handleAuth;
  
  // 5. زر الرجوع
  var backBtn = document.getElementById('back-to-main');
  if (backBtn) backBtn.onclick = function() { showScreen('main-app'); };
  
  // 6. زر دخول الإدارة
  var loginBtn = document.getElementById('login-submit');
  if (loginBtn) loginBtn.onclick = handleAdminLogin;

  console.log('✅ App Started & Buttons Active');
}

function showAuthScreen(role) {
  var title = document.getElementById('auth-role-title');
  if (title) title.textContent = 'تسجيل ' + role;
  updateAuthForm();
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

async function handleAuth(e) {
  e.preventDefault();
  var client = window.supabaseClient;
  if (!client) { alert('جاري الاتصال بقاعدة البيانات...'); return; }
  
  var phone = document.getElementById('auth-phone').value.trim();
  var pass = document.getElementById('auth-password').value;
  var name = document.getElementById('auth-name').value.trim();
  
  if (!phone || !pass) { alert('يرجى إدخال رقم الهاتف وكلمة المرور'); return; }
  
  var currentRole = app.currentRole || 'زبون';
  
  try {
    if (app.authMode === 'register') {
      if (!name) { alert('يرجى إدخال الاسم'); return; }
      
      var res = await client.auth.signUp({
        email: phone + '@shira.app',
        password: pass,
        options: { data: { phone: phone, name: name, role: currentRole } }
      });
      
      if (res.error) throw res.error;
      
      var userId = res.data.user.id;
      await client.from('profiles').insert({
        id: userId, name: name, phone: phone, role: currentRole,
        status: currentRole === 'زبون' ? 'نشط' : 'قيد المراجعة'
      });
      
      alert('✅ تم إنشاء الحساب بنجاح');
      if (currentRole === 'زبون') {
        app.currentUser = res.data.user;
        showScreen('user-dashboard');
      } else {
        showScreen('pending-screen');
      }
    } else {
      var res = await client.auth.signInWithPassword({
        email: phone + '@shira.app',
        password: pass
      });
      
      if (res.error) throw res.error;
      
      app.currentUser = res.data.user;
      var prof = await client.from('profiles').select('*').eq('id', app.currentUser.id).single();
      
      if (prof.error) throw prof.error;
      var p = prof.data;
      
      if (p.status === 'محظور') showScreen('blocked-screen');
      else if (p.status === 'قيد المراجعة') showScreen('pending-screen');
      else showScreen('user-dashboard');
    }
  } catch (err) {
    alert('❌ خطأ: ' + err.message);
  }
}

function handleLogout() {
  var c = window.supabaseClient;
  if (c) c.auth.signOut();
  app.currentUser = null;
  showScreen('main-app');
}

// دوال الإدارة
function handleAdminLogin() {
  var u = document.getElementById('admin-user').value.trim();
  var p = document.getElementById('admin-pass').value;
  var err = document.getElementById('login-error');
  
  if (u === 'علي' && p === 'جنده') {
    localStorage.setItem('shira_admin_logged', 'true');
    if (err) err.style.display = 'none';
    showScreen('admin-panel');
    loadStats();
  } else {
    if (err) err.style.display = 'block';
  }
}

function loadStats() {
  var c = window.supabaseClient;
  if (!c) return;
  
  c.from('profiles').select('*', { count: 'exact', head: true }).then(function(r) {
    var el = document.getElementById('stat-users');
    if (el) el.textContent = r.count || 0;
  });
  
  c.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'قيد المراجعة').then(function(r) {
    var el = document.getElementById('stat-pending');
    if (el) el.textContent = r.count || 0;
  });
}

function showActivationModal(userId) {
  var months = prompt("عدد الأشهر للتفعيل:", "1");
  if (!months) return;
  
  var client = window.supabaseClient;
  var expiryDate = new Date();
  expiryDate.setMonth(expiryDate.getMonth() + parseInt(months));
  
  client.from('profiles').update({
    status: 'نشط',
    subscription_expiry: expiryDate.toISOString()
  }).eq('id', userId).then(function(res) {
    if (res.error) alert('خطأ: ' + res.error.message);
    else {
      alert('✅ تم التفعيل لمدة ' + months + ' أشهر');
      loadStats();
    }
  });
}

function loadUsersTable() {
  var c = window.supabaseClient;
  if (!c) return;
  
  c.from('profiles').select('*').order('created_at', { ascending: false }).then(function(res) {
    if (res.error) return;
    var tbody = document.getElementById('users-list');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    if (res.data) {
      res.data.forEach(function(u) {
        var tr = document.createElement('tr');
        var actions = '';
        
        if (u.status === 'قيد المراجعة') {
          actions = '<button onclick="showActivationModal(\'' + u.id + '\')" style="background:#fef3c7;color:#d97706;padding:5px 10px;border-radius:6px;border:none;cursor:pointer;">⏳ تفعيل</button>';
        }
        
        tr.innerHTML = '<td>' + u.name + '</td><td>' + u.phone + '</td><td>' + u.role + '</td><td>' + u.status + '</td><td>' + actions + '</td>';
        tbody.appendChild(tr);
      });
    }
  });
}

// جعل الدوال متاحة عالمياً
window.showScreen = showScreen;
window.handleLogout = handleLogout;
window.showActivationModal = showActivationModal;
window.loadUsersTable = loadUsersTable;
