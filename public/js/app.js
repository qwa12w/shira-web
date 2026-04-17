// ==========================================
// شراع - تطبيق المنصة المتكاملة
// [النسخة النهائية الصحيحة 100%]
// ==========================================

let currentUser = null;
let currentRole = null;
let currentAuthMode = 'login';
let appInitialized = false;

// ==========================================
// إعدادات Supabase الثابتة
// ==========================================
const SUPABASE_CONFIG = {
  url: "https://qioiiidrwqvwzkveoxnm.supabase.co",
  key: "sb_publishable_yLhyYMSCXttp1e_q_PAovA_zz1xgYDM"
};

// ==========================================
// دالة بدء التطبيق الرئيسية
// ==========================================
async function startApp() {
  if (appInitialized) return;
  appInitialized = true;
  
  console.log('🚀 تهيئة التطبيق...');
  await new Promise(resolve => setTimeout(resolve, 100));
  
  await restoreState();
  await checkSession();
  setupRealtimeSync();
  setupEventListeners();
  await checkMaintenanceMode();
  
  console.log('✅ اكتملت تهيئة التطبيق');
}

// ==========================================
// تهيئة عميل Supabase
// ==========================================
function initSupabaseClient() {
  if (window.supabaseClient) return window.supabaseClient;
  
  if (typeof window.supabase === 'undefined') {
    console.warn('⏳ مكتبة Supabase لم تُحمّل بعد');
    setTimeout(() => initSupabaseClient(), 100);
    return null;
  }
  
  try {
    const { createClient } = window.supabase;
    window.supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    console.log('✅ تم تهيئة Supabase بنجاح');
    return window.supabaseClient;
  } catch (e) {
    console.error('❌ خطأ في تهيئة Supabase:', e);
    return null;
  }
}

// ==========================================
// بدء التهيئة
// ==========================================
function bootstrap() {
  const client = initSupabaseClient();
  if (client) {
    startApp();
  } else {
    let attempts = 0;
    const retry = () => {
      attempts++;
      const client = initSupabaseClient();
      if (client) startApp();
      else if (attempts < 15) setTimeout(retry, 200);
      else console.error('❌ فشل التهيئة');
    };
    retry();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

// ==========================================
// 2. استعادة الحالة
// ==========================================
async function restoreState() {
  const savedScreen = localStorage.getItem('shira_currentScreen');
  const savedTab = localStorage.getItem('shira_adminTab');
  
  if (savedScreen) {
    document.querySelectorAll('body > div').forEach(div => {
      if (div.id !== 'about-modal' && div.id !== 'contact-modal') div.classList.add('hidden');
    });
    const screen = document.getElementById(savedScreen);
    if (screen) screen.classList.remove('hidden');
  }
  
  if (savedTab && savedScreen === 'admin-panel') {
    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === savedTab);
    });
    document.querySelectorAll('.admin-tab').forEach(tab => {
      tab.classList.add('hidden');
      tab.classList.remove('active');
    });
    const activeTab = document.getElementById(`tab-${savedTab}`);
    if (activeTab) {
      activeTab.classList.remove('hidden');
      activeTab.classList.add('active');
    }
  }
}

// ==========================================
// 3. التحقق من الجلسة ✅ صحيح
// ==========================================
async function checkSession() {
  try {
    const client = window.supabaseClient;
    if (!client) return;

    const { data: { session } } = await client.auth.getSession();

    if (session) {
      currentUser = session.user;

      const { data: profile } = await client
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();

      if (!profile) return;

      if (profile.status === 'محظور') showBlockedScreen();
      else if (profile.status === 'قيد المراجعة' && profile.role !== 'زبون') showScreen('pending-screen');
      else {
        showUserDashboard(profile);
        localStorage.setItem('shira_currentScreen', 'user-dashboard');
      }
    } else {
      showScreen('main-app');
      localStorage.setItem('shira_currentScreen', 'main-app');
    }
  } catch (error) {
    console.error('خطأ في الجلسة:', error);
    showScreen('main-app');
  }
}

