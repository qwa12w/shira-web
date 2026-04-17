// ==========================================
// شراع - تطبيق المنصة المتكاملة (نسخة مصححة 100%)
// ==========================================

let currentUser = null;
let currentRole = null;
let currentAuthMode = 'login';
let appInitialized = false;

// ==========================================
async function startApp() {
  if (appInitialized) return;
  appInitialized = true;

  await new Promise(r => setTimeout(r, 100));

  await restoreState();
  await checkSession();
  setupRealtimeSync();
  setupEventListeners();
  await checkMaintenanceMode();
}

// ==========================================
function ensureSupabaseReady(callback) {
  if (window.supabaseClient) return callback();

  if (typeof window.supabase !== 'undefined') {
    try {
      const { createClient } = window.supabase;
      window.supabaseClient = createClient(
        "https://qioiiidrwqvwzkveoxnm.supabase.co",
        "sb_publishable_yLhyYMSCXttp1e_q_PAovA_zz1xgYDM"
      );
      return callback();
    } catch {}
  }

  let attempts = 0;
  const tryInit = () => {
    attempts++;
    if (window.supabaseClient) return callback();

    if (typeof window.supabase !== 'undefined' && attempts < 15) {
      try {
        const { createClient } = window.supabase;
        window.supabaseClient = createClient(
          "https://qioiiidrwqvwzkveoxnm.supabase.co",
          "sb_publishable_yLhyYMSCXttp1e_q_PAovA_zz1xgYDM"
        );
        return callback();
      } catch {}
    }

    if (attempts < 15) setTimeout(tryInit, 200);
  };

  tryInit();
}

// ==========================================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    ensureSupabaseReady(startApp);
  });
} else {
  ensureSupabaseReady(startApp);
}

// ==========================================
async function restoreState() {
  const savedScreen = localStorage.getItem('shira_currentScreen');
  const savedTab = localStorage.getItem('shira_adminTab');

  if (savedScreen) {
    document.querySelectorAll('body > div').forEach(div => {
      if (div.id !== 'about-modal' && div.id !== 'contact-modal')
        div.classList.add('hidden');
    });
    document.getElementById(savedScreen)?.classList.remove('hidden');
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
    activeTab?.classList.remove('hidden');
    activeTab?.classList.add('active');
  }
}

// ==========================================
async function checkSession() {
  try {
    if (!window.supabaseClient) return;

    const { data: { session } } = await supabaseClient.auth.getSession();

    if (session) {
      currentUser = session.user;

      const { data: profile } = await supabaseClient
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
      }

    } else {
      showScreen('main-app');
    }

  } catch {
    showScreen('main-app');
  }
}

// ==========================================
function setupRealtimeSync() {
  if (!window.supabaseClient) return;

  supabaseClient.channel('profiles_changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'profiles' },
      payload => {
        if (currentUser && payload.new?.id === currentUser.id) {
          if (payload.new.status === 'محظور') showBlockedScreen();
        }
      }
    ).subscribe();
}

// ==========================================
function setupEventListeners() {
  document.querySelectorAll('.service-card').forEach(card => {
    const role = card.dataset.role;
    const newCard = card.cloneNode(true);
    card.parentNode.replaceChild(newCard, card);

    newCard.onclick = () => {
      currentRole = role;
      showAuthScreen(role);
    };
  });

  document.getElementById('auth-form')?.addEventListener('submit', handleAuthSubmit);
}

// ==========================================
async function handleAuthSubmit(e) {
  e.preventDefault();

  const phone = document.getElementById('auth-phone').value.trim();
  const password = document.getElementById('auth-password').value;
  const name = document.getElementById('auth-name')?.value.trim();

  if (currentAuthMode === 'register') {

    const { data: authData, error } = await supabaseClient.auth.signUp({
      email: `${phone}@shira.app`,
      password,
      options: {
        data: { phone, name, role: currentRole }
      }
    });

    if (error) return alert(error.message);

    await supabaseClient.from('profiles').insert({
      id: authData.user.id,
      name,
      phone,
      role: currentRole,
      status: currentRole === 'زبون' ? 'نشط' : 'قيد المراجعة'
    });

  } else {

    const { data: authData, error } = await supabaseClient.auth.signInWithPassword({
      email: `${phone}@shira.app`,
      password
    });

    if (error) return alert(error.message);

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    showUserDashboard(profile);
  }
}

// ==========================================
function showScreen(id) {
  document.querySelectorAll('body > div').forEach(div => {
    if (div.id !== 'about-modal' && div.id !== 'contact-modal')
      div.classList.add('hidden');
  });

  document.getElementById(id)?.classList.remove('hidden');
}

// ==========================================
function showAuthScreen(role) {
  currentRole = role;
  showScreen('auth-screen');
}

// ==========================================
function showUserDashboard(profile) {
  document.getElementById('dash-user-name').textContent = profile.name;
  document.getElementById('dash-user-role').textContent = profile.role;
  showScreen('user-dashboard');
}

// ==========================================
function showBlockedScreen() {
  alert('الحساب محظور');
}

// ==========================================
async function checkMaintenanceMode() {
  if (!window.supabaseClient) return;

  const { data } = await supabaseClient
    .from('settings')
    .select('value')
    .eq('key', 'maintenance')
    .single();

  if (data?.value === true && !currentUser) {
    showScreen('maintenance-screen');
  }
}
