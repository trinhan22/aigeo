import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            // DOM Elements
            const userNameEl = document.getElementById('user-name');
            const userAvatarEl = document.getElementById('user-avatar');
            const toastContainer = document.getElementById('toast-container');
            // Cập nhật containers và addBtns
            const containers = {
                groq: document.getElementById('groq-keys-container'), // Đổi từ openrouter
                imgbb: document.getElementById('imgbb-keys-container')
            };
            const addBtns = {
                groq: document.getElementById('add-groq-key-btn'), // Đổi từ add-openrouter-key-btn
                imgbb: document.getElementById('add-imgbb-key-btn')
            };
            const saveKeysBtn = document.getElementById('save-keys-btn');
            const apiKeyDocRef = doc(db, "system_settings", "api_keys");
            const groqLoader = document.getElementById('groq-loader'); // Đổi tên biến
            const imgbbLoader = document.getElementById('imgbb-loader');


            // Show toast message utility
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

            // Auth state listener
            onAuthStateChanged(auth, async (user) => {
                 if (user) {
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists() && docSnap.data().role === 'admin') {
                        const userData = docSnap.data();
                        userNameEl.textContent = userData.name || 'Admin';
                        const nameInitial = (userData.name || 'A').charAt(0).toUpperCase();
                        userAvatarEl.src = `https://placehold.co/40x40/DC2626/FFFFFF?text=${nameInitial}`;
                        initApiKeysLogic();
                    } else { window.location.href = '../auth.html'; }
                 } else { window.location.href = '../auth.html'; }
            });

            async function initApiKeysLogic() {
                try {
                    const docSnap = await getDoc(apiKeyDocRef);
                    
                    if (groqLoader) groqLoader.remove(); // Đổi tên
                    if (imgbbLoader) imgbbLoader.remove();

                    Object.values(containers).forEach(c => c.innerHTML = '');
                    const data = docSnap.exists() ? docSnap.data() : {};
                    
                    // Render Groq keys thay vì OpenRouter
                    if ((data.groq_keys || []).length > 0) {
                        (data.groq_keys || []).forEach(key => renderKeyInput(key, 'groq'));
                    } else {
                        renderKeyInput('', 'groq');
                    }

                    if ((data.imgbb_keys || []).length > 0) {
                        (data.imgbb_keys || []).forEach(key => renderKeyInput(key, 'imgbb'));
                    } else {
                        renderKeyInput('', 'imgbb');
                    }
                    
                    feather.replace();
                } catch (error) { 
                    console.error("Error fetching API keys:", error);
                    showToast("Lỗi tải API keys.", "error");
                    // Sửa lại tên biến ở đây cho đúng với khai báo groqLoader mới của bạn
                    if(groqLoader) groqLoader.innerHTML = '<p class="text-red-500 text-sm">Lỗi tải dữ liệu.</p>';
                    if(imgbbLoader) imgbbLoader.innerHTML = '<p class="text-red-500 text-sm">Lỗi tải dữ liệu.</p>';
                }
            }
            
            function renderKeyInput(keyValue = '', type) {
                const container = containers[type];
                const inputWrapper = document.createElement('div');
                inputWrapper.className = 'key-item relative flex items-center space-x-3';
                inputWrapper.innerHTML = `
                    <i data-feather="key" class="text-slate-400 flex-shrink-0"></i>
                    <div class="relative w-full">
                        <input type="password" class="api-key-input" data-key-type="${type}" placeholder="Dán khóa API của bạn vào đây" value="${keyValue}">
                        <div class="absolute inset-y-0 right-0 pr-3 flex items-center">
                            <button type="button" class="toggle-visibility-btn p-1 rounded-full text-gray-400 hover:text-gray-600">
                                <i data-feather="eye" class="w-5 h-5"></i>
                            </button>
                        </div>
                    </div>
                    <button type="button" class="delete-key-btn text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50">
                        <i data-feather="trash-2" class="w-5 h-5"></i>
                    </button>
                `;
                container.appendChild(inputWrapper);
            }

            // Cập nhật logic để thêm key: chỉ thêm nếu key cuối cùng đã được điền
            Object.keys(addBtns).forEach(type => {
                addBtns[type].addEventListener('click', () => {
                    const inputs = containers[type].querySelectorAll('input');
                    const lastInput = inputs[inputs.length - 1];

                    if (inputs.length === 0 || lastInput.value.trim() !== '') {
                        renderKeyInput('', type);
                        feather.replace();
                    } else {
                        showToast("Vui lòng điền key hiện tại trước khi thêm key mới.", "error");
                    }
                });
            });
            
            Object.values(containers).forEach(container => {
                container.addEventListener('click', (e) => {
                    const toggleBtn = e.target.closest('.toggle-visibility-btn');
                    const deleteBtn = e.target.closest('.delete-key-btn');
                    if (toggleBtn) {
                        const icon = toggleBtn.querySelector('i');
                        const input = toggleBtn.closest('.relative').querySelector('input');
                        if (input.type === 'password') {
                            input.type = 'text';
                            icon.setAttribute('data-feather', 'eye-off');
                        } else {
                            input.type = 'password';
                            icon.setAttribute('data-feather', 'eye');
                        }
                        feather.replace();
                    }
                    if (deleteBtn) {
                        const itemToRemove = deleteBtn.closest('.key-item');
                        const isOnlyItem = itemToRemove.parentElement.querySelectorAll('.key-item').length === 1;
                        
                        if (isOnlyItem && itemToRemove.querySelector('input').value.trim() !== '') {
                            // Nếu chỉ còn 1 item và nó đã có giá trị, xóa nó và thêm lại 1 item trống
                            itemToRemove.remove();
                            renderKeyInput('', itemToRemove.querySelector('input').dataset.keyType);
                        } else if (isOnlyItem) {
                            // Nếu là item trống duy nhất, không làm gì cả
                             showToast("Không thể xóa item trống cuối cùng.", "error");
                        } else {
                            itemToRemove.remove();
                        }
                        feather.replace();
                    }
                });
            });

            saveKeysBtn.addEventListener('click', async () => {
                // 1. Thu thập dữ liệu từ các input (Dùng groq_keys)
                const keysToSave = {
                    groq_keys: Array.from(containers.groq.querySelectorAll('input')).map(i => i.value.trim()).filter(Boolean),
                    imgbb_keys: Array.from(containers.imgbb.querySelectorAll('input')).map(i => i.value.trim()).filter(Boolean)
                };
                
                // 2. Xóa các input trống trên giao diện trước khi lưu cho gọn
                Object.keys(containers).forEach(type => {
                    const inputs = containers[type].querySelectorAll('input');
                    if (inputs.length > 1) { // Chỉ xóa nếu có nhiều hơn 1 ô
                        inputs.forEach(input => {
                            if(input.value.trim() === '') input.closest('.key-item').remove();
                        });
                    }
                });

                saveKeysBtn.disabled = true;
                saveKeysBtn.textContent = 'Đang lưu...';

                try {
                    // 3. Lưu vào Firestore
                    await setDoc(apiKeyDocRef, keysToSave);
                    showToast('Lưu API keys thành công!', 'success');
                }  catch (error) {
                    console.error("Error saving API keys:", error);
                    showToast('Lỗi khi lưu API keys.', 'error');
                } finally {
                    saveKeysBtn.disabled = false;
                    saveKeysBtn.textContent = 'Lưu tất cả thay đổi';

                    // 4. FIX LỖI NÀY: Đảm bảo có ít nhất một input trống sau khi lưu (Dùng groq)
                    if (keysToSave.groq_keys.length === 0) renderKeyInput('', 'groq');
                    if (keysToSave.imgbb_keys.length === 0) renderKeyInput('', 'imgbb');
                    
                    feather.replace();
                }
            });
            
            document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
        });