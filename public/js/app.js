// ==========================================
// شراع - تطبيق المنصة المتكاملة
// [النسخة النهائية الكاملة - مصححة 100%]
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
  
  // انتظار قصير لضمان جاهزية المتصفح
  await new Promise(resolve => setTimeout(resolve, 100));
  
  await restoreState();
  await checkSession();
  setupRealtimeSync();
  setupEventListeners();
  await checkMaintenanceMode();
  
  console.log('✅ اكتملت تهيئة التطبيق');
}

// ==========================================
// تهيئة عميل Supabase - دالة مضمونة
// ==========================================
function initSupabaseClient() {
  if (window.supabaseClient) return window.supabaseClient;
  
  if (typeof window.supabase === 'undefined') {
    console.warn('⏳ مكتبة Supabase لم تُحمّل بعد، إعادة المحاولة...');
    setTimeout(() => initSupabaseClient(), 100);
    return null;
  }
  
  try {
    const { createClient } = window.supabase;
    window.supabaseClient = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);
    console.log('✅ تم تهيئة عميل Supabase بنجاح');
    return window.supabaseClient;
  } catch (e) {
    console.error('❌ خطأ في تهيئة Supabase:', e);
    return null;
  }
}

// ==========================================
// بدء التهيئة عند جاهزية الصفحة
// ==========================================
function bootstrap() {
  const client = initSupabaseClient();
  if (client) {
    startApp();
  } else {
    // محاولة متكررة كل 200مللي ثانية
    let attempts = 0;
    const maxAttempts = 15;
    const retry = () => {
      attempts++;
      const client = initSupabaseClient();
      if (client) {
        startApp();
      } else if (attempts < maxAttempts) {
        setTimeout(retry, 200);
      } else {
        console.error('❌ فشل تهيئة التطبيق بعد محاولات متعددة');
      }
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
// 2. استعادة الحالة المحفوظة
// ==========================================
async function restoreState() {
  const savedScreen = localStorage.getItem('shira_currentScreen');
  const savedTab = localStorage.getItem('shira_adminTab');
  
  if (savedScreen) {
    // إخفاء كل الشاشات ما عدا النوافذ المنبثقة
    document.querySelectorAll('body > div').forEach(div => {
      if (div.id !== 'about-modal' && div.id !== 'contact-modal') {
        div.classList.add('hidden');
      }
    });
    // إظهار الشاشة المحفوظة
    const screen = document.getElementById(savedScreen);
    if (screen) screen.classList.remove('hidden');
  }
  
  // استعادة تبويب الإدارة إذا كان موجوداً
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
// 3. التحقق من الجلسة ✅ مصحح
// ==========================================
async function checkSession() {
  try {
    const client = window.supabaseClient;
    if (!client) return;
    
    // ✅ تصحيح: تفكيك صحيح للبيانات
    const {  { session } } = await client.auth.getSession();
    
    if (session) {
      currentUser = session.user;
      
      // ✅ تصحيح: تفكيك صحيح للبيانات
      const { data: profile } = await client
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      
      if (!profile) return;
      
      if (profile.status === 'محظور') {
        showBlockedScreen();
      } else if (profile.status === 'قيد المراجعة' && profile.role !== 'زبون') {
        showScreen('pending-screen');
      } else {
        showUserDashboard(profile);
        localStorage.setItem('shira_currentScreen', 'user-dashboard');
      }
    } else {
      showScreen('main-app');
      localStorage.setItem('shira_currentScreen', 'main-app');
    }
  } catch (error) {
    console.error('خطأ في التحقق من الجلسة:', error);
    showScreen('main-app');
  }
}

// ==========================================
// 4. المزامنة الذكية (Realtime) ✅ مصحح
// ==========================================
function setupRealtimeSync() {
  const client = window.supabaseClient;
  if (!client) return;
  
  // الاشتراك في تحديثات المستخدمين
  client.channel('profiles_changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'profiles' },
      (payload) => {
        console.log('🔄 تحديث في المستخدمين:', payload);
        
        // تحديث لوحة الإدارة إذا كانت مفتوحة
        if (!document.getElementById('admin-panel')?.classList.contains('hidden')) {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            loadDashboardStats();
            if (!document.getElementById('tab-users')?.classList.contains('hidden')) {
              loadUsersTable();
            }
          }
        }
        
        // إذا تأثر المستخدم الحالي
        if (currentUser && payload.new?.id === currentUser.id) {
          if (payload.new?.status === 'محظور') {
            showBlockedScreen();
          } else if (payload.new?.status === 'نشط' && currentRole !== 'زبون') {
            location.reload();
          }
        }
      }
    )
    .subscribe();
  
  // الاشتراك في تحديثات الإعدادات
  client.channel('settings_changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'settings' },
      (payload) => {
        if (payload.new?.key === 'maintenance' && payload.new?.value === true) {
          if (!currentUser) showScreen('maintenance-screen');
        }
      }
    )
    .subscribe();
  
  console.log('✅ تم تفعيل المزامنة الذكية');
}

// ==========================================
// 5. إعداد الأحداث ✅ مصحح
// ==========================================
function setupEventListeners() {
  console.log('🔗 ربط أحداث الأزرار...');
  
  // ✅ أزرار الخدمات الرئيسية
  document.querySelectorAll('.service-card').forEach(card => {
    const role = card.dataset.role;
    // استنساخ العنصر لتجنب تكرار المستمعات
    const newCard = card.cloneNode(true);
    card.parentNode.replaceChild(newCard, card);
    
    newCard.onclick = () => {
      console.log(`✅ نقر على: ${role}`);
      currentRole = role;
      showAuthScreen(role);
      localStorage.setItem('shira_currentScreen', 'auth-screen');
    };
  });
  
  // زر العودة للرئيسية
  const backToMain = document.getElementById('back-to-main');
  if (backToMain) {
    backToMain.onclick = () => {
      showScreen('main-app');
      localStorage.setItem('shira_currentScreen', 'main-app');
    };
  }
  
  // تبويبات التسجيل/الدخول
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentAuthMode = tab.dataset.mode;
      updateAuthForm();
    };
  });
  
  // نموذج التسجيل/الدخول
  const authForm = document.getElementById('auth-form');
  if (authForm) {
    authForm.onsubmit = handleAuthSubmit;
  }
  
  // زر "عن شراع"
  const btnAbout = document.getElementById('btn-about');
  if (btnAbout) {
    btnAbout.onclick = () => {
      document.getElementById('about-modal')?.classList.remove('hidden');
    };
  }
  
  // زر "تواصل معنا"
  const btnContact = document.getElementById('btn-contact');
  if (btnContact) {
    btnContact.onclick = () => {
      document.getElementById('contact-modal')?.classList.remove('hidden');
    };
  }
  
  // إغلاق النوافذ المنبثقة
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.onclick = () => {
      document.getElementById('about-modal')?.classList.add('hidden');
      document.getElementById('contact-modal')?.classList.add('hidden');
    };
  });
  
  // إغلاق النوافذ عند النقر خارجها
  ['about-modal', 'contact-modal'].forEach(modalId => {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.onclick = (e) => {
        if (e.target === modal) modal.classList.add('hidden');
      };
    }
  });
  
  // الشعار - دخول الإدارة
  const logoContainer = document.getElementById('logo-container');
  if (logoContainer) {
    logoContainer.onclick = () => {
      showScreen('admin-login');
      localStorage.setItem('shira_currentScreen', 'admin-login');
    };
  }
  
  // تسجيل دخول الإدارة
  const loginSubmit = document.getElementById('login-submit');
  if (loginSubmit) {
    loginSubmit.onclick = handleAdminLogin;
  }
  
  // زر العودة من شاشة الإدارة
  const backToHome = document.getElementById('back-to-home');
  if (backToHome) {
    backToHome.onclick = () => {
      showScreen('main-app');
      localStorage.setItem('shira_currentScreen', 'main-app');
    };
  }
  
  // تسجيل الخروج من الإدارة
  const logoutAdmin = document.getElementById('logout-admin');
  if (logoutAdmin) {
    logoutAdmin.onclick = () => {
      showScreen('main-app');
      localStorage.setItem('shira_currentScreen', 'main-app');
    };
  }
  
  // تسجيل الخروج من لوحة المستخدم
  const logoutUser = document.getElementById('logout-user');
  if (logoutUser) {
    logoutUser.onclick = handleUserLogout;
  }
  
  // التنقل في لوحة الإدارة
  document.querySelectorAll('.admin-nav-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      document.querySelectorAll('.admin-tab').forEach(t => {
        t.classList.add('hidden');
        t.classList.remove('active');
      });
      
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
  
  // وضع الصيانة
  const maintenanceToggle = document.getElementById('maintenance-toggle');
  if (maintenanceToggle) {
    maintenanceToggle.onchange = async (e) => {
      const client = window.supabaseClient;
      if (!client) return;
      
      // ✅ تصحيح: تفكيك صحيح
      const { data: settings } = await client
        .from('settings')
        .select('*')
        .eq('key', 'maintenance')
        .single();
      
      if (settings) {
        await client.from('settings').update({ value: e.target.checked }).eq('key', 'maintenance');
      } else {
        await client.from('settings').insert({ key: 'maintenance', value: e.target.checked });
      }
      alert(e.target.checked ? 'تم تفعيل وضع الصيانة' : 'تم إيقاف وضع الصيانة');
    };
  }
  
  console.log('✅ اكتمال ربط جميع الأحداث');
}

