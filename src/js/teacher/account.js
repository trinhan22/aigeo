import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            // [GIỮ NGUYÊN TOÀN BỘ LOGIC CŨ CỦA BẠN]
            // Nhớ đảm bảo các ID không thay đổi: profile-form, profile-name, profile-subject, password-form...
            
            const userNameHeader = document.getElementById('user-name-header');
            const userAvatarEl = document.getElementById('user-avatar');
            const toastContainer = document.getElementById('toast-container');
            const profileForm = document.getElementById('profile-form');
            const passwordForm = document.getElementById('password-form');
            
            const profileNameInput = document.getElementById('profile-name');
            const profileEmailInput = document.getElementById('profile-email');
            const profileSchoolInput = document.getElementById('profile-school');
            const profileSubjectSelect = document.getElementById('profile-subject');

            let currentUser = null;

            // Override hàm showToast để đồng bộ Dashboard
            const showToast = (message, type = 'success') => {
                const toast = document.createElement('div');
                toast.className = `toast show ${type === 'success' ? 'bg-slate-900' : 'bg-red-500'} text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm`;
                toast.textContent = message;
                toastContainer.appendChild(toast);
                setTimeout(() => {
                    toast.classList.remove('show');
                    setTimeout(() => toast.remove(), 300);
                }, 3000);
            };

            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    currentUser = user;
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        userNameHeader.textContent = userData.name;
                        userAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=0D9488&color=fff&bold=true`;
                        
                        // Populate values
                        profileNameInput.value = userData.name || '';
                        profileEmailInput.value = user.email || '';
                        profileSchoolInput.value = userData.school || '';
                        profileSubjectSelect.value = userData.subject || '';
                    }
                } else { window.location.href = '../auth.html'; }
            });

            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const newName = profileNameInput.value.trim();
                const newSchool = profileSchoolInput.value.trim();
                const newSubject = profileSubjectSelect.value;
                
                if (!newName || !newSchool || !newSubject) {
                    showToast('Vui lòng điền đầy đủ thông tin cá nhân.', 'error');
                    return;
                }
                const submitButton = profileForm.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.textContent = 'Đang lưu...';
                try {
                    const userDocRef = doc(db, "users", currentUser.uid);
                    await updateDoc(userDocRef, { 
                        name: newName,
                        school: newSchool,
                        subject: newSubject
                    });
                    showToast('Cập nhật thông tin thành công!', 'success');
                    userNameEl.textContent = newName;
                } catch (error) {
                    showToast('Đã xảy ra lỗi khi cập nhật.', 'error');
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Lưu thông tin';
                }
            });

            passwordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const newPassword = document.getElementById('new-password').value;
                const confirmPassword = document.getElementById('confirm-password').value;

                if (newPassword.length < 6) {
                    showToast('Mật khẩu mới phải có ít nhất 6 ký tự.', 'error');
                    return;
                }
                if (newPassword !== confirmPassword) {
                    showToast('Mật khẩu xác nhận không khớp.', 'error');
                    return;
                }
                
                const submitButton = passwordForm.querySelector('button[type="submit"]');
                submitButton.disabled = true;
                submitButton.textContent = 'Đang đổi...';

                try {
                    await updatePassword(currentUser, newPassword);
                    showToast('Đổi mật khẩu thành công!');
                    passwordForm.reset();
                } catch (error) {
                    showToast('Đã xảy ra lỗi. Vui lòng đăng xuất và đăng nhập lại rồi thử lại.', 'error');
                } finally {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Đổi mật khẩu';
                }
            });

            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    document.body.style.opacity = '0';
                    setTimeout(() => { window.location.href = this.href; }, 200);
                });
            });
            document.body.style.transition = 'opacity 0.2s ease-in-out';

            document.getElementById('logout-btn').onclick = () => signOut(auth);
            feather.replace();
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