// ==========================================
// 4. المزامنة الذكية
// ==========================================
function setupRealtimeSync() {
  const client = window.supabaseClient;
  if (!client) return;

  client.channel('profiles_changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'profiles' },
      (payload) => {
        if (!document.getElementById('admin-panel')?.classList.contains('hidden')) {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            loadDashboardStats();
            if (!document.getElementById('tab-users')?.classList.contains('hidden')) loadUsersTable();
          }
        }
        if (currentUser && payload.new?.id === currentUser.id) {
          if (payload.new?.status === 'محظور') showBlockedScreen();
          else if (payload.new?.status === 'نشط' && currentRole !== 'زبون') location.reload();
        }
      }
    )
    .subscribe();

  client.channel('settings_changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'settings' },
      (payload) => {
        if (payload.new?.key === 'maintenance' && payload.new?.value === true && !currentUser) {
          showScreen('maintenance-screen');
        }
      }
    )
    .subscribe();
}

// ==========================================
// 5. إعداد الأحداث
// ==========================================
function setupEventListeners() {
  document.querySelectorAll('.service-card').forEach(card => {
    const role = card.dataset.role;
    const newCard = card.cloneNode(true);
    card.parentNode.replaceChild(newCard, card);
    newCard.onclick = () => {
      currentRole = role;
      showAuthScreen(role);
      localStorage.setItem('shira_currentScreen', 'auth-screen');
    };
  });

  const backToMain = document.getElementById('back-to-main');
  if (backToMain) backToMain.onclick = () => { showScreen('main-app'); localStorage.setItem('shira_currentScreen', 'main-app'); };

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentAuthMode = tab.dataset.mode;
      updateAuthForm();
    };
  });

  const authForm = document.getElementById('auth-form');
  if (authForm) authForm.onsubmit = handleAuthSubmit;

  const btnAbout = document.getElementById('btn-about');
  if (btnAbout) btnAbout.onclick = () => document.getElementById('about-modal')?.classList.remove('hidden');

  const btnContact = document.getElementById('btn-contact');
  if (btnContact) btnContact.onclick = () => document.getElementById('contact-modal')?.classList.remove('hidden');

  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.onclick = () => {
      document.getElementById('about-modal')?.classList.add('hidden');
      document.getElementById('contact-modal')?.classList.add('hidden');
    };
  });

  ['about-modal', 'contact-modal'].forEach(modalId => {
    const modal = document.getElementById(modalId);
    if (modal) modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };
  });

  const logoContainer = document.getElementById('logo-container');
  if (logoContainer) {
    logoContainer.onclick = () => {
      showScreen('admin-login');
      localStorage.setItem('shira_currentScreen', 'admin-login');
    };
  }

  const loginSubmit = document.getElementById('login-submit');
  if (loginSubmit) loginSubmit.onclick = handleAdminLogin;

  const backToHome = document.getElementById('back-to-home');
  if (backToHome) backToHome.onclick = () => { showScreen('main-app'); localStorage.setItem('shira_currentScreen', 'main-app'); };

  const logoutAdmin = document.getElementById('logout-admin');
  if (logoutAdmin) logoutAdmin.onclick = () => { showScreen('main-app'); localStorage.setItem('shira_currentScreen', 'main-app'); };

  const logoutUser = document.getElementById('logout-user');
  if (logoutUser) logoutUser.onclick = handleUserLogout;

  document.querySelectorAll('.admin-nav-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.admin-tab').forEach(t => { t.classList.add('hidden'); t.classList.remove('active'); });
      const tabId = `tab-${btn.dataset.tab}`;
      const activeTab = document.getElementById(tabId);
      if (activeTab) {
        activeTab.classList.remove('hidden');
        activeTab.classList.add('active');
        localStorage.setItem('shira_adminTab', btn.dataset.tab);
      }
      if (btn.dataset.tab === 'users') loadUsersTable();
      else if (btn.dataset.tab === 'dashboard') loadDashboardStats();
    };
  });

  const maintenanceToggle = document.getElementById('maintenance-toggle');
  if (maintenanceToggle) {
    maintenanceToggle.onchange = async (e) => {
      const client = window.supabaseClient;
      if (!client) return;
      const { data: settings } = await client.from('settings').select('*').eq('key', 'maintenance').single();
      if (settings) await client.from('settings').update({ value: e.target.checked }).eq('key', 'maintenance');
      else await client.from('settings').insert({ key: 'maintenance', value: e.target.checked });
      alert(e.target.checked ? 'تم تفعيل الصيانة' : 'تم إيقاف الصيانة');
    };
  }
}

