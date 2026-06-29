document.addEventListener('DOMContentLoaded', () => {
            feather.replace();

            // Reveal on Scroll
            const revealObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                    }
                });
            }, { threshold: 0.1 });
            
            document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

            // Sidebar Active Tracking
            const sections = document.querySelectorAll('section[id], div[id].bento-card');
            const navLinks = document.querySelectorAll('.sidebar-link');

            const activeLinkObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const id = entry.target.getAttribute('id');
                        navLinks.forEach(link => {
                            link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
                        });
                    }
                });
            }, { rootMargin: "-20% 0px -70% 0px" });

            sections.forEach(section => activeLinkObserver.observe(section));
        });