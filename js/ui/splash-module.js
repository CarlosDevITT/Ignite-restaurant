// splash-module.js - Módulo de Splash Screen Reutilizável
class SplashScreen {
    constructor(options = {}) {
        this.options = {
            duration: 3000,
            autoShow: true,
            showOnce: true,
            storageKey: 'splashShown',
            ...options
        };
        
        this.splashElement = null;
        this.init();
    }
    
    init() {
        // Verificar se deve mostrar a splash screen
        if (this.options.autoShow) {
            this.checkAndShow();
        }
    }
    
    checkAndShow() {
        // Verificar se já foi mostrada (se configurado para mostrar apenas uma vez)
        if (this.options.showOnce) {
            const alreadyShown = sessionStorage.getItem(this.options.storageKey);
            if (alreadyShown) {
                return;
            }
        }
        
        this.show();
    }
    
    show() {
        // Criar elemento da splash screen
        this.splashElement = document.createElement('div');
        this.splashElement.id = 'splash-screen-module';
        this.splashElement.innerHTML = this.getSplashHTML();
        
        // Adicionar estilos
        this.addStyles();
        
        // Adicionar ao body
        document.body.appendChild(this.splashElement);
        
        // Iniciar animações
        this.startAnimations();
        
        // Marcar como mostrada
        if (this.options.showOnce) {
            sessionStorage.setItem(this.options.storageKey, 'true');
        }
        
        // Remover após o tempo especificado
        setTimeout(() => {
            this.hide();
        }, this.options.duration);
    }
    
    hide() {
        if (this.splashElement) {
            this.splashElement.style.opacity = '0';
            this.splashElement.style.transition = 'opacity 0.5s ease';
            
            setTimeout(() => {
                if (this.splashElement && this.splashElement.parentNode) {
                    this.splashElement.parentNode.removeChild(this.splashElement);
                    this.splashElement = null;
                }
            }, 500);
        }
    }
    
    addStyles() {
        const style = document.createElement('style');
        style.textContent = this.getSplashCSS();
        document.head.appendChild(style);
    }
    
    getSplashHTML() {
        return `
            <div class="splash-container">
                <!-- Efeito de brilho -->
                <div class="glow"></div>
                
                <!-- Formas flutuantes -->
                <div class="floating-shapes">
                    <div class="shape"></div>
                    <div class="shape"></div>
                    <div class="shape"></div>
                </div>
                
                <!-- Partículas de fundo -->
                <div class="particles" id="splash-particles"></div>
                
                <!-- Objetos saltitantes -->
                <div class="bouncing-objects">
                    <div class="bouncing-object"><i class="fas fa-utensils"></i></div>
                    <div class="bouncing-object"><i class="fas fa-wine-glass-alt"></i></div>
                    <div class="bouncing-object"><i class="fas fa-fire"></i></div>
                    <div class="bouncing-object"><i class="fas fa-mug-hot"></i></div>
                    <div class="bouncing-object"><i class="fas fa-hamburger"></i></div>
                    <div class="bouncing-object"><i class="fas fa-cheese"></i></div>
                </div>
                
                <!-- Logo central -->
                <div class="logo-container">
                    <div class="logo">
                        <div class="logo-icon">
                            <i class="fas fa-fire"></i>
                        </div>
                        IGNITE
                    </div>
                </div>
                
                <!-- Texto e barra de progresso -->
                <div class="loading-text">Iniciando experiência...</div>
                <div class="progress-container">
                    <div class="progress-bar">
                        <div class="progress"></div>
                    </div>
                </div>
            </div>
        `;
    }
    
