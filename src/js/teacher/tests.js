import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, onSnapshot, query, where, deleteDoc, getDocs, orderBy, updateDoc, arrayUnion, arrayRemove, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            const testsTableBody = document.getElementById('tests-table-body');
            const userNameEl = document.getElementById('user-name');
            const userAvatarEl = document.getElementById('user-avatar');
            const searchInput = document.getElementById('search-input');
            const deleteConfirmModal = document.getElementById('delete-confirm-modal');
            const deleteConfirmText = document.getElementById('delete-confirm-text');
            const deleteCancelBtn = document.getElementById('delete-cancel-btn');
            const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
            const assignModal = document.getElementById('assign-modal');
            const assignModalTitle = document.getElementById('assign-modal-title');
            const assignModalTestName = document.getElementById('assign-modal-test-name');
            const classroomsListEl = document.getElementById('classrooms-list');
            const assignCancelBtn = document.getElementById('assign-cancel-btn');
            const assignConfirmBtn = document.getElementById('assign-confirm-btn');
            const toastContainer = document.getElementById('toast-container');
            const monitorModal = document.getElementById('monitor-modal');
            const monitorModalTestName = document.getElementById('monitor-modal-test-name');
            const monitorClassroomsList = document.getElementById('monitor-classrooms-list');
            const monitorCancelBtn = document.getElementById('monitor-cancel-btn');
            
            let currentUser = null;
            let allTests = [];
            let teacherClassrooms = [];
            let itemToDelete = null;
            let currentTestContext = null; 
            let testToMonitor = null;

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

            onAuthStateChanged(auth, async (user) => {
                 if (user) {
                    currentUser = user;
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists() && docSnap.data().role === 'teacher') {
                        const userData = docSnap.data();
                        userNameEl.textContent = userData.name || 'Giáo viên';
                        const nameInitial = (userData.name || 'T').charAt(0).toUpperCase();
                        userAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=0D9488&color=fff&bold=true`;
                        
                        listenForTeacherClassrooms();
                        listenForTests();
                    } else {
                        const userRole = docSnap.data()?.role;
                        window.location.href = userRole ? `../${userRole}/index.html` : '../auth.html';
                    }
                 } else {
                    window.location.href = '../auth.html';
                 }
            });

            function listenForTeacherClassrooms() {
                const q = query(collection(db, "classrooms"), where("teacherId", "==", currentUser.uid));
                onSnapshot(q, (snapshot) => {
                    teacherClassrooms = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
                    renderTable(allTests); 
                });
            }

            function listenForTests() {
                // UPDATE: Only fetch tests created by the current teacher
                const q = query(collection(db, "tests"), 
                    where("authorId", "==", currentUser.uid),
                    orderBy("createdAt", "desc")
                );
                
                onSnapshot(q, (snapshot) => {
                    allTests = snapshot.docs.map(doc => ({id: doc.id, ...doc.data()}));
                    renderTable(allTests);
                });
            }

            window.renderTable = (tests) => {
                const testsTableBody = document.getElementById('tests-table-body');
                if (tests.length === 0) {
                    testsTableBody.innerHTML = `<tr><td colspan="4" class="p-10 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">Chưa có đề thi nào</td></tr>`;
                    return;
                }
                
                testsTableBody.innerHTML = tests.map(test => {
                    const statusClass = test.status === 'published' ? 'status-published' : 'status-draft';
                    const statusText = test.status === 'published' ? 'Đã đăng' : 'Bản nháp';
                    const assignedClasses = teacherClassrooms.filter(c => c.assignments?.some(a => a.testId === test.id));
                    const isAssigned = assignedClasses.length > 0;
                    const showMonitor = isAssigned && test.status === 'published' && test.isMonitored === true;

                    return `
                        <tr class="hover:bg-slate-50 transition">
                            <td class="font-black text-slate-800">${test.name}</td>
                            <td class="text-center font-bold text-slate-500 text-sm">${test.questionIds?.length || test.questions?.length || 0} câu</td>
                            <td class="text-center"><span class="btn-pill ${statusClass}">${statusText}</span></td>
                            <td class="text-right">
                                <div class="flex items-center justify-end gap-2">
                                    ${showMonitor ? `<button data-action="monitor" data-id="${test.id}" data-name="${test.name}" class="px-4 py-2 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-amber-200">Giám sát</button>` : ''}
                                    
                                    <button data-action="assign" data-id="${test.id}" class="px-4 py-2 bg-teal-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-teal-200">Giao bài</button>
                                    
                                    ${isAssigned ? `<button data-action="unassign" data-id="${test.id}" class="px-4 py-2 bg-slate-200 text-slate-600 rounded-xl text-[10px] font-black uppercase">Hủy giao</button>` : ''}
                                    
                                    <div class="flex gap-1 ml-2">
                                        <a href="test-view-teacher.html?testId=${test.id}" class="p-2 text-slate-400 hover:text-teal-600 transition" title="Xem đề"><i data-feather="eye" class="w-4"></i></a>
                                        <button data-action="delete" data-id="${test.id}" data-name="${test.name}" class="p-2 text-slate-400 hover:text-red-500 transition" title="Xóa đề thi"><i data-feather="trash-2" class="w-4"></i></button>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    `;
                }).join('');
                feather.replace();
            }

            window.showMonitorModalOverride = (assignedClasses, testId) => {
                const monitorClassroomsList = document.getElementById('monitor-classrooms-list');
                monitorClassroomsList.innerHTML = assignedClasses.map(classroom => `
                    <a href="test-monitoring.html?testId=${testId}&classId=${classroom.id}" class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl hover:bg-teal-50 border border-transparent hover:border-teal-100 transition group">
                        <span class="font-black text-slate-700 group-hover:text-teal-700">${classroom.className}</span>
                        <i class="fas fa-chevron-right text-xs text-slate-300"></i>
                    </a>
                `).join('');
            }

            function showDeleteConfirmModal(id, name) {
                itemToDelete = { id, name };
                deleteConfirmText.textContent = `Bạn có chắc chắn muốn xóa đề thi "${name}" không? Mọi giao bài liên quan cũng sẽ bị hủy.`;
                deleteConfirmModal.classList.remove('hidden');
                deleteConfirmModal.classList.add('flex');
            }

            function hideDeleteConfirmModal() {
                deleteConfirmModal.classList.add('hidden');
                deleteConfirmModal.classList.remove('flex');
            }

            async function confirmDelete() {
                if (!itemToDelete) return;
                deleteConfirmBtn.disabled = true;
                deleteConfirmBtn.textContent = "Đang xóa...";

                try {
                    const batch = writeBatch(db);

                    // 1. Delete the test document itself
                    const testRef = doc(db, "tests", itemToDelete.id);
                    batch.delete(testRef);

                    // 2. Find all classrooms where this test was assigned and remove the assignment
                    const assignedClasses = teacherClassrooms.filter(c => 
                        c.assignments?.some(a => a.testId === itemToDelete.id)
                    );

                    for (const classroom of assignedClasses) {
                        const classRef = doc(db, "classrooms", classroom.id);
                        const assignmentToRemove = classroom.assignments.find(a => a.testId === itemToDelete.id);
                        if (assignmentToRemove) {
                            batch.update(classRef, {
                                assignments: arrayRemove(assignmentToRemove)
                            });
                        }
                    }

                    // 3. Commit all batched writes
                    await batch.commit();
                    
                    showToast(`Đã xóa thành công đề thi "${itemToDelete.name}" và hủy các bài giao liên quan.`);
                } catch (error) {
                    console.error("Error deleting test:", error);
                    showToast("Lỗi khi xóa đề thi.", "error");
                } finally {
                    hideDeleteConfirmModal();
                    itemToDelete = null;
                    deleteConfirmBtn.disabled = false;
                    deleteConfirmBtn.textContent = "Xóa";
                }
            }
            
            function showAssignModal(action, testObject) {
                currentTestContext = { action, test: testObject };
                assignModalTestName.textContent = `Đề thi: "${testObject.name}"`;
                
                let relevantClasses = [];
                if (action === 'assign') {
                    assignModalTitle.textContent = "Giao bài cho lớp";
                    assignConfirmBtn.textContent = "Xác nhận Giao bài";
                    assignConfirmBtn.className = "cta-button text-white px-4 py-2 rounded-lg font-semibold";
                    relevantClasses = teacherClassrooms.filter(c => !c.assignments?.some(a => a.testId === testObject.id));
                } else { // unassign
                    assignModalTitle.textContent = "Hủy giao bài";
                    assignConfirmBtn.textContent = "Xác nhận Hủy";
                    assignConfirmBtn.className = "bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold";
                    relevantClasses = teacherClassrooms.filter(c => c.assignments?.some(a => a.testId === testObject.id));
                }
                
                classroomsListEl.innerHTML = '';
                if (relevantClasses.length === 0) {
                    classroomsListEl.innerHTML = `<p class="text-slate-500 text-sm">Không có lớp học nào phù hợp cho hành động này.</p>`;
                } else {
                    relevantClasses.forEach(classroom => {
                        classroomsListEl.innerHTML += `
                            <label class="flex items-center space-x-3 p-2 rounded-md hover:bg-slate-100 cursor-pointer">
                                <input type="checkbox" value="${classroom.id}" name="classroom-select" class="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500">
                                <span class="text-sm text-slate-700">${classroom.className}</span>
                            </label>
                        `;
                    });
                }
                assignModal.classList.remove('hidden');
                assignModal.classList.add('flex');
            }
            
            function hideAssignModal() {
                assignModal.classList.add('hidden');
                assignModal.classList.remove('flex');
                currentTestContext = null;
            }

            async function handleAssignAction() {
                if (!currentTestContext) return;

                const { action, test } = currentTestContext;
                const selectedClassroomIds = Array.from(document.querySelectorAll('input[name="classroom-select"]:checked')).map(cb => cb.value);
                if (selectedClassroomIds.length === 0) {
                    showToast("Vui lòng chọn ít nhất một lớp học.", "error");
                    return;
                }
                
                assignConfirmBtn.disabled = true;
                assignConfirmBtn.textContent = 'Đang xử lý...';

                try {
                    const batch = writeBatch(db);
                    
                    if (action === 'assign') {
                        const testRef = doc(db, "tests", test.id);
                        if (test.status === 'draft') {
                            batch.update(testRef, { status: "published" });
                        }
                        const assignment = { testId: test.id, assignedAt: new Date() };
                        selectedClassroomIds.forEach(classId => {
                            const classRef = doc(db, "classrooms", classId);
                            batch.update(classRef, { assignments: arrayUnion(assignment) });
                        });
                        await batch.commit();
                        showToast(`Đã giao bài thành công cho ${selectedClassroomIds.length} lớp!`, "success");
                    } else { // unassign
                        selectedClassroomIds.forEach(classId => {
                            const classRef = doc(db, "classrooms", classId);
                            const classroom = teacherClassrooms.find(c => c.id === classId);
                            const exactAssignment = classroom.assignments.find(a => a.testId === test.id);
                            if(exactAssignment) {
                                batch.update(classRef, { assignments: arrayRemove(exactAssignment) });
                            }
                        });
                        await batch.commit();
                        showToast(`Đã hủy giao bài cho ${selectedClassroomIds.length} lớp!`, "success");
                    }
                    hideAssignModal();
                } catch (error) {
                    console.error(`Error during ${action}:`, error);
                    showToast("Đã có lỗi xảy ra.", "error");
                } finally {
                    assignConfirmBtn.disabled = false;
                }
            }

            async function showMonitorModal(id, name) {
                testToMonitor = { id, name };
                monitorModalTestName.textContent = `Đề thi: "${name}"`;
                monitorClassroomsList.innerHTML = '<p class="text-slate-500 text-sm">Đang tìm các lớp đã được giao...</p>';
                
                const assignedClasses = teacherClassrooms.filter(c => 
                    c.assignments && c.assignments.some(a => a.testId === id)
                );

                if (assignedClasses.length === 0) {
                    monitorClassroomsList.innerHTML = `<p class="text-slate-500 text-sm">Đề thi này chưa được giao cho lớp nào.</p>`;
                } else {
                    monitorClassroomsList.innerHTML = '';
                    assignedClasses.forEach(classroom => {
                        monitorClassroomsList.innerHTML += `
                            <a href="test-monitoring.html?testId=${id}&classId=${classroom.id}" class="block p-3 rounded-md hover:bg-slate-100 text-slate-700 font-semibold">
                                ${classroom.className}
                            </a>
                        `;
                    });
                }
                monitorModal.classList.remove('hidden');
                monitorModal.classList.add('flex');
            }

            function hideMonitorModal() {
                monitorModal.classList.add('hidden');
                monitorModal.classList.remove('flex');
                testToMonitor = null;
            }

            testsTableBody.addEventListener('click', (e) => {
                const button = e.target.closest('button[data-action]');
                if (!button) return;

                const id = button.dataset.id;
                const name = button.dataset.name;
                const action = button.dataset.action;

                if (action === 'delete') {
                    showDeleteConfirmModal(id, name);
                } else if (action === 'assign' || action === 'unassign') {
                    const testObject = allTests.find(t => t.id === id);
                    if (testObject) {
                        showAssignModal(action, testObject);
                    }
                } else if (action === 'monitor') {
                    showMonitorModal(id, name);
                }
            });
            
            deleteCancelBtn.addEventListener('click', hideDeleteConfirmModal);
            deleteConfirmBtn.addEventListener('click', confirmDelete);
            assignCancelBtn.addEventListener('click', hideAssignModal);
            assignConfirmBtn.addEventListener('click', handleAssignAction);
            monitorCancelBtn.addEventListener('click', hideMonitorModal);
            
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const filteredTests = allTests.filter(test => test.name.toLowerCase().includes(searchTerm));
                renderTable(filteredTests);
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