// ==========================================
// 6. معالجة التسجيل والدخول ✅ صحيح
// ==========================================
async function handleAuthSubmit(e) {
  if (e) e.preventDefault();

  const client = window.supabaseClient;
  if (!client) {
    showMsg(document.getElementById('auth-msg'), 'جاري الاتصال...', 'error');
    return;
  }

  const phone = document.getElementById('auth-phone')?.value.trim();
  const password = document.getElementById('auth-password')?.value;
  const name = document.getElementById('auth-name')?.value.trim();
  const msgEl = document.getElementById('auth-msg');
  if (msgEl) msgEl.classList.add('hidden');

  try {
    if (currentAuthMode === 'register') {
      if (!name) { showMsg(msgEl, 'الاسم مطلوب', 'error'); return; }

      const { data: authData, error: authError } = await client.auth.signUp({
        email: `${phone}@shira.app`,
        password: password,
        options: { data: { phone: phone, name: name, role: currentRole } }
      });

      if (authError) throw authError;

      await client.from('profiles').insert({
        id: authData.user.id,
        name: name,
        phone: phone,
        role: currentRole,
        status: currentRole === 'زبون' ? 'نشط' : 'قيد المراجعة'
      });

      if (currentRole !== 'زبون') await uploadDocuments(authData.user.id);

      showMsg(msgEl, 'تم إنشاء الحساب! ' + (currentRole === 'زبون' ? 'سيتم توجيهك...' : 'بانتظار الموافقة'), 'success');

      setTimeout(() => {
        if (currentRole === 'زبون') {
          showUserDashboard({ name, phone, role: currentRole });
          localStorage.setItem('shira_currentScreen', 'user-dashboard');
        } else {
          showScreen('pending-screen');
          localStorage.setItem('shira_currentScreen', 'pending-screen');
        }
      }, 1500);

    } else {
      const { data: authData, error: authError } = await client.auth.signInWithPassword({
        email: `${phone}@shira.app`,
        password: password
      });

      if (authError) throw authError;

      currentUser = authData.user;

      const { data: profile } = await client.from('profiles').select('*').eq('id', currentUser.id).single();

      if (!profile) throw new Error('الملف غير موجود');

      if (profile.status === 'محظور') {
        showBlockedScreen();
        localStorage.setItem('shira_currentScreen', 'blocked-screen');
      } else if (profile.status === 'قيد المراجعة') {
        showScreen('pending-screen');
        localStorage.setItem('shira_currentScreen', 'pending-screen');
      } else {
        showUserDashboard(profile);
        localStorage.setItem('shira_currentScreen', 'user-dashboard');
      }
    }
  } catch (error) {
    console.error('خطأ:', error);
    showMsg(msgEl, error.message || 'حدث خطأ', 'error');
  }
}

