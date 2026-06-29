import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, getDocs, query, onSnapshot, where, addDoc, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            const userNameEl = document.getElementById('user-name');
            const userAvatarEl = document.getElementById('user-avatar');
            const historyTableContainer = document.getElementById('history-table-container');
            const statAvgScore = document.getElementById('stat-avg-score');
            const statTestsTaken = document.getElementById('stat-tests-taken');
            const statBestSubject = document.getElementById('stat-best-subject');
            const statWorstSubject = document.getElementById('stat-worst-subject');
            
            let currentUser = null;
            let progressChart = null;

            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    currentUser = user;
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists() && docSnap.data().role === 'student') {
                        const userData = docSnap.data();
                        userNameEl.textContent = userData.name;
                        userAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=0D9488&color=fff&bold=true`;
                        listenForResults();

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


            async function listenForResults() {
                try {
                    const resultsQuery = query(
                        collection(db, "submissions"), 
                        where("studentId", "==", currentUser.uid),
                        orderBy("completedAt", "desc")
                    );
                    
                    const subjectsSnap = await getDocs(collection(db, "subjects"));
                    const allSubjects = subjectsSnap.docs.map(d => ({id: d.id, ...d.data()}));

                    onSnapshot(resultsQuery, (resultsSnapshot) => {
                        const results = resultsSnapshot.docs.map(d => ({id: d.id, ...d.data()}));
                        
                        if(results.length === 0) {
                            chartContainer.innerHTML = `<div class="flex items-center justify-center h-full text-slate-500"><p>Chưa có dữ liệu để vẽ biểu đồ.</p></div>`;
                            historyTableContainer.innerHTML = `<div class="p-6 text-center"><p class="text-slate-500">Bạn chưa hoàn thành bài kiểm tra nào.</p></div>`;
                            statAvgScore.textContent = 'N/A';
                            statTestsTaken.textContent = '0';
                            statBestSubject.textContent = 'N/A';
                            statWorstSubject.textContent = 'N/A';
                            return;
                        }

                        renderProgressChart(results.slice(0, 10).reverse());
                        renderSummaryStats(results, allSubjects);
                        renderHistoryTable(results, allSubjects);
                    });
                } catch (error) {
                    console.error("Error loading stats data:", error);
                    if (error.code === 'failed-precondition') {
                         chartContainer.innerHTML = `<div class="p-4 bg-red-100 text-red-700 rounded-lg">Lỗi: Cần tạo chỉ mục (index) trong Firestore. Vui lòng kiểm tra console (F12) để xem link tạo chỉ mục.</div>`;
                    }
                }
            }

            function renderProgressChart(results) {
                const ctx = document.getElementById('progress-chart').getContext('2d');
                const labels = results.map((r, i) => {
                    const date = r.completedAt?.toDate();
                    return date ? date.toLocaleDateString('vi-VN') : `Lần ${i+1}`;
                });
                const scores = results.map(r => (r.score / r.totalQuestions) * 10);

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
                            pointBackgroundColor: '#0D9488',
                            pointRadius: 5,
                            pointHoverRadius: 7
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: { beginAtZero: true, max: 10, grid: { color: '#e2e8f0' } },
                            x: { grid: { display: false } }
                        },
                         plugins: {
                            legend: { display: false },
                            tooltip: {
                                callbacks: {
                                    title: function(context) {
                                        const result = results[context[0].dataIndex];
                                        return result.testName || `Bài làm ngày ${context[0].label}`;
                                    }
                                }
                            }
                        }
                    }
                });
            }

            function renderSummaryStats(results, subjects) {
                statTestsTaken.textContent = results.length;
                
                const totalScore = results.reduce((sum, r) => sum + (r.score / r.totalQuestions), 0);
                const avg = (totalScore / results.length) * 10;
                statAvgScore.textContent = avg.toFixed(1);

                const statsBySubject = {};
                results.forEach(result => {
                    const subjectId = result.subjectId;
                    if(subjectId) {
                         if (!statsBySubject[subjectId]) statsBySubject[subjectId] = { scores: [], count: 0 };
                        statsBySubject[subjectId].scores.push(result.score / result.totalQuestions);
                        statsBySubject[subjectId].count++;
                    }
                });

                let bestSubject = { name: 'N/A', score: -1 };
                let worstSubject = { name: 'N/A', score: 101 };

                for(const subjectId in statsBySubject) {
                    const subject = subjects.find(s => s.id === subjectId);
                    if (subject) {
                        const avgScore = statsBySubject[subjectId].scores.reduce((a, b) => a + b, 0) / statsBySubject[subjectId].count * 100;
                        if(avgScore > bestSubject.score) bestSubject = { name: subject.name, score: avgScore };
                        if(avgScore < worstSubject.score) worstSubject = { name: subject.name, score: avgScore };
                    }
                }
                
                statBestSubject.textContent = bestSubject.name;
                statWorstSubject.textContent = worstSubject.name;
            }
            
            window.renderHistoryTable = (results, subjects) => {
                if (!results || results.length === 0) {
                    historyTableContainer.innerHTML = `
                        <div class="py-20 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">
                            Chưa có dữ liệu làm bài
                        </div>`;
                    return;
                }

                let html = `
                    <div class="history-header-grid">
                        <div class="header-label">Tên bài làm</div>
                        <div class="header-label">Môn học</div>
                        <div class="header-label text-center">Điểm số</div>
                        <div class="header-label text-center">Ngày thực hiện</div>
                        <div class="header-label text-right">Thao tác</div>
                    </div>
                    <div class="space-y-1">
                `;

                results.forEach(result => {
                    const subject = subjects.find(s => s.id === result.subjectId);
                    const percentage = (result.score / result.totalQuestions) * 100;
                    
                    let scoreClass = 'score-avg';
                    if (percentage >= 80) scoreClass = 'score-good';
                    else if (percentage < 50) scoreClass = 'score-bad';

                    const date = result.completedAt?.toDate().toLocaleDateString('vi-VN', {
                        day: '2-digit', month: '2-digit', year: 'numeric'
                    });

                    html += `
                        <div class="history-row">
                            <div class="test-name truncate pr-4">${result.testName}</div>
                            
                            <div>
                                <span class="subject-tag">${subject?.name || 'Địa lý'}</span>
                            </div>

                            <div class="text-center">
                                <span class="score-value ${scoreClass}">${result.score}</span>
                                <span class="text-slate-300 font-bold">/</span>
                                <span class="text-slate-400 font-bold text-sm">${result.totalQuestions}</span>
                            </div>

                            <div class="date-text text-center">${date}</div>

                            <div class="text-right">
                                <a href="result.html" data-result-id="${result.id}" class="btn-view view-result-btn">
                                    Xem lại <i data-feather="chevron-right" class="w-4 h-4"></i>
                                </a>
                            </div>
                        </div>
                    `;
                });

                html += '</div>';
                historyTableContainer.innerHTML = html;
                feather.replace();
            }

            historyTableContainer.addEventListener('click', (e) => {
                const link = e.target.closest('.view-result-btn');
                if (link) {
                    e.preventDefault();
                    sessionStorage.setItem('latestResultId', link.dataset.resultId);
                    window.location.href = link.href;
                }
            });

            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    document.body.style.opacity = '0';
                    setTimeout(() => { window.location.href = this.href; }, 200);
                });
            });
            document.body.style.transition = 'opacity 0.2s ease-in-out';

            document.getElementById('logout-btn').onclick = () => signOut(auth);
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