import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, setDoc, serverTimestamp, updateDoc, deleteField, addDoc, orderBy, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
                
        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            // [LOGIC GIỮ NGUYÊN TỪ FILE CỦA BẠN]
            let currentUser = null, chatHistory = [];
            let groqKeys = [];
            let currentKeyIndex = 0;
            let userName = 'Học sinh', nameInitial = 'S';
            
            const getNextApiKey = () => {
                if (groqKeys.length === 0) return null;
                const key = groqKeys[currentKeyIndex];
                currentKeyIndex = (currentKeyIndex + 1) % groqKeys.length;
                sessionStorage.setItem('orKeyIndex', currentKeyIndex.toString());
                return key;
            };

            const userNameEl = document.getElementById('user-name');
            const userAvatarEl = document.getElementById('user-avatar');
            const chatMessages = document.getElementById('chat-messages');
            const chatInput = document.getElementById('chat-input');
            const sendBtn = document.getElementById('send-btn');
            const typingIndicator = document.getElementById('typing-indicator-container');
            const clearChatBtn = document.getElementById('clear-chat-btn');
        
            // --- THÊM HÀM NÀY VÀO TRƯỚC onAuthStateChanged ---
            function showToast(msg, type = 'success') {
                const toastContainer = document.getElementById('toast-container');
                if(!toastContainer) return;
                const toast = document.createElement('div');
                toast.className = `toast show ${type === 'success' ? 'bg-slate-900' : 'bg-red-500'} text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm mb-3`;
                toast.textContent = msg;
                toastContainer.appendChild(toast);
                setTimeout(() => toast.remove(), 3000);
            }

            onAuthStateChanged(auth, async (user) => {
                if (!user) { window.location.href = '../auth.html'; return; }
                currentUser = user;
                const userDocSnap = await getDoc(doc(db, "users", user.uid));
                
                if (userDocSnap.exists() && userDocSnap.data().role === 'student') {
                    const userData = userDocSnap.data();
                    userName = userData.name || 'Học sinh';
                    // ... (các dòng set UI cũ giữ nguyên) ...
                    userNameEl.textContent = userName;
                    userAvatarEl.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=0D9488&color=fff&bold=true`;
                    
                    await loadApiKeys();
                    await loadChatHistory();
                    setupEventListeners();
                    
                    // --- FEEDBACK LOGIC (ĐÃ FIX LỖI) ---
                    const feedbackModal = document.getElementById('feedback-modal');
                    const viewFeedbackModal = document.getElementById('view-feedback-modal');
                    const feedbackForm = document.getElementById('feedback-form');

                    document.getElementById('feedback-btn').onclick = () => feedbackModal.classList.replace('hidden', 'flex');
                    document.getElementById('feedback-cancel-btn').onclick = () => feedbackModal.classList.replace('flex', 'hidden');

                    feedbackForm.onsubmit = async (e) => {
                        e.preventDefault();
                        const btn = document.getElementById('feedback-submit-btn');
                        btn.disabled = true; btn.textContent = "Đang gửi...";
                        try {
                            await addDoc(collection(db, "feedback"), {
                                content: document.getElementById('feedback-content').value,
                                userId: currentUser.uid,
                                userName: userData.name || "Học sinh",
                                createdAt: serverTimestamp(),
                                status: 'new'
                            });
                            feedbackModal.classList.replace('flex', 'hidden');
                            feedbackForm.reset();
                            showToast("Gửi góp ý thành công!");
                        } catch (e) { 
                            console.error(e);
                            showToast("Lỗi gửi góp ý", "error"); 
                        } finally { 
                            btn.disabled = false; btn.textContent = "Gửi ngay"; 
                        }
                    };

                    document.getElementById('view-feedback-btn').onclick = async () => {
                        const container = document.getElementById('feedback-list-container');
                        container.innerHTML = '<div class="text-center py-10 animate-pulse font-bold text-slate-300">Đang tải...</div>';
                        viewFeedbackModal.classList.replace('hidden', 'flex');
                        try {
                            // Dùng các hàm đã import: query, collection, where, orderBy, getDocs
                            const q = query(collection(db, "feedback"), where("userId", "==", currentUser.uid), orderBy("createdAt", "desc"));
                            const snap = await getDocs(q);
                            
                            if (snap.empty) {
                                container.innerHTML = '<p class="text-center py-10 font-bold text-slate-400">Chưa có góp ý nào.</p>';
                            } else {
                                container.innerHTML = snap.docs.map(doc => {
                                    const f = doc.data();
                                    return `
                                        <div class="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-left mb-4">
                                            <span class="text-[10px] font-black text-slate-400 uppercase">${f.createdAt?.toDate().toLocaleDateString('vi-VN')}</span>
                                            <p class="text-sm font-bold text-slate-700 mt-1">${f.content}</p>
                                            ${f.reply ? `<div class="mt-3 p-3 bg-teal-50 border-l-4 border-teal-500 rounded-r-xl"><p class="text-[10px] font-black text-teal-600 uppercase">Admin:</p><p class="text-sm text-teal-800">${f.reply}</p></div>` : ''}
                                        </div>`;
                                }).join('');
                            }
                        } catch (e) { 
                            console.error(e);
                            container.innerHTML = '<p class="text-red-500 text-center font-bold">Lỗi tải dữ liệu. Vui lòng thử lại sau.</p>'; 
                        }
                    };

                    document.getElementById('view-feedback-close-btn').onclick = () => viewFeedbackModal.classList.replace('flex', 'hidden');

                    if (chatHistory.length === 0) {
                        addMessage("Chào bạn, tôi là trợ lý AI của AIGEO. Tôi có thể giúp gì cho bạn về Địa lý?", "assistant");
                    }
                }
            });
            
            async function loadApiKeys() {
                const apiKeySnap = await getDoc(doc(db, "system_settings", "api_keys"));
                if (apiKeySnap.exists() && apiKeySnap.data().groq_keys) {
                    groqKeys = apiKeySnap.data().groq_keys;
                    currentKeyIndex = parseInt(sessionStorage.getItem('orKeyIndex') || '0', 10) % groqKeys.length;
                }
            }

            async function loadChatHistory() {
                const chatSessionRef = doc(db, "chat_sessions", currentUser.uid);
                const chatDoc = await getDoc(chatSessionRef);
                if (chatDoc.exists()) {
                    chatHistory = chatDoc.data().history || [];
                    chatMessages.innerHTML = '';
                    chatHistory.forEach(msg => addMessage(msg.content, msg.role, true));
                }
                setTimeout(() => chatMessages.scrollTop = chatMessages.scrollHeight, 100);
            }

            async function saveChatHistory(newHistory) {
                const chatSessionRef = doc(db, "chat_sessions", currentUser.uid);
                await setDoc(chatSessionRef, { history: newHistory, lastUpdated: serverTimestamp() }, { merge: true });
                chatHistory = newHistory;
            }
            
            function renderContent(element, text) {
                const safeText = text || "";
                const rawHtml = marked.parse(safeText);
                element.innerHTML = rawHtml;
                renderMathInElement(element, { 
                    delimiters: [
                        {left: "$$", right: "$$", display: true}, 
                        {left: "$", right: "$", display: false}
                    ]
                });
            }

            // [HÀM ADD MESSAGE ĐÃ ĐƯỢC TỐI ƯU GIAO DIỆN MỚI]
            function addMessage(text, role, isLoading = false) {
                const isUser = role === 'user';
                const messageWrapper = document.createElement('div');
                messageWrapper.className = `flex items-start gap-4 message-wrapper ${isUser ? 'user justify-end' : 'bot'}`;
                const avatar = document.createElement('div');
                avatar.className = 'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white';
                const contentWrapper = document.createElement('div');
                contentWrapper.className = 'flex-1 max-w-xl';
                const bubble = document.createElement('div');
                bubble.className = `prose prose-sm message-content`;
                
                renderContent(bubble, text);
                contentWrapper.appendChild(bubble);

                if (isUser) {
                    avatar.textContent = nameInitial;
                    avatar.classList.add('bg-slate-500');
                    messageWrapper.appendChild(contentWrapper);
                    messageWrapper.appendChild(avatar);
                } else {
                    avatar.innerHTML = `<i data-feather="cpu" class="w-6 h-6 text-white"></i>`;
                    avatar.classList.add('bg-gradient-to-br', 'from-teal-400', 'to-emerald-500');
                    messageWrapper.appendChild(avatar);
                    messageWrapper.appendChild(contentWrapper);
                }
                chatMessages.appendChild(messageWrapper);
                if(!isLoading) chatMessages.scrollTop = chatMessages.scrollHeight;
                feather.replace();
                return bubble;
            }
            
            function setChatInputDisabled(isDisabled) {
                chatInput.disabled = isDisabled;
                sendBtn.disabled = isDisabled;
            }

            async function handleSendMessage() {
                const userInput = chatInput.value.trim();
                if (!userInput) return;
                
                setChatInputDisabled(true);
                typingIndicator.classList.remove('hidden');
                typingIndicator.classList.add('flex');
                
                try {
                    const newHistory = [...chatHistory, { role: 'user', content: userInput }];
                    addMessage(userInput, "user");
                    chatInput.value = '';
                    chatMessages.scrollTop = chatMessages.scrollHeight;

                    const aiResponse = await getGroqResponse(newHistory);
                    
                    const finalHistory = [...newHistory, { role: 'assistant', content: aiResponse }];
                    addMessage(aiResponse, 'assistant');
                    await saveChatHistory(finalHistory);
                    
                } catch (error) {
                    addMessage(`Rất tiếc, đã có lỗi xảy ra: ${error.message}`, 'assistant');
                } finally {
                    setChatInputDisabled(false);
                    typingIndicator.classList.add('hidden');
                    chatInput.focus();
                }
            }
            
            async function getGroqResponse(history) {
                const MAX_RETRIES = 3;
                let lastError = null;

                // Thiết lập Prompt hệ thống cho Học sinh
                const messagesToSend = [
                    { 
                        role: "system", 
                        content: "Bạn là một trợ lý AI chuyên gia về Địa lý cho AIGEO. Nhiệm vụ duy nhất của bạn là trả lời các câu hỏi liên quan đến Địa lý. Nếu học sinh hỏi về chủ đề khác (như toán, văn, lịch sử, hay các chủ đề chung), hãy từ chối một cách lịch sự. Ví dụ: 'Xin lỗi, tôi chỉ có thể hỗ trợ các câu hỏi liên quan đến Địa lý.' Luôn trả lời bằng tiếng Việt và sử dụng KaTeX cho công thức toán nếu cần." 
                    },
                    ...history 
                ];

                for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                    const apiKey = getNextApiKey();
                    if (!apiKey) break;

                    // Endpoint chính thức của Groq
                    const API_URL = "https://api.groq.com/openai/v1/chat/completions";
                    
                    try {
                        const response = await fetch(API_URL, {
                            method: 'POST',
                            headers: {
                                'Authorization': `Bearer ${apiKey}`,
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                // Model Llama 3.3 70B cực mạnh của Groq
                                model: "llama-3.3-70b-versatile",
                                messages: messagesToSend,
                                temperature: 0.6,
                                max_tokens: 4096 // Tăng giới hạn phản hồi cho học sinh
                            })
                        });

                        if (response.ok) {
                            const result = await response.json();
                            return result.choices[0]?.message?.content.trim();
                        }

                        // Xử lý lỗi Rate Limit (429) hoặc Server (5xx)
                        if (response.status === 429 || response.status >= 500) {
                            if (attempt < MAX_RETRIES) {
                                await new Promise(resolve => setTimeout(resolve, 2000)); // Đợi 2s thử lại key khác
                                continue;
                            }
                        }
                        
                        const errorData = await response.json();
                        throw new Error(errorData.error?.message || "Lỗi API");

                    } catch (error) {
                        lastError = error;
                        if (attempt < MAX_RETRIES) await new Promise(res => setTimeout(res, 2000));
                    }
                }
                throw lastError || new Error("AI không phản hồi.");
            }
            
            async function handleClearChat() {
                if(confirm("Bạn có chắc chắn muốn xóa toàn bộ lịch sử trò chuyện này không? Hành động này không thể hoàn tác.")) {
                    try {
                        setChatInputDisabled(true);
                        const chatSessionRef = doc(db, "chat_sessions", currentUser.uid);
                        await updateDoc(chatSessionRef, { history: deleteField() }); // Xoa truong history
                        
                        chatHistory = []; // Reset local state
                        chatMessages.innerHTML = ''; // Clear display
                        
                        // Gui tin nhan chao mung moi
                        addMessage("Chào bạn, tôi là trợ lý AI của AIGEO. Tôi chỉ có thể trả lời các câu hỏi liên quan đến Địa lý. Tôi có thể giúp gì cho bạn?", "assistant");
                        
                        setChatInputDisabled(false);
                    } catch (error) {
                        alert("Lỗi khi xóa lịch sử trò chuyện: " + error.message);
                        setChatInputDisabled(false);
                    }
                }
            }
            
            function setupEventListeners() {
                sendBtn.onclick = handleSendMessage;
                clearChatBtn.onclick = handleClearChat;
                
                chatInput.onkeydown = (e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !chatInput.disabled) {
                        e.preventDefault();
                        handleSendMessage();
                    }
                };
                chatInput.addEventListener('input', () => {
                    chatInput.style.height = 'auto';
                    let scrollHeight = chatInput.scrollHeight;
                    const maxHeight = 200; 
                    if (scrollHeight > maxHeight) {
                        chatInput.style.height = maxHeight + 'px';
                        chatInput.style.overflowY = 'auto';
                    } else {
                        chatInput.style.height = scrollHeight + 'px';
                        chatInput.style.overflowY = 'hidden';
                    }
                });
                document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
            }
            
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