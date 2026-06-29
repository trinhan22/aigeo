import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        // Khởi tạo Firebase
        // Lưu ý: Đảm bảo file firebase-config.js của bạn có biến firebaseConfig
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        // --- ELEMENTS ---
        const loginBtn = document.getElementById('btn-login-main');
        const userPill = document.getElementById('user-logged-pill');
        const dropdown = document.getElementById('auth-dropdown-menu');
        const dashboardLink = document.getElementById('link-to-dashboard');
        const logoutBtn = document.getElementById('btn-logout-header');

        // --- 1. THEO DÕI TRẠNG THÁI ĐĂNG NHẬP ---
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        const role = userData.role || 'student';
                        
                        // Hiển thị thông tin
                        const fullName = userData.name || "Người dùng";
                        document.getElementById('user-name-header').textContent = fullName;
                        document.getElementById('user-avatar-header').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=0D9488&color=fff&bold=true`;
                        
                        // Cập nhật link Dashboard
                        if(dashboardLink) dashboardLink.href = `/${role}/index.html`;

                        // Đổi trạng thái nút trên Header
                        if(loginBtn) loginBtn.style.display = 'none';
                        if(userPill) userPill.style.display = 'flex';
                        
                        feather.replace(); // Vẽ lại icon
                    }
                } catch (e) { console.error("Lỗi Auth:", e); }
            } else {
                if(loginBtn) loginBtn.style.display = 'inline-flex';
                if(userPill) userPill.style.display = 'none';
            }
        });

        // --- 2. ĐIỀU KHIỂN DROPDOWN ---
        if (userPill) {
            userPill.addEventListener('click', (e) => {
                e.stopPropagation();
                const isVisible = dropdown.style.display === 'block';
                dropdown.style.display = isVisible ? 'none' : 'block';
                if (!isVisible) {
                    anime({ targets: '#auth-dropdown-menu', translateY: [15, 0], opacity: [0, 1], duration: 400, easing: 'easeOutBack' });
                }
            });
        }
        document.addEventListener('click', () => { if(dropdown) dropdown.style.display = 'none'; });

        // --- 3. ĐĂNG XUẤT ---
        if (logoutBtn) {
            logoutBtn.onclick = () => {
                signOut(auth).then(() => window.location.reload());
            };
        }

        // --- 4. TABS & CAROUSEL (Gán vào window để onclick hoạt động) ---
        window.switchTab = (tabId, btn) => {
            document.querySelectorAll('.about-pane').forEach(p => p.classList.remove('active'));
            document.querySelectorAll('.about-tab-btn').forEach(b => b.classList.remove('active'));
            document.getElementById('tab-' + tabId).classList.add('active');
            btn.classList.add('active');
        };

        const images = [
            'https://cdn.pixabay.com/photo/2023/10/10/07/56/rice-fields-8305669_1280.jpg',
            'https://cdn.pixabay.com/photo/2017/08/23/11/04/vietnam-2672413_1280.jpg',
            'https://cdn.pixabay.com/photo/2020/11/04/16/26/river-5712899_1280.jpg',
            'https://cdn.pixabay.com/photo/2018/04/28/03/15/soi-ball-3356526_1280.jpg',
            'https://cdn.pixabay.com/photo/2021/08/21/09/24/dawn-6562284_1280.jpg',
            'https://cdn.pixabay.com/photo/2018/04/28/03/13/vietnam-3356516_1280.jpg',
            'https://cdn.pixabay.com/photo/2019/12/20/11/27/scenery-4708266_1280.jpg'
        ];
        let currentIndex = 0;
        const carousel = document.getElementById('background-carousel');
        const changeBg = () => {
            if(!carousel) return;
            carousel.style.opacity = 0;
            setTimeout(() => {
                carousel.style.backgroundImage = `url('${images[currentIndex]}')`;
                carousel.style.opacity = 0.08;
                currentIndex = (currentIndex + 1) % images.length;
            }, 1000);
        };
        setInterval(changeBg, 5000); 
        changeBg();

        // --- 5. INITIALIZE ---
        document.addEventListener('DOMContentLoaded', () => {
            feather.replace();
            anime({
                targets: '.hero-text, .hero-image',
                translateY: [30, 0],
                opacity: [0, 1],
                delay: anime.stagger(200),
                easing: 'easeOutExpo'
            });
        });

// 1. Chặn Chuột phải (Để ẩn menu "Inspect/Kiểm tra" và "View Source/Xem nguồn")
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        // Không hiện thông báo gì cả để trải nghiệm mượt mà hơn
    });

    // 2. Chặn các phím tắt Developer Tools
    document.addEventListener('keydown', function(e) {
        // Chặn F12
        if (e.key === 'F12' || e.keyCode === 123) {
            e.preventDefault();
            return false;
        }

        // Chặn các tổ hợp phím Ctrl + ...
        if (e.ctrlKey) {
            switch (e.key.toLowerCase()) {
                case 'u': // Chặn Ctrl + U (Xem source code)
                case 's': // Chặn Ctrl + S (Lưu trang web)
                case 'p': // Chặn Ctrl + P (In trang web - thường hiện code)
                // Lưu ý: KHÔNG chặn 'c' (Copy) và 'a' (Select All)
                    e.preventDefault();
                    return false;
            }

            // Chặn Ctrl + Shift + ... (Các phím mở DevTools)
            if (e.shiftKey) {
                switch (e.key.toLowerCase()) {
                    case 'i': // Inspect Element
                    case 'j': // Console
                    case 'c': // Element Inspector
                        e.preventDefault();
                        return false;
                }
            }
        }
    });