// Evento de clique no botão "Finalizar Compra"
document.getElementById('checkout-btn').addEventListener('click', () => {
    let products = getProductFromStorage();
    if (products.length === 0) {
        // Se o carrinho estiver vazio, exibe um alerta e não continua o processamento
        alert("Seu carrinho está vazio! Adicione produtos antes de finalizar a compra.");
        return;
    }

    showProcessingScreen();  // Mostrar a tela de "Processando"
    setTimeout(() => {
        redirectToWhatsApp();  // Após 2 segundos, redirecionar para o WhatsApp
    }, 2000);  // 2000 milissegundos = 2 segundos
});

// Função para exibir a tela de "Processando"
function showProcessingScreen() {
    // Criar um modal de "Processando"
    const processingModal = document.createElement('div');
    processingModal.id = 'processing-modal';
    processingModal.innerHTML = `
        <div class="processing-container">
            <h2>Processando...</h2>
            <p>Estamos preparando seu pedido. Por favor, aguarde.</p>
            <div class="spinner"></div>  <!-- Um ícone de carregamento -->
            <img src="images/ignite.jpg" alt="Carregando..." class="loading-image"> <!-- Imagem de carregamento -->
        </div>
    `;
    
    // Adicionar o modal ao body
    document.body.appendChild(processingModal);
    
    // Estilizar o modal (pode adicionar estilos CSS para personalizar)
    const style = document.createElement('style');
    style.innerHTML = `
        #processing-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            color: white;
            z-index: 1000;
        }
        .processing-container {
            background: rgba(0, 0, 0, 0.8);
            padding: 20px;
            border-radius: 10px;
            text-align: center;
        }
        .spinner {
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-top: 4px solid #fff;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 2s linear infinite;
            margin: 20px auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .loading-image {
            width: 100px;  /* Ajuste o tamanho da imagem */
            margin-top: 20px;
        }
    `;
    document.head.appendChild(style);
}

// Função para redirecionar para o WhatsApp com as informações da compra
function redirectToWhatsApp() {
    let products = getProductFromStorage();
    let cartInfo = findCartInfo();

    // Confirmar a compra
    let confirmationMessage = `
    🛒 *Resumo do Pedido* 🛒
    
    ${products.map(product => `
    Produto: ${product.name}
    Categoria: ${product.category}
    Preço: ${product.price}
    `).join('\n')}
    
    Total: *$${cartInfo.total}*

    📦 *Deseja finalizar a compra?*📦
    `;

// Exibir uma confirmação ao usuário antes de redirecionar para o WhatsApp
if (confirm(`Seu pedido está pronto para ser enviado. Deseja finalizar? \n\n${confirmationMessage}`)) {
    // Criar a mensagem para o WhatsApp com uma estrutura mais organizada e visualmente atraente
    let message = `*Olá, gostaria de fazer um pedido!*%0A%0A`;

    message += `Aqui estão os detalhes do seu pedido: %0A%0A`;

    // Adicionar os produtos ao corpo da mensagem com uma lista numerada
    products.forEach((product, index) => {
        message += `*Produto ${index + 1}:*%0A`;
        message += `• *Nome:* ${product.name}%0A`;
        message += `• *Categoria:* ${product.category}%0A`;
        message += `• *Preço:* R$ ${product.price}%0A%0A`;
    });

    // Adicionar o total da compra com destaque
    message += `*Resumo da Compra:*%0A`;
    message += `• *Total:* R$ ${cartInfo.total}%0A%0A`;

    // Incluir uma chamada à ação para confirmar ou cancelar a compra
    message += `*Deseja confirmar a compra?*%0A`;
    message += `Responda com *'Sim'* para confirmar ou *'Não'* para cancelar. %0A%0A`;

    message += `Aguardo sua resposta! 🙂%0A`;

    // URL para redirecionar ao WhatsApp com a mensagem formatada
    const phoneNumber = '559285130951'; // Número do WhatsApp sem o '+' e código do país
    const messageEncoded = encodeURIComponent(message); // Codifica a mensagem para URL
    const whatsappLink = `https://wa.me/${phoneNumber}?text=${messageEncoded}`;

    // Fechar a tela de "Processando" antes de redirecionar
    document.getElementById('processing-modal').remove();

    // Redirecionar para o WhatsApp
    window.open(whatsappLink, '_blank');
} else {
        alert("A compra foi cancelada.");
        // Fechar a tela de "Processando" caso o usuário cancele
        document.getElementById('processing-modal').remove();
    }
}

function deleteProduct(e) {
    let cartItem;
    if (e.target.tagName === "BUTTON" || e.target.tagName === "I") {
        cartItem = e.target.closest('.cart-item');
        if (confirm("Tem certeza que deseja remover este item do carrinho?")) {
            cartItem.remove(); // Remove da DOM
            updateCartInfo(); // Atualiza a informação do carrinho
            let products = getProductFromStorage();
            let updatedProducts = products.filter(product => product.id !== parseInt(cartItem.dataset.id));
            localStorage.setItem('products', JSON.stringify(updatedProducts));
        }
    }
}

function addToCartList(product) {
    const cartItem = document.createElement('div');
    cartItem.classList.add('cart-item');
    cartItem.setAttribute('data-id', `${product.id}`);
    cartItem.innerHTML = `
        <img src="${product.imgSrc}" alt="product image">
        <div class="cart-item-info">
            <h3 class="cart-item-name">${product.name}</h3>
            <span class="cart-item-category">${product.category}</span>
            <span class="cart-item-price">${product.price}</span>
        </div>
        <button type="button" class="cart-item-del-btn">
            <i class="fas fa-times"></i>
        </button>
    `;
    cartList.appendChild(cartItem);
    
    // Feedback visual de sucesso
    const feedback = document.createElement('div');
    feedback.classList.add('cart-feedback');
    feedback.textContent = "Produto adicionado ao carrinho!";
    document.body.appendChild(feedback);
    
    setTimeout(() => {
        feedback.remove();
    }, 2000);
}
