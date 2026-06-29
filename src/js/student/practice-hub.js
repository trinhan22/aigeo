import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, getDocs, query, where, onSnapshot, addDoc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            // --- DOM ELEMENTS ---
            const userNameEl = document.getElementById('user-name');
            const userAvatarEl = document.getElementById('user-avatar');
            const toastContainer = document.getElementById('toast-container');
            const tabsContainer = document.querySelector('.tabs-pill-container');
            const tabContents = document.querySelectorAll('.tab-content');
            
            const aiPracticeContent = document.getElementById('ai-practice-content');
            const adminTestsContainer = document.getElementById('admin-tests-container');
            
            const filtersLesson = { subject: document.getElementById('filter-subject-lesson'), grade: document.getElementById('filter-grade-lesson') };
            const lessonListContainerLesson = document.getElementById('lesson-list-container-lesson');
            const startLessonPracticeBtn = document.getElementById('start-lesson-practice-btn');

            const filtersComp = { subject: document.getElementById('filter-subject-comprehensive'), grade: document.getElementById('filter-grade-comprehensive') };
            const lessonListContainerComp = document.getElementById('lesson-list-container-comprehensive');
            const startCompPracticeBtn = document.getElementById('start-comprehensive-practice-btn');

            let currentUser = null;
            let userData = {};
            let allDataCache = { subjects: [], lessons: [], tests: [], submissions: [], questions: [], users: [] };

            const cleanPrefix = (t) => t ? t.replace(/^(Câu|Bài|Phần|Mục)\s*\d+\s*[:.]?\s*/i, '').trim() : '';

            // --- AUTH & INITIAL LOAD ---
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    currentUser = user;
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists() && docSnap.data().role === 'student') {
                        userData = docSnap.data();
                        userNameEl.textContent = userData.name;
                        userAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=0D9488&color=fff&bold=true`;
                        
                        await loadInitialData();
                        initializeTabs();

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

            async function loadInitialData() {
                try {
                    const [sSnap, lSnap, tSnap, subSnap, qSnap, uSnap] = await Promise.all([
                        getDocs(collection(db, "subjects")),
                        getDocs(collection(db, "lessons")),
                        getDocs(query(collection(db, "tests"), where("status", "==", "published"))),
                        getDocs(query(collection(db, "submissions"), where("studentId", "==", currentUser.uid))),
                        getDocs(query(collection(db, "questions"), where("status", "==", "approved"))),
                        getDocs(collection(db, "users"))
                    ]);
                    allDataCache.subjects = sSnap.docs.map(d => ({id: d.id, ...d.data()}));
                    allDataCache.lessons = lSnap.docs.map(d => ({id: d.id, ...d.data()}));
                    allDataCache.tests = tSnap.docs.map(d => ({id: d.id, ...d.data()}));
                    allDataCache.submissions = subSnap.docs.map(d => ({id: d.id, ...d.data()}));
                    allDataCache.questions = qSnap.docs.map(d => ({id: d.id, ...d.data()}));
                    allDataCache.users = uSnap.docs.map(d => ({id: d.id, ...d.data()}));
                    
                    populateSelect(filtersLesson.subject, allDataCache.subjects, 'Chọn Môn học');
                    populateSelect(filtersComp.subject, allDataCache.subjects, 'Chọn Môn học');
                } catch (e) { showToast("Lỗi kết nối dữ liệu", "error"); }
            }

            // --- RENDER FUNCTIONS ---
            function renderLessonList(container, subjectId, grade, inputType) {
                const lessons = allDataCache.lessons.filter(l => l.subjectId === subjectId && l.grade == grade).sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
                if (lessons.length === 0) {
                    container.innerHTML = '<p class="text-slate-400 font-bold p-10 text-center col-span-full">Không có bài học phù hợp.</p>';
                    return;
                }
                container.innerHTML = '';
                container.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left p-2';
                lessons.forEach(lesson => {
                    const qCount = allDataCache.questions.filter(q => q.lessonId === lesson.id).length;
                    const card = document.createElement('div');
                    card.className = `lesson-card p-5 ${qCount === 0 ? 'opacity-50 grayscale cursor-not-allowed' : ''}`;
                    card.innerHTML = `
                        <input id="${lesson.id}-${inputType}" type="${inputType}" data-lesson-id="${lesson.id}" name="lesson-selection-${inputType}" class="hidden" ${qCount === 0 ? 'disabled' : ''}>
                        <div class="lesson-check-icon"><i data-feather="check" class="w-4 text-white"></i></div>
                        <label for="${lesson.id}-${inputType}" class="cursor-pointer">
                            <span class="text-[10px] font-black uppercase text-teal-600 bg-teal-50 px-2 py-1 rounded">${qCount} câu hỏi</span>
                            <h4 class="mt-3 font-bold text-slate-800 text-sm leading-snug">${cleanPrefix(lesson.name)}</h4>
                        </label>`;
                    container.appendChild(card);
                });
                feather.replace();
            }

            function renderTestsList(tests, container) {
                container.innerHTML = tests.map(test => {
                    const subject = allDataCache.subjects.find(s => s.id === test.subjectId);
                    const submission = allDataCache.submissions.find(s => s.testId === test.id);
                    // ĐÃ FIX: Hiển thị đúng số câu
                    const qCount = (test.questionIds?.length) || (test.questions?.length) || 0;
                    
                    return `
                        <div class="bg-white border border-slate-100 p-6 rounded-3xl flex items-center justify-between hover:border-teal-500 transition shadow-sm">
                            <div class="flex items-center gap-4 overflow-hidden">
                                <div class="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0"><i data-feather="file-text"></i></div>
                                <div class="overflow-hidden">
                                    <h3 class="font-black text-slate-800 truncate">${test.name}</h3>
                                    <p class="text-[10px] font-bold text-slate-400 uppercase">${subject?.name || 'Chung'} • ${qCount} câu</p>
                                </div>
                            </div>
                            <div class="flex gap-2">
                                <a href="practice-test.html?testId=${test.id}" class="p-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 transition shadow-lg shadow-teal-600/20"><i data-feather="play" class="w-4"></i></a>
                            </div>
                        </div>`;
                }).join('');
                feather.replace();
            }

            // --- TAB LOGIC ---
            function initializeTabs() {
                tabsContainer.onclick = (e) => {
                    const btn = e.target.closest('.tab-button');
                    if (!btn) return;
                    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
                    tabContents.forEach(c => c.classList.remove('active'));
                    btn.classList.add('active');
                    const id = btn.dataset.tab;
                    document.getElementById(id).classList.add('active');
                    
                    if (id === 'ai-practice') loadAiPracticeTab();
                    if (id === 'admin-practice') loadAdminPracticeTab();
                };
                loadAiPracticeTab();
                setupEventListeners();
            }

            // --- ĐỀ AI (Đã sửa logic click) ---
            async function loadAiPracticeTab() {
                aiPracticeContent.innerHTML = `<div class="skeleton h-20 w-full"></div>`;
                const incorrectQuestions = allDataCache.submissions.flatMap(r => r.incorrectQuestions || []);
                
                if (incorrectQuestions.length === 0) {
                    aiPracticeContent.innerHTML = `<div class="text-center py-10"><i data-feather="award" class="w-12 h-12 mx-auto text-green-500 mb-4"></i><p class="font-bold text-slate-700">Tuyệt vời!</p><p class="text-sm text-slate-400">Bạn chưa có lỗi sai nào cần ôn tập.</p></div>`;
                    feather.replace(); return;
                }

                const weakLessons = [...new Set(incorrectQuestions.map(q => q.lessonId).filter(Boolean))];
                aiPracticeContent.innerHTML = '<div class="space-y-3"></div>';
                
                const subjectGroups = {};
                weakLessons.forEach(lId => {
                    const lesson = allDataCache.lessons.find(l => l.id === lId);
                    if(lesson) {
                        if(!subjectGroups[lesson.subjectId]) subjectGroups[lesson.subjectId] = [];
                        subjectGroups[lesson.subjectId].push(lId);
                    }
                });

                for (const sId in subjectGroups) {
                    const subject = allDataCache.subjects.find(s => s.id === sId);
                    const qPool = allDataCache.questions.filter(q => subjectGroups[sId].includes(q.lessonId)).map(q => q.id);
                    if (qPool.length === 0) continue;

                    const card = document.createElement('div');
                    card.className = "p-4 bg-slate-50 rounded-2xl flex justify-between items-center border border-slate-100";
                    card.innerHTML = `
                        <div><p class="font-black text-slate-800">${subject.name}</p><p class="text-[10px] font-bold text-slate-400 uppercase">${subjectGroups[sId].length} chủ đề cần củng cố</p></div>
                        <button class="bg-teal-600 text-white px-5 py-2 rounded-xl font-black text-xs shadow-lg btn-ai-start" data-sid="${sId}" data-pool='${JSON.stringify(qPool)}'>TẠO ĐỀ NGAY</button>
                    `;
                    aiPracticeContent.querySelector('.space-y-3').appendChild(card);
                }
                
                // Gán sự kiện cho nút AI
                aiPracticeContent.querySelectorAll('.btn-ai-start').forEach(btn => {
                    btn.onclick = () => {
                        const pool = JSON.parse(btn.dataset.pool);
                        const final = pool.sort(() => 0.5 - Math.random()).slice(0, 20);
                        sessionStorage.setItem('practiceTestQuestions', JSON.stringify(final));
                        sessionStorage.setItem('practiceContext', JSON.stringify({ 
                            type: 'ai_generated', 
                            subjectId: btn.dataset.sid,
                            testName: 'Đề ôn tập Năng lực AI' 
                        }));
                        window.location.href = 'practice-test.html'; // ĐÃ FIX TÊN FILE
                    };
                });
                feather.replace();
            }

            function loadAdminPracticeTab() {
                renderTestsList(allDataCache.tests, adminTestsContainer);
            }

            function setupEventListeners() {
                // Theo bài
                filtersLesson.subject.onchange = () => populateGrades(filtersLesson, filtersLesson.subject.value);
                filtersLesson.grade.onchange = () => renderLessonList(lessonListContainerLesson, filtersLesson.subject.value, filtersLesson.grade.value, 'radio');
                
                lessonListContainerLesson.onchange = () => {
                    const sel = lessonListContainerLesson.querySelector('input:checked');
                    document.getElementById('question-count-wrapper-lesson').classList.toggle('hidden', !sel);
                    startLessonPracticeBtn.disabled = !sel;
                };

                // Tổng hợp
                filtersComp.subject.onchange = () => populateGrades(filtersComp, filtersComp.subject.value);
                filtersComp.grade.onchange = () => renderLessonList(lessonListContainerComp, filtersComp.subject.value, filtersComp.grade.value, 'checkbox');

                lessonListContainerComp.onchange = () => {
                    const count = lessonListContainerComp.querySelectorAll('input:checked').length;
                    document.getElementById('question-count-wrapper-comprehensive').classList.toggle('hidden', count === 0);
                    startCompPracticeBtn.disabled = count === 0;
                    startCompPracticeBtn.innerText = `Bắt đầu (${count} bài đã chọn)`;
                };

                // Slider update
                document.getElementById('question-count-slider-lesson').oninput = (e) => document.getElementById('question-count-label-lesson').textContent = e.target.value;
                document.getElementById('question-count-slider-comprehensive').oninput = (e) => document.getElementById('question-count-label-comprehensive').textContent = e.target.value;

                // Nút Bắt đầu - ĐÃ FIX CHUYỂN HƯỚNG VÀ DỮ LIỆU
                startLessonPracticeBtn.onclick = () => {
                    const selInput = lessonListContainerLesson.querySelector('input:checked');
                    const lessonId = selInput.dataset.lessonId;
                    const count = parseInt(document.getElementById('question-count-slider-lesson').value);
                    const pool = allDataCache.questions.filter(q => q.lessonId === lessonId).map(q => q.id);
                    const final = pool.sort(() => 0.5 - Math.random()).slice(0, count);
                    
                    sessionStorage.setItem('practiceTestQuestions', JSON.stringify(final));
                    sessionStorage.setItem('practiceContext', JSON.stringify({ 
                        type: 'lesson_practice', 
                        subjectId: filtersLesson.subject.value,
                        testName: 'Luyện tập theo bài' 
                    }));
                    window.location.href = 'practice-test.html'; // ĐÃ FIX TÊN FILE
                };

                startCompPracticeBtn.onclick = () => {
                    const checked = Array.from(lessonListContainerComp.querySelectorAll('input:checked')).map(i => i.dataset.lessonId);
                    const count = parseInt(document.getElementById('question-count-slider-comprehensive').value);
                    const pool = allDataCache.questions.filter(q => checked.includes(q.lessonId)).map(q => q.id);
                    const final = pool.sort(() => 0.5 - Math.random()).slice(0, count);
                    
                    sessionStorage.setItem('practiceTestQuestions', JSON.stringify(final));
                    sessionStorage.setItem('practiceContext', JSON.stringify({ 
                        type: 'comprehensive_practice', 
                        subjectId: filtersComp.subject.value,
                        testName: 'Luyện tập tổng hợp' 
                    }));
                    window.location.href = 'practice-test.html'; // ĐÃ FIX TÊN FILE
                };

                document.getElementById('logout-btn').onclick = () => signOut(auth);
            }

            // Helpers
            function populateSelect(el, data, placeholder) {
                el.innerHTML = `<option value="">${placeholder}</option>` + data.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
            }

            function populateGrades(group, sId) {
                const grades = [...new Set(allDataCache.lessons.filter(l => l.subjectId === sId).map(l => l.grade))].sort((a,b) => a-b);
                group.grade.innerHTML = `<option value="">Chọn Lớp</option>` + grades.map(g => `<option value="${g}">Lớp ${g}</option>`).join('');
                group.grade.disabled = !sId;
            }

            function showToast(message, type = 'success') {
                const toast = document.createElement('div');
                toast.className = `toast show ${type === 'success' ? 'bg-slate-900' : 'bg-red-500'} text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm`;
                toast.textContent = message;
                toastContainer.appendChild(toast);
                setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
            }
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