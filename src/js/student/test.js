import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, getDocs, collection, query, where, setDoc, serverTimestamp, deleteDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            // --- DOM ELEMENTS ---
            const mainContentArea = document.getElementById('main-content-area');
            const progressBar = document.getElementById('progress-bar');
            const questionGridEl = document.getElementById('question-grid');
            const submitBtn = document.getElementById('submit-btn');
            const timerEl = document.getElementById('timer');
            const testNameHeader = document.getElementById('test-name-header');
            const userNameEl = document.getElementById('user-name');
            const userAvatarEl = document.getElementById('user-avatar');
            const loadingContainer = document.getElementById('loading-container');
            const testHeader = document.getElementById('test-header');
            const testBody = document.getElementById('test-body');
            const lobbyModal = document.getElementById('lobby-modal');
            const lobbyTestName = document.getElementById('lobby-test-name');
            const lobbyTimeLimit = document.getElementById('lobby-time-limit');
            const confirmJoinBtn = document.getElementById('confirm-join-btn');
            const startModal = document.getElementById('start-modal');
            const startTestBtn = document.getElementById('start-test-btn');
            const warningModal = document.getElementById('warning-modal');
            const warningText = document.getElementById('warning-text');

            // --- STATE VARIABLES ---
            let currentUser = null, questions = [], renderedQuestionsOrder = [], testData = {};
            let userAnswers = {}, timerInterval = null, sessionInterval = null, sessionListener = null; 
            let timeLeft = 0, timeLimitInSeconds = 0, eventListenersSetup = false, isTestStarted = false;
            let isLocked = false, currentTestId = null, currentClassId = null, currentTeacherId = null; 
            let warningCount = 0, currentSessionId = null;

            const cleanPrefix = (t) => t ? t.replace(/^(Câu|Bài|Phần|Mục)\s*[\dIVXLC]+\s*[:.]?\s*/i, '').trim() : '';

            // --- AUTH & INIT ---
            onAuthStateChanged(auth, async (user) => {
                if (!user) { window.location.href = '../auth.html'; return; }
                currentUser = user;
                const docSnap = await getDoc(doc(db, "users", user.uid));
                if (docSnap.exists() && docSnap.data().role === 'student') {
                    const userData = docSnap.data();
                    userNameEl.textContent = userData.name;
                    userAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=0D9488&color=fff&bold=true`;
                    initTest();
                } else { window.location.href = '../auth.html'; }
            });

            // --- DATA FETCHING ---
            async function initTest() {
                const urlParams = new URLSearchParams(window.location.search);
                currentTestId = urlParams.get('testId');
                currentClassId = urlParams.get('classId');
                if (!currentTestId || !currentClassId) { window.location.href = 'index.html'; return; }
                currentSessionId = `${currentTestId}_${currentUser.uid}`;

                try {
                    // Check submission
                    const subId = `assigned_${currentTestId}_${currentUser.uid}`;
                    if((await getDoc(doc(db, 'submissions', subId))).exists()){
                        window.location.href = 'result.html?id=' + subId; return;
                    }

                    const classSnap = await getDoc(doc(db, "classrooms", currentClassId));
                    if (classSnap.exists()) currentTeacherId = classSnap.data().teacherId;

                    const testSnap = await getDoc(doc(db, "tests", currentTestId));
                    if (!testSnap.exists()) throw new Error("Đề thi không tồn tại.");
                    testData = testSnap.data();
                    testNameHeader.textContent = testData.name;
                    timeLeft = (testData.timeLimit || 45) * 60;
                    timeLimitInSeconds = timeLeft;

                    // Fetch questions logic
                    let qIds = testData.questionIds || [];
                    let fetched = [];
                    if (testData.questions) fetched = testData.questions.map((q, i) => ({...q, id: `embedded_${i}`}));
                    
                    if (qIds.length > 0) {
                        for (let i = 0; i < qIds.length; i += 30) {
                            const chunk = qIds.slice(i, i + 30);
                            const snap = await getDocs(query(collection(db, "questions"), where("__name__", "in", chunk)));
                            snap.forEach(d => fetched.push({ id: d.id, ...d.data() }));
                        }
                    }
                    questions = fetched.sort((a,b) => (qIds.indexOf(a.id) - qIds.indexOf(b.id)));

                    questions.forEach(q => {
                        if (q.type === 'multiple_choice' && q.options) {
                            let opts = ['A','B','C','D'].map((l, i) => ({ original: l, content: q.options[i] })).filter(o => o.content);
                            q.shuffledOptions = opts.sort(() => Math.random() - 0.5);
                        }
                    });

                    loadingContainer.classList.add('hidden');
                    lobbyTestName.textContent = testData.name;
                    lobbyTimeLimit.textContent = `${testData.timeLimit} phút`;
                    lobbyModal.classList.replace('hidden', 'flex');
                    if (testData.isMonitored !== false) await updateSessionStatus('waiting');
                    setupEventListeners();
                } catch (e) { mainContentArea.innerHTML = `<p class="text-red-500">${e.message}</p>`; }
            }

            // --- RENDER LOGIC ---
            function getQuestionHTML(q, num) {
                let html = '';
                const saved = userAnswers[q.id];

                if (q.type === 'multiple_choice') {
                    html = (q.shuffledOptions || []).map((opt, i) => {
                        const letter = String.fromCharCode(65 + i);
                        const sel = saved === letter ? 'selected' : '';
                        return `<div class="answer-option ${sel}" data-answer="${letter}">
                                    <div class="option-letter">${letter}</div>
                                    <div class="font-bold text-slate-700">${opt.content}</div>
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
                                            <p class="text-sm font-bold text-slate-800 mb-3">${i+1}. ${s.statement}</p>
                                            <div class="flex gap-2" data-statement-key="${key}">
                                                <button data-value="true" class="tf-btn ${isT}">Đúng</button>
                                                <button data-value="false" class="tf-btn ${isF}">Sai</button>
                                            </div>
                                        </div>`;
                        }
                    });
                    html = stmHtml + '</div>';
                } else if (q.type === 'short_answer') {
                    html = `<input type="text" class="w-full p-4 bg-slate-50 border-2 border-slate-100 rounded-xl focus:border-teal-500 transition font-bold" value="${saved || ''}" placeholder="Nhập câu trả lời...">`;
                }

                return `<div id="question-${q.id}" class="question-card">
                            <span class="text-[10px] font-black text-teal-600 bg-teal-50 px-2 py-1 rounded mb-4 inline-block uppercase tracking-widest">Câu hỏi ${num}</span>
                            <div class="prose font-bold text-lg text-slate-900 mb-6">${cleanPrefix(q.content)}</div>
                            ${q.imageUrl ? `<img src="${q.imageUrl}" class="rounded-xl mb-6 border mx-auto max-h-64">` : ''}
                            <div class="space-y-3">${html}</div>
                        </div>`;
            }

            function updateQuestionMap() {
                const btns = questionGridEl.querySelectorAll('.question-grid-btn');
                btns.forEach(btn => {
                    const ans = userAnswers[btn.dataset.questionId];
                    if (ans && (typeof ans !== 'object' || Object.keys(ans).length > 0)) btn.classList.add('answered');
                    else btn.classList.remove('answered');
                });
                const count = Object.keys(userAnswers).length;
                document.getElementById('progress-text').textContent = `${count}/${questions.length}`;
                progressBar.style.width = (count/questions.length)*100 + '%';
            }

            // --- EVENTS & MONITORING ---
            function setupEventListeners() {
                if (eventListenersSetup) return;
                confirmJoinBtn.onclick = () => {
                    lobbyModal.classList.replace('flex', 'hidden');
                    if (testData.isMonitored === false) startTest(false); else startModal.classList.replace('hidden', 'flex');
                };

                mainContentArea.onclick = (e) => {
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
                    updateQuestionMap();
                };

                mainContentArea.addEventListener('input', (e) => {
                    if (e.target.matches('input[type="text"]')) {
                        const qId = e.target.closest('[id^="question-"]').id.replace('question-', '');
                        userAnswers[qId] = e.target.value.trim();
                        updateQuestionMap();
                    }
                });

                startTestBtn.onclick = () => startTest(true);
                submitBtn.onclick = () => handleSubmit(false);

                if (testData.isMonitored !== false) { 
                    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && isTestStarted) handleCheating('Thoát toàn màn hình'); });
                    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && isTestStarted) handleCheating('Chuyển Tab/Ứng dụng'); });
                    document.body.oncontextmenu = (e) => e.preventDefault();
                    const antiCopy = (e) => { if (isTestStarted) { e.preventDefault(); handleCheating('Sao chép/Dán'); } };
                    ['copy','cut','paste'].forEach(ev => document.addEventListener(ev, antiCopy));
                }
                eventListenersSetup = true;
            }

            async function startTest(monitor) {
                isTestStarted = true;
                await updateSessionStatus('online');
                startModal.classList.replace('flex', 'hidden');
                testHeader.classList.remove('hidden');
                testBody.classList.replace('hidden', 'flex');
                
                mainContentArea.innerHTML = questions.map((q, i) => {
                    renderedQuestionsOrder.push(q.id);
                    return getQuestionHTML(q, i + 1);
                }).join('');

                questionGridEl.innerHTML = renderedQuestionsOrder.map((id, i) => `<a href="#question-${id}" class="question-grid-btn" data-question-id="${id}">${i+1}</a>`).join('');
                
                if (monitor) {
                    document.documentElement.requestFullscreen().catch(() => {});
                    startSessionListener();
                }
                
                timerInterval = setInterval(() => {
                    timeLeft--;
                    const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
                    const s = (timeLeft % 60).toString().padStart(2, '0');
                    timerEl.textContent = `${m}:${s}`;
                    if (timeLeft <= 0) handleSubmit(true);
                }, 1000);

                if (testData.isMonitored !== false) sessionInterval = setInterval(() => updateSessionStatus('online'), 10000);
                renderMathInElement(mainContentArea, { delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}] });
                feather.replace();
            }

            async function handleCheating(reason) {
                if (timeLeft <= 0 || !isTestStarted || isLocked) return;
                isLocked = true;
                clearInterval(timerInterval); clearInterval(sessionInterval);
                warningCount++;
                await updateSessionStatus('locked', { violationTime: serverTimestamp(), violationReason: reason });
                warningText.innerHTML = `Lý do: <strong class="text-red-600">${reason}</strong>.`;
                warningModal.classList.replace('hidden', 'flex');
            }

            function startSessionListener() {
                onSnapshot(doc(db, 'test_sessions', currentSessionId), (docSnap) => {
                    if (!docSnap.exists() || !isTestStarted) return;
                    const data = docSnap.data();
                    if (data.status === 'force_submit') handleSubmit(true);
                    if (isLocked && data.status === 'online') {
                        isLocked = false; warningModal.classList.replace('flex', 'hidden');
                        document.documentElement.requestFullscreen().catch(() => {});
                        startTest(true); // Restart timer/updates
                    }
                });
            }

            async function updateSessionStatus(status, extra = {}) {
                if (!currentSessionId || (testData.isMonitored === false && status !== 'finished')) return;
                await setDoc(doc(db, 'test_sessions', currentSessionId), {
                    studentId: currentUser.uid, studentName: userNameEl.textContent,
                    testId: currentTestId, classId: currentClassId, teacherId: currentTeacherId, 
                    status: status, warnings: warningCount, lastUpdated: serverTimestamp(), ...extra
                }, { merge: true });
            }

            async function handleSubmit(auto) {
                if (!isTestStarted && !auto) return;
                if (!auto && !confirm("Nộp bài thi?")) return;
                isTestStarted = false; clearInterval(timerInterval); clearInterval(sessionInterval);
                submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                let score = 0;
                questions.forEach(q => {
                    const ans = userAnswers[q.id];
                    let correct = false;
                    if (q.type === 'multiple_choice' && ans) {
                        if (q.shuffledOptions.find((o, i) => String.fromCharCode(65+i) === ans)?.original === q.correctAnswer) correct = true;
                    } else if (q.type === 'short_answer') {
                        if (String(ans||"").trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase()) correct = true;
                    } else if (q.type === 'true_false' || q.type === 'true_false_group') {
                        const stmts = q.statements || [];
                        const answers = q.answers || {};
                        correct = Array.isArray(stmts) ? stmts.every((s, i) => (ans?.[i]) === s.answer) : Object.keys(stmts).every(k => ans?.[k] === (answers[k] ?? q.statements[k]?.answer));
                    }
                    if (correct) score++;
                });

                const subId = `assigned_${currentTestId}_${currentUser.uid}`;
                await setDoc(doc(db, 'submissions', subId), {
                    studentId: currentUser.uid, testId: currentTestId, classId: currentClassId,
                    testName: testData.name, score, totalQuestions: questions.length,
                    timeTaken: timeLimitInSeconds - timeLeft, completedAt: serverTimestamp(),
                    questionIds: questions.map(q => q.id), userAnswers
                });
                await deleteDoc(doc(db, 'test_sessions', currentSessionId));
                window.location.href = 'result.html?id=' + subId;
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