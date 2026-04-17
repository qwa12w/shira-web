// ==========================================
// شراع - تطبيق المنصة المتكاملة
// مع المزامنة الذكية والحفاظ على الحالة
// [نسخة مصححة - تفعيل الأزرار]
// ==========================================

let currentUser = null;
let currentRole = null;
let currentAuthMode = 'login';

// ==========================================
// 1. التهيئة عند تحميل الصفحة
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 تهيئة التطبيق...');
  
  // ✅ التأكد من تهيئة Supabase قبل أي استخدام
  if (typeof window.supabaseClient === 'undefined') {
    console.error('❌ لم يتم تهيئة عميل Supabase، تحقق من js/database.js');
    return;
  }
  
  await restoreState();
  await checkSession();
  setupRealtimeSync();
  setupEventListeners();
  await checkMaintenanceMode();
});

// ==========================================
// 2. استعادة الحالة المحفوظة
// ==========================================
async function restoreState() {
  const savedScreen = localStorage.getItem('shira_currentScreen');
  const savedTab = localStorage.getItem('shira_adminTab');
  
  if (savedScreen) {
    const screen = document.getElementById(savedScreen);
    if (screen) {
      document.querySelectorAll('body > div').forEach(div => {
        if (div.id !== 'about-modal' && div.id !== 'contact-modal') div.classList.add('hidden');
      });
      screen.classList.remove('hidden');
    }
  }
  
  if (savedTab && savedScreen === 'admin-panel') {
    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
      btn.classList.remove('active');
      if (btn.dataset.tab === savedTab) btn.classList.add('active');
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
// 3. التحقق من الجلسة
// ==========================================
async function checkSession() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
      currentUser = session.user;
      
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      
      if (profile) {
        if (profile.status === 'محظور') {
          showBlockedScreen();
        } else if (profile.status === 'قيد المراجعة' && profile.role !== 'زبون') {
          showScreen('pending-screen');
        } else {
          showUserDashboard(profile);
          localStorage.setItem('shira_currentScreen', 'user-dashboard');
        }
      }
    } else {
      showScreen('main-app');
      localStorage.setItem('shira_currentScreen', 'main-app');
    }
  } catch (error) {
    console.error('خطأ في التحقق من الجلسة:', error);
    showScreen('main-app');
    localStorage.setItem('shira_currentScreen', 'main-app');
  }
}

// ==========================================
// 4. المزامنة الذكية (Realtime)
// ==========================================
function setupRealtimeSync() {
  if (!window.supabaseClient) return;
  
  supabaseClient
    .channel('profiles_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'profiles' },
      (payload) => {
        console.log('🔄 تحديث في المستخدمين:', payload);
        
        if (!document.getElementById('admin-panel')?.classList.contains('hidden')) {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            loadDashboardStats();
            if (!document.getElementById('tab-users')?.classList.contains('hidden')) {
              loadUsersTable();
            }
          }
        }
        
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
  
  supabaseClient
    .channel('settings_changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'settings' },
      (payload) => {
        if (payload.new?.key === 'maintenance') {
          if (payload.new?.value === true) {
            showScreen('maintenance-screen');
          }
        }
      }
    )
    .subscribe();
  
  console.log('✅ تم تفعيل المزامنة الذكية');
}

// ==========================================
// 5. إعداد الأحداث ✅ تم الإصلاح
// ==========================================
function setupEventListeners() {
  console.log('🔗 ربط أحداث الأزرار...');
  
  // ✅ النقر على بطاقات الخدمات - الإصلاح الرئيسي
  const serviceCards = document.querySelectorAll('.service-card');
  console.log(`📦 تم العثور على ${serviceCards.length} بطاقة خدمة`);
  
  serviceCards.forEach((card, index) => {
    const role = card.dataset.role;
    console.log(`🔗 ربط بطاقة #${index + 1}: ${role}`);
    
    card.addEventListener('click', () => {
      console.log(`✅ نقر على: ${role}`);
      currentRole = role;
      showAuthScreen(currentRole);
      localStorage.setItem('shira_currentScreen', 'auth-screen');
    });
  });
  
  // زر العودة للرئيسية
  document.getElementById('back-to-main')?.addEventListener('click', () => {
    showScreen('main-app');
    localStorage.setItem('shira_currentScreen', 'main-app');
  });
  
  // التبويبات (دخول / تسجيل)
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentAuthMode = tab.dataset.mode;
      updateAuthForm();
    });
  });
  
  // نموذج التسجيل/الدخول
  document.getElementById('auth-form')?.addEventListener('submit', handleAuthSubmit);
  
  // زر "عن شراع"
  document.getElementById('btn-about')?.addEventListener('click', () => {
    document.getElementById('about-modal')?.classList.remove('hidden');
  });
  
  // زر "تواصل معنا"
  document.getElementById('btn-contact')?.addEventListener('click', () => {
    document.getElementById('contact-modal')?.classList.remove('hidden');
  });
  
  // إغلاق النوافذ المنبثقة
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('about-modal')?.classList.add('hidden');
      document.getElementById('contact-modal')?.classList.add('hidden');
    });
  });
  
  // إغلاق النوافذ عند النقر خارجها
  ['about-modal', 'contact-modal'].forEach(modalId => {
    const modal = document.getElementById(modalId);
    modal?.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  });
  
  // الشعار - دخول الإدارة
  document.getElementById('logo-container')?.addEventListener('click', () => {
    showScreen('admin-login');
    localStorage.setItem('shira_currentScreen', 'admin-login');
  });
  
  // تسجيل دخول الإدارة
  document.getElementById('login-submit')?.addEventListener('click', handleAdminLogin);
  
  document.getElementById('back-to-home')?.addEventListener('click', () => {
    showScreen('main-app');
    localStorage.setItem('shira_currentScreen', 'main-app');
  });
  
  // تسجيل الخروج من الإدارة
  document.getElementById('logout-admin')?.addEventListener('click', () => {
    showScreen('main-app');
    localStorage.setItem('shira_currentScreen', 'main-app');
  });
  
  // تسجيل الخروج من لوحة المستخدم
  document.getElementById('logout-user')?.addEventListener('click', handleUserLogout);
  
  // التنقل في لوحة الإدارة - مع الحفظ
  document.querySelectorAll('.admin-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
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
      
      if (btn.dataset.tab === 'users') {
        loadUsersTable();
      } else if (btn.dataset.tab === 'dashboard') {
        loadDashboardStats();
      }
    });
  });
  
  // وضع الصيانة
  document.getElementById('maintenance-toggle')?.addEventListener('change', async (e) => {
    const { data: settings } = await supabaseClient
      .from('settings')
      .select('*')
      .eq('key', 'maintenance')
      .single();
    
    if (settings) {
      await supabaseClient
        .from('settings')
        .update({ value: e.target.checked })
        .eq('key', 'maintenance');
    } else {
      await supabaseClient
        .from('settings')
        .insert({ key: 'maintenance', value: e.target.checked });
    }
    
    alert(e.target.checked ? 'تم تفعيل وضع الصيانة' : 'تم إيقاف وضع الصيانة');
  });
  
  console.log('✅ اكتمال ربط جميع الأحداث');
}

