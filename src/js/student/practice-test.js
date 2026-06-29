import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, getDocs, collection, query, where, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            // [Tất cả các biến cũ của bạn được giữ nguyên]
            const mainContentArea = document.getElementById('main-content-area');
            const progressBar = document.getElementById('progress-bar');
            const questionGridEl = document.getElementById('question-grid');
            const submitBtn = document.getElementById('submit-btn');
            const timerEl = document.getElementById('timer');
            const userNameEl = document.getElementById('user-name');
            const userAvatarEl = document.getElementById('user-avatar');
            const testNameHeader = document.getElementById('test-name-header');

            let currentUser = null;
            let questions = [];
            let renderedQuestionsOrder = [];
            let userAnswers = {};
            let timerInterval = null;
            let timeElapsed = 0;
            let eventListenersSetup = false;
            let practiceContext = {};
            let testData = {};

            const cleanPrefix = (t) => t ? t.replace(/^(Câu|Bài|Phần|Mục)\s*[\dIVXLC]+\s*[:.]?\s*/i, '').trim() : '';

            // --- AUTH LOGIC (GIỮ NGUYÊN) ---
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    currentUser = user;
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists() && docSnap.data().role === 'student') {
                        const userData = docSnap.data();
                        userNameEl.textContent = userData.name;
                        userAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=0D9488&color=fff&bold=true`;
                        initTest();
                    } else { window.location.href = '../auth.html'; }
                } else { window.location.href = '../auth.html'; }
            });

            // --- OVERRIDE RENDER FUNCTIONS (Cập nhật giao diện mới) ---

            window.getQuestionHTML = (question, questionNumber) => {
                let answerHTML = '';
                const savedAnswer = userAnswers[question.id];

                if (question.type === 'multiple_choice') {
                    answerHTML = (question.shuffledOptions || []).map((optionData, i) => {
                        const optionLetter = String.fromCharCode(65 + i);
                        const isSelected = savedAnswer === optionLetter ? 'selected' : '';
                        return `<div class="answer-option ${isSelected}" data-answer="${optionLetter}">
                                    <span class="option-letter">${optionLetter}</span>
                                    <span class="font-bold text-slate-700">${optionData.content}</span>
                                </div>`;
                    }).join('');
                } else if (question.type === 'true_false' || question.type === 'true_false_group') {
                    let statementsHTML = '<div class="space-y-3">';
                    const stmts = question.statements;
                    const savedSub = savedAnswer || {};
                    const keys = Object.keys(stmts);

                    keys.forEach(key => {
                        const content = Array.isArray(stmts) ? stmts[key].statement : stmts[key];
                        if (content) {
                            const isT = savedSub[key] === true ? 'selected' : '';
                            const isF = savedSub[key] === false ? 'selected' : '';
                            statementsHTML += `
                                <div class="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                    <p class="text-sm font-bold text-slate-800 mb-3">${key}) ${content}</p>
                                    <div class="flex gap-2" data-statement-key="${key}">
                                        <button data-value="true" class="tf-btn ${isT}">Đúng</button>
                                        <button data-value="false" class="tf-btn ${isF}">Sai</button>
                                    </div>
                                </div>`;
                        }
                    });
                    answerHTML = statementsHTML + '</div>';
                } else if (question.type === 'short_answer') {
                    answerHTML = `<input type="text" class="w-full p-4 border-2 border-slate-100 rounded-xl focus:border-teal-500 transition font-bold" value="${savedAnswer || ''}" placeholder="Gõ câu trả lời của bạn...">`;
                }

                return `
                    <div id="question-${question.id}" class="question-card">
                        <div class="flex items-center gap-3 mb-6">
                            <span class="bg-teal-600 text-white text-[10px] font-black px-3 py-1 rounded uppercase tracking-widest">Câu ${questionNumber}</span>
                        </div>
                        <div class="prose font-bold text-lg text-slate-900 mb-6">${cleanPrefix(question.content)}</div>
                        ${question.imageUrl ? `<img src="${question.imageUrl}" class="rounded-xl mb-6 border mx-auto shadow-sm">` : ''}
                        <div class="answer-wrapper">${answerHTML}</div>
                    </div>`;
            }

            async function initTest() {
                try {
                    const urlParams = new URLSearchParams(window.location.search);
                    const testIdFromUrl = urlParams.get('testId');
                    const questionIdsStr = sessionStorage.getItem('practiceTestQuestions');
                    const contextStr = sessionStorage.getItem('practiceContext');
                    let questionIds = [];

                    if (questionIdsStr && contextStr) {
                        questionIds = JSON.parse(questionIdsStr);
                        practiceContext = JSON.parse(contextStr);
                        testNameHeader.textContent = practiceContext.testName || "Luyện tập";
                    } else if (testIdFromUrl) {
                        const testDocRef = doc(db, "tests", testIdFromUrl);
                        const testDocSnap = await getDoc(testDocRef);
                        if (!testDocSnap.exists()) throw new Error("Đề thi không tồn tại.");
                        
                        testData = { id: testDocSnap.id, ...testDocSnap.data() };
                        testNameHeader.textContent = testData.name;

                        if (testData.questions && testData.questions.length > 0) {
                            questions = testData.questions.map((q, index) => ({...q, id: `embedded_${index}`}));
                        } else if (testData.questionIds && testData.questionIds.length > 0) {
                            questionIds = testData.questionIds;
                        } else {
                            throw new Error("Đề thi này chưa có câu hỏi nào.");
                        }
                        
                        practiceContext = {
                            type: 'admin_test',
                            subjectId: testData.subjectId,
                            testId: testData.id,
                            testName: testData.name
                        };
                    } else {
                        throw new Error("Không tìm thấy dữ liệu cần thiết. Vui lòng bắt đầu lại từ trang Luyện tập.");
                    }

                    if (questions.length === 0 && questionIds.length > 0) {
                        const fetchedQuestions = [];
                        const CHUNK_SIZE = 30;
                        for (let i = 0; i < questionIds.length; i += CHUNK_SIZE) {
                            const chunk = questionIds.slice(i, i + CHUNK_SIZE);
                            const q = query(collection(db, "questions"), where("__name__", "in", chunk));
                            const snapshot = await getDocs(q);
                            snapshot.forEach(doc => fetchedQuestions.push({ id: doc.id, ...doc.data() }));
                        }
                        questions = fetchedQuestions.sort((a, b) => questionIds.indexOf(a.id) - questionIds.indexOf(b.id));
                    }
                    
                    if(questions.length === 0){
                         throw new Error("Không có câu hỏi nào được tìm thấy cho bài luyện tập này.");
                    }

                    questions.forEach(q => {
                        if (q.type === 'multiple_choice' && q.options) {
                            const optionsWithOriginalLetter = ['A', 'B', 'C', 'D']
                                .map((letter, index) => ({ originalLetter: letter, content: q.options[index] }))
                                .filter(opt => opt && opt.content);
                            for (let i = optionsWithOriginalLetter.length - 1; i > 0; i--) {
                                const j = Math.floor(Math.random() * (i + 1));
                                [optionsWithOriginalLetter[i], optionsWithOriginalLetter[j]] = [optionsWithOriginalLetter[j], optionsWithOriginalLetter[i]];
                            }
                            q.shuffledOptions = optionsWithOriginalLetter;
                        }
                    });

                    renderFullTest();
                    renderQuestionMap();
                    setupEventListeners();
                    startTimer();
                } catch (error) {
                    console.error("Error during test initialization:", error);
                    mainContentArea.innerHTML = `
                        <div class="bg-white p-8 rounded-xl shadow-lg text-center">
                            <i data-feather="alert-circle" class="w-16 h-16 mx-auto text-red-500"></i>
                            <h2 class="mt-4 text-2xl font-bold text-slate-800">Đã xảy ra lỗi</h2>
                            <p class="mt-2 text-slate-600">${error.message}</p>
                            <a href="practice-hub.html" class="mt-6 inline-block w-full max-w-xs cta-button text-white font-semibold px-6 py-3 rounded-lg">
                                Quay lại Trung tâm Luyện tập
                            </a>
                        </div>
                    `;
                    feather.replace();
                    document.getElementById('question-map').classList.add('hidden');
                    document.querySelector('header').classList.add('hidden');
                }
            }

            function getQuestionHTML(question, questionNumber) {
                let answerHTML = '';
                const savedAnswer = userAnswers[question.id];

                if (question.type === 'multiple_choice') {
                    answerHTML = (question.shuffledOptions || []).map((optionData, i) => {
                        const optionLetter = String.fromCharCode(65 + i);
                        const isSelected = savedAnswer === optionLetter ? 'selected' : '';
                        return `<div class="answer-option p-4 rounded-lg cursor-pointer flex items-center space-x-4 ${isSelected}" data-answer="${optionLetter}">
                                    <span class="option-letter h-8 w-8 rounded-md flex items-center justify-center font-bold">${optionLetter}</span>
                                    <span class="flex-1">${optionData.content}</span>
                                </div>`;
                    }).join('');
                } else if (question.type === 'true_false' || question.type === 'true_false_group') {
                    let statementsHTML = '<div class="space-y-4">';
                    const statements = question.statements;
                    const savedSubAnswers = savedAnswer || {};

                    const processStatements = (stmts, keys) => {
                        keys.forEach(key => {
                            const statementContent = Array.isArray(stmts) ? stmts[key].statement : stmts[key];
                            if (statementContent) {
                                const isTrueSelected = savedSubAnswers[key] === true;
                                const isFalseSelected = savedSubAnswers[key] === false;
                                statementsHTML += `<div class="p-4 rounded-lg bg-slate-50 border-2 border-slate-200">
                                            <p class="mb-3 text-slate-800">${key}) ${statementContent}</p>
                                            <div class="flex space-x-3" data-statement-key="${key}">
                                                <button data-value="true" class="tf-btn flex-1 p-3 rounded-lg font-semibold ${isTrueSelected ? 'selected' : ''}">Đúng</button>
                                                <button data-value="false" class="tf-btn flex-1 p-3 rounded-lg font-semibold ${isFalseSelected ? 'selected' : ''}">Sai</button>
                                            </div>
                                        </div>`;
                            }
                        });
                    };

                    if (Array.isArray(statements)) {
                         processStatements(statements, Object.keys(statements));
                    } else if (typeof statements === 'object' && statements !== null) {
                        processStatements(statements, Object.keys(statements));
                    }
                    answerHTML = statementsHTML + '</div>';
                } else if (question.type === 'short_answer') {
                    answerHTML = `<input type="text" class="mt-2 w-full p-3 border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-300 focus:border-teal-500 transition" value="${savedAnswer || ''}" placeholder="Nhập câu trả lời của bạn...">`;
                }

                const imageHTML = question.imageUrl
                    ? `<div class="my-4"><img src="${question.imageUrl}" alt="Hình ảnh câu hỏi" class="max-w-full h-auto rounded-lg mx-auto border"></div>`
                    : '';
                
                // *** ĐÂY LÀ THAY ĐỔI CHÍNH ***
                // Thêm lớp CSS 'question-content-area' để đồng bộ font
                return `
                    <div id="question-${question.id}" class="bg-white p-6 rounded-xl shadow-sm">
                        <p class="font-semibold text-slate-600">Câu ${questionNumber}</p>
                        ${imageHTML}
                        <div class="prose mt-4 question-content-area">${cleanPrefix(question.content)}</div>
                        <div class="mt-6 space-y-4">${answerHTML}</div>
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
                renderedQuestionsOrder = [];
                const allTrueFalse = [...questionsByType.true_false, ...questionsByType.true_false_group];

                const renderSection = (title, questionsOfType) => {
                    if (questionsOfType.length === 0) return '';
                    // Sử dụng class question-section-title đồng bộ
                    let sectionHTML = `<div class="question-section">
                        <span class="question-section-title">${title}</span>
                        <div class="space-y-8">`;
                    questionsOfType.forEach(q => {
                        questionCounter++;
                        renderedQuestionsOrder.push(q.id);
                        sectionHTML += getQuestionHTML(q, questionCounter);
                    });
                    sectionHTML += `</div></div>`;
                    return sectionHTML;
                };

                fullTestHTML += renderSection('I. TRẮC NGHIỆM NHIỀU LỰA CHỌN', questionsByType.multiple_choice);
                fullTestHTML += renderSection('II. TRẮC NGHIỆM ĐÚNG/SAI', allTrueFalse);
                fullTestHTML += renderSection('III. TRẢ LỜI NGẮN', questionsByType.short_answer);
                
                mainContentArea.innerHTML = fullTestHTML;
                renderMathWithKaTeX(mainContentArea);
            }

            // Override hàm renderQuestionMap cho khớp CSS
            window.renderQuestionMap = () => {
                questionGridEl.innerHTML = renderedQuestionsOrder.map((id, i) => 
                    `<a href="#question-${id}" class="q-map-btn" data-question-id="${id}">${i+1}</a>`
                ).join('');
                document.getElementById('progress-text').textContent = `0/${questions.length}`;
            }

            document.getElementById('question-grid').addEventListener('click', (e) => {
                if (window.innerWidth <= 768) {
                    const toggle = document.getElementById('question-map-toggle');
                    if (toggle) toggle.checked = false;
                }
            });

            // Override updateProgressBar
            window.updateProgressBar = () => {
                const answered = countAnsweredQuestions();
                const total = questions.length;
                const progress = total > 0 ? (answered / total) * 100 : 0;
                progressBar.style.width = `${progress}%`;
                document.getElementById('progress-text').textContent = `${answered}/${total}`;
            }

            function renderQuestionMap() {
                questionGridEl.innerHTML = '';
                renderedQuestionsOrder.forEach((questionId, index) => {
                    const btn = document.createElement('a');
                    btn.href = `#question-${questionId}`;
                    // PHẢI CÓ CLASS NÀY:
                    btn.className = 'question-grid-btn border-2 rounded-md p-2 font-semibold transition-colors flex items-center justify-center text-slate-600 border-slate-200 hover:border-teal-500';
                    btn.textContent = index + 1;
                    btn.dataset.questionId = questionId;
                    questionGridEl.appendChild(btn);
                });
            }

            function countAnsweredQuestions() {
                return Object.keys(userAnswers).reduce((count, qId) => {
                    const answer = userAnswers[qId];
                    if (answer !== undefined) {
                        if (typeof answer === 'object' && answer !== null) {
                            if (Object.values(answer).some(v => v !== undefined)) return count + 1;
                        } else if (String(answer).trim() !== '') return count + 1;
                    }
                    return count;
                }, 0);
            }

            function updateQuestionMap() {
                // Tìm tất cả các nút trong bản đồ câu hỏi
                const allBtns = questionGridEl.querySelectorAll('.question-grid-btn');
                
                allBtns.forEach(btn => {
                    const questionId = btn.dataset.questionId;
                    const answer = userAnswers[questionId];
                    let hasAnswer = false;

                    if (answer !== undefined && answer !== null) {
                        if (typeof answer === 'object') {
                            // Đối với câu Đúng/Sai: Kiểm tra xem đã chọn ít nhất 1 ý chưa
                            const values = Object.values(answer);
                            hasAnswer = values.length > 0 && values.some(v => v !== undefined && v !== null);
                        } else {
                            // Đối với Trắc nghiệm hoặc Trả lời ngắn: Kiểm tra chuỗi không rỗng
                            hasAnswer = String(answer).trim() !== '';
                        }
                    }

                    if (hasAnswer) {
                        btn.classList.add('answered');
                    } else {
                        btn.classList.remove('answered');
                    }
                });

                // Cập nhật con số hiển thị (ví dụ: 5/10) trên Sidebar
                const answeredCount = Object.keys(userAnswers).filter(key => {
                    const ans = userAnswers[key];
                    if (typeof ans === 'object') return Object.values(ans).some(v => v !== undefined);
                    return String(ans).trim() !== '';
                }).length;

                const progressText = document.getElementById('progress-text');
                if (progressText) {
                    progressText.textContent = `${answeredCount}/${questions.length}`;
                }
            }

            function updateProgressBar() {
                const answeredCount = countAnsweredQuestions();
                const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
                progressBar.style.width = `${progress}%`;
            }

            function setupEventListeners() {
                if (eventListenersSetup) return;
                 mainContentArea.addEventListener('click', (e) => {
                    const questionCard = e.target.closest('[id^="question-"]');
                    if (!questionCard) return;
                    const questionId = questionCard.id.replace('question-', '');

                    const selectedOption = e.target.closest('.answer-option');
                    if (selectedOption) {
                        userAnswers[questionId] = selectedOption.dataset.answer;
                        questionCard.querySelectorAll('.answer-option').forEach(opt => opt.classList.remove('selected'));
                        selectedOption.classList.add('selected');
                    }

                    const tfButton = e.target.closest('.tf-btn');
                    if (tfButton) {
                        const statementKey = tfButton.parentElement.dataset.statementKey;
                        const value = tfButton.dataset.value === 'true';
                        if (!userAnswers[questionId]) userAnswers[questionId] = {};
                        userAnswers[questionId][statementKey] = value;
                        tfButton.parentElement.querySelectorAll('.tf-btn').forEach(btn => btn.classList.remove('selected'));
                        tfButton.classList.add('selected');
                    }
                    updateQuestionMap();
                    updateProgressBar();
                });
                 mainContentArea.addEventListener('input', (e) => {
                    const questionCard = e.target.closest('[id^="question-"]');
                    if (questionCard && e.target.matches('input[type="text"]')) {
                        const questionId = questionCard.id.replace('question-', '');
                        userAnswers[questionId] = e.target.value.trim();
                        updateQuestionMap();
                        updateProgressBar();
                    }
                });
                submitBtn.addEventListener('click', handleSubmit);
                eventListenersSetup = true;
            }

            function startTimer() {
                if (timerInterval) clearInterval(timerInterval);
                timerInterval = setInterval(() => {
                    timeElapsed++;
                    const minutes = Math.floor(timeElapsed / 60).toString().padStart(2, '0');
                    const seconds = (timeElapsed % 60).toString().padStart(2, '0');
                    timerEl.textContent = `${minutes}:${seconds}`;
                }, 1000);
            }

            async function getTeacherIdsForSubject(subjectId) {
                if (!subjectId) return [];
                const q = query(collection(db, "classrooms"), where("students", "array-contains", currentUser.uid), where("subjectId", "==", subjectId));
                const snapshot = await getDocs(q);
                const teacherIds = snapshot.docs.map(doc => doc.data().teacherId);
                return [...new Set(teacherIds)];
            }

            async function handleSubmit() {
                if (!confirm("Bạn có chắc chắn muốn nộp bài?")) return;

                clearInterval(timerInterval);
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<span class="animate-spin h-5 w-5 border-t-2 border-r-2 border-white rounded-full mx-auto"></span>';

                let score = 0;
                let incorrectQuestions = [];

                questions.forEach(q => {
                    const userAnswer = userAnswers[q.id];
                    let isCorrect = false;

                    if (q.type === 'multiple_choice') {
                        if (userAnswer) {
                            const originalSelectedLetter = q.shuffledOptions?.find((opt, i) => String.fromCharCode(65 + i) === userAnswer)?.originalLetter;
                            if (originalSelectedLetter === q.correctAnswer) isCorrect = true;
                        }
                    } else if (q.type === 'short_answer') {
                        isCorrect = String(userAnswer || "").trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
                    } else if (q.type === 'true_false' || q.type === 'true_false_group') {
                        const statements = q.statements || {};
                        const statementKeys = Array.isArray(statements) ? Object.keys(statements) : Object.keys(statements).filter(k => statements[k]);
                        isCorrect = userAnswer && statementKeys.length > 0 && statementKeys.every(key => {
                             const correctAnswer = Array.isArray(statements) ? statements[key].answer : q.answers[key];
                             return userAnswer[key] === correctAnswer;
                        });
                    }
                    
                    if (isCorrect) score++;
                    else incorrectQuestions.push({ questionContent: q.content, lessonId: q.lessonId || null });
                });
                
                const submissionId = `practice_${practiceContext.type || 'general'}_${practiceContext.testId || Date.now()}_${currentUser.uid}`;

                try {
                    const submissionRef = doc(db, 'submissions', submissionId);
                    const teacherIds = await getTeacherIdsForSubject(practiceContext.subjectId);

                    const submissionData = {
                        studentId: currentUser.uid,
                        testId: practiceContext.testId || `practice_${Date.now()}`,
                        testName: practiceContext.testName || "Bài luyện tập",
                        subjectId: practiceContext.subjectId || null,
                        score: score,
                        totalQuestions: questions.length,
                        timeTaken: timeElapsed,
                        completedAt: serverTimestamp(),
                        incorrectQuestions: incorrectQuestions,
                        questionIds: questions.map(q => q.id.startsWith('embedded_') ? null : q.id).filter(Boolean),
                        embeddedQuestions: questions.filter(q => q.id.startsWith('embedded_')),
                        userAnswers: userAnswers,
                        teacherIds: teacherIds
                    };
                    await setDoc(submissionRef, submissionData);
                    sessionStorage.setItem('latestResultId', submissionId);
                    window.location.href = 'result.html';
                } catch(error) {
                    console.error("Error saving test result:", error);
                    alert("Đã có lỗi xảy ra khi lưu kết quả.");
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Nộp bài';
                }
            }

            function renderMathWithKaTeX(elem) {
                if (window.renderMathInElement) {
                    window.renderMathInElement(elem, {
                        delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}]
                    });
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