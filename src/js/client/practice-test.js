import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getFirestore, doc, getDoc, getDocs, collection, query, where, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const db = getFirestore(app);

            const mainContentArea = document.getElementById('main-content-area');
            const progressBar = document.getElementById('progress-bar');
            const questionGridEl = document.getElementById('question-grid');
            const submitBtn = document.getElementById('submit-btn');
            const timerEl = document.getElementById('timer');
            const testNameHeader = document.getElementById('test-name-header');

            let questions = [];
            let renderedQuestionsOrder = [];
            let userAnswers = {};
            let timerInterval = null;
            let timeElapsed = 0;
            let testData = {};
            let practiceContext = {}; 
            let clientSession = {};

            // Helper clean prefix
            const cleanPrefix = (t) => t ? t.replace(/^(Câu|Bài|Phần|Mục)\s*\d+\s*[:.]?\s*/i, '').trim() : '';
            
            // Lấy session khách
            const getClientSession = () => {
                let s = localStorage.getItem('aigeo_client_session');
                if (s) return JSON.parse(s);
                const n = { clientId: `guest_${Date.now()}`, chatCount: 0, createdAt: new Date().toISOString() };
                localStorage.setItem('aigeo_client_session', JSON.stringify(n));
                return n;
            };

            // --- 1. Hàm khởi tạo đề bài ---
            async function initTest() {
                try {
                    clientSession = getClientSession();
                    const urlParams = new URLSearchParams(window.location.search);
                    const testIdUrl = urlParams.get('testId');
                    const qIdsStr = sessionStorage.getItem('practiceTestQuestions');
                    const ctxStr = sessionStorage.getItem('practiceContext');
                    
                    let questionIds = [];
                    let embeddedQuestions = [];

                    if (testIdUrl) {
                        const snap = await getDoc(doc(db, "tests", testIdUrl));
                        if (!snap.exists()) throw new Error("Không tìm thấy đề.");
                        testData = { id: snap.id, ...snap.data() };
                        testNameHeader.textContent = testData.name;
                        if (testData.questions) embeddedQuestions = testData.questions.map((q, i) => ({...q, id: `embedded_${i}`}));
                        if (testData.questionIds) questionIds = testData.questionIds;
                        practiceContext = { testId: testData.id, subjectId: testData.subjectId };
                    } else if (qIdsStr && ctxStr) {
                        questionIds = JSON.parse(qIdsStr);
                        practiceContext = JSON.parse(ctxStr);
                        testNameHeader.textContent = practiceContext.testName || "Luyện tập";
                    } else {
                        throw new Error("Dữ liệu không hợp lệ.");
                    }

                    // Tải câu hỏi từ Firebase
                    let fetched = [];
                    if (questionIds.length > 0) {
                        const q = query(collection(db, "questions"), where("__name__", "in", questionIds));
                        const snap = await getDocs(q);
                        snap.forEach(d => fetched.push({ id: d.id, ...d.data() }));
                    }

                    // Trộn và gán câu hỏi
                    const combined = [...embeddedQuestions, ...fetched];
                    const finalOrder = [...embeddedQuestions.map(q=>q.id), ...questionIds];
                    questions = combined.sort((a,b) => finalOrder.indexOf(a.id) - finalOrder.indexOf(b.id));

                    // Xử lý xáo trộn phương án cho Multiple Choice
                    questions.forEach(q => {
                        if (q.type === 'multiple_choice' && q.options) {
                            let opts = ['A','B','C','D'].map((l, i) => ({ original: l, content: q.options[i] })).filter(o => o.content);
                            q.shuffledOptions = opts.sort(() => Math.random() - 0.5);
                        }
                    });

                    renderFullTest();
                    renderQuestionMap();
                    setupEventListeners();
                    startTimer();
                } catch (e) {
                    mainContentArea.innerHTML = `<div class='text-center p-10 font-bold text-red-500'>${e.message}</div>`;
                }
            }

            // --- 2. Hàm render giao diện câu hỏi ---
            function getQuestionHTML(q, num) {
                let html = '';
                const saved = userAnswers[q.id];

                if (q.type === 'multiple_choice') {
                    html = (q.shuffledOptions || []).map((opt, i) => {
                        const letter = String.fromCharCode(65 + i);
                        const sel = saved === letter ? 'selected' : '';
                        return `<div class="answer-option ${sel}" data-answer="${letter}">
                                    <span class="option-letter">${letter}</span>
                                    <span class="font-bold text-slate-700">${opt.content}</span>
                                </div>`;
                    }).join('');
                } else if (q.type === 'true_false' || q.type === 'true_false_group') {
                    const stmts = q.statements || [];
                    const savedSub = saved || {};
                    let stmHtml = '<div class="space-y-3">';
                    const stArray = Array.isArray(stmts) ? stmts : Object.entries(stmts).map(([k,v]) => ({key:k, statement:v}));
                    
                    stArray.forEach((s, i) => {
                        const key = s.key || i;
                        if(s.statement) {
                            const isT = savedSub[key] === true ? 'selected' : '';
                            const isF = savedSub[key] === false ? 'selected' : '';
                            stmHtml += `<div class="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                            <p class="text-sm font-bold text-slate-800 mb-3">${s.statement}</p>
                                            <div class="flex gap-2" data-statement-key="${key}">
                                                <button data-value="true" class="tf-btn ${isT}">Đúng</button>
                                                <button data-value="false" class="tf-btn ${isF}">Sai</button>
                                            </div>
                                        </div>`;
                        }
                    });
                    html = stmHtml + '</div>';
                } else if (q.type === 'short_answer') {
                    html = `<input type="text" class="w-full p-4 border-2 border-slate-100 rounded-xl focus:border-teal-500 transition font-bold" value="${saved || ''}" placeholder="Nhập câu trả lời...">`;
                }

                return `<div id="question-${q.id}" class="question-card">
                            <span class="question-section-title">Câu hỏi ${num}</span>
                            <div class="prose font-bold text-lg text-slate-900 mb-6">${cleanPrefix(q.content)}</div>
                            ${q.imageUrl ? `<img src="${q.imageUrl}" class="rounded-xl mb-6 border mx-auto">` : ''}
                            <div class="space-y-3">${html}</div>
                        </div>`;
            }

            function renderFullTest() {
                let html = '';
                renderedQuestionsOrder = [];
                questions.forEach((q, i) => {
                    renderedQuestionsOrder.push(q.id);
                    html += getQuestionHTML(q, i + 1);
                });
                mainContentArea.innerHTML = html;
                renderMathInElement(mainContentArea, { delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}] });
            }

            // --- 3. Hàm xử lý logic bổ trợ ---
            function renderQuestionMap() {
                questionGridEl.innerHTML = renderedQuestionsOrder.map((id, i) => 
                    `<a href="#question-${id}" class="q-map-btn" data-question-id="${id}">${i+1}</a>`
                ).join('');
                document.getElementById('progress-text').textContent = `0/${questions.length}`;
            }

            function updateUI() {
                const answered = Object.keys(userAnswers).length;
                const progress = (answered / questions.length) * 100;
                progressBar.style.width = `${progress}%`;
                document.getElementById('progress-text').textContent = `${answered}/${questions.length}`;
                
                document.querySelectorAll('.q-map-btn').forEach(btn => {
                    if (userAnswers[btn.dataset.questionId]) btn.classList.add('answered');
                });
            }

            function setupEventListeners() {
                mainContentArea.addEventListener('click', (e) => {
                    const card = e.target.closest('[id^="question-"]');
                    if (!card) return;
                    const qId = card.id.replace('question-', '');

                    const opt = e.target.closest('.answer-option');
                    if (opt) {
                        userAnswers[qId] = opt.dataset.answer;
                        card.querySelectorAll('.answer-option').forEach(o => o.classList.remove('selected'));
                        opt.classList.add('selected');
                    }

                    const tf = e.target.closest('.tf-btn');
                    if (tf) {
                        const key = tf.parentElement.dataset.statementKey;
                        if (!userAnswers[qId]) userAnswers[qId] = {};
                        userAnswers[qId][key] = tf.dataset.value === 'true';
                        tf.parentElement.querySelectorAll('.tf-btn').forEach(b => b.classList.remove('selected'));
                        tf.classList.add('selected');
                    }
                    updateUI();
                });

                mainContentArea.addEventListener('input', (e) => {
                    if (e.target.matches('input[type="text"]')) {
                        const qId = e.target.closest('[id^="question-"]').id.replace('question-', '');
                        userAnswers[qId] = e.target.value.trim();
                        updateUI();
                    }
                });

                submitBtn.onclick = handleSubmit;
            }

            function startTimer() {
                timerInterval = setInterval(() => {
                    timeElapsed++;
                    const m = Math.floor(timeElapsed / 60).toString().padStart(2, '0');
                    const s = (timeElapsed % 60).toString().padStart(2, '0');
                    timerEl.textContent = `${m}:${s}`;
                }, 1000);
            }

            async function handleSubmit() {
                if (!confirm("Xác nhận nộp bài?")) return;
                clearInterval(timerInterval);
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                
                let score = 0;
                let incorrectQuestions = [];

                questions.forEach(q => {
                    const ans = userAnswers[q.id];
                    let isCorrect = false;

                    if (q.type === 'multiple_choice' && ans) {
                        // Thêm dấu ?. để nếu shuffledOptions không tồn tại sẽ không báo lỗi
                        const selectedOpt = q.shuffledOptions?.find((o, i) => String.fromCharCode(65 + i) === ans);
                        if (selectedOpt && selectedOpt.original === q.correctAnswer) isCorrect = true;
                    } 
                    else if (q.type === 'short_answer') {
                        if (String(ans || "").toLowerCase().trim() === String(q.correctAnswer || "").toLowerCase().trim()) isCorrect = true;
                    } 
                    else if (q.type === 'true_false' || q.type === 'true_false_group') {
                        const stmts = q.statements || [];
                        const answers = q.answers || {};
                        isCorrect = Array.isArray(stmts) 
                            ? stmts.every((s, i) => (ans ? ans[i] : null) === s.answer)
                            : Object.keys(stmts).every(k => ans && ans[k] === (answers[k] ?? q.statements[k]?.answer));
                    }

                    if (isCorrect) score++;
                    else incorrectQuestions.push({ questionId: q.id, lessonId: q.lessonId || null, content: q.content });
                });

                const resId = `guest_res_${Date.now()}`;
                try {
                    await setDoc(doc(db, 'guest_submissions', resId), {
                        guestId: clientSession.clientId,
                        testName: testNameHeader.textContent,
                        score: score,
                        totalQuestions: questions.length,
                        timeTaken: timeElapsed,
                        // QUAN TRỌNG: Lưu cả shuffledOptions vào bài làm để trang kết quả hiển thị đúng thứ tự bạn đã thấy
                        questionsData: questions, 
                        userAnswers: userAnswers,
                        incorrectQuestions: incorrectQuestions,
                        completedAt: serverTimestamp()
                    });

                    sessionStorage.setItem('latestGuestResultId', resId);
                    window.location.href = 'client-result.html';
                } catch (e) {
                    console.error("Lỗi:", e);
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Nộp bài ngay";
                }
            }

            initTest();
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