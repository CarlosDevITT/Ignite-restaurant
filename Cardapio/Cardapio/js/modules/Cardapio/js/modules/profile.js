import { getLocalProfile, saveProfile } from '../services/profile-service.js';

export function initProfile({ requestInstall }) {
  const form = document.querySelector('#profile-form');
  const greeting = document.querySelector('#profile-greeting');

  const fill = () => {
    const profile = getLocalProfile();
    form.elements.name.value = profile.name || '';
    form.elements.phone.value = profile.phone || '';
    form.elements.address.value = profile.address || '';
    greeting.textContent = profile.name ? `Olá, ${profile.name.split(' ')[0]}!` : 'Olá, cliente!';
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const profile = Object.fromEntries(new FormData(form));
    try { await saveProfile(profile); fill(); Swal.fire({ icon: 'success', title: 'Perfil salvo', timer: 1500, showConfirmButton: false }); }
    catch (error) { Swal.fire({ icon: 'warning', title: 'Salvo neste aparelho', text: `A sincronização falhou: ${error.message}` }); }
  });

  document.querySelector('#profile-install').addEventListener('click', requestInstall);
  document.querySelector('#clear-local-data').addEventListener('click', async () => {
    const result = await Swal.fire({ icon: 'warning', title: 'Limpar dados locais?', text: 'Perfil, carrinho e pedidos de demonstração serão removidos.', showCancelButton: true, confirmButtonText: 'Limpar', cancelButtonText: 'Cancelar' });
    if (result.isConfirmed) { ['ignite-profile-v1', 'ignite-cart-v1', 'ignite-orders-v1'].forEach((key) => localStorage.removeItem(key)); location.reload(); }
  });
  fill();
}
