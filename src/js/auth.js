import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, updateProfile, setPersistence, browserLocalPersistence, browserSessionPersistence, sendPasswordResetEmail, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, setDoc, serverTimestamp, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        let isMaintenanceMode = false;
        let isRedirecting = false;
        let pendingRegisterData = null;

        // --- 1. UI HELPERS ---
        const setLoading = (isLoading) => {
            const overlay = document.getElementById('loading-overlay');
            overlay.classList.toggle('flex', isLoading);
            overlay.classList.toggle('hidden', !isLoading);
        };

        const showMaintenanceUI = (show) => {
            const modal = document.getElementById('maintenance-modal');
            const container = document.getElementById('main-auth-container');
            if (show) {
                modal.classList.add('show');
                container.classList.add('opacity-20', 'pointer-events-none');
            } else {
                modal.classList.remove('show');
                container.classList.remove('opacity-20', 'pointer-events-none');
            }
        };

        window.showAlert = (msg, type = 'error') => {
            const modal = document.getElementById('alert-modal');
            const title = document.getElementById('alert-title');
            const message = document.getElementById('alert-message');
            const iconBox = modal.querySelector('.modal-content');
            message.innerText = msg;
            iconBox.className = `modal-content ${type === 'error' ? 'alert-error' : 'alert-success'}`;
            title.innerText = type === 'error' ? "Rất tiếc!" : "Tuyệt vời!";
            document.getElementById('alert-icon-container').innerHTML = type === 'error' ? '<i class="fas fa-times"></i>' : '<i class="fas fa-check"></i>';
            modal.classList.add('show');
        };

        // --- 2. HÀM TẢI DỮ LIỆU ---
        const loadSubjects = async () => {
            const subjectSelect = document.getElementById('reg-subject');
            if (!subjectSelect) return;
            try {
                const querySnapshot = await getDocs(collection(db, "subjects"));
                subjectSelect.innerHTML = '<option value="" disabled selected>Chọn môn học</option>';
                querySnapshot.forEach((doc) => {
                    const opt = document.createElement('option');
                    opt.value = doc.id; opt.textContent = doc.data().name;
                    subjectSelect.appendChild(opt);
                });
            } catch (e) { console.error("Lỗi tải môn học:", e); }
        };

        const checkSystemStatus = async () => {
            try {
                const snap = await getDoc(doc(db, "system_settings", "general"));
                if (snap.exists()) {
                    const data = snap.data();
                    isMaintenanceMode = data.maintenanceMode || false;
                    if (isMaintenanceMode) {
                        document.getElementById('maintenance-reason').innerText = data.maintenanceReason || "Chúng tôi đang nâng cấp hệ thống.";
                        
                        // --- PHẦN SỬA LẠI Ở ĐÂY ---
                        const formatTimeFull = (ts) => {
                            if (!ts) return "--:--";
                            const d = new Date(ts.seconds * 1000);
                            const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                            const date = d.toLocaleDateString('vi-VN');
                            // Sử dụng innerHTML để chèn thẻ span làm dấu ngăn cách mờ
                            return `${time} <span class="opacity-30 mx-2">|</span> ${date}`;
                        };

                        document.getElementById('maintenance-start-time').innerHTML = `BẮT ĐẦU: ${formatTimeFull(data.maintenanceStartTime)}`;
                        document.getElementById('maintenance-end-time').innerHTML = `DỰ KIẾN: ${formatTimeFull(data.maintenanceEndTime)}`;
                        // --------------------------
                    }
                }
            } catch (e) { console.error("Lỗi kiểm tra bảo trì:", e); }
        };

        // --- 3. LOGIC XÁC THỰC ---
        onAuthStateChanged(auth, async (user) => {
            if (isRedirecting) return;
            setLoading(true);
            await checkSystemStatus();

            if (user) {
                try {
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        
                        // NẾU LÀ ADMIN: Vượt bảo trì
                        if (userData.role === 'admin') {
                            isRedirecting = true;
                            showMaintenanceUI(false);
                            window.location.href = "/admin/index.html";
                            return;
                        }

                        // NẾU LÀ USER THƯỜNG: Kiểm tra bảo trì
                        if (isMaintenanceMode) {
                            await signOut(auth);
                            showMaintenanceUI(true);
                        } else {
                            isRedirecting = true;
                            window.location.href = `/${userData.role}/index.html`;
                        }
                    }
                } catch (e) { console.error(e); }
            } else {
                showMaintenanceUI(isMaintenanceMode);
            }
            setLoading(false);
        });

        // --- 4. CÁC SỰ KIỆN FORM ---
        
        // Đăng nhập User
        document.getElementById('login-form').onsubmit = async (e) => {
            e.preventDefault();
            if (isMaintenanceMode) return showAlert("Hệ thống đang bảo trì!");
            setLoading(true);
            try {
                const remember = document.getElementById('remember-me').checked;
                await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
                await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value);
            } catch (err) {
                setLoading(false);
                showAlert("Email hoặc mật khẩu không chính xác.");
            }
        };

        // Đăng nhập Admin
        document.getElementById('admin-login-form').onsubmit = async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
                const userCred = await signInWithEmailAndPassword(auth, document.getElementById('admin-email').value, document.getElementById('admin-password').value);
                const userDoc = await getDoc(doc(db, "users", userCred.user.uid));
                if (userDoc.exists() && userDoc.data().role === 'admin') {
                    isRedirecting = true;
                    showMaintenanceUI(false);
                    window.location.href = "/admin/index.html";
                } else {
                    await signOut(auth);
                    showAlert("Tài khoản không có quyền Admin.");
                }
            } catch (err) {
                showAlert("Thông tin Admin sai.");
            } finally { setLoading(false); }
        };

        // Đăng ký User
        document.getElementById('register-form').onsubmit = (e) => {
            e.preventDefault();
            if (!document.getElementById('reg-agree').checked) return showAlert("Cần đồng ý điều khoản.");
            
            const pass = document.getElementById('reg-pass').value;
            const confirm = document.getElementById('reg-confirm').value;
            const role = document.getElementById('reg-role').value;

            if (pass !== confirm) return showAlert("Mật khẩu không khớp.");
            if (pass.length < 6) return showAlert("Mật khẩu quá ngắn.");

            pendingRegisterData = {
                name: document.getElementById('reg-name').value,
                email: document.getElementById('reg-email').value,
                pass: pass, role: role,
                school: role === 'student' ? document.getElementById('reg-school-student').value : document.getElementById('reg-school-teacher').value,
                grade: document.getElementById('reg-grade').value,
                subject: document.getElementById('reg-subject').value
            };

            document.getElementById('confirm-role-text').innerText = role === 'student' ? "HỌC SINH" : "GIÁO VIÊN";
            document.getElementById('confirm-icon').className = role === 'student' ? "fas fa-user-graduate" : "fas fa-chalkboard-teacher";
            document.getElementById('confirm-role-modal').classList.add('show');
        };

        document.getElementById('btn-confirm-register').onclick = async () => {
            document.getElementById('confirm-role-modal').classList.remove('show');
            setLoading(true);
            try {
                const { name, email, pass, role, school, grade, subject } = pendingRegisterData;
                const userCred = await createUserWithEmailAndPassword(auth, email, pass);
                await updateProfile(userCred.user, { displayName: name });
                
                await setDoc(doc(db, "users", userCred.user.uid), {
                    uid: userCred.user.uid, name, email, role, school,
                    createdAt: serverTimestamp(),
                    ...(role === 'student' ? { grade: parseInt(grade) } : { subject })
                });
                window.location.href = `/${role}/index.html`;
            } catch (err) {
                setLoading(false);
                showAlert(err.code === 'auth/email-already-in-use' ? "Email đã tồn tại." : "Lỗi đăng ký.");
            }
        };

        // Quên mật khẩu
        document.getElementById('btn-forgot').onclick = () => document.getElementById('forgot-modal').classList.add('show');
        document.getElementById('forgot-form').onsubmit = async (e) => {
            e.preventDefault();
            const btn = document.getElementById('forgot-btn');
            btn.disabled = true;
            try {
                await sendPasswordResetEmail(auth, document.getElementById('forgot-email').value);
                document.getElementById('forgot-input-section').classList.add('hidden');
                document.getElementById('forgot-success-section').classList.remove('hidden');
            } catch (e) { showAlert("Lỗi gửi email."); } finally { btn.disabled = false; }
        };

        // Google Login
        document.getElementById('google-login-btn').onclick = async () => {
            const provider = new GoogleAuthProvider();
            try {
                setLoading(true);
                const result = await signInWithPopup(auth, provider);
                const userDoc = await getDoc(doc(db, "users", result.user.uid));
                if (!userDoc.exists()) {
                    await setDoc(doc(db, "users", result.user.uid), {
                        uid: result.user.uid, name: result.user.displayName, email: result.user.email,
                        role: "student", school: "Chưa cập nhật", grade: 10, createdAt: serverTimestamp()
                    });
                }
                const role = userDoc.exists() ? userDoc.data().role : "student";
                window.location.href = `/${role}/index.html`;
            } catch (e) { setLoading(false); }
        };

        // --- 5. UI CONTROLS ---
        const switchTab = (tab) => {
            const loginForm = document.getElementById('login-form');
            const registerForm = document.getElementById('register-form');

            if (tab === 'login') {
                loginForm.classList.remove('hidden');
                registerForm.classList.add('hidden');
                document.getElementById('tab-login').classList.add('active');
                document.getElementById('tab-register').classList.remove('active');
            } else {
                registerForm.classList.remove('hidden');
                loginForm.classList.add('hidden');
                document.getElementById('tab-register').classList.add('active');
                document.getElementById('tab-login').classList.remove('active');
            }
        };

        document.getElementById('tab-login').onclick = () => switchTab('login');
        document.getElementById('tab-register').onclick = () => switchTab('register');

        const updateRoleUI = (role) => {
            document.getElementById('reg-role').value = role;
            document.getElementById('btn-role-student').classList.toggle('active', role === 'student');
            document.getElementById('btn-role-teacher').classList.toggle('active', role === 'teacher');
            document.querySelectorAll('.student-only').forEach(el => el.classList.toggle('hidden', role !== 'student'));
            document.querySelectorAll('.teacher-only').forEach(el => el.classList.toggle('hidden', role !== 'teacher'));
        };

        document.getElementById('btn-role-student').onclick = () => updateRoleUI('student');
        document.getElementById('btn-role-teacher').onclick = () => updateRoleUI('teacher');

        document.getElementById('admin-gate-btn').onclick = () => document.getElementById('admin-modal').classList.add('show');

        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.onclick = () => {
                const modal = btn.closest('.modal-overlay');
                if (modal.id === 'maintenance-modal' && isMaintenanceMode) return;
                modal.classList.remove('show');
            };
        });

        document.querySelectorAll('.toggle-pass').forEach(icon => {
            icon.onclick = () => {
                const input = icon.previousElementSibling;
                input.type = input.type === 'password' ? 'text' : 'password';
                icon.classList.toggle('fa-eye'); icon.classList.toggle('fa-eye-slash');
            };
        });

        // Khởi tạo
        loadSubjects();