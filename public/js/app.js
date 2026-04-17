// ==========================================
// شراع - تطبيق المنصة المتكاملة
// ==========================================

let currentUser = null;
let currentRole = null;
let currentAuthMode = 'login';

// ==========================================
// 1. التهيئة عند تحميل الصفحة
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  console.log('🚀 تهيئة التطبيق...');
  
  // التحقق من وجود جلسة نشطة
  await checkSession();
  
  // إعداد الأحداث
  setupEventListeners();
  
  // التحقق من وضع الصيانة
  await checkMaintenanceMode();
});

// ==========================================
// 2. التحقق من الجلسة
// ==========================================
async function checkSession() {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    
    if (session) {
      currentUser = session.user;
      
      // جلب بيانات المستخدم من profiles
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      
      if (profile) {
        // التحقق من الحالة
        if (profile.status === 'محظور') {
          showBlockedScreen();
        } else if (profile.status === 'قيد المراجعة' && profile.role !== 'زبون') {
          showPendingScreen();
        } else {
          // دخول ناجح - توجيه للوحة التحكم
          showUserDashboard(profile);
        }
      }
    } else {
      // لا توجد جلسة - إظهار الصفحة الرئيسية
      showScreen('main-app');
    }
  } catch (error) {
    console.error('خطأ في التحقق من الجلسة:', error);
    showScreen('main-app');
  }
}

// ==========================================
// 3. إعداد الأحداث
// ==========================================
function setupEventListeners() {
  // النقر على بطاقات الخدمات
  document.querySelectorAll('.service-card').forEach(card => {
    card.addEventListener('click', () => {
      currentRole = card.dataset.role;
      showAuthScreen(currentRole);
    });
  });
  
  // زر العودة للرئيسية
  document.getElementById('back-to-main')?.addEventListener('click', () => {
    showScreen('main-app');
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
    document.getElementById('about-modal').classList.remove('hidden');
  });
  
  document.querySelector('.close-modal')?.addEventListener('click', () => {
    document.getElementById('about-modal').classList.add('hidden');
  });
  
  // الشعار - دخول الإدارة
  document.getElementById('logo-container')?.addEventListener('click', () => {
    showScreen('admin-login');
  });
  
  // تسجيل دخول الإدارة
  document.getElementById('login-submit')?.addEventListener('click', handleAdminLogin);
  
  document.getElementById('back-to-home')?.addEventListener('click', () => {
    showScreen('main-app');
  });
  
  // تسجيل الخروج من الإدارة
  document.getElementById('logout-admin')?.addEventListener('click', () => {
    showScreen('main-app');
  });
  
  // تسجيل الخروج من لوحة المستخدم
  document.getElementById('logout-user')?.addEventListener('click', handleUserLogout);
  
  // التنقل في لوحة الإدارة
  document.querySelectorAll('.admin-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('hidden'));
      document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
      
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
}

// ==========================================
// 4. معالجة التسجيل والدخول
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
      // تسجيل جديد
      if (!name) {
        showMsg(msgEl, 'الاسم مطلوب', 'error');
        return;
      }
      
      // إنشاء حساب في Supabase Auth
      const { data: authData, error: authError } = await supabaseClient.auth.signUp({
        email: `${phone}@shira.app`, // نستخدم الهاتف كإيميل
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
      
      // إنشاء سجل في profiles
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
      
      // إذا كان سائق/ديلفري/بائع - رفع الوثائق
      if (currentRole !== 'زبون') {
        await uploadDocuments(authData.user.id);
      }
      
      showMsg(msgEl, 'تم إنشاء الحساب بنجاح! ' + 
        (currentRole === 'زبون' ? 'سيتم توجيهك الآن...' : 'بانتظار موافقة الإدارة'), 'success');
      
      setTimeout(() => {
        if (currentRole === 'زبون') {
          checkSession();
        } else {
          showPendingScreen();
        }
      }, 1500);
      
    } else {
      // تسجيل دخول
      const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
        email: `${phone}@shira.app`,
        password: password
      });
      
      if (authError) throw authError;
      
      currentUser = authData.user;
      
      // جلب البيانات
      const { data: profile } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      
      if (!profile) throw new Error('الملف غير موجود');
      
      // التحقق من الحالة
      if (profile.status === 'محظور') {
        showBlockedScreen();
      } else if (profile.status === 'قيد المراجعة') {
        showPendingScreen();
      } else {
        showUserDashboard(profile);
      }
    }
  } catch (error) {
    console.error('خطأ في المصادقة:', error);
    showMsg(msgEl, error.message || 'حدث خطأ، حاول مرة أخرى', 'error');
  }
}

