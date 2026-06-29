import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        
        document.addEventListener('DOMContentLoaded', async () => {
            const app = initializeApp(firebaseConfig);
            const db = getFirestore(app);

            const CHAT_LIMIT = 50;
            const chatMessages = document.getElementById('chat-messages');
            const chatInput = document.getElementById('chat-input');
            const sendBtn = document.getElementById('send-btn');
            const typingIndicator = document.getElementById('typing-indicator');
            const limitOverlay = document.getElementById('limit-overlay');
            
            let session = JSON.parse(localStorage.getItem('aigeo_client_session')) || { chatCount: 0 };
            let groqKeys = [];
            let chatHistory = [];

            feather.replace();

            // Tự động giãn textarea
            chatInput.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
            });

            function updateChatLimit() {
                const remaining = CHAT_LIMIT - (session.chatCount || 0);
                if (remaining <= 0) {
                    limitOverlay.style.display = 'flex';
                }
            }

            async function loadApiKeys() {
                const apiKeySnap = await getDoc(doc(db, "system_settings", "api_keys"));
                if (apiKeySnap.exists()) {
                    groqKeys = apiKeySnap.data().groq_keys || []; // Lấy mảng groq_keys
                }
            }

            // Cập nhật hàm lấy Key luân phiên từ mảng groqKeys
            function getNextApiKey() {
                if (groqKeys.length === 0) return null;
                let idx = parseInt(sessionStorage.getItem('orKeyIndex') || '0');
                sessionStorage.setItem('orKeyIndex', (idx + 1) % groqKeys.length);
                return groqKeys[idx];
            }

            function addMessage(text, role) {
                const isUser = role === 'user';
                const div = document.createElement('div');
                div.className = `message-wrapper ${isUser ? 'user' : 'bot'}`;
                
                div.innerHTML = `
                    <div class="avatar shadow-sm">
                        <i class="fas ${isUser ? 'fa-user' : 'fa-robot'}"></i>
                    </div>
                    <div class="message-content prose">
                        ${marked.parse(text)}
                    </div>
                `;
                
                chatMessages.appendChild(div);
                renderMathInElement(div);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }

            async function handleSend() {
                const text = chatInput.value.trim();
                if (!text || (session.chatCount >= CHAT_LIMIT)) return;

                chatInput.value = '';
                chatInput.style.height = 'auto';
                chatInput.disabled = true;
                sendBtn.disabled = true;
                typingIndicator.classList.remove('hidden');

                addMessage(text, 'user');
                chatHistory.push({ role: 'user', content: text });

                try {
                    const apiKey = getNextApiKey();
                    if (!apiKey) throw new Error("Chưa có API Key");

                    // THAY ĐỔI: Endpoint của Groq
                    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${apiKey}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            // THAY ĐỔI: Tên Model Llama 3.3 70B
                            model: "llama-3.3-70b-versatile",
                            messages: [
                                { 
                                    role: "system", 
                                    content: "Bạn là một trợ lý AI chuyên gia về Địa lý cho AIGEO. Trả lời câu hỏi của học sinh một cách ngắn gọn, chính xác, và đi thẳng vào vấn đề. Tuyệt đối không lặp lại câu hỏi hoặc dài dòng không cần thiết. Luôn trả lời bằng tiếng Việt. Sử dụng KaTeX cho công thức toán." 
                                },
                                ...chatHistory
                            ],
                            // Cấu hình tối ưu cho Groq
                            temperature: 0.7,
                            max_tokens: 2048
                        })
                    });

                    if (!response.ok) throw new Error("API Error");

                    const data = await response.json();
                    const aiText = data.choices[0].message.content;
                    
                    addMessage(aiText, 'assistant');
                    chatHistory.push({ role: 'assistant', content: aiText });
                    
                    session.chatCount++;
                    localStorage.setItem('aigeo_client_session', JSON.stringify(session));
                    updateChatLimit();

                } catch (e) {
                    console.error(e);
                    addMessage("Rất tiếc, trợ lý đang bận xử lý dữ liệu. Bạn hãy thử lại sau nhé!", "assistant");
                } finally {
                    typingIndicator.classList.add('hidden');
                    chatInput.disabled = false;
                    sendBtn.disabled = false;
                    chatInput.focus();
                }
            }

            sendBtn.onclick = handleSend;
            chatInput.onkeydown = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                }
            };

            updateChatLimit();
            await loadApiKeys();
            addMessage("Chào bạn! Tôi là trợ lý AI của AIGEO. Bạn cần tôi giải đáp thắc mắc gì về Địa lý hôm nay không?", "assistant");
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