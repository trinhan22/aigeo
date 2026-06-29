import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, query, where, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            let currentUser = null, sessionListener = null;
            const monitoringGrid = document.getElementById('monitoring-grid');
            const loadingContainer = document.getElementById('loading-container');

            // --- 1. AUTH LOGIC ---
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    currentUser = user;
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        document.getElementById('user-name').textContent = userData.name;
                        document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=0D9488&color=fff&bold=true`;
                        initMonitoring();
                    }
                } else { window.location.href = '../auth.html'; }
            });

            // --- 2. RENDERING LOGIC (The Core for Realtime) ---
            function getCardContent(session) {
                const colors = getStatusColors(session.status);
                const isLocked = session.status === 'locked';
                const progress = session.progress || 0;
                const total = session.totalQuestions || '--';

                return `
                    <div class="flex items-center gap-4 mb-6">
                        <div class="avatar-box bg-slate-100 text-slate-500 shadow-sm">${(session.studentName || 'S').charAt(0).toUpperCase()}</div>
                        <div class="overflow-hidden">
                            <h3 class="font-black text-slate-800 text-sm truncate">${session.studentName}</h3>
                            <span class="badge-status ${colors.badgeCls}">${statusText(session.status)}</span>
                        </div>
                    </div>

                    ${isLocked ? `
                        <div class="mb-6 p-3 bg-red-100/50 rounded-xl border border-red-100">
                            <p class="text-[10px] font-black text-red-600 uppercase mb-1 leading-none italic">Lý do vi phạm:</p>
                            <p class="text-xs font-bold text-red-800 leading-tight">${session.violationReason || 'Thoát màn hình'}</p>
                        </div>
                    ` : ''}

                    <div class="flex justify-between items-end mb-4">
                        <div>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tiến độ</p>
                            <p class="font-black text-slate-700 text-sm">${progress}/${total} <span class="text-[10px] font-bold text-slate-300">câu</span></p>
                        </div>
                        <div class="text-right">
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cảnh báo</p>
                            <p class="font-black ${session.warnings > 0 ? 'text-red-500' : 'text-slate-700'} text-sm">${session.warnings || 0}</p>
                        </div>
                    </div>

                    <div class="mt-auto pt-6 border-t border-slate-50 flex gap-2">
                        ${isLocked ? `
                            <button data-session-id="${session.id}" data-action="resume" class="btn-action flex-1 bg-teal-600 text-white shadow-lg shadow-teal-100 hover:scale-105 transition">Duyệt</button>
                            <button data-session-id="${session.id}" data-action="submit" class="btn-action flex-1 bg-slate-800 text-white hover:bg-black transition">Nộp bài</button>
                        ` : `
                            <div class="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div class="h-full bg-teal-500 transition-all duration-700" style="width: ${(progress/total)*100 || 0}%"></div>
                            </div>
                        `}
                    </div>
                `;
            }

            // --- 3. REALTIME LISTENER ---
            async function initMonitoring() {
                const urlParams = new URLSearchParams(window.location.search);
                const testId = urlParams.get('testId');
                const classId = urlParams.get('classId');
                if (!testId || !classId) return;

                const testDoc = await getDoc(doc(db, "tests", testId));
                if(testDoc.exists()) document.getElementById('test-name').textContent = testDoc.data().name;

                const q = query(collection(db, "test_sessions"), 
                                where("teacherId", "==", currentUser.uid),
                                where("testId", "==", testId), 
                                where("classId", "==", classId));
                
                onSnapshot(q, (snapshot) => {
                    loadingContainer.classList.add('hidden');
                    
                    snapshot.docChanges().forEach(change => {
                        const session = { id: change.doc.id, ...change.doc.data() };
                        const existingCard = document.getElementById(`session-${session.id}`);
                        
                        if (change.type === "added" || change.type === "modified") {
                            const colors = getStatusColors(session.status);
                            if (existingCard) {
                                // Realtime update existing card
                                existingCard.className = `student-monitor-card ${colors.cardCls}`;
                                existingCard.innerHTML = getCardContent(session);
                            } else {
                                // Add new card
                                const card = document.createElement('div');
                                card.id = `session-${session.id}`;
                                card.className = `student-monitor-card ${colors.cardCls}`;
                                card.innerHTML = getCardContent(session);
                                monitoringGrid.appendChild(card);
                            }
                        } else if (change.type === "removed") {
                            if (existingCard) existingCard.remove();
                        }
                    });

                    if (monitoringGrid.children.length === 0) {
                        monitoringGrid.innerHTML = '<p class="text-slate-400 font-bold col-span-full text-center py-10">Chưa có học sinh tham gia.</p>';
                    }
                    feather.replace();
                });
            }

            // --- 4. ACTION CONTROLS (Realtime interaction) ---
            monitoringGrid.onclick = async (e) => {
                const btn = e.target.closest('button');
                if (!btn) return;
                const { sessionId, action } = btn.dataset;
                const ref = doc(db, "test_sessions", sessionId);
                
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

                try {
                    if (action === 'resume') await updateDoc(ref, { status: 'online' });
                    else if (action === 'submit') await updateDoc(ref, { status: 'force_submit' });
                } catch (err) {
                    console.error(err);
                    alert("Lỗi thao tác!");
                }
            };

            // --- UTILS ---
            function getStatusColors(status) {
                switch (status) {
                    case 'online': return { cardCls: 'card-online', badgeCls: 'bg-green-100 text-green-600' };
                    case 'locked': return { cardCls: 'card-locked', badgeCls: 'bg-red-500 text-white shadow-lg shadow-red-200' };
                    case 'waiting': return { cardCls: 'card-waiting', badgeCls: 'bg-amber-100 text-amber-600' };
                    case 'finished': return { cardCls: 'card-finished', badgeCls: 'bg-slate-200 text-slate-500' };
                    default: return { cardCls: '', badgeCls: 'bg-slate-100 text-slate-400' };
                }
            }

            function statusText(status) {
                switch (status) {
                    case 'online': return 'Đang làm bài';
                    case 'locked': return 'Bị khóa';
                    case 'waiting': return 'Phòng chờ';
                    case 'finished': return 'Đã nộp bài';
                    default: return status;
                }
            }

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