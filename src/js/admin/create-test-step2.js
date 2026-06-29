import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        
        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            const addQuestionForm = document.getElementById('add-question-form');
            const qContent = document.getElementById('q-content');
            const qType = document.getElementById('q-type');
            const answerFields = document.getElementById('answer-fields');
            const questionsListContainer = document.getElementById('questions-list-container');
            const addQBtn = document.getElementById('add-q-btn');
            const cancelEditBtn = document.getElementById('cancel-edit-btn');
            const toastContainer = document.getElementById('toast-container');
            const imageDropZone = document.getElementById('image-drop-zone');
            const imagePreviewContainer = document.getElementById('image-preview-container');
            const qImagePreview = document.getElementById('q-image-preview');
            const imagePlaceholder = document.getElementById('image-placeholder');
            const qImageInput = document.getElementById('q-image-input');
            const qImageRemoveBtn = document.getElementById('q-image-remove-btn');
            const previewTestBtn = document.getElementById('preview-test-btn');
            
            let currentUser = null;
            let currentTestId = null;
            let testData = null;
            let editingQuestionIndex = null;
            let currentImageUrl = '';
            let imgbbApiKeys = [];
            let currentImgbbKeyIndex = 0;

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
            
            function stripStyling(htmlString) {
                const cleanHtml = DOMPurify.sanitize(htmlString, {
                    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'u', 'em', 'strong', 'sub', 'sup', 'ol', 'ul', 'li', 'span', 'div', 'img'],
                    FORBID_ATTR: ['style', 'face', 'size', 'color', 'class']
                });
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = cleanHtml;
                tempDiv.querySelectorAll('font').forEach(fontEl => {
                    const spanEl = document.createElement('span');
                    while (fontEl.firstChild) {
                        spanEl.appendChild(fontEl.firstChild);
                    }
                    fontEl.parentNode.replaceChild(spanEl, fontEl);
                });
                return tempDiv.innerHTML;
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
                        initPage();
                    } else { window.location.href = '../auth.html'; }
                } else { window.location.href = '../auth.html'; }
            });

            async function initPage() {
                const urlParams = new URLSearchParams(window.location.search);
                currentTestId = urlParams.get('id');
                if (!currentTestId) {
                    window.location.href = 'tests.html';
                    return;
                }
                
                previewTestBtn.href = `test-view.html?testId=${currentTestId}`;
                
                try {
                    const apiKeysSnap = await getDoc(doc(db, "system_settings", "api_keys"));
                    if (apiKeysSnap.exists()) {
                        imgbbApiKeys = apiKeysSnap.data().imgbb_keys || [];
                    }
                } catch (error) {
                    console.error("Could not load API Keys", error);
                }

                await loadTestData();
                setupEventListeners();
                renderAnswerFields();
            }

            async function loadTestData() {
                const docRef = doc(db, "tests", currentTestId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists() && docSnap.data().authorId === currentUser.uid) {
                    testData = docSnap.data();
                    if(!testData.questions) testData.questions = [];
                    document.getElementById('test-name-subtitle').textContent = `Soạn câu hỏi cho: ${testData.name}`;
                    renderQuestionsList();
                } else {
                    showToast("Không tìm thấy đề thi hoặc bạn không có quyền truy cập.", "error");
                    setTimeout(() => window.location.href = 'tests.html', 2000);
                }
            }

            function setupEventListeners() {
                document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
                qType.addEventListener('change', renderAnswerFields);
                addQuestionForm.addEventListener('submit', handleAddOrUpdateQuestion);
                cancelEditBtn.addEventListener('click', resetForm);

                qImageInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) uploadImage(file);
                });
                qContent.addEventListener('paste', handlePaste); // Cập nhật sự kiện paste
                qImageRemoveBtn.addEventListener('click', removeImage);

                imageDropZone.addEventListener('dragover', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    imageDropZone.classList.add('border-teal-500');
                });
                imageDropZone.addEventListener('dragleave', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    imageDropZone.classList.remove('border-teal-500');
                });
                imageDropZone.addEventListener('drop', (e) => {
                    e.preventDefault(); e.stopPropagation();
                    imageDropZone.classList.remove('border-teal-500');
                    const file = e.dataTransfer.files[0];
                    if (file && file.type.startsWith('image/')) {
                        uploadImage(file);
                    }
                });

                questionsListContainer.addEventListener('click', e => {
                    const editBtn = e.target.closest('[data-action="edit"]');
                    const deleteBtn = e.target.closest('[data-action="delete"]');

                    if (editBtn) {
                        const index = parseInt(editBtn.dataset.index, 10);
                        populateFormForEdit(index);
                    }
                    if (deleteBtn) {
                        const index = parseInt(deleteBtn.dataset.index, 10);
                        deleteQuestion(index);
                    }
                });
            }

            function renderAnswerFields() {
                const type = qType.value;
                if (type === 'multiple_choice') {
                    answerFields.innerHTML = `
                        <label class="block text-sm font-medium text-gray-700 mb-1">Các lựa chọn</label>
                        <div class="grid grid-cols-2 gap-x-4 gap-y-2">
                            ${['A', 'B', 'C', 'D'].map(opt => `
                                <div class="flex items-center"><span class="font-semibold mr-2 text-sm">${opt}</span><input type="text" id="q-option-${opt.toLowerCase()}" class="form-input"></div>
                            `).join('')}
                        </div>
                         <div class="mt-2"><label for="q-mc-answer" class="text-sm font-medium text-gray-700">Đáp án đúng:</label><select id="q-mc-answer" class="form-input w-auto !mt-0 ml-2"><option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option></select></div>
                    `;
                } else if (type === 'true_false') {
                    let statementsHTML = '<label class="block text-sm font-medium text-gray-700 mb-1">Các mệnh đề</label><div class="space-y-3">';
                    for (let i = 0; i < 4; i++) {
                        statementsHTML += `
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-x-4 items-center">
                                <div class="md:col-span-2">
                                    <textarea id="q-tf-statement-${i}" placeholder="Nội dung mệnh đề ${i + 1}" class="form-input" rows="2"></textarea>
                                </div>
                                <div class="flex items-center space-x-4 mt-2 md:mt-0">
                                    <label class="flex items-center"><input type="radio" name="q-tf-answer-${i}" value="true" class="h-4 w-4 text-teal-600 border-gray-300"> <span class="ml-2">Đúng</span></label>
                                    <label class="flex items-center"><input type="radio" name="q-tf-answer-${i}" value="false" class="h-4 w-4 text-teal-600 border-gray-300"> <span class="ml-2">Sai</span></label>
                                </div>
                            </div>
                        `;
                    }
                    statementsHTML += '</div>';
                    answerFields.innerHTML = statementsHTML;
                } else if (type === 'short_answer') {
                    answerFields.innerHTML = `
                        <div>
                            <label for="q-sa-answer" class="block text-sm font-medium text-gray-700">Đáp án đúng</label>
                            <input type="text" id="q-sa-answer" class="form-input mt-1">
                        </div>
                    `;
                }
            }
            
            function renderQuestionsList() {
                questionsListContainer.innerHTML = '';
                if (!testData.questions || testData.questions.length === 0) {
                    questionsListContainer.innerHTML = '<p class="text-center text-slate-500">Đề thi này chưa có câu hỏi nào.</p>';
                    return;
                }

                testData.questions.forEach((q, index) => {
                    const questionDiv = document.createElement('div');
                    questionDiv.className = 'question-block';
                    let imageHTML = q.imageUrl ? `<img src="${q.imageUrl}" alt="Question image" class="mt-2 rounded-md max-w-sm">` : '';

                    questionDiv.innerHTML = `
                        <div class="flex justify-between items-start">
                             <div class="prose prose-sm max-w-none">
                                <b>Câu ${index + 1}:</b> ${q.content}
                                ${imageHTML}
                             </div>
                             <div class="flex space-x-1 flex-shrink-0 ml-4">
                                <button data-action="edit" data-index="${index}" class="p-1 text-slate-500 hover:text-blue-600 hover:bg-blue-100 rounded-md"><i data-feather="edit-2" class="w-4 h-4"></i></button>
                                <button data-action="delete" data-index="${index}" class="p-1 text-slate-500 hover:text-red-600 hover:bg-red-100 rounded-md"><i data-feather="trash-2" class="w-4 h-4"></i></button>
                             </div>
                        </div>
                    `;
                    questionsListContainer.appendChild(questionDiv);
                });
                feather.replace();
            }

            async function handleAddOrUpdateQuestion(e) {
                e.preventDefault();
                const rawContent = qContent.innerHTML.trim();
                const content = stripStyling(rawContent);

                if (!content) {
                    showToast("Vui lòng nhập nội dung câu hỏi.", "error");
                    return;
                }

                const newQuestion = {
                    content: content,
                    type: qType.value,
                    imageUrl: currentImageUrl,
                };

                if (newQuestion.type === 'multiple_choice') {
                    newQuestion.options = [...'abcd'].map(c => document.getElementById(`q-option-${c}`).value.trim());
                    newQuestion.correctAnswer = document.getElementById('q-mc-answer').value;
                } else if (newQuestion.type === 'true_false') {
                    newQuestion.statements = [];
                    for (let i = 0; i < 4; i++) {
                        const statementText = document.getElementById(`q-tf-statement-${i}`).value.trim();
                        if (statementText) {
                            const answerRadio = document.querySelector(`input[name="q-tf-answer-${i}"]:checked`);
                            newQuestion.statements.push({
                                statement: statementText,
                                answer: answerRadio ? (answerRadio.value === 'true') : null
                            });
                        }
                    }
                } else {
                    newQuestion.correctAnswer = document.getElementById('q-sa-answer').value.trim();
                }

                if (editingQuestionIndex !== null) {
                    testData.questions[editingQuestionIndex] = newQuestion;
                } else {
                    testData.questions.push(newQuestion);
                }
                
                await saveQuestionsToDb();
                resetForm();
            }

            function populateFormForEdit(index) {
                const q = testData.questions[index];
                if (!q) return;

                editingQuestionIndex = index;
                document.getElementById('form-title').textContent = `Chỉnh sửa Câu ${index + 1}`;
                addQBtn.textContent = "Cập nhật câu hỏi";
                cancelEditBtn.classList.remove('hidden');
                
                qContent.innerHTML = q.content;
                qType.value = q.type;
                renderAnswerFields();

                if (q.imageUrl) {
                    currentImageUrl = q.imageUrl;
                    qImagePreview.src = q.imageUrl;
                    imagePreviewContainer.classList.remove('hidden');
                    imagePlaceholder.classList.add('hidden');
                } else {
                    removeImage();
                }

                if (q.type === 'multiple_choice') {
                    q.options.forEach((opt, i) => {
                        const char = String.fromCharCode(97 + i);
                        document.getElementById(`q-option-${char}`).value = opt;
                    });
                    document.getElementById('q-mc-answer').value = q.correctAnswer;
                } else if (q.type === 'true_false') {
                    if (q.statements && Array.isArray(q.statements)) {
                        q.statements.forEach((stmt, i) => {
                            const statementInput = document.getElementById(`q-tf-statement-${i}`);
                            if (statementInput) {
                                statementInput.value = stmt.statement;
                            }
                            if (stmt.answer !== null) {
                                const radio = document.querySelector(`input[name="q-tf-answer-${i}"][value="${stmt.answer}"]`);
                                if (radio) radio.checked = true;
                            }
                        });
                    }
                } else {
                    document.getElementById('q-sa-answer').value = q.correctAnswer;
                }
                addQuestionForm.scrollIntoView({ behavior: 'smooth' });
            }
            
            async function deleteQuestion(index) {
                if (confirm(`Bạn có chắc muốn xóa Câu ${index + 1}?`)) {
                    testData.questions.splice(index, 1);
                    await saveQuestionsToDb();
                }
            }

            function resetForm() {
                editingQuestionIndex = null;
                addQuestionForm.reset();
                qContent.innerHTML = '';
                removeImage();
                document.getElementById('form-title').textContent = 'Thêm câu hỏi mới';
                addQBtn.textContent = "Thêm câu hỏi";
                cancelEditBtn.classList.add('hidden');
                renderAnswerFields();
            }
            
            function removeImage() {
                currentImageUrl = '';
                qImagePreview.src = '';
                imagePreviewContainer.classList.add('hidden');
                imagePlaceholder.classList.remove('hidden');
                if (qImageInput) qImageInput.value = '';
            }

            async function saveQuestionsToDb() {
                const docRef = doc(db, "tests", currentTestId);
                try {
                    await updateDoc(docRef, { questions: testData.questions });
                    showToast("Cập nhật danh sách câu hỏi thành công!", "success");
                    renderQuestionsList();
                } catch (error) {
                    showToast("Lỗi khi lưu câu hỏi.", "error");
                    console.error("Error saving questions:", error);
                }
            }

            function handlePaste(e) {
                e.preventDefault();
                const clipboardData = e.clipboardData || window.clipboardData;
                const items = clipboardData.items;
                let imageFound = false;
                for (const item of items) {
                    if (item.kind === 'file' && item.type.startsWith('image/')) {
                        const file = item.getAsFile();
                        uploadImage(file);
                        imageFound = true;
                        break; 
                    }
                }

                if (!imageFound) {
                    const pastedData = clipboardData.getData('text/html') || clipboardData.getData('text/plain');
                    const cleanedData = stripStyling(pastedData);
                    document.execCommand('insertHTML', false, cleanedData);
                }
            }
            
            function getNextImgbbApiKey() {
                if (imgbbApiKeys.length === 0) return null;
                const key = imgbbApiKeys[currentImgbbKeyIndex];
                currentImgbbKeyIndex = (currentImgbbKeyIndex + 1) % imgbbApiKeys.length;
                return key;
            }
            
            async function uploadImage(file) {
                 if (!file) return;
                const apiKey = getNextImgbbApiKey();
                if (!apiKey) {
                    showToast("Chưa cấu hình ImgBB API Key tại trang Quản lý API Key.", "error");
                    return;
                }

                showToast("Đang tải ảnh lên...");
                const formData = new FormData();
                formData.append('image', file);

                try {
                    const response = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error?.message || 'Tải ảnh lên thất bại.');
                    }
                    
                    const result = await response.json();
                    
                    if (result.data && result.data.url) {
                        currentImageUrl = result.data.url;
                        qImagePreview.src = currentImageUrl;
                        imagePreviewContainer.classList.remove('hidden');
                        imagePlaceholder.classList.add('hidden');
                        
                        const qContent = document.getElementById('q-content');
                        qContent.innerHTML += `<img src="${currentImageUrl}" alt="Uploaded image">`;

                        showToast("Tải ảnh thành công!", "success");
                    } else {
                        throw new Error('Phản hồi từ ImgBB không hợp lệ.');
                    }

                } catch (error) {
                    showToast(error.message, "error");
                    console.error("ImgBB Upload failed:", error);
                }
            }

            feather.replace();
        });