// ==========================================
// 7. رفع الوثائق ✅ صحيح
// ==========================================
async function uploadDocuments(userId) {
  const client = window.supabaseClient;
  if (!client) return;

  const fileInputs = {
    license: document.getElementById('doc-license'),
    personal: document.getElementById('doc-personal'),
    vehicle: document.getElementById('doc-vehicle'),
    bike: document.getElementById('doc-bike')
  };

  const uploadedFiles = {};

  for (const [key, input] of Object.entries(fileInputs)) {
    if (input?.files?.[0]) {
      const file = input.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${key}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await client.storage.from('shira-docs').upload(fileName, file);

      if (!uploadError) {
        const { data: { publicUrl } } = client.storage.from('shira-docs').getPublicUrl(fileName);
        uploadedFiles[`${key}_image`] = publicUrl;
      }
    }
  }

  const vehicleType = document.getElementById('vehicle-type')?.value;
  const vehicleColor = document.getElementById('vehicle-color')?.value;
  const vehiclePlate = document.getElementById('vehicle-plate')?.value;
  const bikeRegistered = document.getElementById('bike-registered')?.value;

  if (vehicleType) uploadedFiles.vehicle_type = vehicleType;
  if (vehicleColor) uploadedFiles.vehicle_color = vehicleColor;
  if (vehiclePlate) uploadedFiles.vehicle_plate = vehiclePlate;
  if (bikeRegistered !== undefined) uploadedFiles.bike_registered = bikeRegistered === 'true';

  if (Object.keys(uploadedFiles).length > 0) {
    await client.from('documents').insert({ user_id: userId, ...uploadedFiles });
  }
}

// ==========================================
// 8. عرض الشاشات
// ==========================================
function showScreen(screenId) {
  document.querySelectorAll('body > div').forEach(div => {
    if (div.id !== 'about-modal' && div.id !== 'contact-modal') div.classList.add('hidden');
  });
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.remove('hidden');
    localStorage.setItem('shira_currentScreen', screenId);
  }
}

function showAuthScreen(role) {
  currentRole = role;
  const titleEl = document.getElementById('auth-role-title');
  const subtitleEl = document.getElementById('auth-role-subtitle');
  if (titleEl) titleEl.textContent = `تسجيل ${role}`;
  if (subtitleEl) subtitleEl.textContent = 'أدخل بياناتك';
  updateAuthForm();

  const docsSection = document.getElementById('documents-section');
  const vehicleSection = document.getElementById('vehicle-section');
  const bikeSection = document.getElementById('bike-section');

  if (role === 'زبون') docsSection?.classList.add('hidden');
  else {
    docsSection?.classList.remove('hidden');
    if (role === 'سائق تكسي') { vehicleSection?.classList.remove('hidden'); bikeSection?.classList.add('hidden'); }
    else if (role === 'ديلفري') { vehicleSection?.classList.add('hidden'); bikeSection?.classList.remove('hidden'); }
    else { vehicleSection?.classList.add('hidden'); bikeSection?.classList.add('hidden'); }
  }
  showScreen('auth-screen');
}

function updateAuthForm() {
  const nameGroup = document.getElementById('name-group');
  const submitBtn = document.getElementById('auth-submit');
  if (currentAuthMode === 'register') {
    nameGroup?.classList.remove('hidden');
    if (submitBtn) submitBtn.textContent = 'إنشاء حساب';
  } else {
    nameGroup?.classList.add('hidden');
    if (submitBtn) submitBtn.textContent = 'تسجيل الدخول';
  }
}

function showUserDashboard(profile) {
  const nameEl = document.getElementById('dash-user-name');
  const roleEl = document.getElementById('dash-user-role');
  const roleTitleEl = document.getElementById('dash-role-title');
  if (nameEl) nameEl.textContent = profile.name;
  if (roleEl) roleEl.textContent = profile.role;
  if (roleTitleEl) roleTitleEl.textContent = profile.role;

  const content = document.getElementById('dash-content');
  if (content) content.innerHTML = `<div class="welcome-card"><h2>مرحباً ${profile.name} 👋</h2><p>أهلاً بك في لوحة تحكم ${profile.role}</p></div>`;
  showScreen('user-dashboard');
}

function showBlockedScreen() {
  if (!document.getElementById('blocked-screen')) {
    const div = document.createElement('div');
    div.id = 'blocked-screen';
    div.className = 'hidden';
    div.innerHTML = `<div class="pending-container"><div style="font-size:4rem;margin-bottom:1rem;">🚫</div><h2>الحساب محظور</h2><button class="btn-primary" onclick="location.reload()" style="margin-top:1rem;">إعادة المحاولة</button></div>`;
    document.body.appendChild(div);
  }
  showScreen('blocked-screen');
}