// ==========================================
// 6. معالجة التسجيل والدخول
// ==========================================
async function handleAuthSubmit(e) {
  e.preventDefault();
  
  const phone = document.getElementById('auth-phone').value.trim();
  const password = document.getElementById('auth-password').value;
  const name = document.getElementById('auth-name')?.value.trim();
  
  const msgEl = document.getElementById('auth-msg');
  msgEl.classList.add('hidden');
  
  try {
    if (currentAuthMode === 'register') {
      if (!name) {
        showMsg(msgEl, 'الاسم مطلوب', 'error');
        return;
      }
      
      const { data: authData, error: authError } = await supabaseClient.auth.signUp({
        email: `${phone}@shira.app`,
        password: password,
        options: {
          data: {
            phone: phone,
            name: name,
            role: currentRole
          }
        }
      });
      
      if (authError) throw authError;
      
      const { error: profileError } = await supabaseClient
        .from('profiles')
        .insert({
          id: authData.user.id,
          name: name,
          phone: phone,
          role: currentRole,
          status: currentRole === 'زبون' ? 'نشط' : 'قيد المراجعة'
        });
      
      if (profileError) throw profileError;
      
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
      const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
        email: `${phone}@shira.app`,
        password: password
      });
      
      if (authError) throw authError;
      
      currentUser = authData.user;
      
      const { data: profile } = await supabaseClient
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
// 7. رفع الوثائق
// ==========================================
async function uploadDocuments(userId) {
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
      
      const { error: uploadError } = await supabaseClient.storage
        .from('shira-docs')
        .upload(fileName, file);
      
      if (uploadError) {
        console.error(`خطأ في رفع ${key}:`, uploadError);
      } else {
        const { data: { publicUrl } } = supabaseClient.storage
          .from('shira-docs')
          .getPublicUrl(fileName);
        
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
    await supabaseClient
      .from('documents')
      .insert({
        user_id: userId,
        ...uploadedFiles
      });
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
  document.getElementById('auth-role-title').textContent = `تسجيل ${role}`;
  document.getElementById('auth-role-subtitle').textContent = 'أدخل بياناتك للمتابعة';
  
  updateAuthForm();
  
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
}

function updateAuthForm() {
  const nameGroup = document.getElementById('name-group');
  const submitBtn = document.getElementById('auth-submit');
  
  if (currentAuthMode === 'register') {
    nameGroup?.classList.remove('hidden');
    submitBtn.textContent = 'إنشاء حساب';
  } else {
    nameGroup?.classList.add('hidden');
    submitBtn.textContent = 'تسجيل الدخول';
  }
}

function showUserDashboard(profile) {
  document.getElementById('dash-user-name').textContent = profile.name;
  document.getElementById('dash-user-role').textContent = profile.role;
  document.getElementById('dash-role-title').textContent = profile.role;
  
  const content = document.getElementById('dash-content');
  content.innerHTML = `
    <div class="welcome-card">
      <h2>مرحباً ${profile.name} 👋</h2>
      <p>أهلاً بك في لوحة تحكم ${profile.role}</p>
      <p style="margin-top: 1rem; color: #64748b;">سيتم تفعيل الخدمات التفصيلية قريباً</p>
    </div>
  `;
}

function showBlockedScreen() {
  const blockedDiv = document.createElement('div');
  blockedDiv.id = 'blocked-screen';
  blockedDiv.className = 'hidden';
  blockedDiv.innerHTML = `
    <div class="pending-container" style="text-align: center; padding: 3rem;">
      <div style="font-size: 4rem; margin-bottom: 1rem;">🚫</div>
      <h2>الحساب محظور</h2>
      <p>تم حظر هذا الحساب من قبل الإدارة</p>
      <p style="margin-top: 1rem; color: #64748b;">تواصل مع الإدارة لحل المشكلة</p>
      <button class="btn-primary" onclick="location.reload()" style="margin-top: 1rem;">إعادة المحاولة</button>
    </div>
  `;
  
  if (!document.getElementById('blocked-screen')) {
    document.body.appendChild(blockedDiv);
  }
  showScreen('blocked-screen');
}

function showMsg(element, text, type) {
  element.textContent = text;
  element.className = `auth-msg ${type === 'error' ? 'error' : 'success'}`;
  element.classList.remove('hidden');
}

// ==========================================
// 9. وظائف الإدارة
// ==========================================
async function handleAdminLogin() {
  const user = document.getElementById('admin-user').value;
  const pass = document.getElementById('admin-pass').value;
  const errorMsg = document.getElementById('login-error');
  
  if (user === 'admin' && pass === '1234') {
    errorMsg.classList.add('hidden');
    showScreen('admin-panel');
    localStorage.setItem('shira_currentScreen', 'admin-panel');
    loadDashboardStats();
  } else {
    errorMsg.classList.remove('hidden');
  }
}

async function loadDashboardStats() {
  const { count: userCount } = await supabaseClient
    .from('profiles')
    .select('*', { count: 'exact', head: true });
  
  const { count: pendingCount } = await supabaseClient
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'قيد المراجعة');
  
  document.getElementById('stat-users').textContent = userCount || 0;
  document.getElementById('stat-pending').textContent = pendingCount || 0;
}

async function loadUsersTable() {
  const { data: users } = await supabaseClient
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  
  const tbody = document.getElementById('users-list');
  tbody.innerHTML = '';
  
  users?.forEach(user => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${user.name}</td>
      <td>${user.phone}</td>
      <td>${user.role}</td>
      <td>${new Date(user.created_at).toLocaleDateString('ar-IQ')}</td>
      <td style="color: ${getStatusColor(user.status)}">${user.status}</td>
      <td>
        ${user.status !== 'نشط' ? `<button class="btn-action" onclick="updateUserStatus('${user.id}', 'نشط')">تفعيل</button>` : ''}
        ${user.status !== 'محظور' ? `<button class="btn-action btn-delete" onclick="updateUserStatus('${user.id}', 'محظور')">حظر</button>` : ''}
        <button class="btn-action" onclick="deleteUser('${user.id}')">حذف</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

async function updateUserStatus(userId, newStatus) {
  await supabaseClient
    .from('profiles')
    .update({ status: newStatus })
    .eq('id', userId);
  
  loadUsersTable();
  loadDashboardStats();
}

async function deleteUser(userId) {
  if (confirm('هل أنت متأكد من حذف هذا المستخدم؟')) {
    await supabaseClient
      .from('profiles')
      .delete()
      .eq('id', userId);
    
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
  await supabaseClient.auth.signOut();
  currentUser = null;
  currentRole = null;
  localStorage.removeItem('shira_currentScreen');
  localStorage.removeItem('shira_adminTab');
  showScreen('main-app');
}

async function checkMaintenanceMode() {
  const { data } = await supabaseClient
    .from('settings')
    .select('value')
    .eq('key', 'maintenance')
    .single();
  
  if (data?.value === true && !currentUser) {
    showScreen('maintenance-screen');
    localStorage.setItem('shira_currentScreen', 'maintenance-screen');
  }
}

// دوال عامة
window.updateUserStatus = updateUserStatus;
window.deleteUser = deleteUser;
