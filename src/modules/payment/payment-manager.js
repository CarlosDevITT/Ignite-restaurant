/**
 * PAYMENT MANAGER - Integração  APIs de Pagamento
 * Suporta: MercadoPago, Stripe, PayPal
 */

class PaymentManager {
  constructor(config = {}) {
    this.config = {
      provider: config.provider || 'mercadopago', // 'mercadopago', 'stripe', 'paypal', 'abacatepay'
      mercadoPago: {
        publicKey: config.mercadopagoKey || 'TEST-3fb32c3e-a4f3-4d42-86d1-3d49b6c3b8f5',
        integrator: 'ignite-restaurant'
      },
      stripe: {
        publicKey: config.stripeKey || 'pk_test_test',
      },
      paypal: {
        clientId: config.paypalClientId || 'test',
      },
      returnUrl: config.returnUrl || window.location.origin + '/cart-pay',
      webhook: config.webhook || 'https://seu-servidor.com/webhook/pagamento'
      ,abacatePay: {
        apiKey: config.abacatePayKey || 'abc_dev_W6dyNyyLzPKnEccqt5rGFeCB',
      }
    };

    this.isInitialized = false;
    this.currentPayment = null;
    this.paymentHistory = [];

    this.init();
  }

  /**
   * Inicializa o Payment Manager
   */
  async init() {
    try {
      console.log(`🔄 Inicializando PaymentManager com provider: ${this.config.provider}`);


      switch (this.config.provider) {
        case 'mercadopago':
          await this.initMercadoPago();
          break;
        case 'stripe':
          await this.initStripe();
          break;
        case 'paypal':
          await this.initPayPal();
          break;
        case 'abacatepay':
          await this.initAbacatePay();
          break;
      }
      this.isInitialized = true;
      console.log('✅ PaymentManager inicializado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao inicializar PaymentManager:', error);
    }
  }

