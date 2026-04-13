// navigation.js - Controle de Navegação Inferior e Modais (Chat e Perfil)

// Cache de dados do usuário
let _currentUser = null;

// Helper para obter telefone logado
window.getUserPhone = function() {
    const data = localStorage.getItem('igniteProfile');
    if (!data) return null;
    try {
        return JSON.parse(data).phone;
    } catch(e) { return null; }
};

// ========== FUNÇÕES DE NAVEGAÇÃO ==========

function navOpenHome() {
    closeAllModals();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    highlightNav('home');
}

function navOpenPedidos() {
    closeAllModals();
    if (window.unifiedCartManager) {
        window.unifiedCartManager.openCart();
    } else if (window.toggleCart) {
        window.toggleCart();
    }
    highlightNav('pedidos');
}

function navOpenChat() {
    const wasOpen = !document.getElementById('chat-modal').classList.contains('hidden');
    closeAllModals();
    document.getElementById('chat-modal').classList.remove('hidden');
    document.getElementById('chat-modal').classList.add('flex');
    document.body.style.overflow = 'hidden';
    highlightNav('chat');
    
    if (!wasOpen) {
        history.pushState({ modal: 'chat' }, '');
    }
}

function navOpenFeed() {
    const wasOpen = !document.getElementById('feed-modal').classList.contains('hidden');
    closeAllModals();
    const modal = document.getElementById('feed-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }
    highlightNav('feed');
    
    if (!wasOpen && modal) {
        history.pushState({ modal: 'feed' }, '');
    }
}

async function navOpenProfile() {
    const wasOpen = !document.getElementById('profile-modal').classList.contains('hidden');
    closeAllModals();
    const modal = document.getElementById('profile-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }

    const userData = localStorage.getItem('igniteProfile');

    if (userData) {
        try {
            const data = JSON.parse(userData);
            showProfileView('edit');
            
            // Preencher dados básicos do localStorage
            document.getElementById('user-display-name').textContent = data.name || 'CLIENTE';
            document.getElementById('user-initials').textContent = (data.name || 'C').charAt(0).toUpperCase();
            document.getElementById('prof-edit-phone').value = data.phone || '';
            document.getElementById('prof-edit-name').value = data.name || '';
            document.getElementById('prof-edit-address').value = data.address || '';
            document.getElementById('prof-edit-email').value = data.email || '';
            document.getElementById('prof-edit-birth').value = data.birthDate || '';
            
            // Buscar stats no Supabase de forma assíncrona
            if (window.supabaseManager) {
                window.supabaseManager.getUserStats(data.phone).then(stats => {
                    document.getElementById('user-stats-orders').textContent = stats.ordersCount;
                    document.getElementById('user-stats-points').textContent = stats.points;
                });
            }
        } catch (e) {
            console.error("Erro ao ler perfil", e);
            showProfileView('login');
        }
    } else {
        showProfileView('login');
    }

    highlightNav('perfil');
    
    if (!wasOpen) {
        history.pushState({ modal: 'profile' }, '');
    }
}

function showProfileView(view) {
    const views = {
        login: document.getElementById('profile-view-login'),
        register: document.getElementById('profile-view-register'),
        edit: document.getElementById('profile-view-edit')
    };

    Object.values(views).forEach(v => v && v.classList.add('hidden'));
    
    if (views[view]) {
        views[view].classList.remove('hidden');
        // Update Title
        const titles = { login: 'Acessar Conta', register: 'Criar Perfil', edit: 'Meu Perfil' };
        document.getElementById('profile-title').textContent = titles[view];
    }
}

window.toggleAuthView = function(view) {
    showProfileView(view);
};

function closeAllModals() {
    const chat = document.getElementById('chat-modal');
    const profile = document.getElementById('profile-modal');
    const feed = document.getElementById('feed-modal');
    const newPost = document.getElementById('new-post-sheet');
    const comments = document.getElementById('comments-sheet');
    const notif = document.getElementById('notifications-modal');

    if (chat) {
        chat.classList.add('hidden');
        chat.classList.remove('flex');
    }
    if (profile) {
        profile.classList.add('hidden');
    }
    if (feed) {
        feed.classList.add('hidden');
        feed.classList.remove('flex');
    }
    if (newPost) newPost.classList.add('hidden');
    if (comments) comments.classList.add('hidden');
    if (notif) {
        notif.classList.add('hidden');
        notif.classList.remove('flex');
    }
    
    document.body.style.overflow = '';
}

function highlightNav(activeId) {
    const nav = document.querySelector('nav.fixed.bottom-0');
    if (!nav) return;

    const buttons = nav.querySelectorAll('button');
    const mapping = { home: 0, pedidos: 1, avisos: 2, chat: 3, feed: 4, perfil: 5 };
    const activeIndex = mapping[activeId];

    buttons.forEach((btn, index) => {
        if (index === activeIndex) {
            btn.classList.remove('text-gray-400');
            btn.classList.add('text-primary');
        } else {
            btn.classList.add('text-gray-400');
            btn.classList.remove('text-primary');
        }
    });
}

// ========== LÓGICA DE EVENTOS ==========

// Lógica para fechar modais ao clicar no botão 'voltar' do navegador (ou swipe back)
window.addEventListener('popstate', (event) => {
    closeAllModals();
});

// Lógica inicial para capturar o swipe/back behavior e evitar sair do cardápio logo de cara
if (!history.state || history.state.page !== 'menu-root') {
    history.pushState({ page: 'menu-root' }, '');
}

async function loginProfile(e) {
    e.preventDefault();
    const phone = document.getElementById('prof-login-phone').value;
    const pass = document.getElementById('prof-login-pass').value;

    if (!window.supabaseManager) {
        alert("Erro de conexão. Tente novamente.");
        return;
    }

    // Mostrar loading no botão
    const btn = e.target.querySelector('button');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verificando...';

    try {
        const result = await window.supabaseManager.verificarSenha(phone, pass);
        if (result.success) {
            const userData = {
                phone: result.user.phone,
                name: result.user.name,
                address: result.user.address,
                email: result.user.email,
                birthDate: result.user.birth_date,
                gender: result.user.gender
            };
            localStorage.setItem('igniteProfile', JSON.stringify(userData));
            navOpenProfile();
            Swal.fire({ icon: 'success', title: `Olá, ${userData.name}!`, timer: 1500, showConfirmButton: false });
        } else {
            Swal.fire({ icon: 'error', title: 'Erro', text: result.message });
        }
    } catch (err) {
        console.error(err);
        Swal.fire({ icon: 'error', title: 'Falha técnica', text: 'Tente novamente em instantes' });
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function saveProfileRegister(e) {
    e.preventDefault();

    const name = document.getElementById('prof-reg-name').value;
    const phone = document.getElementById('prof-reg-phone').value;
    const address = document.getElementById('prof-reg-address').value;
    const pass = document.getElementById('prof-reg-pass').value;
    const passConf = document.getElementById('prof-reg-pass-confirm').value;

    if (pass !== passConf) {
        Swal.fire({ icon: 'warning', title: 'Senhas não coincidem' });
        return;
    }

    const profileData = { phone, name, address, password: pass };
    
    const btn = e.target.querySelector('button');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Criando conta...';

    try {
        if (window.supabaseManager) {
            await window.supabaseManager.salvarUsuario(profileData);
        }
        localStorage.setItem('igniteProfile', JSON.stringify(profileData));
        
        Swal.fire({ icon: 'success', title: 'Perfil criado!', text: 'Bem-vindo ao Ignite!', timer: 2000 });
        setTimeout(() => navOpenProfile(), 1000);
    } catch (err) {
        Swal.fire({ icon: 'error', title: 'Erro ao cadastrar' });
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function saveProfileEdit(e) {
    e.preventDefault();

    const name = document.getElementById('prof-edit-name').value;
    const address = document.getElementById('prof-edit-address').value;
    const email = document.getElementById('prof-edit-email').value;
    const birthDate = document.getElementById('prof-edit-birth').value;
    const phone = document.getElementById('prof-edit-phone').value;

    let oldData = {};
    try { oldData = JSON.parse(localStorage.getItem('igniteProfile')) || {}; } catch (e) {}

    const profileData = { ...oldData, name, address, email, birthDate, phone };

    localStorage.setItem('igniteProfile', JSON.stringify(profileData));

    if (window.supabaseManager) {
        window.supabaseManager.salvarUsuario(profileData);
    }
    
    Swal.fire({ icon: 'success', title: 'Perfil atualizado!', timer: 1500, showConfirmButton: false });
    // Atualizar UI local
    document.getElementById('user-display-name').textContent = name.toUpperCase();
}

function logoutProfile() {
    Swal.fire({
        title: 'Sair da conta?',
        text: "Você precisará logar novamente para fazer pedidos.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#069C54',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sim, sair!',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem('igniteProfile');
            navOpenProfile();
        }
    });
}

// Tornar global
window.navOpenHome = navOpenHome;
window.navOpenPedidos = navOpenPedidos;
window.navOpenChat = navOpenChat;
window.navOpenProfile = navOpenProfile;
window.navOpenFeed = navOpenFeed;
window.loginProfile = loginProfile;
window.saveProfileRegister = saveProfileRegister;
window.saveProfileEdit = saveProfileEdit;
window.logoutProfile = logoutProfile;
window.closeAllModals = closeAllModals;

// Lógica para abrir modais via URL (ex: ?open=chat)
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('open') === 'chat') {
        setTimeout(() => window.navOpenChat(), 800);
    } else if (params.get('open') === 'profile') {
        setTimeout(() => window.navOpenProfile(), 800);
    }
});
