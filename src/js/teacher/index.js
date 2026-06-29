import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, query, where, onSnapshot, addDoc, serverTimestamp, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        const welcomeHeader = document.getElementById('welcome-header');
        const userNameEl = document.getElementById('user-name');
        const userAvatarEl = document.getElementById('user-avatar');
        const welcomeMessageEl = document.getElementById('welcome-message');
        const logoutBtn = document.getElementById('logout-btn');
        
        // >> BỔ SUNG KHAI BÁO CÁC PHẦN TỬ STATS <<
        const statsClassesEl = document.getElementById('stats-classes');
        const statsStudentsEl = document.getElementById('stats-students');
        const statsTestsEl = document.getElementById('stats-tests');
        
        const recentClassroomsContainer = document.getElementById('recent-classrooms-container');
        const recentTestsContainer = document.getElementById('recent-tests-container');
        
        // Modals
        const profileUpdateModal = document.getElementById('profile-update-modal');
        const updateLaterBtn = document.getElementById('update-later-btn');
        const feedbackModal = document.getElementById('feedback-modal');
        const viewFeedbackModal = document.getElementById('view-feedback-modal');
        
        // Feedback Elements
        const feedbackBtn = document.getElementById('feedback-btn');
        const feedbackCancelBtn = document.getElementById('feedback-cancel-btn');
        const feedbackForm = document.getElementById('feedback-form');
        const feedbackContent = document.getElementById('feedback-content');
        const toastContainer = document.getElementById('toast-container');
        
        // View Feedback Elements
        const viewFeedbackBtn = document.getElementById('view-feedback-btn');
        const viewFeedbackCloseBtn = document.getElementById('view-feedback-close-btn');
        const feedbackListContainer = document.getElementById('feedback-list-container');


        function showToast(message, type = 'success') {
            const toast = document.createElement('div');
            const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
            toast.className = `toast show ${bgColor} text-white px-4 py-2 rounded-lg shadow-lg`;
            toast.textContent = message;
            toastContainer.appendChild(toast);
            setTimeout(() => {
                toast.classList.remove('show');
                toast.addEventListener('transitionend', () => toast.remove());
            }, 3000);
        }

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const userDocRef = doc(db, "users", user.uid);
                try {
                    const docSnap = await getDoc(userDocRef);
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        
                        if (userData.role !== 'teacher') {
                           const targetRole = userData.role || 'student';
                           window.location.href = `../${targetRole}/index.html`;
                           return;
                        }

                        userNameEl.textContent = userData.name || 'Giáo viên';
                        welcomeHeader.textContent = `Xin chào, ${userData.name.split(' ').pop()}!`;
                        welcomeMessageEl.textContent = `Chào mừng trở lại, ${userData.name.split(' ').pop()}!`;
                        const nameInitial = (userData.name || 'T').charAt(0).toUpperCase();
                        userAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=0D9488&color=fff&bold=true`;
                        
                        if (!userData.school || !userData.subject) {
                            profileUpdateModal.classList.remove('hidden');
                            profileUpdateModal.classList.add('flex');
                            feather.replace();
                        }

                        listenForData(user.uid);
                        setupFeedbackListeners(user, userData);
                        animateWelcomeMessage();

                    } else {
                        window.location.href = '../auth.html';
                    }
                } catch (error) {
                    console.error("Error fetching user data:", error);
                    window.location.href = '../auth.html';
                }
            } else {
                window.location.href = '../auth.html';
            }
        });

        function listenForData(teacherId) {
            // 1. Lấy tất cả lớp học của giáo viên này (không dùng orderBy ở query)
            const classroomsQuery = query(
                collection(db, "classrooms"), 
                where("teacherId", "==", teacherId)
            );

            onSnapshot(classroomsQuery, (snapshot) => {
                let classrooms = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
                
                // 2. Sắp xếp thủ công bằng code JS (giả sử bạn có trường createdAt)
                classrooms.sort((a, b) => {
                    const timeA = a.createdAt?.seconds || 0;
                    const timeB = b.createdAt?.seconds || 0;
                    return timeB - timeA; // Mới nhất lên đầu
                });

                // 3. Chỉ lấy 3 cái đầu tiên
                renderRecentClassrooms(classrooms.slice(0, 3));
            });

            // Tương tự cho phần Tests
            const testsQuery = query(
                collection(db, "tests"), 
                where("authorId", "==", teacherId)
            );
            onSnapshot(testsQuery, (snapshot) => {
                let tests = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
                tests.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                renderRecentTests(tests.slice(0, 3));
            });

            // --- Phần Stats giữ nguyên vì nó không có orderBy nên nó chạy đúng ---
            const allClassroomsQuery = query(collection(db, "classrooms"), where("teacherId", "==", teacherId));
            onSnapshot(allClassroomsQuery, (snapshot) => {
                const classCount = snapshot.size;
                let studentCount = 0;
                snapshot.forEach(doc => {
                    studentCount += doc.data().students?.length || 0;
                });
                statsClassesEl.textContent = classCount;
                statsStudentsEl.textContent = studentCount;
            });

            const allTestsQuery = query(collection(db, "tests"), where("authorId", "==", teacherId));
            onSnapshot(allTestsQuery, (snapshot) => {
                statsTestsEl.textContent = snapshot.size;
            });
        }
        
        window.renderRecentClassrooms = (classrooms) => {
            const container = document.getElementById('recent-classrooms-container');
            if (classrooms.length === 0) {
                container.innerHTML = '<p class="text-xs font-bold text-slate-300 py-4 text-center">CHƯA CÓ LỚP HỌC</p>';
                return;
            }
            container.innerHTML = classrooms.map(c => `
                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition cursor-pointer">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm text-teal-600 font-black text-sm">${c.className.charAt(0)}</div>
                        <div>
                            <p class="text-xs font-black text-slate-800">${c.className}</p>
                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">${c.students?.length || 0} học sinh</p>
                        </div>
                    </div>
                    <a href="student-progress.html?classId=${c.id}" class="p-2 text-teal-600 font-black text-[10px] uppercase hover:underline">Chi tiết</a>
                </div>
            `).join('');
            feather.replace();
        }
        
        window.renderRecentTests = (tests) => {
            const container = document.getElementById('recent-tests-container');
            if (tests.length === 0) {
                container.innerHTML = '<p class="text-xs font-bold text-slate-300 py-4 text-center">CHƯA CÓ ĐỀ THI</p>';
                return;
            }
            container.innerHTML = tests.map(t => `
                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-2xl hover:bg-slate-100 transition">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm"><i data-feather="file-text" class="w-4 text-orange-500"></i></div>
                        <div>
                            <p class="text-xs font-black text-slate-800">${t.name}</p>
                            <p class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">${t.questionIds?.length || 0} câu hỏi</p>
                        </div>
                    </div>
                    <span class="px-3 py-1 rounded-lg text-[9px] font-black uppercase ${t.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}">${t.status === 'published' ? 'Đã đăng' : 'Nháp'}</span>
                </div>
            `).join('');
            feather.replace();
        }


        async function loadAndDisplayFeedback() {
            feedbackListContainer.innerHTML = `<div class="text-center p-4"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-900 mx-auto"></div></div>`;
            viewFeedbackModal.classList.remove('hidden');
            viewFeedbackModal.classList.add('flex');
            
            try {
                const q = query(collection(db, "feedback"), where("userId", "==", auth.currentUser.uid), orderBy("createdAt", "desc"));
                const querySnapshot = await getDocs(q);
                
                if (querySnapshot.empty) {
                    feedbackListContainer.innerHTML = `<p class="text-slate-500 text-center p-4">Bạn chưa gửi góp ý nào.</p>`;
                    return;
                }

                feedbackListContainer.innerHTML = '';
                querySnapshot.forEach(doc => {
                    const feedback = doc.data();
                    const date = feedback.createdAt?.toDate().toLocaleDateString('vi-VN') || 'Không rõ';
                    
                    const getStatusBadge = (status) => {
                        switch (status) {
                            case 'replied': return `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">Đã trả lời</span>`;
                            case 'seen': return `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">Đã xem</span>`;
                            default: return `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-800">Mới</span>`;
                        }
                    };

                    const feedbackCard = document.createElement('div');
                    feedbackCard.className = 'p-4 border rounded-lg bg-slate-50';
                    feedbackCard.innerHTML = `
                        <div class="flex justify-between items-center mb-2">
                            <span class="text-xs text-slate-500 font-medium">Gửi ngày: ${date}</span>
                            ${getStatusBadge(feedback.status)}
                        </div>
                        <p class="text-slate-700 whitespace-pre-wrap">${feedback.content}</p>
                        ${feedback.reply ? `
                            <div class="mt-3 pt-3 border-t border-slate-200">
                                <p class="text-sm font-semibold text-teal-700">Phản hồi từ Admin:</p>
                                <p class="text-sm text-slate-600 mt-1 whitespace-pre-wrap">${feedback.reply}</p>
                            </div>
                        ` : ''}
                    `;
                    feedbackListContainer.appendChild(feedbackCard);
                });

            } catch (error) {
                console.error("Error fetching feedback:", error);
                feedbackListContainer.innerHTML = `<p class="text-red-500 text-center p-4">Không thể tải lịch sử góp ý.</p>`;
            }
        }
        
        function setupFeedbackListeners(user, userData) {
            feedbackBtn.addEventListener('click', () => {
                feedbackModal.classList.remove('hidden');
                feedbackModal.classList.add('flex');
            });

            feedbackCancelBtn.addEventListener('click', () => {
                feedbackModal.classList.add('hidden');
                feedbackModal.classList.remove('flex');
            });

            viewFeedbackBtn.addEventListener('click', loadAndDisplayFeedback);
            
            viewFeedbackCloseBtn.addEventListener('click', () => {
                viewFeedbackModal.classList.add('hidden');
                viewFeedbackModal.classList.remove('flex');
            });

            feedbackForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const content = feedbackContent.value.trim();
                if (!content) {
                    showToast("Vui lòng nhập nội dung góp ý.", "error");
                    return;
                }
                const submitBtn = document.getElementById('feedback-submit-btn');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Đang gửi...';

                try {
                    await addDoc(collection(db, "feedback"), {
                        content: content,
                        userId: user.uid,
                        userName: userData.name,
                        userEmail: user.email,
                        userRole: 'teacher',
                        createdAt: serverTimestamp(),
                        status: 'new'
                    });
                    feedbackModal.classList.add('hidden');
                    feedbackModal.classList.remove('flex');
                    feedbackForm.reset();
                    showToast("Cảm ơn bạn! Góp ý của bạn đã được gửi đi.", "success");
                } catch (error) {
                    console.error("Error sending feedback: ", error);
                    showToast("Đã có lỗi xảy ra. Vui lòng thử lại.", "error");
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Gửi góp ý';
                }
            });
        }
        
        function animateWelcomeMessage() {
            const welcomeMsg = document.getElementById('welcome-message');
            if(welcomeMsg) {
                welcomeMsg.innerHTML = welcomeMsg.textContent.replace(/(\S)/g, "<span class='letter'>$&</span>");
                anime.timeline({loop: false})
                .add({
                    targets: '#welcome-message .letter',
                    translateY: ["1.1em", 0],
                    translateX: ["0.55em", 0],
                    translateZ: 0,
                    rotateZ: [180, 0],
                    opacity: [0, 1],
                    easing: "easeOutExpo",
                    duration: 750,
                    delay: (el, i) => 50 * i
                });
            }
        }

        updateLaterBtn.addEventListener('click', () => {
            profileUpdateModal.classList.add('hidden');
            profileUpdateModal.classList.remove('flex');
        });

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                document.body.style.opacity = '0';
                setTimeout(() => { window.location.href = this.href; }, 200);
            });
        });
        document.body.style.transition = 'opacity 0.2s ease-in-out';

        logoutBtn.addEventListener('click', () => signOut(auth));
        
        feather.replace();

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