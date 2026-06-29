import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
    import { getAuth, onAuthStateChanged, signOut, updatePassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
    // ĐÃ BỔ SUNG: collection, query, where, getDocs vào đây
    import { getFirestore, doc, getDoc, updateDoc, addDoc, serverTimestamp, orderBy, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

    document.addEventListener('DOMContentLoaded', () => {
        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        const userNameHeader = document.getElementById('user-name-header');
        const userAvatarEl = document.getElementById('user-avatar');
        const toastContainer = document.getElementById('toast-container');
        const profileForm = document.getElementById('profile-form');
        const passwordForm = document.getElementById('password-form');
        
        const profileNameInput = document.getElementById('profile-name');
        const profileEmailInput = document.getElementById('profile-email');
        const profileSchoolInput = document.getElementById('profile-school');
        const profileGradeSelect = document.getElementById('profile-grade');

        let currentUser = null;

        // Hàm showToast dùng chung
        const showToast = (message, type = 'success') => {
            const toast = document.createElement('div');
            toast.className = `toast show ${type === 'success' ? 'bg-slate-900' : 'bg-red-500'} text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm mb-3`;
            toast.textContent = message;
            toastContainer.appendChild(toast);
            setTimeout(() => {
                toast.remove();
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
                    
                    profileNameInput.value = userData.name || '';
                    profileEmailInput.value = user.email || '';
                    profileSchoolInput.value = userData.school || '';
                    profileGradeSelect.value = userData.grade || userData.selectedGrade || '10';

                    // --- FEEDBACK LOGIC (ĐÃ FIX LỖI TẢI DỮ LIỆU) ---
                    const feedbackModal = document.getElementById('feedback-modal');
                    const viewFeedbackModal = document.getElementById('view-feedback-modal');
                    const feedbackForm = document.getElementById('feedback-form');

                    document.getElementById('feedback-btn').onclick = () => feedbackModal.classList.replace('hidden', 'flex');
                    document.getElementById('feedback-cancel-btn').onclick = () => feedbackModal.classList.replace('flex', 'hidden');

                    feedbackForm.onsubmit = async (e) => {
                        e.preventDefault();
                        const btn = document.getElementById('feedback-submit-btn');
                        btn.disabled = true; btn.textContent = "Đang gửi...";
                        try {
                            await addDoc(collection(db, "feedback"), {
                                content: document.getElementById('feedback-content').value,
                                userId: currentUser.uid,
                                userName: userData.name || "Học sinh",
                                createdAt: serverTimestamp(),
                                status: 'new'
                            });
                            feedbackModal.classList.replace('flex', 'hidden');
                            feedbackForm.reset();
                            showToast("Gửi góp ý thành công!");
                        } catch (e) { showToast("Lỗi gửi góp ý", "error"); }
                        finally { btn.disabled = false; btn.textContent = "Gửi ngay"; }
                    };

                    document.getElementById('view-feedback-btn').onclick = async () => {
                        const container = document.getElementById('feedback-list-container');
                        container.innerHTML = '<div class="text-center py-10 animate-pulse font-bold text-slate-300">Đang tải...</div>';
                        viewFeedbackModal.classList.replace('hidden', 'flex');
                        try {
                            // Truy vấn lịch sử góp ý
                            const q = query(collection(db, "feedback"), where("userId", "==", currentUser.uid), orderBy("createdAt", "desc"));
                            const snap = await getDocs(q);
                            if (snap.empty) {
                                container.innerHTML = '<p class="text-center py-10 font-bold text-slate-400">Chưa có góp ý nào.</p>';
                            } else {
                                container.innerHTML = snap.docs.map(doc => {
                                    const f = doc.data();
                                    return `
                                        <div class="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-left mb-4">
                                            <span class="text-[10px] font-black text-slate-400 uppercase">${f.createdAt?.toDate().toLocaleDateString('vi-VN')}</span>
                                            <p class="text-sm font-bold text-slate-700 mt-1">${f.content}</p>
                                            ${f.reply ? `<div class="mt-3 p-3 bg-teal-50 border-l-4 border-teal-500 rounded-r-xl"><p class="text-[10px] font-black text-teal-600 uppercase">Admin:</p><p class="text-sm text-teal-800">${f.reply}</p></div>` : ''}
                                        </div>`;
                                }).join('');
                            }
                        } catch (e) { 
                            console.error(e);
                            container.innerHTML = '<p class="text-red-500 text-center font-bold">Lỗi tải dữ liệu</p>'; 
                        }
                    };

                    document.getElementById('view-feedback-close-btn').onclick = () => viewFeedbackModal.classList.replace('flex', 'hidden');
                }
            } else { window.location.href = '../auth.html'; }
        });

        // Xử lý cập nhật thông tin cá nhân
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newName = profileNameInput.value.trim();
            const newSchool = profileSchoolInput.value.trim();
            const newGrade = parseInt(profileGradeSelect.value, 10);

            const submitButton = profileForm.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = 'Đang lưu...';

            try {
                const userDocRef = doc(db, "users", currentUser.uid);
                await updateDoc(userDocRef, { 
                    name: newName,
                    school: newSchool,
                    grade: newGrade
                });
                showToast('Cập nhật thông tin thành công!');
                userNameHeader.textContent = newName; // Cập nhật tên trên Header
            } catch (error) {
                showToast('Đã xảy ra lỗi khi cập nhật.', 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = 'Lưu thông tin <i data-feather="save" class="w-4"></i>';
                feather.replace();
            }
        });

        // Xử lý đổi mật khẩu
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
                showToast('Lỗi: Hãy đăng xuất và đăng nhập lại để thực hiện quyền này.', 'error');
            } finally {
                submitButton.disabled = false;
                submitButton.innerHTML = 'Đổi mật khẩu <i data-feather="lock" class="w-4"></i>';
                feather.replace();
            }
        });

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