// ==========================================
// 6. معالجة التسجيل والدخول ✅ مصحح
// ==========================================
async function handleAuthSubmit(e) {
  if (e) e.preventDefault();
  
  const client = window.supabaseClient;
  if (!client) {
    showMsg(document.getElementById('auth-msg'), 'جاري الاتصال... يرجى الانتظار', 'error');
    return;
  }
  
  const phone = document.getElementById('auth-phone')?.value.trim();
  const password = document.getElementById('auth-password')?.value;
  const name = document.getElementById('auth-name')?.value.trim();
  const msgEl = document.getElementById('auth-msg');
  if (msgEl) msgEl.classList.add('hidden');
  
  try {
    if (currentAuthMode === 'register') {
      // تسجيل جديد
      if (!name) {
        showMsg(msgEl, 'الاسم مطلوب', 'error');
        return;
      }
      
      // ✅ تصحيح: تفكيك صحيح
      const {  authData, error: authError } = await client.auth.signUp({
        email: `${phone}@shira.app`,
        password: password,
        options: {
           { phone: phone, name: name, role: currentRole }
        }
      });
      
      if (authError) throw authError;
      
      await client.from('profiles').insert({
        id: authData.user.id,
        name: name,
        phone: phone,
        role: currentRole,
        status: currentRole === 'زبون' ? 'نشط' : 'قيد المراجعة'
      });
      
      // رفع الوثائق إذا لزم الأمر
      if (currentRole !== 'زبون') {
        await uploadDocuments(authData.user.id);
      }
      
      showMsg(msgEl, 'تم إنشاء الحساب بنجاح! ' + 
        (currentRole === 'زبون' ? 'سيتم توجيهك الآن...' : 'بانتظار موافقة الإدارة'), 'success');
      
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
      // تسجيل دخول
      // ✅ تصحيح: تفكيك صحيح
      const {  authData, error: authError } = await client.auth.signInWithPassword({
        email: `${phone}@shira.app`,
        password: password
      });
      
      if (authError) throw authError;
      
      currentUser = authData.user;
      
      // ✅ تصحيح: تفكيك صحيح
      const { data: profile } = await client
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      
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
    console.error('خطأ في المصادقة:', error);
    showMsg(msgEl, error.message || 'حدث خطأ، حاول مرة أخرى', 'error');
  }
}

// ==========================================
// 7. رفع الوثائق ✅ مصحح
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
      
      const { error: uploadError } = await client.storage
        .from('shira-docs')
        .upload(fileName, file);
      
      if (!uploadError) {
        // ✅ تصحيح: تفكيك صحيح
        const { data: { publicUrl } } = client.storage
          .from('shira-docs')
          .getPublicUrl(fileName);
        uploadedFiles[`${key}_image`] = publicUrl;
      }
    }
  }
  
  // بيانات إضافية
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
    if (div.id !== 'about-modal' && div.id !== 'contact-modal') {
      div.classList.add('hidden');
    }
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
  if (subtitleEl) subtitleEl.textContent = 'أدخل بياناتك للمتابعة';
  updateAuthForm();
  
  // إظهار/إخفاء حقول الوثائق حسب الدور
  const docsSection = document.getElementById('documents-section');
  const vehicleSection = document.getElementById('vehicle-section');
  const bikeSection = document.getElementById('bike-section');
  
  if (role === 'زبون') {
    docsSection?.classList.add('hidden');
  } else {
    docsSection?.classList.remove('hidden');
    if (role === 'سائق تكسي') {
      vehicleSection?.classList.remove('hidden');
      bikeSection?.classList.add('hidden');
    } else if (role === 'ديلفري') {
      vehicleSection?.classList.add('hidden');
      bikeSection?.classList.remove('hidden');
    } else {
      vehicleSection?.classList.add('hidden');
      bikeSection?.classList.add('hidden');
    }
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
  if (content) {
    content.innerHTML = `
      <div class="welcome-card">
        <h2>مرحباً ${profile.name} 👋</h2>
        <p>أهلاً بك في لوحة تحكم ${profile.role}</p>
        <p style="margin-top:1rem;color:#64748b;">سيتم تفعيل الخدمات التفصيلية قريباً</p>
      </div>
    `;
  }
  showScreen('user-dashboard');
}

