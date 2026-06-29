import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, onSnapshot, query, where, updateDoc, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            const userNameEl = document.getElementById('user-name');
            const userAvatarEl = document.getElementById('user-avatar');
            const tabsContainer = document.getElementById('tabs-container');
            const feedbackListContainer = document.getElementById('feedback-list-container');
            const replyModal = document.getElementById('reply-modal');
            const replyForm = document.getElementById('reply-form');
            const replyCancelBtn = document.getElementById('reply-cancel-btn');
            const originalFeedbackContent = document.getElementById('original-feedback-content');
            const replyContent = document.getElementById('reply-content');
            const toastContainer = document.getElementById('toast-container');
            
            let allFeedback = [];
            let currentFilter = 'new';
            let currentReplyingFeedbackId = null;

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
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists() && docSnap.data().role === 'admin') {
                        const userData = docSnap.data();
                        userNameEl.textContent = userData.name || 'Admin';
                        userAvatarEl.src = `https://placehold.co/40x40/DC2626/FFFFFF?text=${(userData.name || 'A').charAt(0).toUpperCase()}`;
                        initFeedbackPage();
                    } else {
                        const userRole = docSnap.data()?.role;
                        window.location.href = userRole ? `../${userRole}/index.html` : '../auth.html';
                    }
                } else {
                    window.location.href = '../auth.html';
                }
            });

            function initFeedbackPage() {
                const q = query(collection(db, "feedback"));
                onSnapshot(q, (snapshot) => {
                    allFeedback = snapshot.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                    renderFeedbackList();
                }, (error) => {
                    console.error("Error fetching feedback:", error);
                    feedbackListContainer.innerHTML = `<div class="bg-red-100 text-red-700 p-4 rounded-lg"><p class="font-bold">Đã xảy ra lỗi!</p><p>Không thể tải danh sách góp ý. Vui lòng kiểm tra lại.</p></div>`;
                });
                setupEventListeners();
            }

            function renderFeedbackList() {
                const filteredFeedback = allFeedback.filter(f => f.status === currentFilter);
                feedbackListContainer.innerHTML = '';
                if (filteredFeedback.length === 0) {
                    feedbackListContainer.innerHTML = `<p class="text-slate-500 text-center p-8">Không có góp ý nào trong mục này.</p>`;
                    return;
                }

                filteredFeedback.forEach(feedback => {
                    const date = feedback.createdAt?.toDate().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) || 'N/A';
                    const roleBg = feedback.userRole === 'teacher' ? 'bg-sky-100 text-sky-800' : 'bg-green-100 text-green-800';
                    const card = document.createElement('div');
                    card.className = 'bg-white p-5 rounded-lg shadow-sm';
                    card.innerHTML = `
                        <div class="flex justify-between items-start">
                            <div>
                                <p class="font-bold text-slate-800">${feedback.userName || 'Người dùng ẩn danh'}</p>
                                <p class="text-sm text-slate-500">${feedback.userEmail} - <span class="px-2 py-0.5 text-xs font-semibold rounded-full ${roleBg}">${feedback.userRole}</span></p>
                            </div>
                            <span class="text-xs text-slate-400">${date}</span>
                        </div>
                        <p class="mt-4 text-slate-700 whitespace-pre-wrap">${feedback.content}</p>
                        ${feedback.reply ? `
                            <div class="mt-3 pt-3 border-t border-slate-200">
                                <p class="text-sm font-semibold text-teal-700">Phản hồi của bạn:</p>
                                <p class="text-sm text-slate-600 mt-1 whitespace-pre-wrap">${feedback.reply}</p>
                            </div>
                        ` : ''}
                        <div class="flex justify-end items-center space-x-3 mt-4 pt-4 border-t border-slate-100">
                            ${feedback.status === 'new' ? `<button data-action="mark-seen" data-id="${feedback.id}" class="text-sm font-semibold text-slate-600 hover:text-teal-600">Đánh dấu đã xem</button>` : ''}
                            ${feedback.status !== 'replied' ? `<button data-action="reply" data-id="${feedback.id}" class="text-sm font-semibold bg-teal-50 text-teal-700 px-4 py-2 rounded-lg hover:bg-teal-100">Trả lời</button>` : ''}
                        </div>
                    `;
                    feedbackListContainer.appendChild(card);
                });
            }

            function setupEventListeners() {
                document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
                tabsContainer.addEventListener('click', (e) => {
                    const button = e.target.closest('.tab-button');
                    if (!button) return;
                    currentFilter = button.dataset.status;
                    tabsContainer.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                    button.classList.add('active');
                    renderFeedbackList();
                });

                feedbackListContainer.addEventListener('click', (e) => {
                    const button = e.target.closest('button[data-action]');
                    if (!button) return;
                    const id = button.dataset.id;
                    const action = button.dataset.action;

                    if (action === 'mark-seen') {
                        updateFeedbackStatus(id, 'seen');
                    } else if (action === 'reply') {
                        const feedback = allFeedback.find(f => f.id === id);
                        currentReplyingFeedbackId = id;
                        originalFeedbackContent.textContent = feedback.content;
                        replyModal.classList.remove('hidden');
                        replyModal.classList.add('flex');
                    }
                });
                
                replyCancelBtn.onclick = () => {
                    replyModal.classList.add('hidden');
                    replyModal.classList.remove('flex');
                };

                replyForm.onsubmit = handleReplySubmit;
            }

            async function updateFeedbackStatus(id, status) {
                try {
                    await updateDoc(doc(db, "feedback", id), { status: status });
                    showToast(`Đã cập nhật trạng thái.`, 'success');
                } catch (error) {
                    console.error("Update Status Error:", error);
                    showToast(`Lỗi khi cập nhật: ${error.message}`, 'error');
                }
            }
            
            async function handleReplySubmit(e) {
                e.preventDefault();
                const replyText = replyContent.value.trim();
                if (!replyText || !currentReplyingFeedbackId) return;

                const submitBtn = document.getElementById('reply-submit-btn');
                submitBtn.disabled = true;
                submitBtn.textContent = 'Đang gửi...';

                try {
                    const feedbackRef = doc(db, "feedback", currentReplyingFeedbackId);
                    await updateDoc(feedbackRef, {
                        status: 'replied',
                        reply: replyText,
                        repliedAt: serverTimestamp()
                    });
                    showToast('Gửi phản hồi thành công!', 'success');
                    replyModal.classList.add('hidden');
                    replyModal.classList.remove('flex');
                    replyForm.reset();
                } catch (error) {
                    console.error("Reply Error:", error);
                    showToast(`Lỗi khi gửi phản hồi: ${error.message}`, 'error');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Gửi phản hồi';
                    currentReplyingFeedbackId = null;
                }
            }

            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    document.body.style.opacity = '0';
                    setTimeout(() => { window.location.href = this.href; }, 250);
                });
            });
            document.body.style.transition = 'opacity 0.25s ease-in-out';
            feather.replace();
        });