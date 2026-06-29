import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, onSnapshot, query, where, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        
        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);
            
            // --- Elements ---
            const userNameEl = document.getElementById('user-name');
            const userAvatarEl = document.getElementById('user-avatar');
            const questionsArea = document.getElementById('questions-area');
            const filters = { subject: document.getElementById('filter-subject'), grade: document.getElementById('filter-grade'), lesson: document.getElementById('filter-lesson') };
            const qModal = document.getElementById('question-modal');
            const qForm = document.getElementById('question-form');
            const qModalTitle = document.getElementById('question-modal-title');
            const qCancelBtn = document.getElementById('question-cancel-btn');
            const qSubmitBtn = document.getElementById('question-submit-btn');
            const toastContainer = document.getElementById('toast-container');
            const deleteConfirmModal = document.getElementById('delete-confirm-modal');
            const deleteCancelBtn = document.getElementById('delete-cancel-btn');
            const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
            const deleteConfirmText = document.getElementById('delete-confirm-text');
            const viewQuestionModal = document.getElementById('view-question-modal');
            const viewQuestionCloseBtn = document.getElementById('view-question-close-btn');
            
            const qType = document.getElementById('q-type');
            const qContent = document.getElementById('q-content');
            const qDifficulty = document.getElementById('q-difficulty');
            const qExplanation = document.getElementById('q-explanation');
            const mcWrapper = document.getElementById('mc-options-wrapper');
            const tfGroupWrapper = document.getElementById('true-false-group-wrapper');
            const saWrapper = document.getElementById('short-answer-wrapper');

            // --- State ---
            let allData = { subjects: [], lessons: [] };
            let lessonQuestions = [];
            let currentUser = null;
            let currentLessonId = null;
            let currentQuestionContext = {};
            let itemToDeleteId = null;
            let questionListener = null;

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

            function renderMathWithKaTeX(elem) {
                if (window.renderMathInElement) {
                    window.renderMathInElement(elem, {
                        delimiters: [
                            {left: "$$", right: "$$", display: true},
                            {left: "$", right: "$", display: false}
                        ]
                    });
                }
            }
             function cleanPrefix(text) {
                if (!text) return '';
                return text.replace(/^(Câu|Bài|Phần|Mục)\s*[\dIVXLC]+\s*[:.]?\s*/i, '').trim();
            }

            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    currentUser = user;
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists() && docSnap.data().role === 'teacher') {
                        const userData = docSnap.data();
                        userNameEl.textContent = userData.name || 'Giáo viên';
                        const nameInitial = (userData.name || 'T').charAt(0).toUpperCase();
                        userAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=0D9488&color=fff&bold=true`;
                        initPage();
                    } else {
                        const userRole = docSnap.data()?.role;
                        window.location.href = userRole ? `../${userRole}/index.html` : '../auth.html';
                    }
                } else {
                    window.location.href = '../auth.html';
                }
            });

            async function initPage() {
                try {
                    const [subjectsSnap, lessonsSnap] = await Promise.all([
                        getDocs(collection(db, "subjects")),
                        getDocs(collection(db, "lessons"))
                    ]);
                    allData.subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    allData.lessons = lessonsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    
                    setupFilters();
                    setupEventListeners();
                } catch (error) {
                    console.error("Initialization Error: ", error);
                }
            }

            function setupFilters() {
                populateSelect(filters.subject, allData.subjects, 'Chọn Môn học');
                filters.subject.addEventListener('change', () => {
                    const subjectId = filters.subject.value;
                    resetFilters(['grade', 'lesson']);
                    if (subjectId) {
                        const subjectLessons = allData.lessons.filter(l => l.subjectId === subjectId);
                        const grades = [...new Set(subjectLessons.map(l => l.grade))].sort((a,b) => a-b);
                        populateSelect(filters.grade, grades.map(g => ({id: g, name: `Lớp ${g}`})), 'Chọn Lớp');
                        filters.grade.disabled = false;
                    }
                });
                filters.grade.addEventListener('change', () => {
                    const subjectId = filters.subject.value;
                    const grade = filters.grade.value;
                    resetFilters(['lesson']);
                    if (grade) {
                        const lessons = allData.lessons.filter(l => l.subjectId === subjectId && l.grade == grade).sort((a,b) => (a.order ?? Infinity) - (b.order ?? Infinity));
                        populateSelect(filters.lesson, lessons, 'Chọn Bài học', true);
                        filters.lesson.disabled = false;
                    }
                });
                filters.lesson.addEventListener('change', () => {
                    currentLessonId = filters.lesson.value;
                    if (currentLessonId) {
                        if (questionListener) questionListener(); // Unsubscribe from previous listener
                        listenForQuestions(currentLessonId);
                    } else {
                        renderInitialView();
                    }
                });
            }
            
            function listenForQuestions(lessonId) {
                const approvedQuery = query(collection(db, "questions"), 
                    where("lessonId", "==", lessonId), 
                    where("status", "==", "approved")
                );
                const ownQuery = query(collection(db, "questions"), 
                    where("lessonId", "==", lessonId), 
                    where("authorId", "==", currentUser.uid)
                );

                const unsubApproved = onSnapshot(approvedQuery, (approvedSnapshot) => {
                    const approvedQuestions = approvedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    
                    const unsubOwn = onSnapshot(ownQuery, (ownSnapshot) => {
                        const ownQuestions = ownSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        
                        const questionsMap = new Map();
                        approvedQuestions.forEach(q => questionsMap.set(q.id, q));
                        ownQuestions.forEach(q => questionsMap.set(q.id, q));

                        lessonQuestions = Array.from(questionsMap.values())
                            .sort((a, b) => (a.order || Infinity) - (b.order || Infinity) || (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
                        
                        renderQuestionsForLesson(lessonId);
                    });
                    questionListener = unsubOwn;
                });
                
                // Store the main listener to unsubscribe later
                const mainUnsub = () => {
                    unsubApproved();
                    if(questionListener) questionListener();
                };
                questionListener = mainUnsub;
            }

            window.renderQuestionsForLesson = (lessonId) => {
                const lesson = allData.lessons.find(l => l.id === lessonId);
                questionsArea.innerHTML = `
                    <div class="bento-card !p-0 overflow-hidden shadow-xl shadow-slate-200/50">
                        <div class="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
                            <div>
                                <h2 class="text-xl font-black text-slate-800">${cleanPrefix(lesson.name)}</h2>
                                <p class="text-xs font-bold text-slate-400 uppercase tracking-tighter mt-1">${lessonQuestions.length} câu hỏi khả dụng</p>
                            </div>
                            <!-- Sửa: Nút thêm câu hỏi dùng data-action -->
                            <button type="button" data-action="add-question" class="cta-button shadow-none text-xs px-6 py-3"><i class="fas fa-plus-circle mr-1"></i>Đóng góp câu hỏi</button>
                        </div>
                        <div class="overflow-x-auto">
                            ${renderQuestionsTable(lessonQuestions)}
                        </div>
                    </div>`;
                renderMathWithKaTeX(questionsArea);
                feather.replace();
            }

            window.renderQuestionsTable = (questions) => {
                if (questions.length === 0) return `<div class="p-20 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">Chưa có dữ liệu</div>`;
                
                let html = `<table class="modern-table">
                    <thead><tr>
                        <th class="text-left">Nội dung câu hỏi</th>
                        <th class="text-center">Nguồn</th>
                        <th class="text-center">Trạng thái</th>
                        <th class="text-right">Tác vụ</th>
                    </tr></thead><tbody>`;

                questions.forEach(q => {
                    const isOwn = q.authorId === currentUser.uid;
                    const statusClass = q.status === 'approved' ? 'status-approved' : (q.status === 'rejected' ? 'status-rejected' : 'status-pending');
                    const statusText = q.status === 'approved' ? 'Đã duyệt' : (q.status === 'rejected' ? 'Từ chối' : 'Chờ duyệt');

                    html += `<tr>
                        <td>
                            <div class="max-w-xl">
                                <div class="font-bold text-slate-700 text-sm line-clamp-2">${cleanPrefix(q.content)}</div>
                            </div>
                        </td>
                        <td class="text-center font-black text-[10px] text-slate-400">${isOwn ? 'CÁ NHÂN' : 'HỆ THỐNG'}</td>
                        <td class="text-center">${isOwn ? `<span class="badge-pill ${statusClass}">${statusText}</span>` : '<span class="text-slate-300 font-bold text-[10px]">CÔNG KHAI</span>'}</td>
                        <td class="text-right">
                            <div class="flex justify-end gap-1">
                                <!-- Sửa: Nút mắt dùng data-action -->
                                <button type="button" data-action="view-question" data-id="${q.id}" class="p-2 text-slate-400 hover:text-teal-600 transition"><i data-feather="eye" class="w-4"></i></button>
                                ${isOwn ? `
                                    <button type="button" data-action="edit-question" data-id="${q.id}" class="p-2 text-slate-400 hover:text-teal-600 transition"><i data-feather="edit-2" class="w-4"></i></button>
                                    <button type="button" data-action="delete-question" data-id="${q.id}" class="p-2 text-slate-400 hover:text-red-500 transition"><i data-feather="trash-2" class="w-4"></i></button>
                                ` : ''}
                            </div>
                        </td>
                    </tr>`;
                });
                return html + `</tbody></table>`;
            }
            
            function renderInitialView() {
                questionsArea.innerHTML = `<div class="text-center text-slate-500 bg-white p-10 rounded-lg shadow-sm">
                    <i data-feather="list" class="w-12 h-12 mx-auto"></i>
                    <p class="mt-4">Vui lòng chọn một bài học để xem và thêm câu hỏi.</p>
                </div>`;
                feather.replace();
            }
            
            function setupEventListeners() {
                // Hiệu ứng chuyển trang mượt mà
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.onclick = (e) => { e.preventDefault(); document.body.style.opacity = '0'; setTimeout(() => window.location.href = link.href, 200); };
                });

                document.getElementById('logout-btn').onclick = () => signOut(auth);
                document.getElementById('view-question-close-btn').onclick = () => document.getElementById('view-question-modal').classList.replace('flex', 'hidden');

                // Xử lý click cho toàn bộ vùng câu hỏi (Event Delegation)
                questionsArea.addEventListener('click', (e) => {
                    const btn = e.target.closest('button');
                    if (!btn) return;

                    const action = btn.dataset.action;
                    const id = btn.dataset.id;

                    if (action === 'add-question') {
                        window.showQuestionModal('add', { lessonId: currentLessonId });
                    } else if (action === 'view-question') {
                        window.showQuestionViewModal(id);
                    } else if (action === 'edit-question') {
                        const data = lessonQuestions.find(q => q.id === id);
                        if (data) window.showQuestionModal('edit', data);
                    } else if (action === 'delete-question') {
                        showDeleteConfirmModal(id);
                    }
                });
            }
            
            window.showQuestionViewModal = (questionId) => {
                const question = lessonQuestions.find(q => q.id === questionId);
                if (!question) return;

                const viewContent = document.getElementById('view-question-content');
                let detailsHTML = `<div class="prose prose-lg mb-6">${question.content}</div><div class="space-y-4">`;

                if (question.type === 'multiple_choice') {
                    detailsHTML += (question.options || []).map((opt, i) => {
                        const letter = String.fromCharCode(65 + i);
                        const isCorrect = letter === question.correctAnswer;
                        return `<div class="p-4 rounded-2xl flex items-center gap-3 border ${isCorrect ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-slate-50 border-slate-100 text-slate-600'}">
                            <span class="font-black">${letter}.</span><div class="font-bold">${opt}</div>
                        </div>`;
                    }).join('');
                } else if (question.type === 'true_false_group') {
                    const stmts = question.statements || {};
                    detailsHTML += Object.keys(stmts).map(key => {
                        const isTrue = question.answers[key] === true;
                        return `<div class="p-4 rounded-2xl flex justify-between bg-slate-50 border border-slate-100">
                            <div class="font-bold text-slate-700">${key}) ${stmts[key]}</div>
                            <span class="font-black text-xs ${isTrue ? 'text-teal-600' : 'text-red-500'}">${isTrue ? 'ĐÚNG' : 'SAI'}</span>
                        </div>`;
                    }).join('');
                }

                if (question.explanation) {
                    detailsHTML += `<div class="mt-8 pt-6 border-t border-slate-100"><p class="text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Giải thích chi tiết</p><div class="text-sm font-medium text-slate-600">${question.explanation}</div></div>`;
                }

                viewContent.innerHTML = detailsHTML + `</div>`;
                renderMathWithKaTeX(viewContent);
                document.getElementById('view-question-modal').classList.replace('hidden', 'flex');
                feather.replace();
            };

            async function handleQuestionFormSubmit(e) {
                e.preventDefault();
                qSubmitBtn.disabled = true;
                const { mode, data } = currentQuestionContext;
                
                if(!currentLessonId && mode === 'add') {
                    showToast("Vui lòng chọn một bài học trước khi thêm câu hỏi.", "error");
                    qSubmitBtn.disabled = false;
                    return;
                }
                
                const payload = {
                    content: cleanPrefix(qContent.value.trim()), 
                    type: qType.value,
                    difficulty: qDifficulty.value,
                    explanation: qExplanation.value.trim(),
                    lessonId: data.lessonId || currentLessonId,
                    authorId: currentUser.uid,
                };

                if (mode === 'add') {
                    payload.status = 'pending';
                    payload.createdAt = serverTimestamp();
                    const q = query(collection(db, "questions"), where("lessonId", "==", payload.lessonId));
                    const snapshot = await getDocs(q);
                    const maxOrder = snapshot.docs.reduce((max, doc) => Math.max(max, doc.data().order || 0), 0);
                    payload.order = maxOrder + 1;
                } else {
                    payload.order = data.order; 
                }

                if (payload.type === 'multiple_choice') {
                    payload.options = [document.getElementById('q-option-a').value.trim(), document.getElementById('q-option-b').value.trim(), document.getElementById('q-option-c').value.trim(), document.getElementById('q-option-d').value.trim()];
                    payload.correctAnswer = document.getElementById('q-mc-answer').value;
                } else if (payload.type === 'short_answer') {
                     payload.correctAnswer = document.getElementById('q-sa-answer').value.trim();
                } else if (payload.type === 'true_false_group') {
                    payload.statements = {}; payload.answers = {};
                    ['a', 'b'].forEach(char => {
                        const statementInput = document.getElementById(`q-tf-statement-${char}`);
                        const statement = statementInput.value.trim();
                        if (statement) {
                            payload.statements[char] = statement;
                            const answerRadio = document.querySelector(`input[name="q-tf-answer-${char}"]:checked`);
                            payload.answers[char] = answerRadio ? (answerRadio.value === 'true') : null;
                        }
                    });
                }
                
                try {
                    if (mode === 'add') {
                        await addDoc(collection(db, 'questions'), payload);
                        showToast('Câu hỏi đã được gửi đi chờ duyệt!');
                    } else {
                        await updateDoc(doc(db, 'questions', data.id), payload);
                        showToast('Câu hỏi đã được cập nhật thành công!');
                    }
                    hideQuestionModal();
                } catch (error) {
                    console.error("Error saving question:", error);
                    showToast("Lỗi khi lưu câu hỏi", "error");
                } finally {
                    qSubmitBtn.disabled = false;
                }
            }
            
            function populateSelect(selectElement, data, placeholder, shouldCleanPrefix = false) {
                selectElement.innerHTML = `<option value="">${placeholder}</option>`;
                 data.forEach(item => { 
                    const displayName = shouldCleanPrefix ? cleanPrefix(item.name) : (item.name || '');
                    selectElement.innerHTML += `<option value="${item.id}">${displayName}</option>`;
                });
            }
            
            function resetFilters(filterNames) {
                filterNames.forEach(name => {
                    const filterEl = document.getElementById(`filter-${name}`);
                    if (filterEl) {
                         const placeholder = { grade: 'Chọn Lớp', lesson: 'Chọn Bài học'}[name] || '';
                        filterEl.innerHTML = `<option value="">${placeholder}</option>`;
                        filterEl.disabled = true;
                    }
                });
            }
            
            window.showQuestionModal = (mode, data = {}) => {
                // Cập nhật lại tham chiếu DOM mỗi khi mở modal
                const qModal = document.getElementById('question-modal');
                const qForm = document.getElementById('question-form');
                const qType = document.getElementById('q-type');
                const qSubmitBtn = document.getElementById('question-submit-btn');

                currentQuestionContext = { mode, data };
                qForm.reset();
                
                document.getElementById('question-modal-title').textContent = mode === 'add' ? 'Đóng góp câu hỏi mới' : 'Chỉnh sửa câu hỏi';
                qSubmitBtn.textContent = mode === 'add' ? 'Gửi đi' : 'Lưu thay đổi';

                if (mode === 'edit') {
                    document.getElementById('q-content').value = cleanPrefix(data.content) || '';
                    qType.value = data.type || 'multiple_choice';
                    document.getElementById('q-difficulty').value = data.difficulty || 'nhan_biet';
                    document.getElementById('q-explanation').value = data.explanation || '';
                    if(data.type === 'multiple_choice') {
                        (data.options || []).forEach((opt, i) => {
                            const char = String.fromCharCode(97 + i);
                            document.getElementById(`q-option-${char}`).value = opt;
                        });
                        document.getElementById('q-mc-answer').value = data.correctAnswer || 'A';
                    } else if (data.type === 'true_false_group') {
                        ['a', 'b'].forEach(char => {
                            const statementInput = document.getElementById(`q-tf-statement-${char}`);
                            const answerRadio = document.querySelector(`input[name="q-tf-answer-${char}"][value="true"]`);
                            const answerRadioFalse = document.querySelector(`input[name="q-tf-answer-${char}"][value="false"]`);
                            if(data.statements && data.statements[char]) {
                                statementInput.value = data.statements[char];
                                if(data.answers[char] === true) answerRadio.checked = true;
                                if(data.answers[char] === false) answerRadioFalse.checked = true;
                            }
                        });
                    } else if (data.type === 'short_answer') {
                        document.getElementById('q-sa-answer').value = data.correctAnswer;
                    }
                }
    
                toggleAnswerFields(); // Cập nhật hiển thị wrapper tương ứng
                qType.onchange = toggleAnswerFields; // Gán lại sự kiện onchange

                qModal.classList.replace('hidden', 'flex');
                feather.replace();
            };

            window.hideQuestionModal = () => {
                document.getElementById('question-modal').classList.replace('flex', 'hidden');
            };

             function toggleAnswerFields() {
                const qTypeVal = document.getElementById('q-type').value;
                const mcWrapper = document.getElementById('mc-options-wrapper');
                const tfGroupWrapper = document.getElementById('true-false-group-wrapper');
                const saWrapper = document.getElementById('short-answer-wrapper');

                mcWrapper.classList.add('hidden');
                tfGroupWrapper.classList.add('hidden');
                saWrapper.classList.add('hidden');

                if (qTypeVal === 'multiple_choice') mcWrapper.classList.remove('hidden');
                else if (qTypeVal === 'true_false_group') tfGroupWrapper.classList.remove('hidden');
                else if (qTypeVal === 'short_answer') saWrapper.classList.remove('hidden');
            }
             function showDeleteConfirmModal(id) {
                itemToDeleteId = id;
                const question = lessonQuestions.find(q => q.id === id);
                deleteConfirmText.textContent = `Bạn có chắc chắn muốn xóa câu hỏi "${(question.content || "").substring(0, 50)}..." không?`;
                deleteConfirmModal.classList.remove('hidden');
                deleteConfirmModal.classList.add('flex');
            }
            function hideDeleteConfirmModal() {
                deleteConfirmModal.classList.add('hidden');
                deleteConfirmModal.classList.remove('flex');
            }
            async function handleDeleteQuestion() {
                if (!itemToDeleteId) return;
                deleteConfirmBtn.disabled = true;
                try {
                    await deleteDoc(doc(db, 'questions', itemToDeleteId));
                    showToast('Xóa câu hỏi thành công!');
                } catch (error) {
                    showToast('Lỗi khi xóa câu hỏi.', 'error');
                } finally {
                    hideDeleteConfirmModal();
                    itemToDeleteId = null;
                    deleteConfirmBtn.disabled = false;
                }
            }
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