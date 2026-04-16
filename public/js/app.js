cat > public/js/app.js << 'EOF'
// --- 1. محرك قاعدة البيانات المحلي (Local DB Engine) ---
const DB = {
    get: (key) => JSON.parse(localStorage.getItem(`shira_${key}`)) || [],
    set: (key, data) => localStorage.setItem(`shira_${key}`, JSON.stringify(data)),
    init: () => {
        if (!localStorage.getItem('shira_users')) {
            // بيانات وهمية أولية للتجربة
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

// --- 2. إدارة التطبيق (App Logic) ---
document.addEventListener('DOMContentLoaded', () => {
    DB.init(); // تهيئة البيانات
    
    const screens = {
        main: document.getElementById('main-app'),
        login: document.getElementById('admin-login'),
        panel: document.getElementById('admin-panel'),
        maintenance: document.getElementById('maintenance-screen')
    };

    // التحقق من وضع الصيانة
    const settings = DB.get('settings');
    if (settings.maintenance) {
        screens.main.classList.add('hidden');
        screens.maintenance.classList.remove('hidden');
    }

    // التنقل بين الشاشات
    const showScreen = (screenName) => {
        Object.values(screens).forEach(el => el.classList.add('hidden'));
        screens[screenName].classList.remove('hidden');
    };

    // --- أحداث الأزرار العامة ---
    document.getElementById('btn-admin-login').onclick = () => showScreen('login');
    document.getElementById('back-to-home').onclick = () => showScreen('main');
    
    document.getElementById('btn-about').onclick = () => {
        const modal = document.getElementById('generic-modal');
        document.getElementById('modal-body').innerHTML = `<h2>عن شراع ⛵</h2><p>منصة عراقية متكاملة للنقل والتجارة.</p>`;
        modal.classList.remove('hidden');
    };
    document.querySelector('.close-modal').onclick = () => document.getElementById('generic-modal').classList.add('hidden');

    // --- منطق تسجيل دخول الإدارة ---
    document.getElementById('login-submit').onclick = () => {
        const u = document.getElementById('admin-user').value;
        const p = document.getElementById('admin-pass').value;
        if (u === 'admin' && p === '1234') {
            showScreen('panel');
            loadAdminData();
        } else {
            document.getElementById('login-error').classList.remove('hidden');
        }
    };

    document.getElementById('logout-admin').onclick = () => {
        showScreen('main');
        document.getElementById('admin-user').value = '';
        document.getElementById('admin-pass').value = '';
    };

    // --- منطق لوحة التحكم ---
    const navBtns = document.querySelectorAll('.admin-nav-btn');
    navBtns.forEach(btn => {
        btn.onclick = () => {
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.admin-tab').forEach(t => t.classList.add('hidden'));
            document.getElementById(`tab-${btn.dataset.tab}`).classList.remove('hidden');
        };
    });

    // تحميل البيانات للإدارة
    function loadAdminData() {
        const users = DB.get('users');
        const settings = DB.get('settings');

        // 1. الإحصائيات
        document.getElementById('stat-users').textContent = users.length;
        document.getElementById('stat-status').textContent = settings.maintenance ? 'صيانة 🛠️' : 'نشط ✅';

        // 2. جدول المستخدمين
        const tbody = document.getElementById('users-list');
        tbody.innerHTML = '';
        users.forEach(u => {
            tbody.innerHTML += `
                <tr>
                    <td>${u.id}</td>
                    <td>${u.name}</td>
                    <td><span class="badge">${u.role}</span></td>
                    <td style="color: ${u.status === 'نشط' ? 'green' : 'red'}">${u.status}</td>
                    <td>
                        <button class="btn-action btn-delete" onclick="deleteUser(${u.id})">حذف</button>
                    </td>
                </tr>
            `;
        });

        // 3. إعدادات الصيانة
        document.getElementById('maintenance-toggle').checked = settings.maintenance;
    }

    // حذف مستخدم (Global Function)
    window.deleteUser = (id) => {
        if(confirm('هل أنت متأكد من الحذف؟')) {
            let users = DB.get('users');
            users = users.filter(u => u.id !== id);
            DB.set('users', users);
            loadAdminData();
        }
    };

    // تفعيل/تعطيل الصيانة
    document.getElementById('maintenance-toggle').onchange = (e) => {
        let s = DB.get('settings');
        s.maintenance = e.target.checked;
        DB.set('settings', s);
        loadAdminData();
        alert(e.target.checked ? 'تم تفعيل وضع الصيانة! سيختفي الموقع للزوار.' : 'تم إيقاف وضع الصيانة.');
    };

    // إعادة ضبط المصنع
    document.getElementById('reset-db').onclick = () => {
        if(confirm('تحذير: سيتم حذف جميع البيانات!')) {
            localStorage.clear();
            location.reload();
        }
    };

    console.log("✅ تم تشغيل نظام الإدارة الحقيقي");
});
EOF
