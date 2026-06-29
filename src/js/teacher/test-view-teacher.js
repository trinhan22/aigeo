import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, getDocs, collection, query, where, updateDoc, arrayUnion, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            // --- DOM Elements & State ---
            const mainContentArea = document.getElementById('main-content-area');
            const testNameHeader = document.getElementById('test-name-header');
            const questionGridEl = document.getElementById('question-grid');
            const showAnswerBtn = document.getElementById('show-answer-btn');
            const assignBtn = document.getElementById('assign-btn');
            const userNameEl = document.getElementById('user-name');
            const userAvatarEl = document.getElementById('user-avatar');
            const toastContainer = document.getElementById('toast-container');
            const assignConfirmModal = document.getElementById('assign-confirm-modal');
            const assignCancelBtn = document.getElementById('assign-cancel-btn');
            const assignConfirmBtn = document.getElementById('assign-confirm-btn');
            const classroomsListEl = document.getElementById('classrooms-list');
            const assignModalTestName = document.getElementById('assign-modal-test-name');
            
            let currentUser = null;
            let currentTestId = null;
            let questions = [];
            let testToAssign = null;

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
                        initTestView();
                    } else {
                        const userRole = docSnap.data()?.role;
                        window.location.href = userRole ? `../${userRole}/index.html` : '../auth.html';
                    }
                } else {
                    window.location.href = '../auth.html';
                }
            });
            
            async function initTestView() {
                const urlParams = new URLSearchParams(window.location.search);
                currentTestId = urlParams.get('testId');
                if (!currentTestId) {
                    window.location.href = 'tests.html';
                    return;
                }

                try {
                    const testDocSnap = await getDoc(doc(db, "tests", currentTestId));
                    if (!testDocSnap.exists()) throw new Error("Đề thi không tồn tại.");
                    
                    const testData = testDocSnap.data();
                    testNameHeader.textContent = testData.name;

                    if (testData.status === 'published') {
                        assignBtn.disabled = true;
                        assignBtn.innerHTML = '<i data-feather="check-circle" class="w-4 h-4 mr-2"></i>Đã giao bài';
                        feather.replace();
                    }

                    if (testData.questionIds && testData.questionIds.length > 0) {
                        const questionIds = testData.questionIds;
                        const fetchedQuestions = [];
                        for (let i = 0; i < questionIds.length; i += 30) {
                            const chunk = questionIds.slice(i, i + 30);
                            const questionsQuery = query(collection(db, "questions"), where("__name__", "in", chunk));
                            const questionsSnap = await getDocs(questionsQuery);
                            questionsSnap.forEach(d => fetchedQuestions.push({id: d.id, ...d.data()}));
                        }
                        questions = fetchedQuestions.sort((a, b) => questionIds.indexOf(a.id) - questionIds.indexOf(b.id));
                    } else if (testData.questions && testData.questions.length > 0) {
                        questions = testData.questions.map((q, i) => ({...q, id: `embedded_${i}`}));
                    } else {
                        mainContentArea.innerHTML = `<p class="text-center text-slate-500">Đề thi này chưa có câu hỏi nào.</p>`;
                        return;
                    }

                    renderFullTest();
                    renderQuestionMap();
                    setupEventListeners();
                } catch (error) {
                    console.error("Error loading test:", error);
                }
            }

            function getQuestionHTML(question, questionNumber) {
                let answerHTML = '';
                if (question.type === 'multiple_choice') {
                    answerHTML = (question.options || []).map((option, i) => {
                        const optionLetter = String.fromCharCode(65 + i);
                        return `<div class="answer-option border-2 border-slate-200 p-4 rounded-lg mt-2 flex items-start" data-answer="${optionLetter}">
                                    <span class="font-bold mr-2">${optionLetter}.</span> <div>${option}</div>
                                </div>`;
                    }).join('');
                } else if (question.type === 'true_false_group' || question.type === 'true_false') {
                    const statements = question.statements || (Array.isArray(question.statements) ? [] : {});
                    let counter = 0;
                    if(Array.isArray(statements)) {
                        answerHTML = statements.map((stmt, i) => {
                            if (!stmt.statement) return '';
                            counter++;
                            return `<div class="answer-option-tf border-2 border-slate-200 p-4 rounded-lg mt-2" data-statement-key="${i}">
                                        <p class="mb-2"><span class="font-bold mr-2">${counter})</span> ${stmt.statement}</p>
                                    </div>`;
                        }).join('');
                    } else {
                        answerHTML = Object.keys(statements).map(key => {
                            if (!statements[key]) return '';
                            counter++;
                            return `<div class="answer-option-tf border-2 border-slate-200 p-4 rounded-lg mt-2" data-statement-key="${key}">
                                        <p class="mb-2"><span class="font-bold mr-2">${counter})</span> ${statements[key]}</p>
                                    </div>`;
                        }).join('');
                    }
                } else if (question.type === 'short_answer') {
                     answerHTML = `<div class="mt-2 text-sm text-slate-500"><i>(Câu trả lời ngắn)</i></div>`;
                }

                const imageHTML = question.imageUrl 
                    ? `<div class="my-4"><img src="${question.imageUrl}" alt="Hình ảnh câu hỏi" class="max-w-full h-auto rounded-lg mx-auto border"></div>` 
                    : '';

                return `
                    <div id="question-${question.id}" class="bg-white p-6 rounded-xl shadow-sm">
                        <p class="font-semibold text-slate-600">Câu ${questionNumber}</p>
                        ${imageHTML}
                        <div class="prose mt-4 text-lg">${question.content}</div>
                        <div class="mt-6 space-y-3">${answerHTML}</div>
                    </div>
                `;
            }
            
            function renderFullTest() {
                const questionsByType = {
                    multiple_choice: [],
                    true_false: [],
                    true_false_group: [],
                    short_answer: []
                };
                questions.forEach(q => {
                    if (questionsByType[q.type]) {
                        questionsByType[q.type].push(q);
                    }
                });

                let fullTestHTML = '';
                let questionCounter = 0;

                const renderSection = (title, questionsOfType) => {
                    if (questionsOfType.length === 0) return '';
                    let sectionHTML = `<div class="question-section">
                        <h2 class="text-2xl font-bold text-slate-800 pb-2 mb-6 border-b-2 border-slate-200">${title}</h2>
                        <div class="space-y-8">`;

                    questionsOfType.forEach(q => {
                        questionCounter++;
                        sectionHTML += getQuestionHTML(q, questionCounter);
                    });

                    sectionHTML += `</div></div>`;
                    return sectionHTML;
                };
                
                fullTestHTML += renderSection('I. TRẮC NGHIỆM NHIỀU LỰA CHỌN', questionsByType.multiple_choice);
                const allTrueFalse = [...questionsByType.true_false, ...questionsByType.true_false_group];
                fullTestHTML += renderSection('II. TRẮC NGHIỆM ĐÚNG/SAI', allTrueFalse);
                fullTestHTML += renderSection('III. TRẢ LỜI NGẮN', questionsByType.short_answer);
                
                mainContentArea.innerHTML = fullTestHTML;
                renderMathWithKaTeX(mainContentArea);
            }

            function renderQuestionMap() {
                questionGridEl.innerHTML = '';
                questions.forEach((q, index) => {
                     const btn = document.createElement('a');
                     btn.href = `#question-${q.id}`;
                     btn.className = 'question-grid-btn border-2 rounded-md p-2 font-semibold transition-colors flex items-center justify-center';
                     btn.textContent = index + 1;
                     questionGridEl.appendChild(btn);
                });
            }

            function setupEventListeners() {
                document.querySelectorAll('.nav-link').forEach(link => {
                    link.addEventListener('click', function(e) {
                        e.preventDefault();
                        document.body.style.opacity = '0';
                        setTimeout(() => { window.location.href = this.href; }, 200);
                    });
                });
                document.body.style.transition = 'opacity 0.2s ease-in-out';
                
                showAnswerBtn.addEventListener('click', checkAllAnswers);
                
                assignBtn.addEventListener('click', showAssignModal);
                assignCancelBtn.addEventListener('click', hideAssignModal);
                assignConfirmBtn.addEventListener('click', handleAssignTest);
                
                document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
            }

            function checkAllAnswers() {
                questions.forEach(question => {
                    const questionCard = document.getElementById(`question-${question.id}`);
                    if (!questionCard) return;

                    switch(question.type) {
                        case 'multiple_choice':
                            questionCard.querySelectorAll('.answer-option').forEach(opt => {
                                if (opt.dataset.answer === question.correctAnswer) {
                                    opt.classList.add('correct');
                                }
                            });
                            break;
                        case 'short_answer':
                            const saAnswerDiv = document.createElement('div');
                            saAnswerDiv.className = "mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm";
                            saAnswerDiv.innerHTML = `<strong>Đáp án đúng:</strong> <span class="font-mono text-green-800">${question.correctAnswer}</span>`;
                            questionCard.querySelector('.mt-6').appendChild(saAnswerDiv);
                            break;
                        case 'true_false': // Array format from Admin
                            (question.statements || []).forEach((stmt, i) => {
                                const wrapper = questionCard.querySelector(`[data-statement-key="${i}"]`);
                                if (wrapper) {
                                    const correctAnswer = stmt.answer;
                                    const answerText = `<strong class="${correctAnswer ? 'text-green-700' : 'text-red-700'}">${correctAnswer ? 'Đúng' : 'Sai'}</strong>`;
                                    wrapper.classList.add(correctAnswer ? 'correct' : 'incorrect');
                                    wrapper.innerHTML += `<div class="mt-2 text-sm">Đáp án: ${answerText}</div>`;
                                }
                            });
                            break;
                        case 'true_false_group': // Object format from Teacher
                             Object.keys(question.statements || {}).forEach(key => {
                                const wrapper = questionCard.querySelector(`[data-statement-key="${key}"]`);
                                 if (wrapper) {
                                    const correctAnswer = question.answers[key];
                                    const answerText = `<strong class="${correctAnswer ? 'text-green-700' : 'text-red-700'}">${correctAnswer ? 'Đúng' : 'Sai'}</strong>`;
                                    wrapper.classList.add(correctAnswer ? 'correct' : 'incorrect');
                                    wrapper.innerHTML += `<div class="mt-2 text-sm">Đáp án: ${answerText}</div>`;
                                }
                            });
                            break;
                    }
                });
                showAnswerBtn.disabled = true;
                showToast("Đã hiển thị tất cả đáp án.", "success");
            }
            
            async function showAssignModal() {
                testToAssign = { id: currentTestId, name: testNameHeader.textContent };
                assignModalTestName.textContent = `Giao bài: "${testToAssign.name}"`;
                
                const q = query(collection(db, "classrooms"), where("teacherId", "==", currentUser.uid));
                const snapshot = await getDocs(q);
                classroomsListEl.innerHTML = '';
                if (snapshot.empty) {
                    classroomsListEl.innerHTML = `<p class="text-slate-500 text-sm">Bạn chưa có lớp học nào.</p>`;
                } else {
                    snapshot.forEach(doc => {
                        const classroom = {id: doc.id, ...doc.data()};
                        classroomsListEl.innerHTML += `
                            <label class="flex items-center space-x-3 p-2 rounded-md hover:bg-slate-100 cursor-pointer">
                                <input type="checkbox" value="${classroom.id}" name="assign-classroom" class="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500">
                                <span class="text-sm text-slate-700">${classroom.className}</span>
                            </label>
                        `;
                    });
                }
                assignConfirmModal.classList.remove('hidden');
                assignConfirmModal.classList.add('flex');
            }

            function hideAssignModal() {
                 assignConfirmModal.classList.add('hidden');
                 assignConfirmModal.classList.remove('flex');
            }
            
            async function handleAssignTest() {
                const selectedClassroomIds = Array.from(document.querySelectorAll('input[name="assign-classroom"]:checked')).map(cb => cb.value);
                if (selectedClassroomIds.length === 0) {
                    showToast("Vui lòng chọn ít nhất một lớp học.", "error");
                    return;
                }
                
                assignConfirmBtn.disabled = true;
                assignConfirmBtn.textContent = 'Đang giao...';

                try {
                    const batch = writeBatch(db);
                    
                    const testRef = doc(db, "tests", testToAssign.id);
                    batch.update(testRef, { status: "published" });

                    const assignment = { testId: testToAssign.id, assignedAt: new Date() };
                    selectedClassroomIds.forEach(classId => {
                        const classRef = doc(db, "classrooms", classId);
                        batch.update(classRef, {
                            assignments: arrayUnion(assignment)
                        });
                    });
                    
                    await batch.commit();

                    showToast(`Đã xuất bản và giao bài thành công cho ${selectedClassroomIds.length} lớp!`, "success");
                    hideAssignModal();
                    assignBtn.disabled = true;
                    assignBtn.innerHTML = '<i data-feather="check-circle" class="w-4 h-4 mr-2"></i>Đã giao bài';
                    feather.replace();
                } catch (error) {
                    console.error("Error assigning test:", error);
                    showToast("Đã có lỗi xảy ra khi giao bài.", "error");
                } finally {
                    assignConfirmBtn.disabled = false;
                    assignConfirmBtn.textContent = 'Xác nhận Giao bài';
                }
            }
            
            function renderMathWithKaTeX(elem) {
                if (window.renderMathInElement) {
                    window.renderMathInElement(elem, { delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}] });
                }
            }
            
            feather.replace();
        });


        document.addEventListener('DOMContentLoaded', () => {
            const mapTrigger = document.getElementById('mobile-map-trigger');
            const questionMap = document.getElementById('question-map');
            
            // Tạo lớp phủ (overlay)
            const overlay = document.createElement('div');
            overlay.className = 'map-overlay';
            document.body.appendChild(overlay);

            if (mapTrigger) {
                mapTrigger.onclick = () => {
                    questionMap.classList.toggle('active');
                    overlay.classList.toggle('show');
                };
            }

            // Đóng khi chạm vào lớp phủ hoặc chọn 1 câu hỏi
            overlay.onclick = () => {
                questionMap.classList.remove('active');
                overlay.classList.remove('show');
            };

            document.getElementById('question-grid').onclick = (e) => {
                if (e.target.classList.contains('question-grid-btn') && window.innerWidth <= 768) {
                    questionMap.classList.remove('active');
                    overlay.classList.remove('show');
                }
            };
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