import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, getDocs, addDoc, serverTimestamp, query, where } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        // --- DOM ELEMENTS ---
        const testNameInput = document.getElementById('test-name');
        const subjectFilter = document.getElementById('filter-subject');
        const gradeFilter = document.getElementById('filter-grade');
        const timeLimitInput = document.getElementById('time-limit');
        const sourceOptions = document.getElementById('source-options');
        const classroomsListContainer = document.getElementById('classrooms-list');
        const nextStepBtn = document.getElementById('next-step-btn');
        const toastContainer = document.getElementById('toast-container');

        // --- STATE ---
        let allData = { subjects: [], lessons: [], classrooms: [] };
        let currentUser = null;

        // --- UTILS ---
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
                selectElement.innerHTML += `<option value="${item.id || item.value}">${item.name}</option>`;
            });
        }

        // --- AUTH & PAGE LOAD ---
        onAuthStateChanged(auth, async (user) => {
             if (user) {
                currentUser = user;
                const docSnap = await getDoc(doc(db, "users", user.uid));
                if (docSnap.exists() && docSnap.data().role === 'teacher') {
                    const userData = docSnap.data();
                    document.getElementById('user-name').textContent = userData.name || 'Giáo viên';
                    const nameInitial = (userData.name || 'T').charAt(0).toUpperCase();
                    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=0D9488&color=fff&bold=true`;
                    initCreateTestPage();
                } else {
                    const userRole = docSnap.data()?.role;
                    window.location.href = userRole ? `../${userRole}/index.html` : '../auth.html';
                }
             } else {
                window.location.href = '../auth.html';
             }
        });
        
        async function initCreateTestPage() {
            try {
                const [subjectsSnap, lessonsSnap, classroomsSnap] = await Promise.all([
                    getDocs(collection(db, "subjects")),
                    getDocs(collection(db, "lessons")),
                    getDocs(query(collection(db, "classrooms"), where("teacherId", "==", currentUser.uid)))
                ]);
                allData.subjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                allData.lessons = lessonsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                allData.classrooms = classroomsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                
                populateSelect(subjectFilter, allData.subjects, "Chọn Môn học");
                renderClassroomsList();
                setupEventListeners();
            } catch (error) {
                console.error("Error loading initial data:", error);
                showToast("Không thể tải dữ liệu cần thiết.", "error");
            }
        }

        function renderClassroomsList() {
            classroomsListContainer.innerHTML = '';
            if (allData.classrooms.length === 0) {
                classroomsListContainer.innerHTML = `<p class="text-sm text-slate-500">Bạn chưa có lớp học nào. Hãy tạo lớp học trước khi giao bài.</p>`;
                return;
            }
            allData.classrooms.forEach(classroom => {
                const label = document.createElement('label');
                label.className = "flex items-center space-x-3 p-2 rounded-md hover:bg-slate-100 cursor-pointer";
                label.innerHTML = `
                    <input type="checkbox" value="${classroom.id}" name="classroom" class="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500">
                    <span class="text-sm text-slate-700">${classroom.className}</span>
                `;
                classroomsListContainer.appendChild(label);
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
            
            [testNameInput, subjectFilter, gradeFilter, timeLimitInput].forEach(el => {
                el.addEventListener('input', validateForm);
                el.addEventListener('change', validateForm);
            });
            sourceOptions.addEventListener('change', validateForm);
            
            subjectFilter.addEventListener('change', handleSubjectChange);
            nextStepBtn.addEventListener('click', saveAndProceed);
        }

        function handleSubjectChange() {
            const subjectId = subjectFilter.value;
            if (!subjectId) {
                gradeFilter.innerHTML = '<option value="">Chọn Lớp</option>';
                gradeFilter.disabled = true;
                return;
            }
            const relevantLessons = allData.lessons.filter(l => l.subjectId === subjectId);
            const grades = [...new Set(relevantLessons.map(t => t.grade))].sort((a,b) => a-b);
            const gradeOptions = grades.map(g => ({ value: g, name: `Lớp ${g}` }));
            populateSelect(gradeFilter, gradeOptions, "Chọn Lớp");
            gradeFilter.disabled = false;
        }
        
        function validateForm() {
            const selectedSource = sourceOptions.querySelector('input[name="question-source"]:checked');
            const isFormValid = testNameInput.value.trim() !== '' &&
                                subjectFilter.value !== '' &&
                                gradeFilter.value !== '' &&
                                timeLimitInput.value > 0 &&
                                selectedSource;
            nextStepBtn.disabled = !isFormValid;
        }
        
        async function saveAndProceed() {
            nextStepBtn.disabled = true;
            nextStepBtn.innerHTML = 'Đang xử lý...';
            
            const selectedSource = sourceOptions.querySelector('input[name="question-source"]:checked').value;
            const isMonitored = document.querySelector('input[name="monitoring"]:checked').value === 'true';
            const selectedClassrooms = Array.from(document.querySelectorAll('input[name="classroom"]:checked')).map(cb => cb.value);

            const testData = {
                name: testNameInput.value.trim(),
                subjectId: subjectFilter.value,
                grade: parseInt(gradeFilter.value, 10),
                timeLimit: parseInt(timeLimitInput.value, 10),
                authorId: currentUser.uid,
                status: 'draft',
                createdAt: serverTimestamp(),
                creationMethod: selectedSource,
                isMonitored: isMonitored,
                assignedClassroomIds: selectedClassrooms,
                ...(selectedSource === 'manual_input' && { questions: [] })
            };

            try {
                const docRef = await addDoc(collection(db, "tests"), testData);
                // ĐÃ SỬA LỖI ĐIỀU HƯỚNG: Luôn trỏ đến create-test-teacher-step2.html
                const destination = `create-test-teacher-step2.html?testId=${docRef.id}&source=${selectedSource}`;
                
                window.location.href = destination;
            } catch (error) {
                console.error("Error creating test:", error);
                showToast("Đã xảy ra lỗi khi tạo đề thi.", "error");
                nextStepBtn.disabled = false;
                nextStepBtn.innerHTML = 'Tiếp tục <i data-feather="arrow-right" class="inline-block ml-2 w-5 h-5"></i>';
                feather.replace();
            }
        }
        
        feather.replace();

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