document.addEventListener('DOMContentLoaded', () => {
            feather.replace();

            // --- Menu Mobile ---
            const mobileMenuButton = document.getElementById('mobile-menu-button');
            const mobileMenu = document.getElementById('mobile-menu');
            if (mobileMenuButton) {
                mobileMenuButton.addEventListener('click', () => {
                    mobileMenu.classList.toggle('hidden');
                    const icon = mobileMenuButton.querySelector('i');
                    icon.setAttribute('data-feather', mobileMenu.classList.contains('hidden') ? 'menu' : 'x');
                    feather.replace();
                });
            }

            const sections = document.querySelectorAll('section[id]');
            const navLinks = document.querySelectorAll('#sidebar-nav a');

            // Scroll reveal animation
            const revealObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                    }
                });
            }, { threshold: 0.05 }); 
            
            document.querySelectorAll('.reveal').forEach(el => {
                revealObserver.observe(el);
            });

            // Active sidebar link on scroll
            const activeLinkObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const id = entry.target.getAttribute('id');
                        let activeLink = document.querySelector(`#sidebar-nav a[href="#${id}"]`);
                        
                        if (!activeLink) {
                            // Nếu không tìm thấy, thử tìm mục cha
                            const parentId = id.substring(0, id.lastIndexOf('-'));
                            if (parentId) {
                                activeLink = document.querySelector(`#sidebar-nav a[href="#${parentId}"]`);
                            }
                        }

                        navLinks.forEach(link => link.classList.remove('active'));
                        if(activeLink) {
                            activeLink.classList.add('active');
                        }
                    }
                });
            }, { rootMargin: "-40% 0px -60% 0px" }); // Kích hoạt khi mục ở giữa màn hình

            sections.forEach(section => {
                activeLinkObserver.observe(section);
            });
            
            // Kích hoạt link đầu tiên khi tải trang
            if(navLinks.length > 0) {
                navLinks.forEach(link => link.classList.remove('active'));
                const firstMainLink = document.querySelector('#sidebar-nav a:not(.ml-4)');
                if (firstMainLink) {
                    firstMainLink.classList.add('active');
                } else {
                    navLinks[0].classList.add('active');
                }
            }
        });