document.addEventListener('DOMContentLoaded', () => {
            feather.replace();

            // Khởi tạo client session nếu chưa có
            if (!localStorage.getItem('aigeo_client_session')) {
                const session = {
                    clientId: `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    chatCount: 0,
                    createdAt: new Date().toISOString()
                };
                localStorage.setItem('aigeo_client_session', JSON.stringify(session));
            }

            // Cập nhật số lượt chat còn lại
            const session = JSON.parse(localStorage.getItem('aigeo_client_session'));
            const chatLimitDisplay = document.getElementById('chat-limit-display');
            if (chatLimitDisplay && session) {
                const remaining = 50 - (session.chatCount || 0);
                chatLimitDisplay.textContent = remaining > 0 ? remaining : 0;
                chatLimitDisplay.classList.add(remaining < 10 ? 'text-red-500' : 'text-emerald-600');
            }
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