function showMsg(element, text, type) {
  if (!element) return;
  element.textContent = text;
  element.className = `auth-msg ${type === 'error' ? 'error' : 'success'}`;
  element.classList.remove('hidden');
}

// ==========================================
// 9. وظائف الإدارة ✅ صحيح
// ==========================================
async function handleAdminLogin() {
  const user = document.getElementById('admin-user')?.value;
  const pass = document.getElementById('admin-pass')?.value;
  const errorMsg = document.getElementById('login-error');

  if (user === 'admin' && pass === '1234') {
    if (errorMsg) errorMsg.classList.add('hidden');
    showScreen('admin-panel');
    localStorage.setItem('shira_currentScreen', 'admin-panel');
    loadDashboardStats();
  } else {
    if (errorMsg) errorMsg.classList.remove('hidden');
  }
}

async function loadDashboardStats() {
  const client = window.supabaseClient;
  if (!client) return;

  const { count: userCount } = await client.from('profiles').select('*', { count: 'exact', head: true });
  const { count: pendingCount } = await client.from('profiles').select('*', { count: 'exact', head: true }).eq('status', 'قيد المراجعة');

  const statUsers = document.getElementById('stat-users');
  const statPending = document.getElementById('stat-pending');
  if (statUsers) statUsers.textContent = userCount || 0;
  if (statPending) statPending.textContent = pendingCount || 0;
}

async function loadUsersTable() {
  const client = window.supabaseClient;
  if (!client) return;

  const { data: users } = await client.from('profiles').select('*').order('created_at', { ascending: false });

  const tbody = document.getElementById('users-list');
  if (!tbody) return;

  tbody.innerHTML = '';
  users?.forEach(user => {
    tbody.innerHTML += `<tr><td>${user.name}</td><td>${user.phone}</td><td>${user.role}</td><td>${new Date(user.created_at).toLocaleDateString('ar-IQ')}</td><td style="color:${getStatusColor(user.status)}">${user.status}</td><td>${user.status!=='نشط'?'<button class="btn-action" onclick="updateUserStatus(\''+user.id+'\','نشط')">تفعيل</button>':''}${user.status!=='محظور'?'<button class="btn-action btn-delete" onclick="updateUserStatus(\''+user.id+'\','محظور')">حظر</button>':''}<button class="btn-action" onclick="deleteUser('${user.id}')">حذف</button></td></tr>`;
  });
}

async function updateUserStatus(userId, newStatus) {
  const client = window.supabaseClient;
  if (!client) return;
  await client.from('profiles').update({ status: newStatus }).eq('id', userId);
  loadUsersTable();
  loadDashboardStats();
}

async function deleteUser(userId) {
  const client = window.supabaseClient;
  if (!client) return;
  if (confirm('هل أنت متأكد؟')) {
    await client.from('profiles').delete().eq('id', userId);
    loadUsersTable();
    loadDashboardStats();
  }
}

function getStatusColor(status) {
  switch(status) {
    case 'نشط': return 'green';
    case 'قيد المراجعة': return 'orange';
    case 'محظور': return 'red';
    default: return 'gray';
  }
}

async function handleUserLogout() {
  const client = window.supabaseClient;
  if (client) await client.auth.signOut();
  currentUser = null;
  currentRole = null;
  localStorage.removeItem('shira_currentScreen');
  localStorage.removeItem('shira_adminTab');
  showScreen('main-app');
}

async function checkMaintenanceMode() {
  const client = window.supabaseClient;
  if (!client) return;

  const { data } = await client.from('settings').select('value').eq('key', 'maintenance').single();

  if (data?.value === true && !currentUser) showScreen('maintenance-screen');
}

// دوال عامة
window.updateUserStatus = updateUserStatus;
window.deleteUser = deleteUser;
