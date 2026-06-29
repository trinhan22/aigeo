import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, onSnapshot, query, where, deleteDoc, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        
        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);
            
            // --- DOM Elements ---
            const testsGrid = document.getElementById('tests-grid');
            const toastContainer = document.getElementById('toast-container');
            const searchInput = document.getElementById('search-input');
            const subjectFilter = document.getElementById('subject-filter');
            const statusFilter = document.getElementById('status-filter');

            // Delete Modal
            const deleteConfirmModal = document.getElementById('delete-confirm-modal');
            const deleteCancelBtn = document.getElementById('delete-cancel-btn');
            const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
            const deleteConfirmText = document.getElementById('delete-confirm-text');
            
            // --- State ---
            let allSubjects = [];
            let allTests = [];
            let currentUser = null;
            let itemToDeleteId = null;
            let testsListener = null;

            function showToast(message, type = 'success') {
                const toast = document.createElement('div');
                const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
                const icon = type === 'success' ? 'check-circle' : 'alert-circle';
                toast.className = `toast show ${bgColor} text-white p-4 rounded-lg shadow-lg flex items-center space-x-3`;
                toast.innerHTML = `<i data-feather="${icon}" class="w-5 h-5"></i><span>${message}</span>`;
                toastContainer.appendChild(toast);
                feather.replace();
                setTimeout(() => {
                    toast.classList.remove('show');
                    toast.addEventListener('transitionend', () => toast.remove());
                }, 3000);
            }
            
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    currentUser = user;
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists() && docSnap.data().role === 'admin') {
                        const userData = docSnap.data();
                        document.getElementById('user-name').textContent = userData.name || 'Admin';
                        const nameInitial = (userData.name || 'A').charAt(0).toUpperCase();
                        document.getElementById('user-avatar').src = `https://placehold.co/40x40/DC2626/FFFFFF?text=${nameInitial}`;
                        initTestsPage();
                    } else {
                        window.location.href = '../auth.html';
                    }
                } else {
                    window.location.href = '../auth.html';
                }
            });

            async function initTestsPage() {
                try {
                    const subjectsSnap = await getDocs(collection(db, "subjects"));
                    allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    
                    populateSubjectFilter();
                    listenForAdminTests();
                    setupEventListeners();
                } catch (error) {
                    console.error("Initialization Error: ", error);
                    showToast("Lỗi khi tải dữ liệu ban đầu.", "error");
                }
            }

            function populateSubjectFilter() {
                subjectFilter.innerHTML = `<option value="all">Tất cả môn học</option>`;
                allSubjects.forEach(subject => {
                    const option = document.createElement('option');
                    option.value = subject.id;
                    option.textContent = subject.name;
                    subjectFilter.appendChild(option);
                });
            }

            function listenForAdminTests() {
                if(testsListener) testsListener();
                const q = query(collection(db, "tests"), where("authorId", "==", currentUser.uid), orderBy("createdAt", "desc"));
                testsListener = onSnapshot(q, (snapshot) => {
                    allTests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    applyFiltersAndRender();
                }, (error) => {
                    console.error("Error listening to tests:", error);
                    showToast("Lỗi khi tải danh sách đề thi của bạn.", "error");
                });
            }
            
            function applyFiltersAndRender() {
                const searchTerm = searchInput.value.toLowerCase();
                const selectedSubject = subjectFilter.value;
                const selectedStatus = statusFilter.value;

                const filteredTests = allTests.filter(test => {
                    const nameMatch = test.name.toLowerCase().includes(searchTerm);
                    const subjectMatch = selectedSubject === 'all' || test.subjectId === selectedSubject;
                    const statusMatch = selectedStatus === 'all' || test.status === selectedStatus;
                    return nameMatch && subjectMatch && statusMatch;
                });
                renderTestsGrid(filteredTests);
            }

            function renderTestsGrid(tests) {
                if (tests.length === 0) {
                    testsGrid.innerHTML = `<p class="text-slate-500 md:col-span-2 lg:col-span-3 text-center py-10">Không tìm thấy đề thi nào phù hợp.</p>`;
                    return;
                }

                testsGrid.innerHTML = '';
                tests.forEach(test => {
                    const subject = allSubjects.find(s => s.id === test.subjectId);
                    const statusBg = test.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
                    const statusText = test.status === 'published' ? 'Đã xuất bản' : 'Bản nháp';
                    const canEdit = test.status === 'draft';

                    const card = document.createElement('div');
                    card.className = "test-card bg-white rounded-xl shadow-sm p-5 flex flex-col";
                    card.innerHTML = `
                        <div class="flex-grow">
                            <div class="flex justify-between items-start">
                                <h3 class="font-bold text-slate-800 pr-4">${test.name}</h3>
                                <span class="flex-shrink-0 px-2 py-1 text-xs font-semibold rounded-full ${statusBg}">${statusText}</span>
                            </div>
                            <div class="text-sm text-slate-500 mt-2 space-x-4">
                                <span><i data-feather="book-open" class="w-4 h-4 inline-block -mt-1 mr-1"></i>${subject?.name || 'N/A'}</span>
                                <span><i data-feather="list" class="w-4 h-4 inline-block -mt-1 mr-1"></i>${test.questions?.length || 0} câu</span>
                            </div>
                        </div>
                        <div class="mt-4 pt-4 border-t border-slate-100 flex items-center justify-end space-x-2">
                            <a href="test-view.html?testId=${test.id}" class="bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-lg text-sm">Xem</a>
                            ${canEdit ? `
                                <a href="create-test-step2.html?id=${test.id}" class="bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold px-4 py-2 rounded-lg text-sm">Sửa</a>
                            ` : ''}
                            <button data-action="delete-test" data-id="${test.id}" class="bg-red-50 hover:bg-red-100 text-red-700 font-semibold px-4 py-2 rounded-lg text-sm">Xóa</button>
                        </div>
                    `;
                    testsGrid.appendChild(card);
                });
                feather.replace();
            }


            function setupEventListeners() {
                document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
                
                searchInput.addEventListener('input', applyFiltersAndRender);
                subjectFilter.addEventListener('change', applyFiltersAndRender);
                statusFilter.addEventListener('change', applyFiltersAndRender);

                document.body.addEventListener('click', (e) => {
                    const button = e.target.closest('button[data-action="delete-test"]');
                    if(!button) return;
                    showDeleteConfirmModal(button.dataset.id);
                });
                
                deleteConfirmBtn.onclick = handleDeleteTest;
                deleteCancelBtn.onclick = hideDeleteConfirmModal;
            }
            
            async function handleDeleteTest() {
                if (!itemToDeleteId) return;
                deleteConfirmBtn.disabled = true;
                try {
                    await deleteDoc(doc(db, 'tests', itemToDeleteId));
                    showToast('Xóa đề thi thành công!');
                } catch (error) {
                    showToast('Lỗi khi xóa đề thi.', "error");
                } finally {
                    hideDeleteConfirmModal();
                    itemToDeleteId = null;
                    deleteConfirmBtn.disabled = false;
                }
            }
            
            function showDeleteConfirmModal(id) {
                itemToDeleteId = id;
                const test = allTests.find(t => t.id === id);
                deleteConfirmText.textContent = `Bạn có chắc chắn muốn xóa đề thi "${test.name}" không?`;
                deleteConfirmModal.classList.remove('hidden');
                deleteConfirmModal.classList.add('flex');
            }
            
            function hideDeleteConfirmModal() {
                deleteConfirmModal.classList.add('hidden');
                deleteConfirmModal.classList.remove('flex');
            }

            feather.replace();
        });