function showBlockedScreen() {
  if (!document.getElementById('blocked-screen')) {
    const blockedDiv = document.createElement('div');
    blockedDiv.id = 'blocked-screen';
    blockedDiv.className = 'hidden';
    blockedDiv.innerHTML = `
      <div class="pending-container" style="text-align:center;padding:3rem;">
        <div style="font-size:4rem;margin-bottom:1rem;">🚫</div>
        <h2>الحساب محظور</h2>
        <p>تم حظر هذا الحساب من قبل الإدارة</p>
        <p style="margin-top:1rem;color:#64748b;">تواصل مع الإدارة لحل المشكلة</p>
        <button class="btn-primary" onclick="location.reload()" style="margin-top:1rem;">إعادة المحاولة</button>
      </div>
    `;
    document.body.appendChild(blockedDiv);
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
// 9. وظائف الإدارة ✅ مصحح
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
  
  const { count: userCount } = await client
    .from('profiles')
    .select('*', { count: 'exact', head: true });
  
  const { count: pendingCount } = await client
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'قيد المراجعة');
  
  const statUsers = document.getElementById('stat-users');
  const statPending = document.getElementById('stat-pending');
  if (statUsers) statUsers.textContent = userCount || 0;
  if (statPending) statPending.textContent = pendingCount || 0;
}

