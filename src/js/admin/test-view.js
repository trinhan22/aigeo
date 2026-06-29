import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            // --- DOM Elements & State ---
            const mainContentArea = document.getElementById('main-content-area');
            const testNameHeader = document.getElementById('test-name-header');
            const publishStatusEl = document.getElementById('publish-status');
            const questionGridEl = document.getElementById('question-grid');
            const showAnswerBtn = document.getElementById('show-answer-btn');
            const publishBtn = document.getElementById('publish-btn');
            const editBtn = document.getElementById('edit-btn');
            const userNameEl = document.getElementById('user-name');
            const userAvatarEl = document.getElementById('user-avatar');
            const toastContainer = document.getElementById('toast-container');
            const publishConfirmModal = document.getElementById('publish-confirm-modal');
            const publishCancelBtn = document.getElementById('publish-cancel-btn');
            const publishConfirmBtn = document.getElementById('publish-confirm-btn');
            
            let currentTestId = null;
            let questions = [];
            let testData = {};

            // --- UTILS ---
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

            // --- AUTH & DATA LOADING ---
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists() && docSnap.data().role === 'admin') {
                        const userData = docSnap.data();
                        userNameEl.textContent = userData.name || 'Admin';
                        const nameInitial = (userData.name || 'A').charAt(0).toUpperCase();
                        userAvatarEl.src = `https://placehold.co/40x40/DC2626/FFFFFF?text=${nameInitial}`;
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
                    alert("Không tìm thấy ID đề thi.");
                    window.location.href = 'tests.html';
                    return;
                }

                try {
                    const testDocRef = doc(db, "tests", currentTestId);
                    const testDocSnap = await getDoc(testDocRef);
                    if (!testDocSnap.exists()) throw new Error("Đề thi không tồn tại.");
                    
                    testData = testDocSnap.data();
                    testNameHeader.textContent = testData.name;
                    editBtn.href = `create-test-step2.html?id=${currentTestId}`;
                    
                    updatePublishUI();

                    if (!testData.questions || testData.questions.length === 0) {
                        mainContentArea.innerHTML = `<p class="text-center text-slate-500">Đề thi này chưa có câu hỏi nào.</p>`;
                        return;
                    }
                    
                    questions = testData.questions.map((q, index) => ({...q, id: `local_${index}`}));

                    renderFullTest();
                    renderQuestionMap();
                    setupEventListeners();
                } catch (error) {
                    console.error("Error loading test:", error);
                    showToast(`Lỗi tải đề thi: ${error.message}`, "error");
                }
            }
            
            function updatePublishUI() {
                if (testData.status === 'published') {
                    const publishCount = testData.publishCount || 1;
                    publishStatusEl.innerHTML = `<span class="bg-green-100 text-green-800 px-2 py-1 rounded-full">Đã xuất bản ${publishCount} lần</span>`;
                    publishBtn.innerHTML = '<i data-feather="send" class="w-4 h-4 mr-2"></i>Xuất bản lại';
                } else {
                    publishStatusEl.innerHTML = `<span class="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Bản nháp</span>`;
                    publishBtn.innerHTML = '<i data-feather="send" class="w-4 h-4 mr-2"></i>Phân phối Đề thi';
                }
                feather.replace();
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
                } else if (question.type === 'true_false') {
                     answerHTML = '<div class="space-y-3">';
                    (question.statements || []).forEach((stmt, i) => {
                        if(stmt.statement) {
                             answerHTML += `<div class="answer-option-tf border-2 border-slate-200 p-4 rounded-lg">
                                <p class="mb-2"><span class="font-bold mr-2">${i+1})</span> ${stmt.statement}</p>
                            </div>`;
                        }
                    });
                    answerHTML += '</div>';
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
                        <div class="prose mt-4 text-lg">${cleanPrefix(question.content)}</div>
                        <div class="mt-6 space-y-3">${answerHTML}</div>
                    </div>
                `;
            }
            
            function renderFullTest() {
                const questionsByType = {
                    multiple_choice: [],
                    true_false: [],
                    short_answer: []
                };
                questions.forEach(q => {
                    if (questionsByType[q.type]) {
                        questionsByType[q.type].push(q);
                    }
                });

                let fullTestHTML = '';
                let questionCounter = 0;

                const renderSection = (title, type, questionsOfType) => {
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
                
                fullTestHTML += renderSection('I. TRẮC NGHIỆM NHIỀU LỰA CHỌN', 'multiple_choice', questionsByType.multiple_choice);
                fullTestHTML += renderSection('II. TRẮC NGHIỆM ĐÚNG/SAI', 'true_false', questionsByType.true_false);
                fullTestHTML += renderSection('III. TRẢ LỜI NGẮN', 'short_answer', questionsByType.short_answer);
                
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

            // --- EVENT HANDLING ---
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
                
                publishBtn.addEventListener('click', () => {
                    const confirmTextEl = document.getElementById('publish-confirm-text');
                     if (testData.status === 'published') {
                        confirmTextEl.textContent = 'Hành động này sẽ cập nhật trạng thái đã xuất bản của đề thi. Tiếp tục?';
                    } else {
                        confirmTextEl.textContent = 'Bạn có chắc chắn muốn phân phối đề thi này?';
                    }
                    publishConfirmModal.classList.remove('hidden');
                    publishConfirmModal.classList.add('flex');
                });
                publishCancelBtn.addEventListener('click', () => {
                    publishConfirmModal.classList.add('hidden');
                    publishConfirmModal.classList.remove('flex');
                });
                publishConfirmBtn.addEventListener('click', publishTest);
                
                document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
            }

            function checkAllAnswers() {
                questions.forEach(question => {
                    const questionCard = document.getElementById(`question-${question.id}`);
                    if (!questionCard) return;

                    switch(question.type) {
                        case 'multiple_choice':
                            questionCard.querySelectorAll('.answer-option').forEach(opt => {
                                const optAnswer = opt.dataset.answer;
                                if (optAnswer === question.correctAnswer) {
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
                        case 'true_false':
                             (question.statements || []).forEach((stmt, index) => {
                                const wrapper = questionCard.querySelectorAll('.answer-option-tf')[index];
                                if(wrapper) {
                                    const correctAnswer = stmt.answer;
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

            async function publishTest() {
                publishConfirmModal.classList.add('hidden');
                publishConfirmModal.classList.remove('flex');
                publishBtn.disabled = true;
                publishBtn.innerHTML = '<i data-feather="loader" class="animate-spin w-4 h-4 mr-2"></i>Đang xử lý...';
                feather.replace();
                
                try {
                    const testDocRef = doc(db, "tests", currentTestId);
                    const currentCount = testData.publishCount || 0;
                    const newCount = currentCount + 1;

                    await updateDoc(testDocRef, { 
                        status: 'published',
                        publishCount: newCount,
                        lastPublishedAt: serverTimestamp()
                    });

                    // Cập nhật state cục bộ
                    testData.status = 'published';
                    testData.publishCount = newCount;
                    
                    showToast("Đề thi đã được xuất bản/cập nhật thành công!", "success");
                    updatePublishUI(); // Gọi hàm cập nhật UI
                    publishBtn.disabled = false; // Bật lại nút sau khi thành công

                } catch (error) {
                    console.error("Error publishing test:", error);
                    showToast("Lỗi khi phân phối đề thi.", "error");
                    publishBtn.disabled = false; // Bật lại nút khi có lỗi
                    updatePublishUI(); // Cập nhật lại UI về trạng thái trước đó
                }
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
            
            feather.replace();
        });