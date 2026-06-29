import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, onSnapshot, query, where, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            const studentNameHeader = document.getElementById('student-name-header');
            const statsContainer = document.getElementById('stats-container');
            const resultModal = document.getElementById('result-modal');
            const resultModalContent = document.getElementById('result-modal-content');
            const resultModalTitle = document.getElementById('result-modal-title');
            const resultModalCloseBtn = document.getElementById('result-modal-close-btn');
            const resultModalBackdrop = document.getElementById('result-modal-backdrop');
            
            let currentUser = null;
            let currentStudentId = null;
            let currentClassId = null; // Biến mới để lưu classId
            let progressChart = null;
            let allLessons = [];

            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    currentUser = user;
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists() && docSnap.data().role === 'teacher') {
                        const userData = docSnap.data();
                        document.getElementById('user-name').textContent = userData.name || 'Giáo viên';
                        document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=0D9488&color=fff&bold=true`;
                        initPage();
                    } else {
                        window.location.href = `../${docSnap.data()?.role || 'auth'}/index.html`;
                    }
                } else {
                    window.location.href = '../auth.html';
                }
            });

            async function initPage() {
                const urlParams = new URLSearchParams(window.location.search);
                currentStudentId = urlParams.get('studentId');
                const studentName = urlParams.get('studentName');
                currentClassId = urlParams.get('classId'); // Lấy classId từ URL

                if (!currentStudentId || !studentName || !currentClassId) { // Kiểm tra cả classId
                    document.getElementById('page-header').innerHTML = `<p class="text-red-500 font-semibold">Lỗi: Thiếu thông tin học sinh hoặc lớp học. Vui lòng thử lại.</p>`;
                    return;
                }
                
                studentNameHeader.textContent = studentName;
                const lessonsSnap = await getDocs(collection(db, "lessons"));
                allLessons = lessonsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                listenForStudentSubmissions();
                setupEventListeners();
            }

            function listenForStudentSubmissions() {
                statsContainer.innerHTML = `<div class="skeleton h-64 w-full"></div>`;
                
                // *** SỬA LỖI TRUY VẤN ***
                // Thêm điều kiện `where("classId", "==", currentClassId)` để khớp với security rule
                const submissionsQuery = query(
                    collection(db, "submissions"),
                    where("studentId", "==", currentStudentId),
                    where("classId", "==", currentClassId), // Điều kiện mới
                    orderBy("completedAt", "desc")
                );

                onSnapshot(submissionsQuery, (snapshot) => {
                    const submissions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    
                    if (submissions.length === 0) {
                        statsContainer.innerHTML = `<div class="bg-white p-8 rounded-xl text-center text-slate-500"><i data-feather="info" class="w-12 h-12 mx-auto"></i><p class="mt-4">Học sinh này chưa có bài làm nào trong lớp này.</p></div>`;
                        feather.replace();
                        return;
                    }

                    renderStats(submissions);
                }, (error) => {
                    console.error("Error fetching submissions:", error);
                    statsContainer.innerHTML = `<p class="text-red-500">Lỗi khi tải dữ liệu bài làm của học sinh. Lỗi: ${error.message}</p>`;
                });
            }

            window.renderStats = (submissions) => {
                const testsTaken = submissions.length;
                const totalScore = submissions.reduce((sum, r) => sum + (r.score / r.totalQuestions), 0);
                const avgScore = testsTaken > 0 ? ((totalScore / testsTaken) * 10).toFixed(1) : 'N/A';

                let statsHTML = `
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="bento-card border-l-4 border-l-teal-500 flex items-center gap-6">
                            <div class="w-14 h-14 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center shrink-0"><i data-feather="award"></i></div>
                            <div>
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Điểm trung bình</p>
                                <h3 class="text-3xl font-black text-slate-800">${avgScore}</h3>
                            </div>
                        </div>
                        <div class="bento-card border-l-4 border-l-blue-500 flex items-center gap-6">
                            <div class="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0"><i data-feather="file-text"></i></div>
                            <div>
                                <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Bài làm đã nộp</p>
                                <h3 class="text-3xl font-black text-slate-800">${testsTaken}</h3>
                            </div>
                        </div>
                    </div>

                    <div class="bento-card">
                        <h2 class="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><i class="fas fa-chart-line text-teal-600"></i> Biểu đồ Tiến độ</h2>
                        <div class="relative h-[350px]"><canvas id="progress-chart"></canvas></div>
                    </div>

                    <div class="space-y-6">
                        <h2 class="text-xl font-black text-slate-800">Lịch sử bài tập</h2>
                        <div class="bento-card !p-0 overflow-hidden">
                            <table class="modern-table">
                                <thead>
                                    <tr>
                                        <th>Tên đề thi</th>
                                        <th class="text-center">Kết quả</th>
                                        <th class="text-center">Ngày làm</th>
                                        <th class="text-right">Hành động</th>
                                    </tr>
                                </thead>
                                <tbody>`;
                
                submissions.forEach(sub => {
                    const percentage = (sub.score / sub.totalQuestions) * 100;
                    let scoreClass = percentage >= 80 ? 'score-good' : (percentage < 50 ? 'score-bad' : 'score-avg');
                    const date = sub.completedAt.toDate().toLocaleDateString('vi-VN');
                    
                    statsHTML += `
                        <tr>
                            <td class="font-bold text-slate-700">${sub.testName}</td>
                            <td class="text-center"><span class="score-badge ${scoreClass}">${sub.score}/${sub.totalQuestions}</span></td>
                            <td class="text-center text-slate-400 font-bold text-xs">${date}</td>
                            <td class="text-right">
                                <button data-submission-id="${sub.id}" class="view-result-btn text-teal-600 font-black text-xs hover:tracking-widest transition-all">CHI TIẾT →</button>
                            </td>
                        </tr>`;
                });

                statsHTML += `</tbody></table></div></div>`;
                document.getElementById('stats-container').innerHTML = statsHTML;
                feather.replace();

                renderProgressChart(submissions.slice(0, 10).reverse());

                document.querySelectorAll('.view-result-btn').forEach(btn => {
                    btn.onclick = () => showResultModal(btn.dataset.submissionId);
                });
            }

            async function showResultModal(submissionId) {
                resultModal.classList.remove('hidden');
                resultModal.classList.add('flex');
                resultModalContent.innerHTML = `<div class="skeleton h-64 w-full"></div>`;
                
                try {
                    const resultDocRef = doc(db, "submissions", submissionId);
                    const resultSnap = await getDoc(resultDocRef);
                    if (!resultSnap.exists()) throw new Error("Không tìm thấy dữ liệu bài làm.");

                    const resultData = resultSnap.data();
                    const { userAnswers, questionIds, embeddedQuestions } = resultData;
                    
                    resultModalTitle.textContent = `Chi tiết bài làm: ${resultData.testName}`;
                    
                    let questions = [];
                    if (questionIds && questionIds.length > 0) {
                        const fetchedQuestions = [];
                        for (let i = 0; i < questionIds.length; i += 30) {
                            const chunk = questionIds.slice(i, i + 30);
                            const q = query(collection(db, "questions"), where("__name__", "in", chunk));
                            const snapshot = await getDocs(q);
                            snapshot.forEach(doc => fetchedQuestions.push({ id: doc.id, ...doc.data() }));
                        }
                        questions = fetchedQuestions.sort((a, b) => questionIds.indexOf(a.id) - questionIds.indexOf(b.id));
                    } else if (embeddedQuestions && embeddedQuestions.length > 0) {
                        questions = embeddedQuestions;
                    }
                    
                    renderResultDetails(questions, userAnswers);

                } catch(error) {
                    console.error("Error showing result modal:", error);
                    resultModalContent.innerHTML = `<p class="text-red-500">${error.message}</p>`;
                }
            }

            function renderResultDetails(questions, userAnswers) {
                resultModalContent.innerHTML = '';
                questions.forEach((q, index) => {
                    const lesson = allLessons.find(l => l.id === q.lessonId);
                    const userAnswer = userAnswers[q.id];
                    let isCorrect = false;
                    let answerHTML = '';

                    if (q.type === 'multiple_choice') {
                        const originalAnswer = q.shuffledOptions?.find(opt => opt.originalLetter === q.correctAnswer);
                        const selectedOption = q.shuffledOptions?.find((opt, i) => String.fromCharCode(65 + i) === userAnswer);
                        isCorrect = selectedOption?.originalLetter === q.correctAnswer;
                        answerHTML = (q.shuffledOptions || []).map((optionData, i) => {
                            const optionLetter = String.fromCharCode(65 + i);
                            let classes = 'answer-option border p-3 rounded-md mt-2 flex items-start';
                            if(optionData.originalLetter === q.correctAnswer) classes += ' correct';
                            else if (optionLetter === userAnswer && !isCorrect) classes += ' incorrect';
                            return `<div class="${classes}"><span class="font-bold mr-2">${optionLetter}.</span> <div class="prose prose-sm">${optionData.content}</div></div>`;
                        }).join('');
                    } else { // Handle other types if necessary
                         isCorrect = String(userAnswer || "").trim().toLowerCase() === String(q.correctAnswer).trim().toLowerCase();
                         answerHTML = `<div class="mt-4"><p><strong>Đáp án đúng:</strong> <span class="font-mono bg-green-100 text-green-800 px-2 py-1 rounded">${q.correctAnswer}</span></p><p><strong>Câu trả lời của bạn:</strong> <span class="font-mono ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} px-2 py-1 rounded">${userAnswer || '(bỏ trống)'}</span></p></div>`;
                    }
                    
                    const questionCard = document.createElement('div');
                    questionCard.className = 'bg-slate-50 p-4 rounded-xl';
                    questionCard.innerHTML = `
                        <div class="flex justify-between items-start">
                            <div><p class="font-bold text-slate-800">Câu ${index + 1}</p><p class="text-xs text-slate-500 mt-1">Chủ đề: ${lesson ? lesson.name : 'N/A'}</p></div>
                            <span class="px-3 py-1 text-xs font-semibold rounded-full ${isCorrect ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">${isCorrect ? 'Đúng' : 'Sai'}</span>
                        </div>
                        <div class="prose mt-4">${q.content}</div>
                        <div class="mt-4 space-y-2">${answerHTML}</div>
                        ${q.explanation ? `<div class="mt-4 pt-4 border-t border-slate-200 prose prose-sm text-slate-600"><strong>Giải thích:</strong> ${q.explanation}</div>` : ''}
                    `;
                    resultModalContent.appendChild(questionCard);
                });
                feather.replace();
                if (window.renderMathInElement) {
                    renderMathInElement(resultModalContent, { delimiters: [{left: "$$", right: "$$", display: true}, {left: "$", right: "$", display: false}] });
                }
            }


            function renderProgressChart(submissions) {
                const ctx = document.getElementById('progress-chart').getContext('2d');
                const labels = submissions.map(r => r.completedAt.toDate().toLocaleDateString('vi-VN'));
                const scores = submissions.map(r => (r.score / r.totalQuestions) * 10);

                if (progressChart) {
                    progressChart.destroy();
                }

                progressChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Điểm (thang 10)',
                            data: scores,
                            borderColor: '#0D9488',
                            backgroundColor: 'rgba(13, 148, 136, 0.1)',
                            fill: true,
                            tension: 0.4,
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: { y: { beginAtZero: true, max: 10 } }
                    }
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
                document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

                const closeModal = () => {
                    resultModal.classList.add('hidden');
                    resultModal.classList.remove('flex');
                };
                resultModalCloseBtn.addEventListener('click', closeModal);
                resultModalBackdrop.addEventListener('click', closeModal);
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