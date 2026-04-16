// --- 1. محرك قاعدة البيانات المحلي ---
const DB = {
    get: (key) => {
        const data = localStorage.getItem(`shira_${key}`);
        return data ? JSON.parse(data) : [];
    },
    set: (key, data) => localStorage.setItem(`shira_${key}`, JSON.stringify(data)),
    init: () => {
        if (!localStorage.getItem('shira_users')) {
            DB.set('users', [
                { id: 1, name: 'أحمد السائق', role: 'سائق', status: 'نشط' },
                { id: 2, name: 'محمد الزبون', role: 'زبون', status: 'نشط' },
                { id: 3, name: 'علي التاجر', role: 'بائع', status: 'محظور' }
            ]);
        }
        if (!localStorage.getItem('shira_settings')) {
            DB.set('settings', { maintenance: false });
        }
    }
};

// --- 2. إدارة التطبيق ---
document.addEventListener('DOMContentLoaded', () => {
    DB.init();
    
    // حفظ حالة الصفحة الحالية
    const currentPage = localStorage.getItem('shira_currentPage') || 'main';
    
    const screens = {
        main: document.getElementById('main-app'),
        login: document.getElementById('admin-login'),
        panel: document.getElementById('admin-panel'),
        maintenance: document.getElementById('maintenance-screen')
    };

    // التحقق من وضع الصيانة
    const settings = DB.get('settings');
    if (settings.maintenance && currentPage === 'main') {
        screens.main.classList.add('hidden');
        screens.maintenance.classList.remove('hidden');
        localStorage.setItem('shira_currentPage', 'maintenance');
    } else {
        // استعادة الصفحة الأخيرة
        showScreen(currentPage);
    }

    // دالة التنقل بين الشاشات مع الحفظ
    const showScreen = (screenName) => {
        Object.values(screens).forEach(el => el.classList.add('hidden'));
        if (screens[screenName]) {
            screens[screenName].classList.remove('hidden');
            localStorage.setItem('shira_currentPage', screenName);
        }
    };

    // --- الأحداث ---
    
    // زر "عن شراع"
    const aboutBtn = document.getElementById('btn-about');
    const aboutModal = document.getElementById('about-modal');
    const closeModal = document.querySelector('.close-modal');

    if (aboutBtn && aboutModal) {
        aboutBtn.onclick = () => aboutModal.classList.remove('hidden');
    }
    if (closeModal && aboutModal) {
        closeModal.onclick = () => aboutModal.classList.add('hidden');
        aboutModal.onclick = (e) => {
            if (e.target === aboutModal) aboutModal.classList.add('hidden');
        };
    }

    // الشعار - للدخول للإدارة (زر مخفي)
    const logoContainer = document.getElementById('logo-container');
    if (logoContainer) {
        logoContainer.onclick = () => {
            showScreen('login');
        };
        logoContainer.style.cursor = 'pointer';
    }

    // زر العودة للرئيسية
    const backBtn = document.getElementById('back-to-home');
    if (backBtn) {
        backBtn.onclick = () => showScreen('main');
    }

    // تسجيل الخروج
    const logoutBtn = document.getElementById('logout-admin');
    if (logoutBtn) {
        logoutBtn.onclick = () => {
            showScreen('main');
            document.getElementById('admin-user').value = '';
            document.getElementById('admin-pass').value = '';
        };
    }

    // --- لوحة التحكم ---
    const navBtns = document.querySelectorAll('.admin-nav-btn');
    navBtns.forEach(btn => {
        btn.onclick = () => {
            navBtns.forEach(b => b.classList.remove('active'));
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
            }
        };
    });

    // تحميل بيانات الإدارة
    function loadAdminData() {
        const users = DB.get('users');
        const settings = DB.get('settings');

        const statUsers = document.getElementById('stat-users');
        const statStatus = document.getElementById('stat-status');
        if (statUsers) statUsers.textContent = users.length;
        if (statStatus) statStatus.textContent = settings.maintenance ? 'صيانة 🛠️' : 'نشط ✅';

        const tbody = document.getElementById('users-list');
        if (tbody) {
            tbody.innerHTML = '';
            users.forEach(u => {
                tbody.innerHTML += `
                    <tr>
                        <td>${u.id}</td>
                        <td>${u.name}</td>
                        <td>${u.role}</td>
                        <td style="color: ${u.status === 'نشط' ? 'green' : 'red'}">${u.status}</td>
                        <td>
                            <button class="btn-action btn-delete" onclick="deleteUser(${u.id})">حذف</button>
                        </td>
                    </tr>
                `;
            });
        }

        const maintenanceToggle = document.getElementById('maintenance-toggle');
        if (maintenanceToggle) {
            maintenanceToggle.checked = settings.maintenance;
        }
    }

    // حذف مستخدم
    window.deleteUser = (id) => {
        if(confirm('هل أنت متأكد من الحذف؟')) {
            let users = DB.get('users');
            users = users.filter(u => u.id !== id);
            DB.set('users', users);
            loadAdminData();
        }
    };

    // وضع الصيانة
    const maintenanceToggle = document.getElementById('maintenance-toggle');
    if (maintenanceToggle) {
        maintenanceToggle.onchange = (e) => {
            let s = DB.get('settings');
            s.maintenance = e.target.checked;
            DB.set('settings', s);
            loadAdminData();
            if (e.target.checked) {
                alert('تم تفعيل وضع الصيانة! سيختفي الموقع للزوار.');
            } else {
                alert('تم إيقاف وضع الصيانة.');
            }
        };
    }

    // إعادة الضبط
    const resetBtn = document.getElementById('reset-db');
    if (resetBtn) {
        resetBtn.onclick = () => {
            if(confirm('تحذير: سيتم حذف جميع البيانات!')) {
                localStorage.clear();
                location.reload();
            }
        };
    }

    console.log("✅ تم تشغيل النظام مع حفظ الحالة");
});
