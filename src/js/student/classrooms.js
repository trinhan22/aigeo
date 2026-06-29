import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, arrayRemove, addDoc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            let currentUser = null;
            const classroomsGrid = document.getElementById('classrooms-grid');
            const toastContainer = document.getElementById('toast-container');
            
            // --- Toast Function ---
            function showToast(message, type = 'success') {
                const toast = document.createElement('div');
                toast.className = `toast show ${type === 'success' ? 'bg-slate-900' : 'bg-red-500'} text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm`;
                toast.textContent = message;
                toastContainer.appendChild(toast);
                setTimeout(() => {
                    toast.classList.remove('show');
                    setTimeout(() => toast.remove(), 300);
                }, 3000);
            }
            
            // --- Auth & Data Loading (GIỮ NGUYÊN LOGIC) ---
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    currentUser = user;
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists() && docSnap.data().role === 'student') {
                        const userData = docSnap.data();
                        document.getElementById('user-name').textContent = userData.name || 'Học sinh';
                        document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=0D9488&color=fff&bold=true`;
                        initPage();

                    // --- FEEDBACK LOGIC ---
                    const feedbackModal = document.getElementById('feedback-modal');
                    const viewFeedbackModal = document.getElementById('view-feedback-modal');
                    const feedbackForm = document.getElementById('feedback-form');

                    // Mở/Đóng Modal
                    document.getElementById('feedback-btn').onclick = () => feedbackModal.classList.replace('hidden', 'flex');
                    document.getElementById('feedback-cancel-btn').onclick = () => feedbackModal.classList.replace('flex', 'hidden');

                    // Gửi form
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

                    // Xem lịch sử
                    document.getElementById('view-feedback-btn').onclick = async () => {
                        const container = document.getElementById('feedback-list-container');
                        container.innerHTML = '<div class="text-center py-10 animate-pulse font-bold text-slate-300">Đang tải...</div>';
                        viewFeedbackModal.classList.replace('hidden', 'flex');
                        try {
                            const q = query(collection(db, "feedback"), where("userId", "==", currentUser.uid), orderBy("createdAt", "desc"));
                            const snap = await getDocs(q);
                            if (snap.empty) container.innerHTML = '<p class="text-center py-10 font-bold text-slate-400">Chưa có góp ý nào.</p>';
                            else {
                                container.innerHTML = snap.docs.map(doc => {
                                    const f = doc.data();
                                    return `
                                        <div class="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-left">
                                            <span class="text-[10px] font-black text-slate-400 uppercase">${f.createdAt?.toDate().toLocaleDateString('vi-VN')}</span>
                                            <p class="text-sm font-bold text-slate-700 mt-1">${f.content}</p>
                                            ${f.reply ? `<div class="mt-3 p-3 bg-teal-50 border-l-4 border-teal-500 rounded-r-xl"><p class="text-[10px] font-black text-teal-600 uppercase">Admin:</p><p class="text-sm text-teal-800">${f.reply}</p></div>` : ''}
                                        </div>`;
                                }).join('');
                            }
                        } catch (e) { container.innerHTML = '<p class="text-red-500 text-center font-bold">Lỗi tải dữ liệu</p>'; }
                    };

                    document.getElementById('view-feedback-close-btn').onclick = () => viewFeedbackModal.classList.replace('flex', 'hidden');

                    } else {
                         window.location.href = '../auth.html';
                    }
                } else {
                    window.location.href = '../auth.html';
                }
            });

            async function initPage() {
                try {
                    const classroomsQuery = query(collection(db, "classrooms"), where("students", "array-contains", currentUser.uid));
                    const classroomsSnap = await getDocs(classroomsQuery);
                    
                    if (classroomsSnap.empty) {
                        classroomsGrid.innerHTML = `
                            <div class="col-span-full py-20 text-center bg-white rounded-[40px] border-2 border-dashed border-slate-200">
                                <i data-feather="inbox" class="w-16 h-16 mx-auto text-slate-300 mb-4"></i>
                                <p class="text-slate-400 font-bold">Bạn chưa tham gia lớp học nào.</p>
                                <a href="join-class.html" class="text-teal-600 font-black mt-2 inline-block">Tham gia ngay →</a>
                            </div>`;
                        feather.replace();
                        return;
                    }

                    const classrooms = classroomsSnap.docs.map(d => ({id: d.id, ...d.data()}));
                    const teacherIds = [...new Set(classrooms.map(c => c.teacherId))];
                    const subjectIds = [...new Set(classrooms.map(c => c.subjectId))];
                    
                    const [teacherDocs, subjectDocs] = await Promise.all([
                        fetchDocsInChunks(collection(db, "users"), "__name__", teacherIds),
                        fetchDocsInChunks(collection(db, "subjects"), "__name__", subjectIds)
                    ]);
                    
                    renderClassrooms(classrooms, teacherDocs, subjectDocs);

                } catch (error) {
                    console.error(error);
                    showToast("Lỗi khi tải danh sách lớp học.", "error");
                }
            }
            
            async function fetchDocsInChunks(collectionRef, field, ids) {
                if (!ids || ids.length === 0) return [];
                const allDocsData = [];
                for (let i = 0; i < ids.length; i += 30) {
                    const chunk = ids.slice(i, i + 30);
                    const q = query(collectionRef, where(field, "in", chunk));
                    const snapshot = await getDocs(q);
                    snapshot.forEach(doc => allDocsData.push({id: doc.id, ...doc.data()}));
                }
                return allDocsData;
            }
            
            function renderClassrooms(classrooms, teachers, subjects) {
                classroomsGrid.innerHTML = classrooms.map(c => {
                    const subject = subjects.find(s => s.id === c.subjectId);
                    const teacher = teachers.find(t => t.id === c.teacherId);
                    return `
                        <div class="class-card">
                            <div class="flex justify-between items-start mb-6">
                                <span class="subject-badge">${subject ? subject.name : 'Địa lý'}</span>
                                <span class="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded italic uppercase">Khối ${c.grade}</span>
                            </div>
                            <h3 class="text-xl font-black text-slate-800 leading-tight mb-2">${c.className}</h3>
                            <p class="text-xs font-bold text-slate-400 flex items-center gap-2 mb-8">
                                <i class="fas fa-user-tie"></i> GV: ${teacher ? teacher.name : 'N/A'}
                            </p>
                            <div class="mt-auto pt-6 border-t border-slate-50">
                                <a href="classroom-view.html?classId=${c.id}" class="cta-button w-full justify-center text-sm">
                                    Vào lớp học <i class="fas fa-chevron-right text-[10px]"></i>
                                </a>
                            </div>
                        </div>
                    `;
                }).join('');
                feather.replace();
            }

            // --- Logout ---
            document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
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