// ==========================================
// 5. رفع الوثائق
// ==========================================
async function uploadDocuments(userId) {
  const fileInputs = {
    license: document.getElementById('doc-license'),
    personal: document.getElementById('doc-personal'),
    vehicle: document.getElementById('doc-vehicle'),
    bike: document.getElementById('doc-bike')
  };
  
  const uploadedFiles = {};
  
  // رفع كل ملف
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
  
  // بيانات إضافية
  const vehicleType = document.getElementById('vehicle-type')?.value;
  const vehicleColor = document.getElementById('vehicle-color')?.value;
  const vehiclePlate = document.getElementById('vehicle-plate')?.value;
  const bikeRegistered = document.getElementById('bike-registered')?.value;
  
  if (vehicleType) uploadedFiles.vehicle_type = vehicleType;
  if (vehicleColor) uploadedFiles.vehicle_color = vehicleColor;
  if (vehiclePlate) uploadedFiles.vehicle_plate = vehiclePlate;
  if (bikeRegistered !== undefined) uploadedFiles.bike_registered = bikeRegistered === 'true';
  
  // حفظ في جدول documents
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
// 6. عرض الشاشات
// ==========================================
function showScreen(screenId) {
  document.querySelectorAll('body > div').forEach(div => {
    if (div.id !== 'about-modal') {
      div.classList.add('hidden');
    }
  });
  
  const screen = document.getElementById(screenId);
  if (screen) {
    screen.classList.remove('hidden');
  }
}

function showAuthScreen(role) {
  currentRole = role;
  document.getElementById('auth-role-title').textContent = `تسجيل ${role}`;
  document.getElementById('auth-role-subtitle').textContent = 'أدخل بياناتك للمتابعة';
  
  // إظهار/إخفاء حقل الاسم حسب الوضع
  updateAuthForm();
  
  // إظهار حقول الوثائق إذا لزم الأمر
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
  
  // محتوى مخصص لكل دور
  const content = document.getElementById('dash-content');
  content.innerHTML = `
    <div class="welcome-card">
      <h2>مرحباً ${profile.name} 👋</h2>
      <p>أهلاً بك في لوحة تحكم ${profile.role}</p>
      <p style="margin-top: 1rem; color: #64748b;">سيتم تفعيل الخدمات التفصيلية قريباً</p>
    </div>
  `;
  
  showScreen('user-dashboard');
}

function showPendingScreen() {
  showScreen('pending-screen');
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
  document.body.appendChild(blockedDiv);
  showScreen('blocked-screen');
}

function showMsg(element, text, type) {
  element.textContent = text;
  element.className = `auth-msg ${type === 'error' ? 'error' : 'success'}`;
  element.classList.remove('hidden');
}

// ==========================================
// 7. وظائف الإدارة
// ==========================================
async function handleAdminLogin() {
  const user = document.getElementById('admin-user').value;
  const pass = document.getElementById('admin-pass').value;
  const errorMsg = document.getElementById('login-error');
  
  if (user === 'admin' && pass === '1234') {
    errorMsg.classList.add('hidden');
    showScreen('admin-panel');
    loadDashboardStats();
  } else {
    errorMsg.classList.remove('hidden');
  }
}

async function loadDashboardStats() {
  // عدد المستخدمين
  const { count: userCount } = await supabaseClient
    .from('profiles')
    .select('*', { count: 'exact', head: true });
  
  // عدد بانتظار الموافقة
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
  showScreen('main-app');
}

async function checkMaintenanceMode() {
  const { data } = await supabaseClient
    .from('settings')
    .select('value')
    .eq('key', 'maintenance')
    .single();
  
  if (data?.value === true) {
    showScreen('maintenance-screen');
  }
}

// دوال عامة
window.updateUserStatus = updateUserStatus;
window.deleteUser = deleteUser;
