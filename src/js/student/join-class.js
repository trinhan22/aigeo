import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, query, where, getDocs, updateDoc, arrayUnion, writeBatch } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            // [GIỮ NGUYÊN TOÀN BỘ LOGIC FIREBASE DƯỚI ĐÂY]
            let currentUser = null;
            let classToJoin = null;
            
            const joinClassForm = document.getElementById('join-class-form');
            const classCodeInput = document.getElementById('class-code-input');
            const joinBtn = document.getElementById('join-btn');
            const toastContainer = document.getElementById('toast-container');
            const classInfoEl = document.getElementById('class-info');

            // --- Override showToast để đồng bộ giao diện ---
            function showToast(message, type = 'success') {
                const toast = document.createElement('div');
                toast.className = `toast show ${type === 'success' ? 'bg-slate-900' : 'bg-red-500'} text-white px-6 py-3 rounded-2xl shadow-2xl font-bold text-sm`;
                toast.textContent = message;
                toastContainer.appendChild(toast);
                setTimeout(() => {
                    toast.classList.remove('show');
                    setTimeout(() => toast.remove(), 300);
                }, 3000);
            }
            
            // --- Auth & Data Loading ---
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    currentUser = user;
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists() && docSnap.data().role === 'student') {
                        const userData = docSnap.data();
                        document.getElementById('user-name').textContent = userData.name;
                        document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name)}&background=0D9488&color=fff&bold=true`;
                        initPage();
                    } else { window.location.href = '../auth.html'; }
                } else { window.location.href = '../auth.html'; }
            });

            // Override findClassByCode để hiển thị đẹp hơn
            async function findClassByCode(code) {
                 try {
                    const q = query(collection(db, "classrooms"), where("classCode", "==", code));
                    const querySnapshot = await getDocs(q);

                    if (querySnapshot.empty) {
                        classInfoEl.innerHTML = `<p class="text-red-500 font-bold text-xs uppercase tracking-wider">Không tìm thấy mã lớp này</p>`;
                        classInfoEl.classList.remove('hidden');
                        return null;
                    }
                    const classroomDoc = querySnapshot.docs[0];
                    classToJoin = { id: classroomDoc.id, ...classroomDoc.data() };
                    
                    const teacherSnap = await getDoc(doc(db, 'users', classToJoin.teacherId));
                    const teacherName = teacherSnap.exists() ? teacherSnap.data().name : 'Hệ thống';

                    classInfoEl.innerHTML = `
                        <p class="font-black text-teal-700 text-lg leading-tight mb-1">${classToJoin.className}</p>
                        <p class="text-[10px] font-bold text-teal-600 uppercase tracking-widest">GV: ${teacherName}</p>
                    `;
                    classInfoEl.classList.remove('hidden');
                    return classToJoin;
                 } catch (error) { return null; }
            }

            // [NỐI TIẾP CÁC HÀM XỬ LÝ SỰ KIỆN CỦA BẠN...]
            function initPage() {
                setupEventListeners();
            }

            function setupEventListeners() {
                joinClassForm.addEventListener('submit', handleJoinClass);
                classCodeInput.addEventListener('input', () => {
                    if (classCodeInput.value.trim().length >= 6) {
                        findClassByCode(classCodeInput.value.trim().toUpperCase());
                    } else {
                        classInfoEl.classList.add('hidden');
                        classToJoin = null;
                    }
                });
                document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
            }

            async function handleJoinClass(e) {
                e.preventDefault();
                if (!classToJoin) {
                    showToast("Mã lớp không hợp lệ.", "error");
                    return;
                }
                joinBtn.disabled = true; joinBtn.innerHTML = "Đang xử lý...";
                try {
                    if (classToJoin.students && classToJoin.students.includes(currentUser.uid)) {
                        throw new Error("Bạn đã ở trong lớp này.");
                    }
                    const batch = writeBatch(db);
                    batch.update(doc(db, "classrooms", classToJoin.id), { students: arrayUnion(currentUser.uid) });
                    batch.update(doc(db, "users", currentUser.uid), { joinedClassrooms: arrayUnion(classToJoin.id) });
                    await batch.commit();
                    showToast("Tham gia lớp thành công!");
                    setTimeout(() => window.location.href = 'classrooms.html', 1500);
                } catch (error) {
                    showToast(error.message, "error");
                    joinBtn.disabled = false; joinBtn.innerHTML = "Tham gia";
                }
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