async function loadUsersTable() {
  const client = window.supabaseClient;
  if (!client) return;
  
  // ✅ تصحيح: تفكيك صحيح
  const { data: users } = await client
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  
  const tbody = document.getElementById('users-list');
  if (!tbody) return;
  
  tbody.innerHTML = '';
  users?.forEach(user => {
    tbody.innerHTML += `
      <tr>
        <td>${user.name}</td>
        <td>${user.phone}</td>
        <td>${user.role}</td>
        <td>${new Date(user.created_at).toLocaleDateString('ar-IQ')}</td>
        <td style="color:${getStatusColor(user.status)}">${user.status}</td>
        <td>
          ${user.status !== 'نشط' ? `<button class="btn-action" onclick="updateUserStatus('${user.id}','نشط')">تفعيل</button>` : ''}
          ${user.status !== 'محظور' ? `<button class="btn-action btn-delete" onclick="updateUserStatus('${user.id}','محظور')">حظر</button>` : ''}
          <button class="btn-action" onclick="deleteUser('${user.id}')">حذف</button>
        </td>
      </tr>
    `;
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
  if (confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
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
  
  const { data } = await client
    .from('settings')
    .select('value')
    .eq('key', 'maintenance')
    .single();
  
  if (data?.value === true && !currentUser) {
    showScreen('maintenance-screen');
  }
}

// ==========================================
// دوال عامة متاحة عالمياً
// ==========================================
window.updateUserStatus = updateUserStatus;
window.deleteUser = deleteUser;
