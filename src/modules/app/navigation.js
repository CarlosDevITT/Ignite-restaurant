// navigation.js - Controle de Navegação Inferior e Modais (Chat e Perfil)

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
    closeAllModals();
    document.getElementById('chat-modal').classList.remove('hidden');
    document.getElementById('chat-modal').classList.add('flex');
    highlightNav('chat');
}

function navOpenProfile() {
    closeAllModals();
    const modal = document.getElementById('profile-modal');
    modal.classList.remove('hidden');

    // Lógica de visualização baseada em dados locais
    const userData = localStorage.getItem('igniteProfile');

    if (userData) {
        // Tem cadastro -> Mostrar tela Editar e preencher dados
        document.getElementById('profile-view-register').classList.add('hidden');
        document.getElementById('profile-view-edit').classList.remove('hidden');

        try {
            const data = JSON.parse(userData);
            document.getElementById('prof-edit-phone').value = data.phone || '';
            document.getElementById('prof-edit-name').value = data.name || '';
            if (document.getElementById('prof-edit-address')) document.getElementById('prof-edit-address').value = data.address || '';
            document.getElementById('prof-edit-email').value = data.email || '';
            document.getElementById('prof-edit-birth').value = data.birthDate || '';
            document.getElementById('prof-edit-gender').value = data.gender || '';
        } catch (e) {
            console.error("Erro ao ler profile json", e);
        }
    } else {
        // Primeiro acesso -> Form de Cadastro
        document.getElementById('profile-view-register').classList.remove('hidden');
        document.getElementById('profile-view-edit').classList.add('hidden');
    }

    highlightNav('perfil');
}

function closeAllModals() {
    const chat = document.getElementById('chat-modal');
    const profile = document.getElementById('profile-modal');

    if (chat) {
        chat.classList.add('hidden');
        chat.classList.remove('flex');
    }
    if (profile) {
        profile.classList.add('hidden');
    }
}

function highlightNav(activeId) {
    // Ajuste visual dos botões de navegacão pra mostrar qual está ativo
    // Esta parte procura o <nav> e altera as cores dos botões dependendo da função clicada
    const nav = document.querySelector('nav.fixed.bottom-0');
    if (!nav) return;

    const buttons = nav.querySelectorAll('button');
    buttons.forEach((btn, index) => {
        btn.classList.remove('text-primary');
        btn.classList.add('text-gray-400');

        let isMatch = false;
        if (activeId === 'home' && index === 0) isMatch = true;
        if (activeId === 'pedidos' && index === 1) isMatch = true;
        if (activeId === 'chat' && index === 2) isMatch = true;
        if (activeId === 'perfil' && index === 3) isMatch = true;

        if (isMatch) {
            btn.classList.remove('text-gray-400', 'hover:text-primary');
            btn.classList.add('text-primary');
        } else {
            btn.classList.add('hover:text-primary');
        }
    });
}

// ========== LÓGICA DO PERFIL (FORMULÁRIOS E LOCALSTORAGE) ==========

function saveProfileRegister(e) {
    e.preventDefault();

    const phone = document.getElementById('prof-reg-phone').value;
    const name = document.getElementById('prof-reg-name').value;
    const address = document.getElementById('prof-reg-address') ? document.getElementById('prof-reg-address').value : '';
    const pass = document.getElementById('prof-reg-pass').value;
    const passConf = document.getElementById('prof-reg-pass-confirm').value;

    if (pass !== passConf) {
        alert("As senhas não coincidem!");
        return;
    }

    const profileData = {
        phone,
        name,
        address,
        password: pass // em um sistema real seria enviado para um banco e encriptado
    };

    localStorage.setItem('igniteProfile', JSON.stringify(profileData));

    // Sincronizar com o Supabase de forma assíncrona
    if (window.supabaseManager && typeof window.supabaseManager.salvarUsuario === 'function') {
        window.supabaseManager.salvarUsuario(profileData).catch(err => console.error("Erro no sync Supabase", err));
    }

    // Feedback visual com auto-reload da view de perfil logado
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Cadastro salvo!',
            showConfirmButton: false,
            timer: 1500
        });
    } else {
        alert("Cadastro salvo com sucesso!");
    }

    setTimeout(() => navOpenProfile(), 1000);
}

function saveProfileEdit(e) {
    e.preventDefault();

    const phone = document.getElementById('prof-edit-phone').value;
    const name = document.getElementById('prof-edit-name').value;
    const address = document.getElementById('prof-edit-address') ? document.getElementById('prof-edit-address').value : '';
    const email = document.getElementById('prof-edit-email').value;
    const birthDate = document.getElementById('prof-edit-birth').value;
    const gender = document.getElementById('prof-edit-gender').value;

    // Pegar a senha antiga se existir
    let oldData = {};
    try {
        oldData = JSON.parse(localStorage.getItem('igniteProfile')) || {};
    } catch (e) { }

    const profileData = {
        ...oldData,
        phone,
        name,
        address,
        email,
        birthDate,
        gender
    };

    localStorage.setItem('igniteProfile', JSON.stringify(profileData));

    // Sincronizar com o Supabase de forma assíncrona
    if (window.supabaseManager && typeof window.supabaseManager.salvarUsuario === 'function') {
        window.supabaseManager.salvarUsuario(profileData).catch(err => console.error("Erro no sync Supabase", err));
    }

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            icon: 'success',
            title: 'Dados atualizados!',
            showConfirmButton: false,
            timer: 1500
        });
    } else {
        alert("Dados atualizados com sucesso!");
    }
}

function logoutProfile() {
    if (confirm("Tem certeza que deseja sair/limpar dados locais?")) {
        localStorage.removeItem('igniteProfile');
        navOpenProfile(); // Recarregar exibindo tela de cadastro
    }
}

// Tornar global para os onclick do HTML
window.navOpenHome = navOpenHome;
window.navOpenPedidos = navOpenPedidos;
window.navOpenChat = navOpenChat;
window.navOpenProfile = navOpenProfile;
window.saveProfileRegister = saveProfileRegister;
window.saveProfileEdit = saveProfileEdit;
window.logoutProfile = logoutProfile;