  /**
   * Inicializa AbacatePay
   */
  async initAbacatePay() {
    // Supondo que AbacatePay use um endpoint JS externo
    return new Promise((resolve, reject) => {
      if (window.AbacatePay) {
        console.log('✅ AbacatePay SDK já carregado');
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.abacatepay.com/sdk/v1/abacatepay.min.js';
      script.onload = () => {
        if (window.AbacatePay) {
          console.log('✅ AbacatePay SDK carregado');
          resolve();
        } else {
          reject(new Error('AbacatePay SDK não carregou'));
        }
      };
      script.onerror = () => reject(new Error('Erro ao carregar AbacatePay SDK'));
      document.head.appendChild(script);
    });
  }

  /**
   * Processa pagamento via AbacatePay
   */
  async processAbacatePayPayment(orderData) {
    try {
      console.log('🥑 Processando pagamento AbacatePay...', orderData);
      if (!this.validateOrderData(orderData)) {
        throw new Error('Dados do pedido inválidos');
      }
      // Exemplo de integração: enviar dados para API AbacatePay
      const response = await fetch('/api/pagamento/abacatepay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-abacatepay-key': this.config.abacatePay.apiKey },
        body: JSON.stringify({
          amount: orderData.total,
          description: `Pedido Ignite - ${orderData.items.length} itens`,
          orderId: orderData.orderId,
          customer: {
            name: orderData.nome,
            phone: orderData.telefone,
            address: orderData.endereco
          },
          items: orderData.items
        })
      });
      const result = await response.json();
      if (result.success) {
        console.log('✅ Pagamento AbacatePay aprovado:', result);
        this.currentPayment = {
          provider: 'abacatepay',
          status: 'approved',
          paymentId: result.paymentId,
          orderId: orderData.orderId,
          amount: orderData.total,
          timestamp: new Date(),
          reference: result.reference
        };
        return { success: true, payment: this.currentPayment };
      } else {
        throw new Error(result.error || 'Erro no pagamento AbacatePay');
      }
    } catch (error) {
      console.error('❌ Erro no pagamento AbacatePay:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Inicializa MercadoPago
   */
  async initMercadoPago() {
    return new Promise((resolve, reject) => {
      // Carregar SDK MercadoPago
      if (document.getElementById('mercadopago-script')) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.id = 'mercadopago-script';
      script.src = 'https://sdk.mercadopago.com/js/v2';
      script.onload = () => {
        if (window.MercadoPago) {
          // Nova API do MercadoPago v2 - não precisa mais de setPublishableKey
          // A chave pública é passada ao criar o checkout
          console.log('✅ MercadoPago SDK carregado');
          resolve();
        } else {
          reject(new Error('MercadoPago SDK não carregou'));
        }
      };
      script.onerror = () => reject(new Error('Erro ao carregar MercadoPago SDK'));
      document.head.appendChild(script);
    });
  }

  /**
   * Inicializa Stripe
   */
  async initStripe() {
    return new Promise((resolve, reject) => {
      if (window.Stripe) {
        this.stripe = window.Stripe(this.config.stripe.publicKey);
        console.log('✅ Stripe SDK carregado');
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://js.stripe.com/v3/';
      script.onload = () => {
        this.stripe = window.Stripe(this.config.stripe.publicKey);
        console.log('✅ Stripe SDK carregado');
        resolve();
      };
      script.onerror = () => reject(new Error('Erro ao carregar Stripe SDK'));
      document.head.appendChild(script);
    });
  }

  /**
   * Inicializa PayPal
   */
  async initPayPal() {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = `https://www.paypal.com/sdk/js?client-id=${this.config.paypal.clientId}`;
      script.onload = () => {
        console.log('✅ PayPal SDK carregado');
        resolve();
      };
      script.onerror = () => reject(new Error('Erro ao carregar PayPal SDK'));
      document.head.appendChild(script);
    });
  }

  /**
   * Processa pagamento via MercadoPago
   */
  async processMercadoPagoPayment(orderData) {
    try {
      console.log('💳 Processando pagamento MercadoPago...', orderData);

      // Validar dados
      if (!this.validateOrderData(orderData)) {
        throw new Error('Dados do pedido inválidos');
      }

      // Preparar dados de pagamento
      const paymentData = {
        token: orderData.token, // Token gerado pelo Checkout Pro
        installments: orderData.installments || 1,
        amount: orderData.total,
        description: `Pedido Ignite - ${orderData.items.length} itens`,
        external_reference: orderData.orderId,
        metadata: {
          restaurant: 'ignite-restaurant',
          items_count: orderData.items.length,
          delivery_address: orderData.endereco,
          phone: orderData.telefone
        }
      };

      // Enviar para sua API (backend)
      const response = await fetch('/api/pagamento/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(paymentData)
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ Pagamento MercadoPago aprovado:', result);
        this.currentPayment = {
          provider: 'mercadopago',
          status: 'approved',
          paymentId: result.paymentId,
          orderId: orderData.orderId,
          amount: orderData.total,
          timestamp: new Date(),
          reference: result.reference
        };
        return { success: true, payment: this.currentPayment };
      } else {
        throw new Error(result.error || 'Erro no pagamento');
      }
    } catch (error) {
      console.error('❌ Erro no pagamento MercadoPago:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Processa pagamento via Stripe
   */
  async processStripePayment(orderData) {
    try {
      console.log('💳 Processando pagamento Stripe...', orderData);

      if (!this.validateOrderData(orderData)) {
        throw new Error('Dados do pedido inválidos');
      }

      // Criar intent de pagamento
      const response = await fetch('/api/pagamento/stripe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(orderData.total * 100), // Stripe usa centavos
          currency: 'brl',
          description: `Pedido Ignite - ${orderData.items.length} itens`,
          metadata: {
            orderId: orderData.orderId,
            restaurant: 'ignite-restaurant'
          }
        })
      });

      const { clientSecret } = await response.json();

      // Confirmar pagamento
      const result = await this.stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: this.stripe.elements().getElement('card'),
          billing_details: {
            name: orderData.nome || 'Cliente',
            phone: orderData.telefone
          }
        }
      });

