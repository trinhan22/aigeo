import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, arrayRemove, addDoc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            // --- State ---
            let currentUser = null;

            // --- Elements ---
            const classroomsGrid = document.getElementById('classrooms-grid');
            const toastContainer = document.getElementById('toast-container');
            const classNameHeader = document.getElementById('class-name-header');
            const classSubjectHeader = document.getElementById('class-subject-header');
            const assignmentsContainer = document.getElementById('assignments-container');
            const membersContainer = document.getElementById('members-container');
            
            // --- Utility Functions ---
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
            
            // --- Auth & Data Loading ---
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    currentUser = user;
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists() && docSnap.data().role === 'student') {
                        const userData = docSnap.data();
                        document.getElementById('user-name').textContent = userData.name;
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

                    } else { window.location.href = '../auth.html'; }
                } else { window.location.href = '../auth.html'; }
            });

            // --- OVERRIDE RENDER MEMBERS (Giao diện đẹp hơn) ---
            window.renderMembers = (teacher, students) => {
                membersContainer.innerHTML = '';
                
                // Teacher Row
                const tHTML = `
                    <div class="member-item bg-teal-50 border border-teal-100 mb-4">
                        <div class="avatar-box bg-teal-600 text-white shadow-lg shadow-teal-600/20">
                            ${(teacher.name || 'G').charAt(0).toUpperCase()}
                        </div>
                        <div class="overflow-hidden">
                            <p class="font-black text-slate-800 truncate text-sm">${teacher.name}</p>
                            <span class="text-[10px] font-black text-teal-600 uppercase tracking-tighter">Giáo viên hướng dẫn</span>
                        </div>
                    </div>`;
                membersContainer.insertAdjacentHTML('beforeend', tHTML);
                
                // Students Row
                students.forEach(s => {
                    const sHTML = `
                        <div class="member-item">
                            <div class="avatar-box bg-slate-100 text-slate-500">
                                ${(s.name || 'H').charAt(0).toUpperCase()}
                            </div>
                            <p class="font-bold text-slate-700 text-sm truncate">${s.name}</p>
                        </div>`;
                    membersContainer.insertAdjacentHTML('beforeend', sHTML);
                });
            }

            // --- CẬP NHẬT HÀM HIỂN THỊ BÀI TẬP ---
            window.renderAssignments = (tests, submissions, classId) => {
                const container = document.getElementById('assignments-container');
                
                if (tests.length === 0) {
                    container.innerHTML = `
                        <div class="py-20 text-center bg-white rounded-[40px] border-2 border-dashed border-slate-200">
                            <div class="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                <i data-feather="inbox" class="w-10 h-10 text-slate-300"></i>
                            </div>
                            <p class="text-slate-400 font-bold tracking-tight">Lớp học hiện tại chưa có bài tập được giao.</p>
                        </div>`;
                    feather.replace();
                    return;
                }
                
                container.innerHTML = tests.map(test => {
                    // Tìm bài làm tương ứng với đề thi này
                    const submission = submissions.find(s => s.testId === test.id);
                    
                    // Logic hiển thị Badge và Nút bấm
                    let statusBadge = '';
                    let actionButtons = '';

                    if (submission) {
                        // Trạng thái ĐÃ LÀM
                        statusBadge = `
                            <div class="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                                <span class="relative flex h-2 w-2">
                                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                </span>
                                <span class="text-[10px] font-black uppercase tracking-wider">Đã hoàn thành</span>
                            </div>`;
                        
                        actionButtons = `
                            <a href="result.html" data-submission-id="${submission.id}" 
                            class="view-result-btn flex items-center gap-2 px-6 py-2.5 bg-white border-2 border-slate-100 text-slate-700 rounded-xl font-bold text-sm hover:border-teal-500 hover:text-teal-600 transition-all shadow-sm">
                                <i data-feather="file-text" class="w-4 h-4"></i> Xem kết quả
                            </a>`;
                    } else {
                        // Trạng thái CHƯA LÀM
                        statusBadge = `
                            <div class="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-lg border border-slate-200">
                                <span class="w-2 h-2 rounded-full bg-slate-400"></span>
                                <span class="text-[10px] font-black uppercase tracking-wider">Chưa làm bài</span>
                            </div>`;
                        
                        actionButtons = `
                            <a href="test.html?testId=${test.id}&classId=${classId}" 
                            class="cta-button flex items-center gap-2 px-8 py-2.5 text-sm group">
                                Bắt đầu ngay <i data-feather="arrow-right" class="w-4 h-4 group-hover:translate-x-1 transition-transform"></i>
                            </a>`;
                    }

                    return `
                        <div class="assignment-card group !flex-col md:!flex-row !items-start md:!items-center gap-6 p-6 bg-white rounded-[32px] border border-slate-100 hover:border-teal-500/30 transition-all duration-300">
                            <!-- Phần thông tin -->
                            <div class="flex items-center gap-5 flex-1">
                                <div class="w-16 h-16 bg-slate-50 text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600 rounded-2xl flex items-center justify-center shrink-0 transition-colors duration-300">
                                    <i data-feather="edit-3" class="w-7 h-7"></i>
                                </div>
                                <div class="space-y-1">
                                    <div class="flex flex-wrap items-center gap-3">
                                        <h3 class="font-black text-slate-800 text-lg tracking-tight">${test.name}</h3>
                                        ${statusBadge}
                                    </div>
                                    <p class="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-4">
                                        <span class="flex items-center gap-1"><i data-feather="help-circle" class="w-3"></i> ${test.questionIds?.length || 0} câu hỏi</span>
                                        <span class="flex items-center gap-1"><i data-feather="clock" class="w-3"></i> ${test.timeLimit || 45} phút</span>
                                    </p>
                                </div>
                            </div>

                            <!-- Phần nút bấm -->
                            <div class="w-full md:w-auto shrink-0">
                                ${actionButtons}
                            </div>
                        </div>`;
                }).join('');

                // Gán sự kiện Click cho các nút xem kết quả để lưu ID bài làm
                container.querySelectorAll('.view-result-btn').forEach(btn => {
                    btn.onclick = (e) => {
                        const subId = btn.getAttribute('data-submission-id');
                        if (subId) {
                            sessionStorage.setItem('latestResultId', subId);
                            // Sau khi lưu xong sẽ tự động nhảy theo href="result.html"
                        }
                    };
                });

                feather.replace();
            }

            // --- Cập nhật lại logic initPage để đồng bộ với hàm renderAssignments mới ---
            async function initPage() {
                const urlParams = new URLSearchParams(window.location.search);
                const classId = urlParams.get('classId');

                if (!classId) return;

                try {
                    const classDocRef = doc(db, "classrooms", classId);
                    const classDocSnap = await getDoc(classDocRef);
                    
                    if (classDocSnap.exists()) {
                        const classroom = { id: classDocSnap.id, ...classDocSnap.data() };
                        
                        // Lấy thông tin môn học để làm Subtitle
                        const subjectSnap = await getDoc(doc(db, "subjects", classroom.subjectId));
                        document.getElementById('class-name-header').textContent = classroom.className;
                        document.getElementById('class-subject-header').textContent = `${subjectSnap.data()?.name || 'Địa lí'} • Khối ${classroom.grade}`;

                        // Lấy thông tin Giáo viên
                        const teacherSnap = await getDoc(doc(db, "users", classroom.teacherId));
                        
                        // Lấy danh sách học sinh
                        const studentDocs = await fetchDocsInChunks(collection(db, "users"), "__name__", classroom.students);
                        
                        // Lấy danh sách đề thi
                        const testIds = (classroom.assignments || []).map(a => a.testId);
                        const testDocs = await fetchDocsInChunks(collection(db, "tests"), "__name__", testIds);
                        
                        // Lấy danh sách bài làm của học sinh này tại lớp này
                        const submissionsQuery = query(
                            collection(db, "submissions"), 
                            where("studentId", "==", currentUser.uid), 
                            where("classId", "==", classId)
                        );
                        const submissionsSnap = await getDocs(submissionsQuery);
                        const submissionData = submissionsSnap.docs.map(d => ({id: d.id, ...d.data()}));

                        // Gọi hàm Render Members
                        renderMembers(teacherSnap.data(), studentDocs);
                        
                        // Gọi hàm Render Assignments (Đã cập nhật logic chỉ hiện 1 nút)
                        renderAssignments(testDocs, submissionData, classId);
                    }
                } catch (error) {
                    console.error("Lỗi:", error);
                    showToast("Không thể tải dữ liệu lớp học", "error");
                }
            }
            
            async function fetchDocsInChunks(collectionRef, field, ids) {
                if (!ids || ids.length === 0) return [];
                const allDocsData = [];
                for (let i = 0; i < ids.length; i += 30) {
                    const chunk = ids.slice(i, i + 30);
                    if (chunk.length > 0) {
                        const q = query(collectionRef, where(field, "in", chunk));
                        const snapshot = await getDocs(q);
                        snapshot.forEach(doc => allDocsData.push({id: doc.id, ...doc.data()}));
                    }
                }
                return allDocsData;
            }
            
            function renderMembers(teacher, students) {
                membersContainer.innerHTML = '';
                const teacherHTML = `
                    <div class="flex items-center space-x-3 p-3 bg-teal-50 rounded-lg">
                        <div class="w-10 h-10 rounded-full bg-teal-200 flex items-center justify-center font-bold text-teal-700">${(teacher.name || 'GV').charAt(0)}</div>
                        <div>
                            <p class="font-semibold text-slate-800">${teacher.name}</p>
                            <p class="text-xs text-slate-500">Giáo viên</p>
                        </div>
                    </div>`;
                membersContainer.insertAdjacentHTML('beforeend', teacherHTML);
                
                students.forEach(student => {
                     const studentHTML = `
                    <div class="flex items-center space-x-3 p-3">
                        <div class="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700">${(student.name || 'HS').charAt(0)}</div>
                        <div>
                            <p class="font-semibold text-slate-700">${student.name}</p>
                            <p class="text-xs text-slate-500">Học sinh</p>
                        </div>
                    </div>`;
                    membersContainer.insertAdjacentHTML('beforeend', studentHTML);
                });
            }

            function renderAssignments(tests, submissions, classId) {
                if(tests.length === 0) {
                    assignmentsContainer.innerHTML = `<div class="bg-white p-6 rounded-xl shadow-sm text-center"><i data-feather="inbox" class="w-12 h-12 mx-auto text-slate-400"></i><p class="mt-4 text-slate-500">Chưa có bài tập nào được giao.</p></div>`;
                    feather.replace();
                    return;
                }
                
                assignmentsContainer.innerHTML = '';
                tests.forEach(test => {
                    const submission = submissions.find(s => s.testId === test.id);
                    const card = document.createElement('div');
                    card.className = "bg-white p-6 rounded-xl shadow-sm flex items-center justify-between";
                    
                    let buttonHTML = '';
                    if (submission) {
                        buttonHTML = `
                            <a href="result.html" data-submission-id="${submission.id}" class="view-result-btn bg-white text-slate-700 font-semibold px-5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 transition text-sm">Xem lại</a>
                        `;
                    } else {
                        buttonHTML = `<a href="test.html?testId=${test.id}&classId=${classId}" class="cta-button text-white font-semibold px-5 py-2 rounded-lg">Vào thi</a>`;
                    }

                    card.innerHTML = `
                        <div>
                            <h3 class="font-bold text-lg text-slate-800">${test.name}</h3>
                            <p class="text-sm text-slate-500 mt-1">${test.questionIds?.length || 0} câu - ${test.timeLimit} phút</p>
                        </div>
                        <div class="flex-shrink-0 flex items-center space-x-2">${buttonHTML}</div>
                    `;
                    assignmentsContainer.appendChild(card);
                });

                // Thêm event listener cho các nút "Xem kết quả"
                assignmentsContainer.querySelectorAll('.view-result-btn').forEach(button => {
                    button.addEventListener('click', (e) => {
                        e.preventDefault();
                        sessionStorage.setItem('latestResultId', button.dataset.submissionId);
                        window.location.href = button.href;
                    });
                });

                feather.replace();
            }

            // --- Event Listeners & Handlers ---
            function setupEventListeners() {
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.addEventListener('click', function(e) {
                        e.preventDefault();
                        document.body.style.opacity = '0';
                        setTimeout(() => { window.location.href = this.href; }, 200);
                    });
                });
                document.body.style.transition = 'opacity 0.2s ease-in-out';
                
                document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
            }
            
            setupEventListeners();
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