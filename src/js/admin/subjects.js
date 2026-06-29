import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, writeBatch, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        
        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            const treeContainer = document.getElementById('tree-container');
            const contentPanel = document.getElementById('content-panel');
            const editModal = document.getElementById('edit-modal');
            const modalForm = document.getElementById('modal-form');
            const toastContainer = document.getElementById('toast-container');
            
            let allData = { subjects: [], lessons: [], questions: [] };
            let selected = { subjectId: null, gradeId: null, lessonId: null };
            let expanded = new Set();
            let sortableInstances = {};

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
            
            function cleanPrefix(text) {
                if (!text) return '';
                return text.replace(/^(Bài|Chương|Phần)\s*\d+\s*[:.]?\s*/i, '').trim();
            }

            function getTypeIcon(type) {
                const icons = { subject: 'book', grade: 'layers', lesson: 'file-text' };
                return icons[type] || 'chevron-right';
            }
            
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists() && docSnap.data().role === 'admin') {
                        const userData = docSnap.data();
                        document.getElementById('user-name').textContent = userData.name || 'Admin';
                        document.getElementById('user-avatar').src = `https://placehold.co/40x40/DC2626/FFFFFF?text=${(userData.name || 'A').charAt(0).toUpperCase()}`;
                        initPage();
                    } else { window.location.href = `../${docSnap.data()?.role || 'auth'}/index.html`; }
                } else { window.location.href = '../auth.html'; }
            });

            function initPage() {
                treeContainer.innerHTML = `<div class="p-4 text-center text-sm text-slate-500">Đang tải cấu trúc...</div>`;
                const collections = ['subjects', 'lessons', 'questions'];
                let loadedCount = 0;
                collections.forEach(key => {
                    onSnapshot(collection(db, key), (snapshot) => {
                        allData[key] = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                        if (++loadedCount === collections.length) {
                            renderTree();
                            if(selected.subjectId) renderContentPanel();
                        }
                    });
                });
                setupEventListeners();
            }

            function setupEventListeners() {
                document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
                document.getElementById('add-subject-btn').addEventListener('click', () => showModal('add', 'subject'));
                document.getElementById('modal-cancel-btn').addEventListener('click', () => editModal.classList.add('hidden'));
                modalForm.addEventListener('submit', handleFormSubmit);
                treeContainer.addEventListener('click', handleTreeClick);
                contentPanel.addEventListener('click', handleContentPanelClick);
            }
            
            function renderTree() {
                treeContainer.innerHTML = '';
                const sortedSubjects = [...allData.subjects].sort((a,b) => a.name.localeCompare(b.name));
                sortedSubjects.forEach(subject => {
                    const subjectEl = createTreeItem(subject, 'subject', allData.lessons.filter(l => l.subjectId === subject.id).length);
                    treeContainer.appendChild(subjectEl);
                    if (expanded.has(subject.id)) {
                        const childrenContainer = document.createElement('div');
                        childrenContainer.className = 'tree-children expanded';
                        [10, 11, 12].forEach(grade => {
                            const gradeLessons = allData.lessons.filter(l => l.subjectId === subject.id && l.grade == grade);
                            // Luôn hiển thị Khối lớp dù chưa có bài học để người dùng có thể chọn và thêm bài
                            const gradeId = `${subject.id}_${grade}`;
                            const gradeEl = createTreeItem({ id: gradeId, name: `Lớp ${grade}` }, 'grade', gradeLessons.length);
                            childrenContainer.appendChild(gradeEl);
                            if (expanded.has(gradeId)) {
                                const lessonContainer = document.createElement('div');
                                lessonContainer.className = 'tree-children expanded';
                                if (gradeLessons.length > 0) {
                                    gradeLessons.sort((a,b) => (a.order ?? Infinity) - (b.order ?? Infinity)).forEach(lesson => {
                                        const qCount = allData.questions.filter(q => q.lessonId === lesson.id).length;
                                        lessonContainer.appendChild(createTreeItem(lesson, 'lesson', qCount));
                                    });
                                } else {
                                    lessonContainer.innerHTML = `<div class="p-2 text-xs text-slate-400 italic pl-4">Chưa có bài học</div>`;
                                }
                                gradeEl.appendChild(lessonContainer);
                            }
                        });
                        subjectEl.appendChild(childrenContainer);
                    }
                });
                feather.replace();
            }

            function createTreeItem(item, type, childCount = 0) {
                const container = document.createElement('div');
                const isSelected = selected.subjectId === item.id || selected.lessonId === item.id || selected.gradeId === item.id;
                const isExpandable = type !== 'lesson';
                const isExpanded = expanded.has(item.id);

                container.className = `tree-item-container ${isSelected ? 'selected' : ''}`;
                container.dataset.id = item.id;
                container.dataset.type = type;

                container.innerHTML = `
                    <div class="tree-item">
                        <i data-feather="chevron-right" class="chevron ${isExpandable ? '' : 'invisible'} ${isExpanded ? 'expanded' : ''} w-4 h-4 text-slate-400"></i>
                        <i data-feather="${getTypeIcon(type)}" class="tree-item-icon w-5 h-5 text-slate-500"></i>
                        <span class="tree-item-name flex-grow truncate text-sm ml-2">${cleanPrefix(item.name)}</span>
                        ${childCount > 0 ? `<span class="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">${childCount}</span>` : ''}
                        <div class="item-actions ml-2 space-x-1 bg-transparent">
                             ${type !== 'grade' ? `<button data-action="edit" title="Sửa" class="p-1.5 hover:bg-slate-200 rounded-md"><i data-feather="edit-2" class="w-4 h-4 text-slate-500"></i></button><button data-action="delete" title="Xóa" class="p-1.5 hover:bg-slate-200 rounded-md"><i data-feather="trash-2" class="w-4 h-4 text-red-500"></i></button>` : ''}
                        </div>
                    </div>`;
                return container;
            }
            
            function renderContentPanel() {
                const { subjectId, gradeId, lessonId } = selected;
                
                if (lessonId) {
                    renderQuestionDetails(lessonId);
                } else if (gradeId) {
                    renderLessonDetails(gradeId);
                } else if (subjectId) {
                    renderSubjectDetails(subjectId);
                } else {
                    contentPanel.innerHTML = `<div class="text-center text-slate-500 h-full flex flex-col justify-center items-center"><i data-feather="sidebar" class="w-16 h-16 text-slate-400"></i><p class="mt-4">Chọn một mục để xem chi tiết.</p></div>`;
                    feather.replace();
                }
            }

             function renderSubjectDetails(subjectId) {
                const subject = allData.subjects.find(s => s.id === subjectId);
                if (!subject) return;
                contentPanel.innerHTML = `<div class="p-8">
                    <h2 class="text-2xl font-bold text-slate-800">${subject.name}</h2>
                    <p class="mt-2 text-slate-500">Tổng quan về môn học. Vui lòng mở rộng môn học và chọn một khối lớp bên trái để thêm và quản lý các bài học.</p>
                </div>`;
            }

            function renderLessonDetails(gradeId) {
                const [subjectId, grade] = gradeId.split('_');
                const subject = allData.subjects.find(s => s.id === subjectId);
                if (!subject) return;

                let contentHTML = `<div class="p-6 border-b">
                    <div class="flex justify-between items-center">
                        <div>
                            <h2 class="text-2xl font-bold text-slate-800">Lớp ${grade} - ${subject.name}</h2>
                            <p class="text-slate-500">Danh sách bài học trong khối lớp này.</p>
                        </div>
                        <button data-action="add-lesson" data-grade="${grade}" data-subject-id="${subjectId}" class="cta-button text-white px-3 py-2 rounded-lg text-sm flex items-center"><i data-feather="plus" class="w-4 h-4 mr-2"></i>Thêm bài học</button>
                    </div>
                </div>
                <div id="lesson-list-container" class="p-4 space-y-1"></div>`;
                contentPanel.innerHTML = contentHTML;
                
                const listEl = document.getElementById('lesson-list-container');
                const lessons = allData.lessons.filter(l => l.subjectId === subjectId && l.grade == grade).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
                
                if(lessons.length > 0) {
                    lessons.forEach(lesson => {
                        const qCount = allData.questions.filter(q => q.lessonId === lesson.id).length;
                        const lessonItem = createTreeItem(lesson, 'lesson', qCount);
                        const treeItemDiv = lessonItem.querySelector('.tree-item');
                        treeItemDiv.insertAdjacentHTML('afterbegin', `<i data-feather="move" class="w-4 h-4 text-slate-400 cursor-grab handle"></i>`);
                        listEl.appendChild(lessonItem);
                    });
                } else {
                    listEl.innerHTML = `<p class="text-sm text-slate-400 text-center py-4">Chưa có bài học nào. Hãy nhấn nút "Thêm bài học" để bắt đầu.</p>`;
                }

                feather.replace();

                if(lessons.length > 0) {
                    sortableInstances[grade] = new Sortable(listEl, {
                        animation: 150,
                        ghostClass: 'ghost-class',
                        handle: '.handle',
                        onEnd: async (evt) => {
                            const batch = writeBatch(db);
                            Array.from(evt.to.children).forEach((item, index) => {
                                batch.update(doc(db, "lessons", item.dataset.id), { order: index });
                            });
                            await batch.commit();
                            showToast('Đã cập nhật thứ tự bài học!', 'success');
                        }
                    });
                }
            }
            
            function renderQuestionDetails(lessonId) {
                const lesson = allData.lessons.find(l => l.id === lessonId);
                if (!lesson) return;
                const questions = allData.questions.filter(q => q.lessonId === lessonId);
                
                let contentHTML = `<div class="p-6 border-b">
                    <h2 class="text-2xl font-bold text-slate-800">${cleanPrefix(lesson.name)}</h2>
                    <p class="text-slate-500">Lớp ${lesson.grade}</p>
                </div>
                <div class="p-6">
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-bold text-lg text-slate-700">Danh sách câu hỏi (${questions.length})</h3>
                        <a href="questions.html?lessonId=${lessonId}" class="cta-button text-white px-3 py-2 rounded-lg text-sm flex items-center"><i data-feather="edit" class="w-4 h-4 mr-2"></i>Quản lý chi tiết</a>
                    </div>
                    <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-2 border-t pt-4">`;

                if (questions.length > 0) {
                    questions.forEach((q, i) => {
                        contentHTML += `<div class="p-3 bg-slate-50 rounded-md prose prose-sm border border-slate-200"><span class="font-bold text-slate-700">Câu ${i+1}:</span> ${q.content}</div>`;
                    });
                } else {
                    contentHTML += `<p class="text-sm text-slate-400 text-center py-4">Chưa có câu hỏi nào trong bài học này.</p>`;
                }
                contentHTML += `</div></div>`;
                contentPanel.innerHTML = contentHTML;
                feather.replace();
            }

            function handleTreeClick(e) {
                const treeItemContainer = e.target.closest('.tree-item-container');
                if (!treeItemContainer) return;

                const id = treeItemContainer.dataset.id;
                const type = treeItemContainer.dataset.type;
                const actionBtn = e.target.closest('[data-action]');
                
                if (actionBtn) {
                    e.stopPropagation();
                    handleItemAction(actionBtn.dataset.action, type, id);
                    return;
                }
                
                // Toggle expand/collapse
                if (type !== 'lesson') {
                    if(expanded.has(id)) {
                        expanded.delete(id);
                    } else {
                        expanded.add(id);
                    }
                }
                
                // Set selected item
                if (type === 'subject') selected = { subjectId: id, gradeId: null, lessonId: null };
                else if (type === 'grade') selected = { subjectId: id.split('_')[0], gradeId: id, lessonId: null };
                else if (type === 'lesson') {
                     const lesson = allData.lessons.find(l => l.id === id);
                     if(lesson) selected = { subjectId: lesson.subjectId, gradeId: `${lesson.subjectId}_${lesson.grade}`, lessonId: id };
                }
                
                renderTree();
                renderContentPanel();
            }
             
            function handleContentPanelClick(e) {
                const addLessonBtn = e.target.closest('[data-action="add-lesson"]');
                if (addLessonBtn) {
                     showModal('add', 'lesson', {
                        grade: parseInt(addLessonBtn.dataset.grade),
                        subjectId: addLessonBtn.dataset.subjectId
                    });
                    return;
                }
                
                // Handle interactions within the list inside content panel
                const listItem = e.target.closest('.tree-item-container');
                const itemAction = e.target.closest('[data-action]');
                
                if(itemAction && listItem) {
                    e.stopPropagation();
                    handleItemAction(itemAction.dataset.action, listItem.dataset.type, listItem.dataset.id);
                } else if(listItem) {
                     selected.lessonId = listItem.dataset.id;
                     const lesson = allData.lessons.find(l => l.id === selected.lessonId);
                     if(lesson) selected.gradeId = `${lesson.subjectId}_${lesson.grade}`;
                     
                     renderTree(); // Update tree highlight
                     renderContentPanel(); // Show lesson details
                }
            }

            function handleItemAction(action, type, id) {
                const item = allData[type + 's'].find(i => i.id === id) || { id: id };
                if (action === 'edit') {
                    showModal('edit', type, item);
                } else if (action === 'delete') {
                    if (confirm(`Bạn có chắc chắn muốn xóa "${item.name}"? Hành động này không thể hoàn tác.`)) {
                        deleteItem(type, id);
                    }
                }
            }
            
            function showModal(mode, type, data={}) {
                 document.getElementById('edit-id').value = data.id || '';
                 document.getElementById('edit-type').value = type;
                 document.getElementById('modal-title').textContent = mode === 'add' ? `Thêm ${type === 'subject' ? 'Môn học' : 'Bài học'}` : `Sửa ${type === 'subject' ? 'Môn học' : 'Bài học'}`;
                 document.getElementById('item-name').value = data.name || '';
                 
                 // Store context for new items
                 if (type === 'lesson' && mode === 'add') {
                     document.getElementById('edit-context-id').value = JSON.stringify({ subjectId: data.subjectId, grade: data.grade });
                 } else {
                     document.getElementById('edit-context-id').value = '';
                 }
                 
                 editModal.classList.remove('hidden');
                 editModal.classList.add('flex');
                 document.getElementById('item-name').focus();
            }

            async function handleFormSubmit(e) {
                e.preventDefault();
                const id = document.getElementById('edit-id').value;
                const type = document.getElementById('edit-type').value;
                const name = document.getElementById('item-name').value.trim();
                const contextStr = document.getElementById('edit-context-id').value;
                
                if (!name) return;

                const payload = { name };
                const collectionName = type === 'lesson' ? 'lessons' : 'subjects';
                
                try {
                    if (id) {
                        await updateDoc(doc(db, collectionName, id), payload);
                        showToast('Cập nhật thành công!');
                    } else {
                        if (type === 'lesson') {
                            const context = JSON.parse(contextStr);
                            payload.subjectId = context.subjectId;
                            payload.grade = context.grade;
                            
                            // Get max order
                            const q = query(collection(db, 'lessons'), where('subjectId', '==', context.subjectId), where('grade', '==', context.grade));
                            const snapshot = await getDocs(q);
                            payload.order = snapshot.size;
                        }
                        
                        await addDoc(collection(db, collectionName), payload);
                        showToast('Thêm mới thành công!');
                    }
                    editModal.classList.add('hidden');
                    editModal.classList.remove('flex');
                } catch(error) { 
                    console.error(error);
                    showToast('Lỗi: ' + error.message, 'error'); 
                }
            }

             async function deleteItem(type, id) {
                const batch = writeBatch(db);
                batch.delete(doc(db, `${type}s`, id));
                
                if (type === 'subject') {
                    const lessonsToDelete = allData.lessons.filter(l => l.subjectId === id);
                    for (const lesson of lessonsToDelete) {
                        batch.delete(doc(db, 'lessons', lesson.id));
                        const questionsToDelete = allData.questions.filter(q => q.lessonId === lesson.id);
                        questionsToDelete.forEach(q => batch.delete(doc(db, 'questions', q.id)));
                    }
                } else if (type === 'lesson') {
                     const questionsToDelete = allData.questions.filter(q => q.lessonId === id);
                     questionsToDelete.forEach(q => batch.delete(doc(db, 'questions', q.id)));
                }
                
                try {
                    await batch.commit();
                    showToast('Xóa thành công!');
                    
                    if(selected.subjectId === id) selected = { subjectId: null, gradeId: null, lessonId: null };
                    if(selected.lessonId === id) selected.lessonId = null;
                    
                    renderContentPanel();
                } catch (error) {
                    showToast('Lỗi khi xóa: ' + error.message, 'error');
                }
            }
            
            feather.replace();
        });