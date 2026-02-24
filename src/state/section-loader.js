// section-loader.js - Módulo de Loading de Seções com Performance Otimizada

class SectionLoader {
    constructor() {
        this.loadedSections = new Set();
        this.currentLoader = null;
        this.init();
    }

    init() {
        // Implementar Intersection Observer para lazy loading de seções
        this.setupIntersectionObserver();
        // Pré-carregar imagens críticas
        this.preloadCriticalImages();
        // Implementar caching
        this.setupLocalStorage();
    }

    setupIntersectionObserver() {
        const options = {
            root: null,
            rootMargin: '100px', // Carregar 100px antes de aparecer
            threshold: 0.1
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !this.loadedSections.has(entry.target.id)) {
                    this.loadSection(entry.target);
                }
            });
        }, options);

        // Observar todas as seções
        document.querySelectorAll('section[id]').forEach(section => {
            observer.observe(section);
        });
    }

    loadSection(section) {
        const sectionId = section.id;

        // Mostrar loader
        this.showSectionLoader(section);

        // Simular carregamento com delay mínimo
        setTimeout(() => {
            // Carregar imagens da seção
            const images = section.querySelectorAll('img:not([loading])');
            let imagesLoaded = 0;
            let totalImages = images.length;

            if (totalImages === 0) {
                this.completeSectionLoad(section);
                return;
            }

            images.forEach(img => {
                // Lazy loading nativo
                img.loading = 'lazy';
                img.decoding = 'async';

                // Listener para quando imagem carregar
                img.addEventListener('load', () => {
                    imagesLoaded++;
                    if (imagesLoaded === totalImages) {
                        this.completeSectionLoad(section);
                    }
                });

                img.addEventListener('error', () => {
                    imagesLoaded++;
                    if (imagesLoaded === totalImages) {
                        this.completeSectionLoad(section);
                    }
                });
            });

            // Timeout máximo de 2 segundos
            setTimeout(() => {
                if (imagesLoaded < totalImages) {
                    this.completeSectionLoad(section);
                }
            }, 2000);
        }, 300);

        this.loadedSections.add(sectionId);
    }

    showSectionLoader(section) {
        const loader = document.createElement('div');
        loader.className = 'section-loader';
        loader.innerHTML = `
            <div class="mini-loader">
                <div class="loader-spinner"></div>
                <span class="loader-text">Carregando...</span>
            </div>
        `;

        // Adicionar loader ao topo da seção
        section.insertAdjacentElement('afterbegin', loader);
        this.currentLoader = loader;
    }

    completeSectionLoad(section) {
        // Remover loader
        const loader = section.querySelector('.section-loader');
        if (loader) {
            loader.style.opacity = '0';
            loader.style.transition = 'opacity 0.3s ease';
            setTimeout(() => loader.remove(), 300);
        }

        // Animação de entrada (já implementada com ScrollReveal)
        section.style.opacity = '1';
    }

    preloadCriticalImages() {
        // Pré-carregar primeira imagem da home
        const homeImg = document.querySelector('.home__img');
        if (homeImg && homeImg.src) {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = homeImg.src;
            document.head.appendChild(link);
        }

        // Pré-carregar primeira imagem do about
        const aboutImg = document.querySelector('.about__img');
        if (aboutImg && aboutImg.src) {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = aboutImg.src;
            document.head.appendChild(link);
        }
    }

    setupLocalStorage() {
        // Armazenar seções carregadas
        window.addEventListener('beforeunload', () => {
            try {
                const loadedArray = Array.from(this.loadedSections);
                safeStorage.setItem('igniteSectionsLoaded', JSON.stringify(loadedArray));
            } catch (e) {
                // Storage bloqueado - ignorar
            }
        });

        // Recuperar seções carregadas
        try {
            const stored = safeStorage.getItem('igniteSectionsLoaded');
            if (stored) {
                const arr = JSON.parse(stored);
                arr.forEach(id => this.loadedSections.add(id));
            }
        } catch (e) {
            // Ignorar erro
        }
    }

    // Método para força recarregamento de uma seção
    reloadSection(sectionId) {
        this.loadedSections.delete(sectionId);
        const section = document.getElementById(sectionId);
        if (section) {
            this.loadSection(section);
        }
    }
}

// Inicializar quando DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new SectionLoader();
    });
} else {
    new SectionLoader();
}
