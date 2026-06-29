import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, updateDoc, collection, getDocs, query, where, orderBy, limit, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            const scoreDisplayEl = document.getElementById('score-display');
            const rawScoreDisplayEl = document.getElementById('raw-score-display');
            const aiFeedbackEl = document.getElementById('ai-feedback');
            const reviewContainerEl = document.getElementById('review-container');
            const resultPageContent = document.getElementById('result-page-content');
            const aiDetailBtn = document.getElementById('ai-detail-btn');
            
            let currentUser = null, resultId = null, currentResultData = null, allLessonsCache = [];

            // --- 1. AUTH & INIT ---
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    currentUser = user;
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        document.getElementById('user-name-display').textContent = userData.name;
                        document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=0D9488&color=fff&bold=true`;
                        initResultPage();

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

                    }
                } else { window.location.href = '../auth.html'; }
            });

            async function initResultPage() {
                try {
                    const urlParams = new URLSearchParams(window.location.search);
                    resultId = urlParams.get('id') || sessionStorage.getItem('latestResultId');
                    if (!resultId) throw new Error("Không tìm thấy mã kết quả.");

                    document.getElementById('result-id-display').textContent = `#${resultId.slice(0, 8)}`;
                    
                    const snap = await getDoc(doc(db, "submissions", resultId));
                    if (!snap.exists()) throw new Error("Dữ liệu kết quả không tồn tại.");
                    currentResultData = snap.data();

                    // Hiển thị Stats
                    const tenScore = (currentResultData.score / currentResultData.totalQuestions) * 10 || 0;
                    scoreDisplayEl.textContent = tenScore.toFixed(tenScore % 1 === 0 ? 0 : 1);
                    rawScoreDisplayEl.textContent = `${currentResultData.score}/${currentResultData.totalQuestions}`;
                    document.getElementById('time-taken-display').textContent = Math.floor(currentResultData.timeTaken / 60) + "p " + (currentResultData.timeTaken % 60) + "s";
                    document.getElementById('completed-at-display').textContent = currentResultData.completedAt?.toDate().toLocaleDateString('vi-VN') || '--';

                    if (tenScore >= 8) launchConfetti();

                    // Tải câu hỏi và bài học
                    const [allLessons, questions] = await Promise.all([
                        getDocs(collection(db, "lessons")).then(s => s.docs.map(d => ({id: d.id, ...d.data()}))),
                        fetchQuestions(currentResultData.questionIds || [])
                    ]);
                    allLessonsCache = allLessons;
                    
                    const finalQuestions = [...(currentResultData.embeddedQuestions || []), ...questions];
                    renderReview(finalQuestions, currentResultData.userAnswers, allLessons);

                    // Render Topics
                    const wrongLessonIds = [...new Set((currentResultData.incorrectQuestions || []).map(q => q.lessonId).filter(Boolean))];
                    const topics = allLessons.filter(l => wrongLessonIds.includes(l.id));
                    document.getElementById('review-topics').innerHTML = topics.length > 0 
                        ? topics.map(t => `<li class="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-black uppercase border border-red-100">${t.name}</li>`).join('')
                        : `<li class="p-3 bg-teal-50 text-teal-700 rounded-xl text-xs font-black uppercase border border-teal-100">Hoàn hảo!</li>`;

                    // AI Feedback
                    const apiKeysSnap = await getDoc(doc(db, "system_settings", "api_keys"));
                    getAiFeedback(finalQuestions, currentResultData.userAnswers, currentResultData.incorrectQuestions, topics, currentResultData.score, currentResultData.totalQuestions, apiKeysSnap.data(), false);

                    aiDetailBtn.onclick = () => getAiFeedback(finalQuestions, currentResultData.userAnswers, currentResultData.incorrectQuestions, topics, currentResultData.score, currentResultData.totalQuestions, apiKeysSnap.data(), true);

                    resultPageContent.classList.replace('opacity-0', 'opacity-100');
                    feather.replace();
                } catch (e) { console.error(e); }
            }

            // --- 2. AI COACH LOGIC (GROQ) ---
            async function getAiFeedback(allQs, answers, incorrects, topics, score, total, keys, isDetailed) {
                const groqKeys = keys?.groq_keys || [];
                if (!groqKeys.length) return;
                
                aiFeedbackEl.innerHTML = '<div class="flex items-center gap-3 py-4 text-slate-400 font-bold text-xs animate-pulse"><i class="fas fa-spinner fa-spin"></i> ĐANG PHÂN TÍCH BÀI LÀM...</div>';
                
                const prompt = isDetailed 
                    ? `Giải thích chi tiết 3 câu sai tiêu biểu từ bài làm đạt ${score}/${total} điểm. Các chủ đề sai: ${topics.map(t=>t.name).join(', ')}.`
                    : `Nhận xét ân cần về bài làm ${score}/${total} điểm Địa lý 12. Khen câu đúng và nhắc ôn lại các bài: ${topics.map(t=>t.name).join(', ')}.`;

                try {
                    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${groqKeys[0]}`, "Content-Type": "application/json" },
                        body: JSON.stringify({
                            model: "llama-3.3-70b-versatile",
                            messages: [
                                { role: "system", content: "Bạn là Giáo viên Địa lý tâm lý của AIGEO. Xưng Mình, gọi Bạn. Trình bày bằng thẻ HTML <p>, <strong>. Ngắn gọn (3-5 câu)." },
                                { role: "user", content: prompt }
                            ]
                        })
                    });
                    const data = await res.json();
                    aiFeedbackEl.innerHTML = data.choices[0].message.content;
                } catch (e) { aiFeedbackEl.innerHTML = "<p>Mình đã xem qua bài làm, bạn hãy xem lại chi tiết các câu sai bên dưới nhé!</p>"; }
            }

            // --- 3. RENDER REVIEW HOÀN THIỆN (Đã sửa lỗi Đúng/Sai và Giải thích) ---
            function renderReview(qs, ans, lessons) {
                const container = document.getElementById('review-container');
                
                container.innerHTML = qs.map((q, i) => {
                    const lesson = lessons.find(l => l.id === q.lessonId);
                    const userAns = ans[q.id]; // Đáp án học sinh đã chọn
                    let html = '';

                    // --- A. XỬ LÝ TRẮC NGHIỆM NHIỀU LỰA CHỌN ---
                    if (q.type === 'multiple_choice') {
                        const options = q.shuffledOptions || (q.options || []).map((o, idx) => ({original: String.fromCharCode(65+idx), content: o}));
                        html = options.map((opt, idx) => {
                            const letter = String.fromCharCode(65 + idx);
                            let cls = '';
                            if (opt.original === q.correctAnswer) cls = 'correct'; // Đáp án đúng hệ thống
                            else if (letter === userAns) cls = 'incorrect'; // Học sinh chọn sai
                            return `<div class="answer-box ${cls}"><span class="font-black mr-2">${letter}.</span><span>${opt.content}</span></div>`;
                        }).join('');
                    } 

                    // --- B. XỬ LÝ TRẢ LỜI NGẮN ---
                    else if (q.type === 'short_answer') {
                        const isCorrect = String(userAns||"").trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
                        html = `<div class="mt-4 p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-3">
                                    <div class="flex items-center justify-between">
                                        <span class="text-[10px] font-black text-slate-400 uppercase">Đáp án đúng</span>
                                        <span class="px-3 py-1 bg-teal-100 text-teal-700 rounded-lg font-bold text-sm">${q.correctAnswer}</span>
                                    </div>
                                    <div class="flex items-center justify-between border-t pt-3 border-slate-200">
                                        <span class="text-[10px] font-black text-slate-400 uppercase">Bạn đã viết</span>
                                        <span class="px-3 py-1 ${isCorrect ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700'} rounded-lg font-bold text-sm">${userAns || '(Bỏ trống)'}</span>
                                    </div>
                                </div>`;
                    } 

                    // --- C. XỬ LÝ ĐÚNG / SAI (FIX TRIỆT ĐỂ) ---
                    else if (q.type === 'true_false' || q.type === 'true_false_group') {
                        const stmts = q.statements || [];
                        const answers = q.answers || {}; // Dành cho Teacher format
                        const stArray = Array.isArray(stmts) ? stmts : Object.entries(stmts).map(([k,v]) => ({key:k, statement:v}));
                        
                        html = `<div class="mt-4 border border-slate-100 rounded-2xl overflow-hidden shadow-sm">` + 
                            stArray.map((s, idx) => {
                                const key = s.key || idx;
                                const uPick = userAns ? userAns[key] : null; // Học sinh chọn True/False
                                const cAns = Array.isArray(stmts) ? s.answer : answers[key]; // Đáp án đúng của hệ thống
                                const isSubCorrect = uPick === cAns;

                                return `
                                <div class="p-4 border-b border-slate-50 last:border-0 ${isSubCorrect ? 'bg-teal-50/30' : 'bg-red-50/30'}">
                                    <div class="flex justify-between items-start gap-4">
                                        <p class="text-sm font-bold text-slate-700 leading-snug">${idx + 1}. ${s.statement || s}</p>
                                        <div class="flex gap-2 shrink-0">
                                            <span class="text-[9px] font-black px-2 py-1 rounded ${cAns ? 'bg-teal-600 text-white' : 'bg-red-500 text-white'}">
                                                ĐÁP ÁN: ${cAns ? 'ĐÚNG' : 'SAI'}
                                            </span>
                                            ${uPick !== null ? `
                                            <span class="text-[9px] font-black px-2 py-1 rounded ${isSubCorrect ? 'bg-teal-100 text-teal-600' : 'bg-red-100 text-red-600'}">
                                                BẠN CHỌN: ${uPick ? 'ĐÚNG' : 'SAI'}
                                            </span>` : '<span class="text-[9px] font-black px-2 py-1 bg-slate-100 text-slate-400 rounded">CHƯA CHỌN</span>'}
                                        </div>
                                    </div>
                                </div>`;
                            }).join('') + `</div>`;
                    }

                    // --- D. KHỐI GIẢI THÍCH (FIX LỖI KHÔNG HIỆN) ---
                    const explanationHtml = q.explanation ? `
                        <div class="mt-8 p-6 bg-teal-50/50 rounded-2xl border-l-4 border-l-teal-500 relative overflow-hidden">
                            <div class="relative z-10">
                                <div class="flex items-center gap-2 mb-2 text-teal-700">
                                    <i data-feather="info" class="w-4 h-4"></i>
                                    <span class="text-[10px] font-black uppercase tracking-widest">Giải thích chi tiết:</span>
                                </div>
                                <div class="text-sm text-slate-600 font-medium leading-relaxed">${q.explanation}</div>
                            </div>
                            <i data-feather="help-circle" class="absolute -right-4 -bottom-4 w-24 h-24 text-teal-500 opacity-[0.05]"></i>
                        </div>
                    ` : '';

                    return `
                        <div class="question-card">
                            <div class="flex justify-between items-start mb-6">
                                <div class="flex items-center gap-3">
                                    <span class="text-[10px] font-black text-teal-600 bg-teal-50 px-3 py-1.5 rounded-lg uppercase">Câu hỏi ${i+1}</span>
                                    <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">${lesson ? cleanPrefix(lesson.name) : 'Kiến thức chung'}</span>
                                </div>
                                ${(q.difficulty) ? `<span class="text-[9px] font-black text-slate-400 border border-slate-200 px-2 py-1 rounded uppercase">${q.difficulty}</span>` : ''}
                            </div>
                            <div class="font-bold text-lg text-slate-900 mb-8 leading-relaxed">${q.content}</div>
                            ${q.imageUrl ? `<img src="${q.imageUrl}" class="rounded-3xl mb-8 border border-slate-100 mx-auto shadow-sm max-h-72 object-contain bg-white">` : ''}
                            <div class="space-y-1">${html}</div>
                            ${explanationHtml}
                        </div>`;
                }).join('');

                renderMathInElement(container, { delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}] });
                feather.replace();
            }

            // --- 4. CONFETTI & UTILS ---
            function launchConfetti() {
                const canvas = document.getElementById('confetti-canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = window.innerWidth; canvas.height = window.innerHeight;
                const startTime = Date.now();
                let pieces = [];
                for (let i = 0; i < 150; i++) pieces.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height - canvas.height, r: Math.random() * 5 + 2, color: ['#0D9488', '#10B981', '#F59E0B'][Math.floor(Math.random() * 3)], v: Math.random() * 3 + 2 });
                function draw() {
                    if (Date.now() - startTime > 4000) { ctx.clearRect(0, 0, canvas.width, canvas.height); return; }
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    pieces.forEach(p => {
                        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = p.color; ctx.fill();
                        p.y += p.v; if (p.y > canvas.height) p.y = -20;
                    });
                    requestAnimationFrame(draw);
                }
                draw();
            }

            async function fetchQuestions(ids) {
                if (!ids.length) return [];
                const fetched = [];
                for (let i = 0; i < ids.length; i += 30) {
                    const snap = await getDocs(query(collection(db, "questions"), where("__name__", "in", ids.slice(i, i + 30))));
                    snap.forEach(d => fetched.push({id: d.id, ...d.data()}));
                }
                return fetched.sort((a,b) => ids.indexOf(a.id) - ids.indexOf(b.id));
            }

            const cleanPrefix = (t) => t ? t.replace(/^(Bài|Chương|Phần|Câu)\s*\d+\s*[:.]?\s*/i, '').trim() : '';
            document.getElementById('logout-btn').onclick = () => signOut(auth);
            feather.replace();
        });