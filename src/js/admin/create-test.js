import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, getDocs, addDoc, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        
        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);
            
            const testForm = document.getElementById('test-form');
            const testCancelBtn = document.getElementById('test-cancel-btn');
            const testSubmitBtn = document.getElementById('test-submit-btn');
            const toastContainer = document.getElementById('toast-container');

            let allSubjects = [];
            let currentUser = null;
            let currentEditingTestId = null;

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
            
            function populateSelect(selectElement, data, placeholder) {
                selectElement.innerHTML = `<option value="">${placeholder}</option>`;
                data.forEach(item => {
                    const option = document.createElement('option');
                    option.value = item.id;
                    option.textContent = item.name;
                    selectElement.appendChild(option);
                });
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
                try {
                    const subjectsSnap = await getDocs(collection(db, "subjects"));
                    allSubjects = subjectsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    populateSelect(document.getElementById('test-subject'), allSubjects, "Chọn môn học");

                    const urlParams = new URLSearchParams(window.location.search);
                    const testId = urlParams.get('id');
                    currentEditingTestId = testId;

                    if (testId) {
                        document.getElementById('page-title').textContent = 'Chỉnh sửa Đề thi - Bước 1';
                        document.getElementById('test-submit-btn').textContent = 'Lưu & Tiếp tục';
                        await loadTestData(testId);
                    }

                    setupEventListeners();
                } catch (error) {
                    console.error("Initialization Error: ", error);
                    showToast("Lỗi khi tải dữ liệu.", "error");
                }
            }

            async function loadTestData(testId) {
                const docRef = doc(db, "tests", testId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const testData = docSnap.data();
                    if (testData.authorId !== currentUser.uid) {
                        showToast("Bạn không có quyền chỉnh sửa đề thi này.", "error");
                        setTimeout(() => window.location.href = 'tests.html', 2000);
                        return;
                    }

                    document.getElementById('test-name').value = testData.name;
                    document.getElementById('test-type').value = testData.type;
                    document.getElementById('test-subject').value = testData.subjectId || '';
                } else {
                    showToast("Không tìm thấy đề thi.", "error");
                    setTimeout(() => window.location.href = 'tests.html', 2000);
                }
            }
            
            function setupEventListeners() {
                document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
                testForm.onsubmit = handleTestFormSubmit;
                testCancelBtn.onclick = () => { window.location.href = 'tests.html'; };
            }

            async function handleTestFormSubmit(e) {
                e.preventDefault();
                testSubmitBtn.disabled = true;

                const name = document.getElementById('test-name').value.trim();
                const subjectId = document.getElementById('test-subject').value;
                if (!name || !subjectId) {
                    showToast("Vui lòng nhập tên đề thi và chọn môn học.", "error");
                    testSubmitBtn.disabled = false;
                    return;
                }
                
                const payload = {
                    name,
                    subjectId,
                    type: document.getElementById('test-type').value,
                    authorId: currentUser.uid,
                    status: 'approved',
                    updatedAt: serverTimestamp()
                };

                try {
                    let testId;
                    if (currentEditingTestId) {
                        await updateDoc(doc(db, 'tests', currentEditingTestId), payload);
                        testId = currentEditingTestId;
                        showToast('Cập nhật thành công! Chuyển sang Bước 2...');
                    } else {
                        payload.createdAt = serverTimestamp();
                        payload.questions = [];
                        const docRef = await addDoc(collection(db, 'tests'), payload);
                        testId = docRef.id;
                        showToast('Tạo thành công! Chuyển sang Bước 2...');
                    }
                    setTimeout(() => window.location.href = `create-test-step2.html?id=${testId}`, 1500);
                } catch (error) {
                    console.error("Error saving test:", error);
                    showToast("Lỗi khi lưu đề thi.", "error");
                } finally {
                    testSubmitBtn.disabled = false;
                }
            }
            
            feather.replace();
        });