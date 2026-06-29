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
        });