import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, onSnapshot, query, where, getDocs, addDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            // --- State ---
            let currentUser = null;
            let classrooms = [];
            let allSubjects = [];
            let currentClassContext = {};

            // --- Elements ---
            const classroomsArea = document.getElementById('classrooms-area');
            const classroomsTableBody = document.getElementById('classrooms-table-body');
            const addClassroomBtn = document.getElementById('add-classroom-btn');
            const classroomModal = document.getElementById('classroom-modal');
            const classroomForm = document.getElementById('classroom-form');
            const classroomModalTitle = document.getElementById('classroom-modal-title');
            const classroomCancelBtn = document.getElementById('classroom-cancel-btn');
            const deleteConfirmModal = document.getElementById('delete-confirm-modal');
            const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
            const deleteCancelBtn = document.getElementById('delete-cancel-btn');
            const deleteConfirmText = document.getElementById('delete-confirm-text');
            const toastContainer = document.getElementById('toast-container');

            // --- Utility Functions ---
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
             function generateClassCode() {
                const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789';
                let result = '';
                for (let i = 0; i < 6; i++) {
                    result += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return result;
            }

            // --- Auth & Data Loading ---
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    currentUser = user;
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists() && docSnap.data().role === 'teacher') {
                        const userData = docSnap.data();
                        document.getElementById('user-name').textContent = userData.name || 'Giáo viên';
                        document.getElementById('user-avatar').src = userData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=0D9488&color=fff&bold=true`;
                        initPage();
                    } else {
                        const userRole = docSnap.data()?.role;
                        window.location.href = userRole ? `../${userRole}/index.html` : '../auth.html';
                    }
                } else {
                    window.location.href = '../auth.html';
                }
            });

            async function initPage() {
                try {
                    const subjectsSnap = await getDocs(collection(db, "subjects"));
                    allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                    const q = query(collection(db, "classrooms"), where("teacherId", "==", currentUser.uid));
                    onSnapshot(q, (snapshot) => {
                        classrooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                        renderClassrooms();
                    });
                    
                    setupEventListeners();
                } catch (error) {
                    console.error("Error loading initial data:", error);
                    showToast("Lỗi tải dữ liệu ban đầu.", "error");
                }
            }

            // --- Rendering ---
            window.renderClassrooms = () => {
                const classroomsTableBody = document.getElementById('classrooms-table-body');
                classroomsTableBody.innerHTML = '';
                if (classrooms.length === 0) {
                    classroomsTableBody.innerHTML = `<tr><td colspan="6" class="text-center py-20 text-slate-300 font-bold uppercase tracking-widest text-xs">Chưa có lớp học nào</td></tr>`;
                    return;
                }
                classrooms.forEach(c => {
                    const subject = allSubjects.find(s => s.id === c.subjectId);
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="font-black text-slate-800">${c.className}</td>
                        <td class="text-sm font-bold text-slate-500">${subject ? subject.name : 'Địa lý'}</td>
                        <td class="text-sm font-black text-teal-600 uppercase tracking-tighter">Lớp ${c.grade}</td>
                        <td>
                            <div class="flex items-center gap-2">
                                <span class="code-badge">${c.classCode}</span>
                                <button data-action="copy-code" data-code="${c.classCode}" class="p-1.5 text-slate-400 hover:text-teal-600 transition"><i data-feather="copy" class="w-4"></i></button>
                                <button data-action="share-link" data-code="${c.classCode}" class="p-1.5 text-slate-400 hover:text-teal-600 transition"><i data-feather="link" class="w-4"></i></button>
                            </div>
                        </td>
                        <td class="text-sm font-bold text-slate-500">${c.students ? c.students.length : 0} HS</td>
                        <td class="text-right">
                            <div class="flex items-center justify-end gap-1">
                                <a href="student-progress.html?classId=${c.id}" class="px-3 py-1.5 text-[10px] font-black bg-teal-50 text-teal-600 rounded-lg hover:bg-teal-600 hover:text-white transition uppercase tracking-widest">Tiến độ</a>
                                <button data-action="edit" data-id="${c.id}" class="p-2 text-slate-400 hover:text-teal-600 transition"><i data-feather="edit-3" class="w-4"></i></button>
                                <button data-action="delete" data-id="${c.id}" class="p-2 text-slate-400 hover:text-red-500 transition"><i data-feather="trash-2" class="w-4"></i></button>
                            </div>
                        </td>
                    `;
                    classroomsTableBody.appendChild(tr);
                });
                feather.replace();
            }

            // --- Event Listeners & Handlers ---
            function setupEventListeners() {
                // Chỉ gắn listener cho nav-link cố định một lần
                document.querySelectorAll('aside .nav-link').forEach(link => {
                    link.addEventListener('click', function(e) {
                        e.preventDefault();
                        document.body.style.opacity = '0';
                        setTimeout(() => { window.location.href = this.href; }, 200);
                    });
                });
                document.body.style.transition = 'opacity 0.2s ease-in-out';
                
                document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

                addClassroomBtn.addEventListener('click', () => showClassroomModal('add'));
                classroomForm.addEventListener('submit', handleFormSubmit);
                classroomCancelBtn.addEventListener('click', hideClassroomModal);
                deleteConfirmBtn.addEventListener('click', handleDelete);
                deleteCancelBtn.addEventListener('click', hideDeleteModal);

                // Gắn listener vào Bảng, không phải link <a>
                classroomsTableBody.addEventListener('click', e => {
                    const targetElement = e.target.closest('button[data-action]');
                    if (!targetElement) return;

                    const action = targetElement.dataset.action;
                    if (action) e.preventDefault();
                    
                    const id = targetElement.dataset.id;

                    if (action === 'copy-code') {
                        navigator.clipboard.writeText(targetElement.dataset.code);
                        showToast("Đã sao chép mã lớp!");
                    } else if (action === 'share-link') {
                        const classCode = targetElement.dataset.code;
                        const joinLink = `${window.location.origin}/student/join-class.html?code=${classCode}`;
                        navigator.clipboard.writeText(joinLink);
                        showToast("Đã sao chép link mời tham gia lớp học!");
                    } else if (action === 'edit') {
                        const classroom = classrooms.find(c => c.id === id);
                        if(classroom) showClassroomModal('edit', classroom);
                    } else if (action === 'delete') {
                        showDeleteModal(id);
                    }
                });
            }
            
            async function handleFormSubmit(e) {
                e.preventDefault();
                const { mode, data } = currentClassContext;
                const payload = {
                    className: document.getElementById('class-name').value,
                    subjectId: document.getElementById('class-subject').value,
                    grade: document.getElementById('class-grade').value,
                    teacherId: currentUser.uid
                };
                
                try {
                    if (mode === 'add') {
                        payload.classCode = generateClassCode();
                        payload.students = [];
                        payload.assignments = [];
                        await addDoc(collection(db, "classrooms"), payload);
                        showToast('Tạo lớp học thành công!');
                    } else {
                        await updateDoc(doc(db, "classrooms", data.id), payload);
                        showToast('Cập nhật lớp học thành công!');
                    }
                    hideClassroomModal();
                } catch (error) {
                    showToast('Có lỗi xảy ra', 'error');
                }
            }

            function showClassroomModal(mode, data = {}) {
                currentClassContext = { mode, data };
                classroomForm.reset();
                classroomModalTitle.textContent = mode === 'add' ? 'Tạo lớp học mới' : 'Chỉnh sửa lớp học';
                
                const subjectSelect = document.getElementById('class-subject');
                subjectSelect.innerHTML = '<option value="">Chọn môn học</option>';
                allSubjects.forEach(s => subjectSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`);

                if(mode === 'edit') {
                    document.getElementById('class-name').value = data.className;
                    subjectSelect.value = data.subjectId;
                    document.getElementById('class-grade').value = data.grade;
                }

                classroomModal.classList.remove('hidden');
                classroomModal.classList.add('flex');
            }
            
            window.hideClassroomModal = () => {
                document.getElementById('classroom-modal').classList.replace('flex', 'hidden');
            }
            
            function showDeleteModal(classId) {
                currentClassContext = { id: classId };
                const classroom = classrooms.find(c => c.id === classId);
                deleteConfirmText.textContent = `Bạn có chắc chắn muốn xóa lớp "${classroom.className}"? Mọi dữ liệu liên quan sẽ bị mất.`;
                deleteConfirmModal.classList.remove('hidden');
                deleteConfirmModal.classList.add('flex');
            }

            function hideDeleteModal() {
                deleteConfirmModal.classList.add('hidden');
                deleteConfirmModal.classList.remove('flex');
            }

            async function handleDelete() {
                try {
                    await deleteDoc(doc(db, "classrooms", currentClassContext.id));
                    showToast('Xóa lớp học thành công!');
                } catch (error) {
                    showToast('Lỗi khi xóa lớp học.', 'error');
                } finally {
                    hideDeleteModal();
                }
            }
            
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