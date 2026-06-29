import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getFirestore, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const db = getFirestore(app);

            // --- DOM Elements ---
            const tabButtons = document.querySelectorAll('.tab-button');
            const tabContents = document.querySelectorAll('.tab-content');
            const adminTestsContainer = document.getElementById('admin-tests-container');
            const toastContainer = document.getElementById('toast-container');

            const filtersLesson = { subject: document.getElementById('filter-subject-lesson'), grade: document.getElementById('filter-grade-lesson') };
            const lessonListContainerLesson = document.getElementById('lesson-list-container-lesson');
            const startLessonPracticeBtn = document.getElementById('start-lesson-practice-btn');

            const filtersComp = { subject: document.getElementById('filter-subject-comprehensive'), grade: document.getElementById('filter-grade-comprehensive') };
            const lessonListContainerComp = document.getElementById('lesson-list-container-comprehensive');
            const startCompPracticeBtn = document.getElementById('start-comprehensive-practice-btn');

            // --- State Cache ---
            let allDataCache = { subjects: [], lessons: [], tests: [], questions: [] };

            const cleanPrefix = (t) => t ? t.replace(/^(Câu|Bài|Phần|Mục)\s*\d+\s*[:.]?\s*/i, '').trim() : '';

            // --- Core Functions ---
            async function loadInitialData() {
                try {
                    const [subjectsSnap, lessonsSnap, testsSnap, questionsSnap] = await Promise.all([
                        getDocs(collection(db, "subjects")),
                        getDocs(collection(db, "lessons")),
                        getDocs(query(collection(db, "tests"), where("status", "==", "published"))),
                        getDocs(query(collection(db, "questions"), where("status", "==", "approved")))
                    ]);
                    allDataCache.subjects = subjectsSnap.docs.map(d => ({id: d.id, ...d.data()}));
                    allDataCache.lessons = lessonsSnap.docs.map(d => ({id: d.id, ...d.data()}));
                    allDataCache.tests = testsSnap.docs.map(d => ({id: d.id, ...d.data()}));
                    allDataCache.questions = questionsSnap.docs.map(d => ({id: d.id, ...d.data()}));
                    
                    loadLessonPracticeTab(); // Initial load
                } catch (error) { 
                    showToast("Lỗi tải dữ liệu từ máy chủ."); 
                }
            }

            // Render danh sách bài học
            function renderLessonList(container, subjectId, grade, inputType) {
                const lessons = allDataCache.lessons.filter(l => l.subjectId === subjectId && l.grade == grade).sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity));
                if (lessons.length === 0) {
                    container.innerHTML = '<p class="text-slate-400 font-bold p-10">Không tìm thấy bài học phù hợp.</p>';
                    return;
                }
                container.innerHTML = '';
                container.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto p-2';
                
                lessons.forEach(lesson => {
                    const qCount = allDataCache.questions.filter(q => q.lessonId === lesson.id).length;
                    const card = document.createElement('div');
                    card.className = `lesson-card p-5 ${qCount === 0 ? 'opacity-50 grayscale cursor-not-allowed' : ''}`;
                    card.innerHTML = `
                        <input id="${lesson.id}-${inputType}" type="${inputType}" data-lesson-id="${lesson.id}" name="lesson-selection-${inputType}" class="hidden" ${qCount === 0 ? 'disabled' : ''}>
                        <div class="check-indicator"><i class="fas fa-check"></i></div>
                        <label for="${lesson.id}-${inputType}" class="cursor-pointer block">
                            <span class="text-[10px] font-black uppercase text-teal-600 bg-teal-50 px-2 py-1 rounded">${qCount} câu hỏi</span>
                            <h4 class="mt-3 font-bold text-slate-800 leading-tight">${lesson.name}</h4>
                        </label>
                    `;
                    container.appendChild(card);
                });
                feather.replace();
            }

            // Render Đề thi hệ thống
            function renderTestsList(tests, container) {
                container.innerHTML = tests.length > 0 ? tests.map(test => `
                    <div class="bg-white border border-slate-100 p-6 rounded-2xl flex items-center justify-between hover:bg-slate-50 transition-all group shadow-sm">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><i class="fas fa-file-signature"></i></div>
                            <div>
                                <h3 class="font-black text-slate-800 group-hover:text-indigo-600 transition">${test.name}</h3>
                                <p class="text-xs font-bold text-slate-400 uppercase tracking-tighter">${test.questionIds?.length || 0} câu • ${test.timeLimit || 45} phút</p>
                            </div>
                        </div>
                        <a href="practice-test.html?testId=${test.id}" class="btn-modern btn-primary py-2 px-6 text-sm">Làm đề</a>
                    </div>
                `).join('') : '<p class="text-slate-400 font-bold p-10 text-center col-span-2">Chưa có đề thi nào.</p>';
            }

            // --- Logic Xử lý Bắt đầu làm bài ---

            // 1. Logic cho "Theo Bài"
            function handleStartLesson() {
                const selected = lessonListContainerLesson.querySelector('input:checked');
                if (!selected) return;

                const lessonId = selected.dataset.lessonId;
                const count = parseInt(document.getElementById('question-count-slider-lesson').value);
                
                // Lọc câu hỏi của bài đó
                const pool = allDataCache.questions.filter(q => q.lessonId === lessonId).map(q => q.id);
                const finalIds = pool.sort(() => 0.5 - Math.random()).slice(0, count);

                if (finalIds.length === 0) return showToast("Bài học này chưa có câu hỏi.");

                sessionStorage.setItem('practiceTestQuestions', JSON.stringify(finalIds));
                sessionStorage.setItem('practiceContext', JSON.stringify({ 
                    type: 'lesson_practice', 
                    testName: `Luyện tập: ${allDataCache.lessons.find(l => l.id === lessonId)?.name}` 
                }));
                window.location.href = 'practice-test.html';
            }

            // 2. Logic cho "Tổng Hợp"
            function handleStartComprehensive() {
                const checkedInputs = lessonListContainerComp.querySelectorAll('input:checked');
                if (checkedInputs.length === 0) return;

                const lessonIds = Array.from(checkedInputs).map(i => i.dataset.lessonId);
                const totalCount = parseInt(document.getElementById('question-count-slider-comprehensive').value);

                // Gom câu hỏi từ tất cả các bài đã chọn
                const pool = allDataCache.questions.filter(q => lessonIds.includes(q.lessonId)).map(q => q.id);
                const finalIds = pool.sort(() => 0.5 - Math.random()).slice(0, totalCount);

                if (finalIds.length === 0) return showToast("Các bài đã chọn chưa có câu hỏi.");

                sessionStorage.setItem('practiceTestQuestions', JSON.stringify(finalIds));
                sessionStorage.setItem('practiceContext', JSON.stringify({ 
                    type: 'comprehensive_practice', 
                    testName: "Luyện tập tổng hợp" 
                }));
                window.location.href = 'practice-test.html';
            }

            // --- Event Listeners Setup ---
            function setupEventListeners() {
                // Tab Switch
                tabButtons.forEach(btn => {
                    btn.onclick = () => {
                        tabButtons.forEach(b => b.classList.remove('active'));
                        tabContents.forEach(c => c.classList.remove('active'));
                        btn.classList.add('active');
                        document.getElementById(btn.dataset.tab).classList.add('active');
                        if(btn.dataset.tab === 'admin-practice') renderTestsList(allDataCache.tests, adminTestsContainer);
                    };
                });

                // Lesson Practice Filters
                filtersLesson.subject.onchange = () => populateGrades(filtersLesson, filtersLesson.subject.value);
                filtersLesson.grade.onchange = () => renderLessonList(lessonListContainerLesson, filtersLesson.subject.value, filtersLesson.grade.value, 'radio');
                
                lessonListContainerLesson.addEventListener('change', () => {
                    const isSelected = lessonListContainerLesson.querySelector('input:checked');
                    document.getElementById('question-count-wrapper-lesson').classList.toggle('hidden', !isSelected);
                    startLessonPracticeBtn.disabled = !isSelected;
                });

                // Comprehensive Filters
                filtersComp.subject.onchange = () => populateGrades(filtersComp, filtersComp.subject.value);
                filtersComp.grade.onchange = () => renderLessonList(lessonListContainerComp, filtersComp.subject.value, filtersComp.grade.value, 'checkbox');

                lessonListContainerComp.addEventListener('change', () => {
                    const count = lessonListContainerComp.querySelectorAll('input:checked').length;
                    document.getElementById('question-count-wrapper-comprehensive').classList.toggle('hidden', count === 0);
                    startCompPracticeBtn.disabled = count === 0;
                    startCompPracticeBtn.innerText = `Bắt đầu (${count} bài đã chọn)`;
                });

                // Slider labels
                document.getElementById('question-count-slider-lesson').oninput = (e) => {
                    document.getElementById('question-count-label-lesson').innerText = e.target.value;
                };
                document.getElementById('question-count-slider-comprehensive').oninput = (e) => {
                    document.getElementById('question-count-label-comprehensive').innerText = e.target.value;
                };

                // Nút Bắt đầu
                startLessonPracticeBtn.onclick = handleStartLesson;
                startCompPracticeBtn.onclick = handleStartComprehensive;
            }

            // Helpers
            function populateGrades(group, sId) {
                const grades = [...new Set(allDataCache.lessons.filter(l => l.subjectId === sId).map(l => l.grade))].sort((a,b) => a-b);
                group.grade.innerHTML = `<option value="">Chọn Lớp</option>` + grades.map(g => `<option value="${g}">Lớp ${g}</option>`).join('');
                group.grade.disabled = !sId;
            }

            function populateSelect(el, data, placeholder) {
                el.innerHTML = `<option value="">${placeholder}</option>` + data.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
            }

            function showToast(msg) {
                const t = document.createElement('div');
                t.className = "bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl font-bold animate-bounce";
                t.innerText = msg;
                toastContainer.appendChild(t);
                setTimeout(() => t.remove(), 3000);
            }

            (async () => {
                await loadInitialData();
                populateSelect(filtersLesson.subject, allDataCache.subjects, 'Chọn Môn học');
                populateSelect(filtersComp.subject, allDataCache.subjects, 'Chọn Môn học');
                setupEventListeners();
                feather.replace();
            })();
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