    getSplashCSS() {
        return `
            #splash-screen-module {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 9999;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            
            #splash-screen-module .splash-container {
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #1e5631 0%, #2a7d4a 50%, #38a169 100%);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                color: white;
                overflow: hidden;
            }

            /* Efeito de brilho */
            #splash-screen-module .glow {
                position: absolute;
                width: 300px;
                height: 300px;
                background: radial-gradient(circle, rgba(56, 161, 105, 0.2) 0%, rgba(56, 161, 105, 0) 70%);
                border-radius: 50%;
                filter: blur(20px);
                z-index: 0;
                animation: splashGlowPulse 3s infinite alternate;
            }

            @keyframes splashGlowPulse {
                0% {
                    transform: scale(0.8);
                    opacity: 0.3;
                }
                100% {
                    transform: scale(1.2);
                    opacity: 0.6;
                }
            }

            /* Formas flutuantes */
            #splash-screen-module .floating-shapes {
                position: absolute;
                width: 100%;
                height: 100%;
                z-index: 2;
            }

            #splash-screen-module .shape {
                position: absolute;
                border-radius: 50%;
                background: rgba(26, 26, 26, 0.1);
                animation: splashPulseShape 4s infinite ease-in-out;
            }

            #splash-screen-module .shape:nth-child(1) {
                width: 120px;
                height: 120px;
                top: 10%;
                left: 5%;
                animation-delay: 0s;
            }

            #splash-screen-module .shape:nth-child(2) {
                width: 80px;
                height: 80px;
                bottom: 15%;
                right: 8%;
                animation-delay: 1s;
            }

            #splash-screen-module .shape:nth-child(3) {
                width: 150px;
                height: 150px;
                top: 60%;
                left: 80%;
                animation-delay: 2s;
            }

            @keyframes splashPulseShape {
                0%, 100% {
                    transform: scale(1);
                    opacity: 0.1;
                }
                50% {
                    transform: scale(1.2);
                    opacity: 0.2;
                }
            }

            /* Partículas de fundo */
            #splash-screen-module .particles {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 1;
            }

            #splash-screen-module .particle {
                position: absolute;
                background-color: rgba(26, 26, 26, 0.4);
                border-radius: 50%;
                animation: splashFloat 15s infinite linear;
            }

            @keyframes splashFloat {
                0% {
                    transform: translateY(0) rotate(0deg);
                    opacity: 1;
                }
                100% {
                    transform: translateY(-1000px) rotate(720deg);
                    opacity: 0;
                }
            }

            /* Objetos saltitantes */
            #splash-screen-module .bouncing-objects {
                position: absolute;
                width: 100%;
                height: 100%;
                z-index: 5;
            }

            #splash-screen-module .bouncing-object {
                position: absolute;
                width: 70px;
                height: 70px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 28px;
                color: white;
                background: rgba(26, 26, 26, 0.8);
                backdrop-filter: blur(10px);
                box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
                border: 2px solid rgba(255, 255, 255, 0.1);
                opacity: 0;
            }

            /* Posicionamento dos objetos */
            #splash-screen-module .bouncing-object:nth-child(1) {
                top: 20%;
                left: 15%;
                animation: splashBounceIn 0.6s 0.1s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }

            #splash-screen-module .bouncing-object:nth-child(2) {
                top: 15%;
                right: 20%;
                animation: splashBounceIn 0.6s 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }

            #splash-screen-module .bouncing-object:nth-child(3) {
                bottom: 25%;
                left: 20%;
                animation: splashBounceIn 0.6s 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }

            #splash-screen-module .bouncing-object:nth-child(4) {
                bottom: 20%;
                right: 15%;
                animation: splashBounceIn 0.6s 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }

            #splash-screen-module .bouncing-object:nth-child(5) {
                top: 40%;
                left: 10%;
                animation: splashBounceIn 0.6s 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }

            #splash-screen-module .bouncing-object:nth-child(6) {
                top: 35%;
                right: 10%;
                animation: splashBounceIn 0.6s 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }

            @keyframes splashBounceIn {
                0% {
                    opacity: 0;
                    transform: scale(0.3) translateY(-100px);
                }
                50% {
                    opacity: 1;
                    transform: scale(1.05) translateY(20px);
                }
                70% {
                    transform: scale(0.95) translateY(-10px);
                }
                100% {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                }
            }

            /* Logo central */
            #splash-screen-module .logo-container {
                position: relative;
                z-index: 10;
                margin-bottom: 40px;
                opacity: 0;
                animation: splashLogoRotateScale 0.8s 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }

            #splash-screen-module .logo {
                font-size: 64px;
                font-weight: 900;
                color: white;
                text-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                display: flex;
                align-items: center;
                justify-content: center;
            }

            #splash-screen-module .logo-icon {
                width: 70px;
                height: 70px;
                background: #1a1a1a;
                border-radius: 15px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-right: 15px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                border: 2px solid rgba(255, 255, 255, 0.1);
            }

            #splash-screen-module .logo-icon i {
                font-size: 36px;
                color: #38a169;
            }

            @keyframes splashLogoRotateScale {
                0% {
                    opacity: 0;
                    transform: scale(0) rotate(-180deg);
                }
                70% {
                    transform: scale(1.1) rotate(10deg);
                }
                100% {
                    opacity: 1;
                    transform: scale(1) rotate(0deg);
                }
            }

            /* Texto e barra de progresso */
            #splash-screen-module .loading-text {
                margin-top: 20px;
                font-size: 16px;
                font-weight: 500;
                opacity: 0;
                animation: splashFadeIn 0.5s 2s forwards;
                color: rgba(255, 255, 255, 0.9);
            }

            @keyframes splashFadeIn {
                0% {
                    opacity: 0;
                }
                100% {
                    opacity: 1;
                }
            }

            #splash-screen-module .progress-container {
                width: 200px;
                margin-top: 15px;
                opacity: 0;
                animation: splashFadeIn 0.5s 2.2s forwards;
            }

            #splash-screen-module .progress-bar {
                height: 4px;
                background-color: rgba(26, 26, 26, 0.4);
                border-radius: 2px;
                overflow: hidden;
            }

            #splash-screen-module .progress {
                height: 100%;
                width: 0%;
                background: linear-gradient(90deg, #1a1a1a, #38a169);
                border-radius: 2px;
                animation: splashLoading 2s 2.2s ease-in-out forwards;
            }

            @keyframes splashLoading {
                0% {
                    width: 0%;
                }
                50% {
                    width: 70%;
                }
                100% {
                    width: 100%;
                }
            }
        `;
    }
    
    startAnimations() {
        // Criar partículas de fundo
        const particlesContainer = document.getElementById('splash-particles');
        const particleCount = 25;
        
        for (let i = 0; i < particleCount; i++) {
            const particle = document.createElement('div');
            particle.classList.add('particle');
            
            // Tamanho aleatório
            const size = Math.random() * 12 + 3;
            particle.style.width = `${size}px`;
            particle.style.height = `${size}px`;
            
            // Posição aleatória
            particle.style.left = `${Math.random() * 100}%`;
            particle.style.top = `${Math.random() * 100}%`;
            
            // Opacidade aleatória
            const opacity = Math.random() * 0.3 + 0.1;
            particle.style.backgroundColor = `rgba(26, 26, 26, ${opacity})`;
            
            // Duração e delay aleatórios
            const duration = Math.random() * 20 + 10;
            const delay = Math.random() * 5;
            particle.style.animationDuration = `${duration}s`;
            particle.style.animationDelay = `${delay}s`;
            
            particlesContainer.appendChild(particle);
        }
    }
}

// Exportar para uso global
window.SplashScreen = SplashScreen;
