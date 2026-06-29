import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, getDocs, query, where, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        
        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);
            
            const userNameEl = document.getElementById('user-name');
            const userAvatarEl = document.getElementById('user-avatar');
            const userContextDisplay = document.getElementById('user-context-display');
            const subjectFilter = document.getElementById('filter-subject');
            const lessonListContainer = document.getElementById('lesson-list-container');
            const startPracticeBtn = document.getElementById('start-practice-btn');
            const toastContainer = document.getElementById('toast-container');

            let allData = { subjects: [], lessons: [], questions: [] };
            let currentUser = null;
            let userGrade = null;

            function showToast(message, type = 'error') {
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

            function populateSelect(selectElement, data, placeholder) {
                selectElement.innerHTML = `<option value="">${placeholder}</option>`;
                data.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(item => {
                    selectElement.innerHTML += `<option value="${item.id}">${item.name}</option>`;
                });
            }

            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    currentUser = user;
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists() && docSnap.data().role === 'student') {
                        const userData = docSnap.data();
                        userGrade = userData.selectedGrade;
                        userNameEl.textContent = userData.name || 'Học sinh';
                        const nameInitial = (userData.name || 'S').charAt(0).toUpperCase();
                        userAvatarEl.src = `https://placehold.co/40x40/3B82F6/FFFFFF?text=${nameInitial}`;
                        initPage();
                    } else {
                        window.location.href = `../${docSnap.data()?.role || 'admin'}/index.html`;
                    }
                } else {
                    window.location.href = '../auth.html';
                }
            });

            async function initPage() {
                try {
                    if (!userGrade) {
                        userContextDisplay.innerHTML = `Vui lòng vào <a href="account.html" class="font-bold text-blue-600 hover:underline">Tài khoản</a> để chọn Khối lớp của bạn.`;
                        return;
                    }
                    userContextDisplay.textContent = `Phạm vi luyện tập hiện tại: Lớp ${userGrade}`;

                    const [subjectsSnap, lessonsSnap, questionsSnap] = await Promise.all([
                        getDocs(collection(db, "subjects")),
                        getDocs(query(collection(db, "lessons"), where("grade", "==", userGrade))),
                        getDocs(collection(db, "questions")) // We still need all questions to count them
                    ]);
                    allData.subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    allData.lessons = lessonsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    allData.questions = questionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    
                    populateSubjects();
                    setupEventListeners();
                } catch (error) {
                    console.error("Error loading data:", error);
                    showToast("Lỗi tải dữ liệu. Vui lòng thử lại.");
                }
            }

            function setupEventListeners() {
                document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
                subjectFilter.addEventListener('change', handleSubjectChange);
                startPracticeBtn.addEventListener('click', startPractice);
            }
            
            function populateSubjects() {
                const relevantSubjectIds = [...new Set(allData.lessons.map(l => l.subjectId))];
                const subjectOptions = allData.subjects.filter(s => relevantSubjectIds.includes(s.id));
                populateSelect(subjectFilter, subjectOptions, "Chọn Môn học");
            }

            function handleSubjectChange() {
                const selectedSubjectId = subjectFilter.value;
                if (!selectedSubjectId) {
                    lessonListContainer.innerHTML = '<p>Vui lòng chọn Môn học.</p>';
                    validateForm();
                    return;
                }
                renderLessonList(selectedSubjectId);
                validateForm();
            }
            
            function renderLessonList(subjectId) {
                const lessons = allData.lessons
                    .filter(l => l.subjectId === subjectId)
                    .map(lesson => {
                        const questionCount = allData.questions.filter(q => q.lessonId === lesson.id).length;
                        return { ...lesson, questionCount };
                    })
                    .sort((a,b) => (a.order ?? Infinity) - (b.order ?? Infinity));

                if (lessons.length === 0) {
                    lessonListContainer.innerHTML = '<p>Môn học này chưa có bài học nào.</p>';
                    validateForm();
                    return;
                }

                lessonListContainer.innerHTML = '';
                const list = document.createElement('ul');
                list.className = 'divide-y divide-slate-200 text-left';
                lessons.forEach(lesson => {
                    const li = document.createElement('li');
                    li.className = "lesson-item p-4 flex items-center justify-between";
                    li.innerHTML = `
                        <div class="flex items-center">
                            <input id="${lesson.id}" type="radio" name="lesson-selection" data-question-count="${lesson.questionCount}" class="h-5 w-5 rounded-full border-gray-300 text-blue-600 focus:ring-blue-500" ${lesson.questionCount === 0 ? 'disabled' : ''}>
                            <label for="${lesson.id}" class="ml-3 ${lesson.questionCount === 0 ? 'text-slate-400' : 'text-slate-700'}">${lesson.name.replace(/^(Bài|Chương|Phần|Câu)\\s*\\d+\\s*[:.]?\\s*/i, '').trim()}</label>
                        </div>
                        <span class="text-sm font-semibold ${lesson.questionCount === 0 ? 'bg-slate-200 text-slate-400' : 'bg-slate-100 text-slate-600'} px-2 py-1 rounded-md">${lesson.questionCount} câu</span>
                    `;
                    list.appendChild(li);
                });
                lessonListContainer.appendChild(list);
                lessonListContainer.addEventListener('change', validateForm);
                validateForm();
            }
            
            function validateForm() {
                const selectedLesson = lessonListContainer.querySelector('input[type="radio"]:checked');
                startPracticeBtn.disabled = !selectedLesson;
            }

            async function startPractice() {
                startPracticeBtn.disabled = true;
                startPracticeBtn.innerHTML = '<span class="animate-spin h-5 w-5 mr-3 border-t-2 border-r-2 border-white rounded-full"></span>Đang chuẩn bị...';

                try {
                    const selectedLessonRadio = lessonListContainer.querySelector('input[type="radio"]:checked');
                    if (!selectedLessonRadio) throw new Error("Vui lòng chọn một bài học.");
                    
                    const selectedLessonId = selectedLessonRadio.id;
                    const questionPool = allData.questions.filter(q => q.lessonId === selectedLessonId).map(q => q.id);

                    if (questionPool.length === 0) {
                        throw new Error(`Bài học này chưa có câu hỏi nào.`);
                    }
                    
                    // Lấy tối đa 20 câu, hoặc tất cả nếu có ít hơn 20
                    const questionCount = Math.min(20, questionPool.length);
                    const finalQuestionIds = questionPool.sort(() => 0.5 - Math.random()).slice(0, questionCount);
                    
                    sessionStorage.setItem('practiceTestQuestions', JSON.stringify(finalQuestionIds));
                    
                    window.location.href = 'practice-test.html';

                } catch (error) {
                    console.error("Error creating practice test:", error);
                    showToast(error.message, 'error');
                    startPracticeBtn.disabled = false;
                    startPracticeBtn.textContent = 'Bắt đầu Luyện tập';
                }
            }
            
            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    document.body.style.opacity = '0';
                    setTimeout(() => { window.location.href = this.href; }, 200);
                });
            });
            document.body.style.transition = 'opacity 0.2s ease-in-out';

            feather.replace();
        });