// notifications.js - Gerenciador de Notificações do Ignite

class NotificationManager {
    constructor() {
        this.notifications = [];
        this.isOpen = false;
        this.init();
    }

    init() {
        this.createUI();
        this.loadNotifications();
        // Simular polling ou usar Realtime do Supabase se disponível
        setInterval(() => this.checkNewNotifications(), 60000); // 1 minuto
    }

    createUI() {
        const modalHTML = `
            <div id="notifications-modal" class="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm hidden flex-col items-center justify-center p-4 transition-all duration-300">
                <div class="bg-white w-full max-w-sm rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-in fade-in zoom-in duration-300">
                    <div class="bg-primary p-5 text-white flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <i class="fas fa-bell"></i>
                            <h3 class="font-black uppercase tracking-tight m-0 text-sm">Notificações</h3>
                        </div>
                        <button onclick="toggleNotifications()" class="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div id="notif-list" class="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                        <!-- Itens via JS -->
                    </div>
                    <div class="p-4 bg-white border-t border-slate-100 text-center">
                        <button onclick="markAllAsRead()" class="text-xs font-bold text-primary uppercase tracking-widest hover:underline">Marcar tudo como lido</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    async loadNotifications() {
        const phone = window.getUserPhone();
        if (!phone) return;

        // Tentar buscar do Supabase (tabela fictícia por enquanto, ou usar orders)
        try {
            if (window.supabaseManager && window.supabaseManager.isConnected()) {
                // Exemplo: Buscar pedidos recentes com status mudado
                const { data } = await window.supabaseManager.client
                    .from('orders')
                    .select('id, status, total, created_at')
                    .eq('phone', phone.replace(/\D/g, ''))
                    .order('created_at', { ascending: false })
                    .limit(5);

                if (data) {
                    this.notifications = data.map(order => ({
                        id: order.id,
                        title: `Pedido #${order.id.toString().slice(-4)}`,
                        text: `Status: ${this.translateStatus(order.status)}`,
                        time: new Date(order.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}),
                        read: false,
                        type: 'order'
                    }));
                }
            }
        } catch (e) {
            console.warn("Notifications load failed", e);
        }

        this.updateBadge();
        this.renderList();
    }

    translateStatus(status) {
        const map = {
            'pending': 'Pendente',
            'confirmed': 'Confirmado ✅',
            'preparing': 'Sendo preparado 🍳',
            'delivering': 'Saiu para entrega 🛵',
            'completed': 'Entregue 😋',
            'cancelled': 'Cancelado ❌'
        };
        return map[status] || status;
    }

    renderList() {
        const container = document.getElementById('notif-list');
        if (!container) return;

        if (this.notifications.length === 0) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 text-slate-400">
                    <i class="fas fa-bell-slash text-3xl mb-3 opacity-20"></i>
                    <p class="text-xs font-medium uppercase tracking-widest">Sem avisos novos</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.notifications.map(n => `
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-3 items-start transition-all hover:border-primary/30">
                <div class="w-10 h-10 rounded-xl ${n.read ? 'bg-slate-100 text-slate-400' : 'bg-primary/10 text-primary'} flex items-center justify-center flex-shrink-0">
                    <i class="fas ${n.type === 'order' ? 'fa-shopping-bag' : 'fa-info-circle'}"></i>
                </div>
                <div class="flex-1">
                    <div class="flex items-center justify-between gap-2">
                        <span class="text-[13px] font-black text-slate-800 uppercase tracking-tight">${n.title}</span>
                        <span class="text-[10px] font-bold text-slate-400">${n.time}</span>
                    </div>
                    <p class="text-[12px] text-slate-500 mt-1 leading-snug">${n.text}</p>
                </div>
                ${!n.read ? '<div class="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0"></div>' : ''}
            </div>
        `).join('');
    }

    updateBadge() {
        const count = this.notifications.filter(n => !n.read).length;
        const badges = [document.getElementById('notif-count-mobile'), document.getElementById('notif-count-desktop')];
        badges.forEach(b => {
            if (b) {
                b.textContent = count;
                b.style.display = count > 0 ? 'flex' : 'none';
            }
        });
    }

    toggle() {
        const modal = document.getElementById('notifications-modal');
        if (!modal) return;
        this.isOpen = !this.isOpen;
        modal.classList.toggle('hidden', !this.isOpen);
        modal.classList.toggle('flex', this.isOpen);
        if (this.isOpen) {
            this.loadNotifications();
        }
    }

    async checkNewNotifications() {
        if (!window.getUserPhone()) return;
        await this.loadNotifications();
    }
}

// Global instances
window.notificationManager = new NotificationManager();
window.toggleNotifications = () => window.notificationManager.toggle();
window.markAllAsRead = () => {
    window.notificationManager.notifications.forEach(n => n.read = true);
    window.notificationManager.renderList();
    window.notificationManager.updateBadge();
};
