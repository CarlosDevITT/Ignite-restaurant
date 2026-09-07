import {
  getAccountProfile, getLocalProfile, onAuthStateChange, requestPasswordReset, saveProfile,
  signInCustomer, signOutCustomer, signUpCustomer, syncCustomerAccount, updatePassword,
} from '../services/profile-service.js';
import { getPlayerStats } from './ignite-play/score-service.js';

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}
function ensureStyles() {
  if (document.querySelector('#ignite-profile-auth-style')) return;
  const link = document.createElement('link'); link.id = 'ignite-profile-auth-style'; link.rel = 'stylesheet';
  link.href = new URL('../../styles/profile-auth.css', import.meta.url).href; document.head.appendChild(link);
}

export function initProfile({ requestInstall }) {
  ensureStyles();
  const view = document.querySelector('#view-profile');
  if (!view) return;
  let disposed = false;

  const changePassword = async (title = 'Alterar senha') => {
    const result = await Swal.fire({
      title,
      html: '<input id="ignite-new-password" class="swal2-input" type="password" minlength="6" autocomplete="new-password" placeholder="Nova senha (mín. 6 caracteres)">',
      showCancelButton: true, confirmButtonText: 'Salvar nova senha', cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const value = document.querySelector('#ignite-new-password')?.value || '';
        if (value.length < 6) { Swal.showValidationMessage('Use pelo menos 6 caracteres.'); return false; }
        return value;
      },
    });
    if (!result.isConfirmed) return;
    try { await updatePassword(result.value); await Swal.fire({ icon: 'success', title: 'Senha atualizada', timer: 1600, showConfirmButton: false }); }
    catch (error) { await Swal.fire({ icon: 'error', title: 'Não foi possível alterar', text: error.message }); }
  };

  const renderGuest = () => {
    const local = getLocalProfile();
    view.innerHTML = `
      <section class="account-welcome"><div class="account-welcome__mark">IG</div><span class="section-kicker">Sua conta Ignite</span><h2>Compre rápido. Crie sua conta quando quiser.</h2><p>Seu primeiro pedido continua simples: nome e telefone. A conta sincroniza pedidos, dados e seu progresso no Ignite Play entre aparelhos.</p></section>
      <div class="auth-tabs card-panel"><button type="button" class="is-active" data-auth-tab="login">Entrar</button><button type="button" data-auth-tab="signup">Criar conta</button></div>
      <form class="account-auth card-panel" id="customer-login-form">
        <div class="account-auth__heading"><strong>Bem-vindo de volta</strong><small>Acesse seus pedidos e benefícios.</small></div>
        <label class="field"><span>E-mail</span><input name="email" type="email" autocomplete="email" required value="${esc(local.email)}" placeholder="voce@email.com"></label>
        <label class="field"><span>Senha</span><input name="password" type="password" autocomplete="current-password" minlength="6" required placeholder="Sua senha"></label>
        <button class="button button--full" type="submit">Entrar</button><button class="account-link" type="button" id="forgot-password">Esqueci minha senha</button>
      </form>
      <form class="account-auth card-panel" id="customer-signup-form" hidden>
        <div class="account-auth__heading"><strong>Criar sua conta</strong><small>Não é obrigatório para comprar.</small></div>
        <label class="field"><span>Nome</span><input name="name" autocomplete="name" required value="${esc(local.name)}" placeholder="Seu nome"></label>
        <label class="field"><span>WhatsApp</span><input name="phone" inputmode="tel" autocomplete="tel" required value="${esc(local.phone)}" placeholder="(47) 99999-9999"></label>
        <label class="field"><span>E-mail</span><input name="email" type="email" autocomplete="email" required value="${esc(local.email)}" placeholder="voce@email.com"></label>
        <label class="field"><span>Senha</span><input name="password" type="password" autocomplete="new-password" minlength="6" required placeholder="Mínimo de 6 caracteres"></label>
        <button class="button button--full" type="submit">Criar minha conta</button><small class="account-auth__note">Pedidos anteriores deste cliente e o Ignite Play serão vinculados quando a conta for conectada.</small>
      </form>
      <div class="account-guest-note card-panel"><i class="fi fi-rr-shopping-bag"></i><div><strong>Quer apenas pedir?</strong><small>Volte ao cardápio e finalize normalmente. Conta não é obrigatória.</small></div></div>
      <div class="settings-list card-panel"><button type="button" id="profile-install"><span>Instalar aplicativo</span><small>Tenha o Ignite na tela inicial</small></button></div>`;

    const tabs = [...view.querySelectorAll('[data-auth-tab]')], login = view.querySelector('#customer-login-form'), signup = view.querySelector('#customer-signup-form');
    tabs.forEach(button => button.addEventListener('click', () => { const mode = button.dataset.authTab; tabs.forEach(item => item.classList.toggle('is-active', item === button)); login.hidden = mode !== 'login'; signup.hidden = mode !== 'signup'; }));
    login.addEventListener('submit', async event => {
      event.preventDefault(); const button = login.querySelector('[type="submit"]'); button.disabled = true; button.textContent = 'Entrando...';
      try { await signInCustomer(Object.fromEntries(new FormData(login))); await render(); await Swal.fire({ icon: 'success', title: 'Conta conectada', text: 'Pedidos e Ignite Play foram sincronizados.', timer: 2000, showConfirmButton: false }); }
      catch (error) { await Swal.fire({ icon: 'error', title: 'Não foi possível entrar', text: error.message }); }
      finally { button.disabled = false; button.textContent = 'Entrar'; }
    });
    signup.addEventListener('submit', async event => {
      event.preventDefault(); const values = Object.fromEntries(new FormData(signup)); const button = signup.querySelector('[type="submit"]'); button.disabled = true; button.textContent = 'Criando conta...';
      try { const data = await signUpCustomer(values); if (data?.session) { await render(); await Swal.fire({ icon: 'success', title: 'Conta criada', text: 'Seus pedidos e progresso foram vinculados.' }); } else { await Swal.fire({ icon: 'success', title: 'Confira seu e-mail', text: 'Confirme a conta pelo e-mail e depois entre no Ignite.' }); } }
      catch (error) { await Swal.fire({ icon: 'error', title: 'Não foi possível criar a conta', text: error.message }); }
      finally { button.disabled = false; button.textContent = 'Criar minha conta'; }
    });
    view.querySelector('#forgot-password').addEventListener('click', async () => {
      const result = await Swal.fire({ title: 'Recuperar senha', input: 'email', inputValue: login.elements.email.value || local.email || '', inputLabel: 'E-mail da sua conta', showCancelButton: true, confirmButtonText: 'Enviar recuperação', cancelButtonText: 'Cancelar' });
      if (!result.isConfirmed || !result.value) return;
      try { await requestPasswordReset(result.value); await Swal.fire({ icon: 'success', title: 'E-mail enviado', text: 'Abra o link recebido para definir uma nova senha.' }); }
      catch (error) { await Swal.fire({ icon: 'error', title: 'Falha ao enviar', text: error.message }); }
    });
    view.querySelector('#profile-install')?.addEventListener('click', requestInstall);
  };

  const renderAccount = async (session, profile) => {
    const local = getLocalProfile(), player = await getPlayerStats().catch(() => null);
    const name = profile?.name || local.name || session.user.user_metadata?.full_name || 'Cliente Ignite', first = name.split(/\s+/)[0];
    const initials = name.split(/\s+/).slice(0,2).map(v => v[0]).join('').toUpperCase();
    view.innerHTML = `
      <section class="profile-hero profile-hero--account"><div class="profile-avatar">${esc(initials)}</div><div><span class="section-kicker">Conta conectada</span><h2>Olá, ${esc(first)}!</h2><p>${esc(session.user.email || '')}</p></div></section>
      <div class="account-stats"><article><span>Pedidos</span><strong>${Number(profile?.total_orders || 0)}</strong></article><article><span>Total no Ignite</span><strong>${Number(profile?.total_spent || 0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong></article><article><span>Ignite Play</span><strong>Nível ${Number(player?.level || 1)}</strong><small>${Number(player?.totalXp || 0)} XP</small></article></div>
      <form class="profile-form card-panel" id="profile-form">
        <div class="account-form-heading"><strong>Dados pessoais</strong><small>Usados para agilizar seus próximos pedidos.</small></div>
        <div class="field-grid"><label class="field"><span>Nome</span><input name="name" autocomplete="name" required value="${esc(profile?.name || local.name)}"></label><label class="field"><span>WhatsApp</span><input name="phone" inputmode="tel" autocomplete="tel" required value="${esc(profile?.phone || local.phone)}"></label></div>
        <label class="field"><span>E-mail da conta</span><input value="${esc(session.user.email || '')}" disabled></label>
        <label class="field"><span>Data de nascimento <small>(opcional)</small></span><input name="birth_date" type="date" value="${esc(profile?.birth_date || local.birth_date)}"></label>
        <label class="field"><span>Endereço padrão <small>(opcional)</small></span><input name="address" autocomplete="street-address" value="${esc(profile?.address || local.address)}" placeholder="Rua, número, bairro e referência"></label>
        <label class="account-check"><input name="marketing_opt_in" type="checkbox" ${profile?.marketing_opt_in ? 'checked' : ''}><span>Quero receber novidades e promoções do Ignite.</span></label><button class="button" type="submit">Salvar alterações</button>
      </form>
      <div class="account-benefits card-panel"><div><i class="fi fi-rr-receipt"></i><span><strong>Pedidos sincronizados</strong><small>Seu histórico acompanha sua conta.</small></span></div><div><i class="fi fi-rr-gamepad"></i><span><strong>Ignite Play sincronizado</strong><small>XP, nível e recordes ficam vinculados à conta.</small></span></div></div>
      <div class="settings-list card-panel"><button type="button" id="change-password"><span>Alterar senha</span><small>Atualize a segurança da sua conta</small></button><button type="button" id="profile-install"><span>Instalar aplicativo</span><small>Tenha o Ignite na tela inicial</small></button><button type="button" id="logout-customer"><span>Sair da conta</span><small>Seus dados permanecem salvos no Ignite</small></button><button type="button" id="clear-local-data"><span>Limpar dados deste aparelho</span><small>Remove carrinho e cache local, não sua conta</small></button></div>`;

    const form = view.querySelector('#profile-form');
    form.addEventListener('submit', async event => {
      event.preventDefault(); const values = Object.fromEntries(new FormData(form)); values.marketing_opt_in = form.elements.marketing_opt_in.checked; const button = form.querySelector('[type="submit"]'); button.disabled = true;
      try { await saveProfile(values); await Swal.fire({ icon: 'success', title: 'Perfil atualizado', timer: 1500, showConfirmButton: false }); await render(); }
      catch (error) { await Swal.fire({ icon: 'error', title: 'Não foi possível salvar', text: error.message }); }
      finally { button.disabled = false; }
    });
    view.querySelector('#change-password').addEventListener('click', () => changePassword());
    view.querySelector('#profile-install')?.addEventListener('click', requestInstall);
    view.querySelector('#logout-customer').addEventListener('click', async () => { await signOutCustomer(); await render(); });
    view.querySelector('#clear-local-data').addEventListener('click', async () => {
      const result = await Swal.fire({ icon: 'warning', title: 'Limpar este aparelho?', text: 'A conta continuará existindo. Carrinho, perfil local e pedidos em cache serão removidos.', showCancelButton: true, confirmButtonText: 'Limpar', cancelButtonText: 'Cancelar' });
      if (result.isConfirmed) { ['ignite-profile-v1','ignite-cart-v1','ignite-orders-v1'].forEach(key => localStorage.removeItem(key)); location.reload(); }
    });
  };

  const render = async () => {
    if (disposed) return;
    try { let { session, profile } = await getAccountProfile(); if (!session) return renderGuest(); if (!profile) profile = await syncCustomerAccount(); await renderAccount(session, profile); }
    catch (error) { console.warn('[Perfil]', error); renderGuest(); }
  };

  const stopAuth = onAuthStateChange(async (event) => {
    if (event === 'PASSWORD_RECOVERY') await changePassword('Defina sua nova senha');
    await render();
  });
  render();
  return () => { disposed = true; stopAuth?.(); };
}