      if (result.paymentIntent.status === 'succeeded') {
        console.log('✅ Pagamento Stripe aprovado:', result);
        this.currentPayment = {
          provider: 'stripe',
          status: 'approved',
          paymentId: result.paymentIntent.id,
          orderId: orderData.orderId,
          amount: orderData.total,
          timestamp: new Date()
        };
        return { success: true, payment: this.currentPayment };
      } else {
        throw new Error('Pagamento não foi confirmado');
      }
    } catch (error) {
      console.error('❌ Erro no pagamento Stripe:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Processa pagamento via PIX (via MercadoPago)
   */
  async processPixPayment(orderData) {
    try {
      console.log('🟪 Gerando QR Code PIX...', orderData);

      if (!this.validateOrderData(orderData)) {
        throw new Error('Dados do pedido inválidos');
      }

      const response = await fetch('/api/pagamento/pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: orderData.total,
          description: `Pedido Ignite - ${orderData.items.length} itens`,
          externalReference: orderData.orderId,
          notificationUrl: this.config.webhook
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ QR Code PIX gerado:', result);
        this.currentPayment = {
          provider: 'pix',
          status: 'pending',
          paymentId: result.paymentId,
          orderId: orderData.orderId,
          amount: orderData.total,
          qrCode: result.qrCode,
          qrCodeBase64: result.qrCodeBase64,
          copyPaste: result.copyPaste,
          expiresAt: result.expiresAt,
          timestamp: new Date()
        };
        return { success: true, payment: this.currentPayment };
      } else {
        throw new Error(result.error || 'Erro ao gerar PIX');
      }
    } catch (error) {
      console.error('❌ Erro ao gerar PIX:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Abre modal de checkout
   */
  openCheckout(orderData) {
    try {
      console.log('🔓 Abrindo modal de checkout');

      if (!this.validateOrderData(orderData)) {
        throw new Error('Dados do pedido inválidos');
      }

      // Usar SweetAlert para modal
      if (typeof Swal === 'undefined') {
        console.error('SweetAlert2 não carregado');
        return;
      }

      Swal.fire({
        title: 'Escolha a forma de pagamento',
        html: `
          <div class="payment-methods">
            <button class="payment-method-btn pix-btn" onclick="window.paymentManager?.selectPaymentMethod('pix')">
              <i class="fas fa-qrcode"></i>
              <span>PIX</span>
            </button>
            <button class="payment-method-btn card-btn" onclick="window.paymentManager?.selectPaymentMethod('card')">
              <i class="fas fa-credit-card"></i>
              <span>Cartão de Crédito</span>
            </button>
            <button class="payment-method-btn boleto-btn" onclick="window.paymentManager?.selectPaymentMethod('boleto')">
              <i class="fas fa-barcode"></i>
              <span>Boleto</span>
            </button>
          </div>
        `,
        icon: 'question',
        showCancelButton: true,
        cancelButtonText: 'Cancelar',
        allowOutsideClick: false,
        didOpen: (modal) => {
          modal.style.maxWidth = '600px';
        }
      });

      this.currentPayment = orderData;
    } catch (error) {
      console.error('❌ Erro ao abrir checkout:', error);
      Swal?.fire('Erro', error.message, 'error');
    }
  }

  /**
   * Seleciona método de pagamento
   */
  async selectPaymentMethod(method) {
    try {
      console.log(`✅ Método selecionado: ${method}`);

      Swal.close();

      let result;


      switch (method) {
        case 'pix':
          result = await this.processPixPayment(this.currentPayment);
          if (result.success) {
            this.showPixModal(result.payment);
          }
          break;
        case 'card':
          result = await this.processStripePayment(this.currentPayment);
          if (result.success) {
            this.showSuccessModal(result.payment);
          }
          break;
        case 'boleto':
          result = await this.generateBoleto(this.currentPayment);
          if (result.success) {
            this.showBoletoModal(result.payment);
          }
          break;
        case 'abacatepay':
          result = await this.processAbacatePayPayment(this.currentPayment);
          if (result.success) {
            this.showSuccessModal(result.payment);
          }
          break;
        default:
          throw new Error('Método de pagamento inválido');
      }

      if (!result.success) {
        Swal.fire('Erro no Pagamento', result.error, 'error');
      }
    } catch (error) {
      console.error('❌ Erro ao selecionar método:', error);
      Swal?.fire('Erro', error.message, 'error');
    }
  }

  /**
   * Mostra modal com QR Code PIX
   */
  showPixModal(payment) {
    Swal.fire({
      title: 'Pagamento via PIX',
      html: `
        <div class="pix-modal">
          <p>Escaneie o código com seu aplicativo bancário:</p>
          <img src="${payment.qrCodeBase64}" alt="QR Code PIX" class="pix-qrcode">
          <div class="pix-copy">
            <p>Ou copie a chave:</p>
            <div class="copy-field">
              <input type="text" value="${payment.copyPaste}" readonly id="pix-copy-input">
              <button onclick="document.getElementById('pix-copy-input').select(); document.execCommand('copy');">
                <i class="fas fa-copy"></i> Copiar
              </button>
            </div>
          </div>
          <p class="pix-expiry">⏱️ Expira em ${new Date(payment.expiresAt).toLocaleTimeString()}</p>
          <p class="pix-status">Aguardando confirmação do pagamento...</p>
        </div>
      `,
      icon: 'success',
      allowOutsideClick: false,
      showConfirmButton: false,
      didOpen: () => {
        // Verificar status do pagamento a cada 5 segundos
        this.checkPixPaymentStatus(payment.paymentId);
      }
    });
  }

  /**
   * Mostra modal de sucesso
   */
  showSuccessModal(payment) {
    Swal.fire({
      title: 'Pagamento Aprovado! ✅',
      html: `
        <div class="payment-success">
          <p>Seu pedido foi confirmado com sucesso!</p>
          <div class="payment-details">
            <p><strong>ID do Pagamento:</strong> ${payment.paymentId}</p>
            <p><strong>Valor:</strong> R$ ${payment.amount.toFixed(2)}</p>
          </div>
          <p>Você receberá um SMS de confirmação em breve.</p>
        </div>
      `,
      icon: 'success',
      confirmButtonText: 'OK',
      confirmButtonColor: '#069C54'
    }).then(() => {
      this.redirectToOrderStatus(payment.orderId);
    });
  }

  /**
   * Mostra modal com boleto
   */
  showBoletoModal(payment) {
    Swal.fire({
      title: 'Boleto Bancário',
      html: `
        <div class="boleto-modal">
          <p>Seu boleto foi gerado com sucesso!</p>
          <div class="boleto-code">
            <input type="text" value="${payment.boletoCode}" readonly id="boleto-copy-input">
            <button onclick="document.getElementById('boleto-copy-input').select(); document.execCommand('copy');">
              <i class="fas fa-copy"></i> Copiar
            </button>
          </div>
          <button onclick="window.open('${payment.boletoUrl}', '_blank');" class="download-boleto">
            <i class="fas fa-download"></i> Baixar Boleto
          </button>
        </div>
      `,
      icon: 'info',
      confirmButtonText: 'OK',
      confirmButtonColor: '#069C54'
    });
  }

  /**
   * Verifica status do pagamento PIX
   */
  async checkPixPaymentStatus(paymentId) {
    const checkInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/pagamento/status/${paymentId}`);
        const result = await response.json();

        if (result.status === 'approved' || result.status === 'confirmed') {
          clearInterval(checkInterval);
          Swal.close();
          this.showSuccessModal({
            paymentId,
            orderId: this.currentPayment.orderId,
            amount: this.currentPayment.total
          });
        }
      } catch (error) {
        console.error('Erro ao verificar status PIX:', error);
      }
    }, 5000); // Verificar a cada 5 segundos

    // Parar após 30 minutos
    setTimeout(() => clearInterval(checkInterval), 30 * 60 * 1000);
  }

  /**
   * Gera boleto
   */
  async generateBoleto(orderData) {
    try {
      const response = await fetch('/api/pagamento/boleto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: orderData.total,
          description: `Pedido Ignite - ${orderData.orderId}`,
          dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 dias
        })
      });

      const result = await response.json();

      if (result.success) {
        return {
          success: true,
          payment: {
            boletoCode: result.code,
            boletoUrl: result.url,
            dueDateDate: result.dueDate
          }
        };
      } else {
        throw new Error(result.error || 'Erro ao gerar boleto');
      }
    } catch (error) {
      console.error('❌ Erro ao gerar boleto:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Valida dados do pedido
   */
  validateOrderData(data) {
    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      console.error('❌ Items inválidos');
      return false;
    }

    if (!data.total || data.total <= 0) {
      console.error('❌ Total inválido');
      return false;
    }

    if (!data.endereco || data.endereco.trim() === '') {
      console.error('❌ Endereço não informado');
      return false;
    }

    if (!data.telefone || data.telefone.trim() === '') {
      console.error('❌ Telefone não informado');
      return false;
    }

    return true;
  }

  /**
   * Redireciona para página de status do pedido
   */
  redirectToOrderStatus(orderId) {
    setTimeout(() => {
      window.location.href = `/order-status?id=${orderId}`;
    }, 2000);
  }

  /**
   * Retorna histórico de pagamentos
   */
  getPaymentHistory() {
    return this.paymentHistory;
  }

  /**
   * Retorna pagamento atual
   */
  getCurrentPayment() {
    return this.currentPayment;
  }
}

// Inicializar globalmente
window.paymentManager = new PaymentManager({
  provider: 'mercadopago', // ou 'stripe', 'paypal', 'abacatepay'
  mercadopagoKey: 'TEST-3fb32c3e-a4f3-4d42-86d1-3d49b6c3b8f5',
  abacatePayKey: 'abc_dev_W6dyNyyLzPKnEccqt5rGFeCB',
});

console.log('✅ PaymentManager carregado globalmente em window.paymentManager');
