import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);
            
            // *** UPDATED: Changed variable name ***
            let dashboardStatsForExport = {}; 

            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists() && docSnap.data().role === 'admin') {
                        const userData = docSnap.data();
                        document.getElementById('user-name').textContent = userData.name || 'Admin';
                        const nameInitial = (userData.name || 'A').charAt(0).toUpperCase();
                        document.getElementById('user-avatar').src = `https://placehold.co/40x40/DC2626/FFFFFF?text=${nameInitial}`;
                        loadDashboardData();
                        // *** UPDATED: Call the correct setup function ***
                        setupDownloadButton();
                    } else {
                        window.location.href = '../auth.html';
                    }
                } else {
                    window.location.href = '../auth.html';
                }
            });
            
            async function loadDashboardData() {
                try {
                    const [usersSnap, questionsSnap, testsSnap] = await Promise.all([
                        getDocs(collection(db, "users")),
                        getDocs(collection(db, "questions")),
                        getDocs(collection(db, "tests"))
                    ]);

                    const totalUsersEl = document.getElementById('total-users');
                    const totalSchoolsEl = document.getElementById('total-schools');
                    const schoolListContainer = document.getElementById('school-list-container');
                    const downloadBtn = document.getElementById('download-data-btn');

                    totalUsersEl.textContent = usersSnap.size;
                    
                    const allUsers = usersSnap.docs.map(d => d.data());
                    // *** UPDATED: Filter out empty/null school names before creating Set ***
                    const uniqueSchools = new Set(allUsers.map(u => u.school).filter(s => s && s.trim() !== "").map(s => s.trim()));
                    const sortedSchools = [...uniqueSchools].sort((a, b) => a.localeCompare(b, 'vi'));
                    
                    totalSchoolsEl.textContent = uniqueSchools.size;
                    
                    if (uniqueSchools.size > 0) {
                        // *** UPDATED: Changed grid to simple list ***
                        schoolListContainer.innerHTML = '<ul class="space-y-2 text-slate-600"></ul>';
                        const ul = schoolListContainer.querySelector('ul');
                        sortedSchools.forEach(school => {
                            const li = document.createElement('li');
                            li.className = "flex items-center space-x-2 text-sm p-1 hover:bg-slate-50 rounded-md";
                            li.innerHTML = `<i data-feather="chevrons-right" class="w-4 h-4 text-slate-400 flex-shrink-0"></i><span class="truncate" title="${school}">${school}</span>`;
                            ul.appendChild(li);
                        });
                        feather.replace();
                    } else {
                        schoolListContainer.innerHTML = '<p class="text-slate-500">Chưa có dữ liệu trường học nào.</p>';
                    }
                    
                    const questionsFromCollection = questionsSnap.docs.map(d => d.data());
                    const questionsFromTests = testsSnap.docs.flatMap(d => d.data().questions || []);
                    const allQuestions = [...questionsFromCollection, ...questionsFromTests];
                    
                    document.getElementById('total-questions').textContent = allQuestions.length;
                    
                    const stats = {
                        types: { 'multiple_choice': 0, 'true_false': 0, 'short_answer': 0 },
                        difficulty: { 'nhan_biet': 0, 'thong_hieu': 0, 'van_dung': 0, 'van_dung_cao': 0 },
                        tf_answers: { 'true': 0, 'false': 0 }
                    };

                    allQuestions.forEach(q => {
                        if (q.type === 'multiple_choice') stats.types.multiple_choice++;
                        else if (q.type === 'short_answer') stats.types.short_answer++;
                        else if (q.type === 'true_false' || q.type === 'true_false_group') {
                            stats.types.true_false++;
                            if (q.answers && typeof q.answers === 'object') {
                                Object.values(q.answers).forEach(ans => {
                                    if (ans === true) stats.tf_answers.true++;
                                    else if (ans === false) stats.tf_answers.false++;
                                });
                            } else if (q.statements && Array.isArray(q.statements)) {
                                q.statements.forEach(stmt => {
                                    if(stmt.answer === true) stats.tf_answers.true++;
                                    else if(stmt.answer === false) stats.tf_answers.false++;
                                });
                            }
                        }
                        if (stats.difficulty.hasOwnProperty(q.difficulty)) {
                            stats.difficulty[q.difficulty]++;
                        } else {
                            stats.difficulty.nhan_biet++;
                        }
                    });

                    document.getElementById('total-true').textContent = stats.tf_answers.true;
                    document.getElementById('total-false').textContent = stats.tf_answers.false;

                    renderQuestionTypeChart(stats.types);
                    renderDifficultyChart(stats.difficulty);

                    // *** UPDATED: Store data for Excel export ***
                    dashboardStatsForExport = {
                        totalUsers: usersSnap.size,
                        totalQuestions: allQuestions.length,
                        totalTrueStatements: stats.tf_answers.true,
                        totalFalseStatements: stats.tf_answers.false,
                        totalUniqueSchools: uniqueSchools.size,
                        questionTypes: stats.types,
                        questionDifficulties: stats.difficulty,
                        schoolList: sortedSchools
                    };
                    
                    if (downloadBtn) downloadBtn.disabled = false;

                } catch (error) {
                    console.error("Error loading dashboard data:", error);
                    alert("Không thể tải dữ liệu thống kê.");
                }
            }
            
            // *** UPDATED: Point to the new Excel function ***
            function setupDownloadButton() {
                const downloadBtn = document.getElementById('download-data-btn');
                if (downloadBtn) {
                    downloadBtn.addEventListener('click', downloadDataAsExcel);
                }
            }
            
            // *** NEW: Function to download data as Excel ***
            function downloadDataAsExcel() {
                if (typeof XLSX === 'undefined') {
                    console.error("XLSX library is not loaded.");
                    alert("Lỗi: Thư viện Excel chưa được tải. Vui lòng thử làm mới trang.");
                    return;
                }
                
                if (Object.keys(dashboardStatsForExport).length === 0) {
                    alert("Dữ liệu chưa sẵn sàng, vui lòng chờ.");
                    return;
                }
                
                const stats = dashboardStatsForExport;
                const date = new Date().toISOString().split('T')[0];
                const fileName = `aigeo_database_stats_${date}.xlsx`;

                // 1. Create a new workbook
                const wb = XLSX.utils.book_new();

                // 2. Create Summary Sheet
                const summaryData = [
                    ["AIGEO Database Statistics", `(Tính đến ${new Date().toLocaleString('vi-VN')})`],
                    [], // Empty row
                    ["Hạng mục", "Số lượng"],
                    ["Tổng số người dùng", stats.totalUsers],
                    ["Tổng số câu hỏi", stats.totalQuestions],
                    ["Tổng số trường học (duy nhất)", stats.totalUniqueSchools],
                    ["Tổng số mệnh đề ĐÚNG", stats.totalTrueStatements],
                    ["Tổng số mệnh đề SAI", stats.totalFalseStatements],
                    [],
                    ["Phân loại theo Dạng", ""],
                    ["Trắc nghiệm 4 Lựa chọn", stats.questionTypes.multiple_choice],
                    ["Đúng/Sai", stats.questionTypes.true_false],
                    ["Trả lời ngắn", stats.questionTypes.short_answer],
                    [],
                    ["Phân loại theo Mức độ", ""],
                    ["Nhận biết", stats.questionDifficulties.nhan_biet],
                    ["Thông hiểu", stats.questionDifficulties.thong_hieu],
                    ["Vận dụng", stats.questionDifficulties.van_dung],
                    ["Vận dụng cao", stats.questionDifficulties.van_dung_cao],
                ];
                const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
                // Set column widths
                wsSummary['!cols'] = [{wch: 30}, {wch: 20}];
                XLSX.utils.book_append_sheet(wb, wsSummary, "ThongKeTongQuan");

                // 3. Create School List Sheet
                const schoolData = [["Danh sách các trường"]];
                stats.schoolList.forEach(school => {
                    schoolData.push([school]);
                });
                const wsSchools = XLSX.utils.aoa_to_sheet(schoolData);
                wsSchools['!cols'] = [{wch: 70}];
                XLSX.utils.book_append_sheet(wb, wsSchools, "DanhSachTruongHoc");

                // 4. Write and download the file
                XLSX.writeFile(wb, fileName);
            }

            function renderQuestionTypeChart(typeData) {
                const ctx = document.getElementById('question-type-chart').getContext('2d');
                new Chart(ctx, {
                    type: 'doughnut',
                    data: {
                        labels: ['Trắc nghiệm 4 Lựa chọn', 'Đúng/Sai', 'Trả lời ngắn'],
                        datasets: [{
                            label: 'Số lượng',
                            data: [typeData.multiple_choice, typeData.true_false, typeData.short_answer],
                            backgroundColor: [
                                'rgba(59, 130, 246, 0.85)',
                                'rgba(16, 185, 129, 0.85)',
                                'rgba(245, 158, 11, 0.85)',
                            ],
                            borderColor: '#fff',
                            borderWidth: 2,
                            hoverOffset: 8
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'bottom',
                                labels: {
                                    padding: 20,
                                    font: {
                                        family: "'Be Vietnam Pro', sans-serif",
                                        size: 13
                                    }
                                }
                            }
                        },
                        cutout: '60%'
                    }
                });
            }

            function renderDifficultyChart(difficultyData) {
                const ctx = document.getElementById('difficulty-chart').getContext('2d');
                new Chart(ctx, {
                    type: 'bar',
                    data: {
                        labels: ['Nhận biết', 'Thông hiểu', 'Vận dụng', 'Vận dụng cao'],
                        datasets: [{
                            label: 'Số lượng câu hỏi',
                            data: [
                                difficultyData.nhan_biet, 
                                difficultyData.thong_hieu, 
                                difficultyData.van_dung, 
                                difficultyData.van_dung_cao
                            ],
                            backgroundColor: 'rgba(13, 148, 136, 0.7)',
                            borderColor: 'rgba(13, 148, 136, 1)',
                            borderWidth: 2,
                            borderRadius: 6,
                            hoverBackgroundColor: 'rgba(13, 148, 136, 0.9)'
                        }]
                    },
                    options: {
                         responsive: true,
                         maintainAspectRatio: false,
                         scales: {
                            y: {
                                beginAtZero: true,
                                grid: {
                                    drawBorder: false,
                                },
                                ticks: {
                                    padding: 10,
                                    font: { family: "'Be Vietnam Pro', sans-serif" }
                                }
                            },
                            x: {
                                grid: {
                                    display: false,
                                },
                                ticks: {
                                     font: { family: "'Be Vietnam Pro', sans-serif" }
                                }
                            }
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                 backgroundColor: '#334155',
                                 titleFont: { size: 14, weight: 'bold', family: "'Be Vietnam Pro', sans-serif" },
                                 bodyFont: { size: 12, family: "'Be Vietnam Pro', sans-serif" },
                                 padding: 12,
                                 cornerRadius: 8,
                                 boxPadding: 4
                            }
                        }
                    }
                });
            }
            
            document.getElementById('logout-btn')?.addEventListener('click', () => signOut(auth));
            
            feather.replace();
        });