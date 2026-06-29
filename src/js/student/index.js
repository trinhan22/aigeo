import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, getDocs, query, where, onSnapshot, addDoc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            const welcomeHeader = document.getElementById('welcome-header');
            const assignmentsContainer = document.getElementById('assignments-container');
            const classroomsContainer = document.getElementById('classrooms-container');
            const feedbackModal = document.getElementById('feedback-modal');
            const feedbackForm = document.getElementById('feedback-form');
            const toastContainer = document.getElementById('toast-container');
            let currentUser = null;

            function showToast(msg, type = 'success') {
                const toast = document.createElement('div');
                toast.className = `toast show ${type === 'success' ? 'bg-slate-900' : 'bg-red-500'} text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm`;
                toast.textContent = msg;
                toastContainer.appendChild(toast);
                setTimeout(() => toast.remove(), 3000);
            }

            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    currentUser = user;
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists() && docSnap.data().role === 'student') {
                        const userData = docSnap.data();
                        document.getElementById('user-name').textContent = userData.name;
                        welcomeHeader.textContent = `Xin chào, ${userData.name.split(' ').pop()}!`;
                        document.getElementById('welcome-message').textContent = `Chào mừng trở lại, ${userData.name.split(' ').pop()}!`;
                        document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=0D9488&color=fff&bold=true`;
                        
                        listenForData();
                        setupFeedbackLogic();
                        animateWelcome();
                    } else { window.location.href = '../auth.html'; }
                } else { window.location.href = '../auth.html'; }
            });

            function listenForData() {
                const subQuery = query(collection(db, "submissions"), where("studentId", "==", currentUser.uid));
                onSnapshot(subQuery, (snap) => {
                    const subs = snap.docs.map(d => d.data());
                    let avgScoreValue = 0;
                    if (subs.length > 0) {
                        const avg = subs.reduce((sum, r) => sum + (r.score / r.totalQuestions), 0);
                        avgScoreValue = (avg / subs.length) * 10;
                        document.getElementById('avg-score').textContent = avgScoreValue.toFixed(1);
                        document.getElementById('tests-taken').textContent = subs.length;
                        
                        let abilityText = "Yếu";
                        if (avgScoreValue >= 8.0) abilityText = "Giỏi";
                        else if (avgScoreValue >= 6.5) abilityText = "Khá";
                        else if (avgScoreValue >= 5.0) abilityText = "Trung bình";
                        document.getElementById('ability-level').textContent = abilityText;
                    } else {
                        document.getElementById('avg-score').textContent = "0.0";
                        document.getElementById('tests-taken').textContent = "0";
                        document.getElementById('ability-level').textContent = "Chưa có";
                    }
                    loadClassroomsAndAssignments(subs);
                });
            }

            async function loadClassroomsAndAssignments(subs) {
                try {
                    const q = query(collection(db, 'classrooms'), where('students', 'array-contains', currentUser.uid));
                    const snap = await getDocs(q);
                    const classrooms = snap.docs.map(d => ({id: d.id, ...d.data()}));
                    
                    const teacherIds = [...new Set(classrooms.map(c => c.teacherId).filter(id => id))];
                    const teachersData = {};
                    if (teacherIds.length > 0) {
                        const teachersSnap = await getDocs(query(collection(db, "users"), where("__name__", "in", teacherIds)));
                        teachersSnap.forEach(tDoc => teachersData[tDoc.id] = tDoc.data().name);
                    }

                    classroomsContainer.innerHTML = classrooms.map(c => {
                        const displayTeacherName = teachersData[c.teacherId] || c.teacherName || 'Hệ thống';
                        return `
                            <div class="bento-card p-6 flex flex-col justify-between min-h-[140px]">
                                <div>
                                    <h4 class="font-black text-slate-800 truncate">${c.className || 'Lớp học không tên'}</h4>
                                    <p class="text-[10px] font-bold text-slate-400 uppercase mt-1">GV: ${displayTeacherName}</p>
                                </div>
                                <a href="classroom-view.html?classId=${c.id}" class="mt-4 text-xs font-black text-teal-600 hover:tracking-widest transition-all uppercase inline-flex items-center gap-1">Vào lớp <i data-feather="chevron-right" class="w-3"></i></a>
                            </div>
                        `;
                    }).join('');

                    let allAss = [];
                    classrooms.forEach(c => {
                        if (c.assignments) c.assignments.forEach(a => allAss.push({ ...a, cName: c.className, cId: c.id }));
                    });

                    if (allAss.length > 0) {
                        const assignedTestIds = allAss.map(a => a.testId);
                        const uniqueAssignedCount = [...new Set(assignedTestIds)].length;
                        const uniqueCompletedCount = [...new Set(subs.filter(s => assignedTestIds.includes(s.testId)).map(s => s.testId))].length;
                        document.getElementById('progress-percent').textContent = Math.round((uniqueCompletedCount / uniqueAssignedCount) * 100) + "%";
                    }

                    if (allAss.length === 0) {
                        assignmentsContainer.innerHTML = '<div class="py-10 text-center font-bold text-slate-300 text-xs uppercase tracking-widest text-center">Không có bài tập mới</div>';
                    } else {
                        allAss.sort((a, b) => (b.assignedAt?.seconds || 0) - (a.assignedAt?.seconds || 0));
                        const testIds = [...new Set(allAss.map(a => a.testId))];
                        const testsSnap = await getDocs(query(collection(db, "tests"), where("__name__", "in", testIds)));
                        const testsData = {};
                        testsSnap.forEach(doc => testsData[doc.id] = doc.data().name);

                        assignmentsContainer.innerHTML = allAss.slice(0, 3).map(a => {
                            const isDone = subs.some(s => s.testId === a.testId);
                            return `
                                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-transparent hover:border-teal-100 transition">
                                    <div class="flex items-center gap-3 overflow-hidden">
                                        <div class="shrink-0 w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm"><i data-feather="file-text" class="w-4 text-teal-600"></i></div>
                                        <div class="overflow-hidden">
                                            <p class="text-xs font-black text-slate-800 truncate">${testsData[a.testId] || a.testName || "Đề thi"}</p>
                                            <p class="text-[10px] font-bold text-slate-400 truncate uppercase">${a.cName}</p>
                                        </div>
                                    </div>
                                    <a href="test.html?testId=${a.testId}&classId=${a.cId}" class="shrink-0 ml-2 px-4 py-2 text-[10px] font-black rounded-lg ${isDone ? 'bg-slate-200 text-slate-600' : 'bg-teal-600 text-white shadow-lg shadow-teal-600/20'}">${isDone ? 'XEM LẠI' : 'VÀO THI'}</a>
                                </div>
                            `;
                        }).join('');
                    }
                    feather.replace();
                } catch (e) { console.error("Lỗi:", e); }
            }

            function setupFeedbackLogic() {
                document.getElementById('feedback-btn').onclick = () => feedbackModal.classList.replace('hidden', 'flex');
                document.getElementById('feedback-cancel-btn').onclick = () => feedbackModal.classList.replace('flex', 'hidden');
                feedbackForm.onsubmit = async (e) => {
                    e.preventDefault();
                    try {
                        await addDoc(collection(db, "feedback"), {
                            content: document.getElementById('feedback-content').value,
                            userId: currentUser.uid, userName: currentUser.displayName || "Học sinh",
                            createdAt: serverTimestamp(), status: 'new'
                        });
                        feedbackModal.classList.replace('flex', 'hidden');
                        feedbackForm.reset();
                        showToast("Gửi góp ý thành công!");
                    } catch (e) { showToast("Lỗi gửi góp ý", "error"); }
                };
                document.getElementById('view-feedback-btn').onclick = loadFeedbackHistory;
                document.getElementById('view-feedback-close-btn').onclick = () => document.getElementById('view-feedback-modal').classList.replace('flex', 'hidden');
            }

            async function loadFeedbackHistory() {
                const container = document.getElementById('feedback-list-container');
                container.innerHTML = '<div class="text-center py-10 animate-pulse font-bold text-slate-300">Đang tải...</div>';
                document.getElementById('view-feedback-modal').classList.replace('hidden', 'flex');
                const q = query(collection(db, "feedback"), where("userId", "==", currentUser.uid), orderBy("createdAt", "desc"));
                const snap = await getDocs(q);
                if (snap.empty) container.innerHTML = '<p class="text-center py-10 font-bold text-slate-400">Chưa có góp ý nào.</p>';
                else {
                    container.innerHTML = snap.docs.map(doc => {
                        const f = doc.data();
                        return `
                            <div class="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                                <span class="text-[10px] font-black text-slate-400 uppercase">${f.createdAt?.toDate().toLocaleDateString('vi-VN')}</span>
                                <p class="text-sm font-bold text-slate-700 mt-1">${f.content}</p>
                                ${f.reply ? `<div class="mt-3 p-3 bg-teal-50 border-l-4 border-teal-500 rounded-r-xl"><p class="text-[10px] font-black text-teal-600 uppercase mb-1">Admin:</p><p class="text-sm text-teal-800">${f.reply}</p></div>` : ''}
                            </div>
                        `;
                    }).join('');
                }
            }

            function animateWelcome() {
                const msg = document.getElementById('welcome-message');
                msg.innerHTML = msg.textContent.replace(/(\S)/g, "<span class='letter'>$&</span>");
                anime({ targets: '#welcome-message .letter', translateY: [20, 0], opacity: [0, 1], delay: anime.stagger(30), easing: 'easeOutExpo' });
            }

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