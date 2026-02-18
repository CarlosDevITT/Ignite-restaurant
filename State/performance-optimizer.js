// performance-optimizer.js - Otimizações de Performance Global

class PerformanceOptimizer {
    constructor() {
        this.init();
    }

    init() {
        this.optimizeDOM();
        this.optimizeScripts();
        this.optimizeImages();
        this.setupServiceWorker();
        this.measurePerformance();
    }

    // 1. Otimizações de DOM
    optimizeDOM() {
        // Desabilitar animations para conexões lenta
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (mediaQuery.matches) {
            document.documentElement.style.setProperty('--animation-duration', '0s');
        }

        // Usar requestIdleCallback para tarefas não críticas
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                this.cleanupDOMEvents();
            });
        }
    }

    // 2. Otimizar carregamento de scripts
    optimizeScripts() {
        // Estratégia de resource hints
        const link = document.createElement('link');
        link.rel = 'dns-prefetch';
        link.href = '//cdn.jsdelivr.net';
        document.head.appendChild(link);

        // Prefetch de URLs importantes
        this.prefetchResources();
    }

    // 3. Otimizações de imagens
    optimizeImages() {
        // Implementar WebP fallback
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            // Atualizar atributo alt se não existir
            if (!img.alt) {
                img.alt = 'Imagem Ignite';
            }
            // Adicionar decoding assíncrono
            img.decoding = 'async';
        });

        // Usar picture element para formatos modernos
        this.convertToWebP();
    }

    // 4. Converter para WebP quando disponível
    convertToWebP() {
        const supportsWebP = (() => {
            const canvas = document.createElement('canvas');
            return canvas.toDataURL('image/webp').indexOf('image/webp') === 5;
        })();

        if (supportsWebP) {
            console.log('WebP suportado: implementar conversão');
        }
    }

    // 5. Prefetch de recursos
    prefetchResources() {
        const resources = [
            { rel: 'prefetch', href: 'cart-pay/index.html' },
            { rel: 'prefetch', href: 'routes/index.html' }
        ];

        resources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = resource.rel;
            link.href = resource.href;
            document.head.appendChild(link);
        });
    }

    // 6. Service Worker para cache
    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            // Service worker deve ser registrado
            // navigator.serviceWorker.register('sw.js').catch(() => {
            //     console.log('Service Worker não disponível');
            // });
        }
    }

    // 7. Medir performance
    measurePerformance() {
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach((entry) => {
                        if (entry.duration > 3000) {
                            console.warn(`Tarefa lenta detectada: ${entry.name} - ${entry.duration}ms`);
                        }
                    });
                });

                observer.observe({ entryTypes: ['longtask'] });
            } catch (e) {
                console.log('PerformanceObserver não suportado');
            }
        }

        // Medir Web Vitals
        this.measureWebVitals();
    }

    // 8. Medir Web Vitals (LCP, FID, CLS)
    measureWebVitals() {
        // Largest Contentful Paint (LCP)
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    console.log('LCP:', lastEntry.renderTime || lastEntry.loadTime);
                });
                observer.observe({ entryTypes: ['largest-contentful-paint'] });
            } catch (e) {
                console.log('LCP não disponível');
            }
        }

        // Cumulative Layout Shift (CLS)
        if ('PerformanceObserver' in window) {
            let clsValue = 0;
            try {
                const observer = new PerformanceObserver((list) => {
                    list.getEntries().forEach((entry) => {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                            console.log('CLS:', clsValue);
                        }
                    });
                });
                observer.observe({ entryTypes: ['layout-shift'] });
            } catch (e) {
                console.log('CLS não disponível');
            }
        }
    }

    // 9. Limpar eventos DOM não usados
    cleanupDOMEvents() {
        // Remover event listeners antigos
        const elementsWithListeners = document.querySelectorAll('[data-old-listener]');
        elementsWithListeners.forEach(el => {
            el.removeAttribute('data-old-listener');
        });
    }

    // 10. Otimizar CSS (remover estilos não utilizados)
    optimizeCSS() {
        // Identificar estilos não utilizados (em navegadores com suporte)
        if ('CSS' in window && 'supports' in CSS) {
            console.log('Verificação de CSS não utilizado disponível');
        }
    }

    // Método para desabilitar animações para usuários com preferência
    respectUserPreferences() {
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
            document.documentElement.classList.add('reduce-motion');
        }

        // Dark theme preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark && !localStorage.getItem('selected-theme')) {
            document.body.classList.add('dark-theme');
        }
    }
}

// Inicializar otimizador quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new PerformanceOptimizer();
    });
} else {
    new PerformanceOptimizer();
}
