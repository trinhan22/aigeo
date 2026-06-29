import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        let currentClassId = new URLSearchParams(window.location.search).get('classId');
        let studentsList = [];
        let allSubmissions = [];

        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const docSnap = await getDoc(doc(db, "users", user.uid));
                if (docSnap.exists() && docSnap.data().role === 'teacher') {
                    document.getElementById('user-name').textContent = docSnap.data().name;
                    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${encodeURIComponent(docSnap.data().name)}&background=0D9488&color=fff&bold=true`;
                    initDashboard();
                } else { window.location.href = '../auth.html'; }
            } else { window.location.href = '../auth.html'; }
        });

        async function initDashboard() {
            if (!currentClassId) return;

            try {
                // 1. Tải thông tin lớp & học sinh
                const classSnap = await getDoc(doc(db, "classrooms", currentClassId));
                if (!classSnap.exists()) return;
                const classData = classSnap.data();

                // --- ĐOẠN CODE LẤY MÔN HỌC TỪ DỮ LIỆU THẬT ---
                let subjectName = "Chưa cập nhật môn"; // Sẽ hiện dòng này nếu lớp trên Firebase bị thiếu subjectId

                if (classData.subjectId) {
                    const subjectDocSnap = await getDoc(doc(db, "subjects", classData.subjectId));
                    if (subjectDocSnap.exists()) {
                        subjectName = subjectDocSnap.data().name; // Đây chính là biến lấy tên thật từ database (Toán, Lý, Hóa, Sinh...)
                    }
                }

                document.getElementById('class-title').textContent = `Danh sách học sinh lớp: ${classData.className}`;
                document.getElementById('class-subtitle').textContent = `Khối ${classData.grade} • ${subjectName}`;
                // ---------------------------------------------

                const studentIds = classData.students || [];
                if (studentIds.length > 0) {
                    studentsList = await fetchDocsInChunks(collection(db, "users"), "__name__", studentIds);
                    document.getElementById('stat-students').textContent = studentsList.length;
                }

                // 2. Tải bài làm (submissions)
                const q = query(collection(db, "submissions"), where("classId", "==", currentClassId), orderBy("completedAt", "desc"));
                const querySnap = await getDocs(q);
                allSubmissions = querySnap.docs.map(d => ({ id: d.id, ...d.data() }));

                // 3. Đổ danh sách đề thi vào bộ lọc
                const testMap = new Map();
                allSubmissions.forEach(s => testMap.set(s.testId, s.testName));
                const filterSelect = document.getElementById('filter-test');
                testMap.forEach((name, id) => {
                    const opt = document.createElement('option');
                    opt.value = id;
                    opt.textContent = name;
                    filterSelect.appendChild(opt);
                });

                renderTable();
                updateStats();

            } catch (error) {
                console.error(error);
                document.getElementById('data-body').innerHTML = `<tr><td colspan="7" class="text-center py-10 text-red-400">Lỗi: ${error.message}</td></tr>`;
            }
        }

        function renderTable() {
            const tbody = document.getElementById('data-body');
            const searchVal = document.getElementById('search-student').value.toLowerCase();
            const filterTest = document.getElementById('filter-test').value;

            const filtered = allSubmissions.filter(s => {
                const student = studentsList.find(std => std.id === s.studentId);
                const nameMatch = student ? student.name.toLowerCase().includes(searchVal) : false;
                const testMatch = filterTest === "" || s.testId === filterTest;
                return nameMatch && testMatch;
            });

            if (filtered.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" class="text-center py-20 text-slate-400 font-bold uppercase text-[10px]">Không tìm thấy kết quả</td></tr>`;
                return;
            }

            tbody.innerHTML = '';
            filtered.forEach((s, index) => {
                const student = studentsList.find(std => std.id === s.studentId) || { name: 'N/A', id: 'N/A' };
                const scoreRatio = (s.score / s.totalQuestions) * 10;
                
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="font-bold text-slate-300 text-xs">${index + 1}</td>
                    <td><span class="text-teal-600 font-bold text-[11px] bg-teal-50 px-2 py-1 rounded">HV${student.id.slice(-4).toUpperCase()}</span></td>
                    <td class="font-bold text-slate-800">${student.name}</td>
                    <td class="text-slate-500 font-medium">${s.testName}</td>
                    <td>
                        <span class="score-high">${s.score}</span><span class="text-slate-300 font-bold text-xs">/${s.totalQuestions}</span>
                    </td>
                    <td class="hide-mobile">
                        <span class="status-badge status-done"><i data-feather="check-circle" class="w-3"></i> Đã nộp bài</span>
                    </td>
                    <td style="text-align: center;">
                        <div class="flex items-center justify-center gap-2">
                            <button onclick="kickStudent('${student.id}', '${student.name}')" class="p-2 hover:bg-red-50 text-red-500 transition rounded-xl inline-flex" title="Đuổi học sinh khỏi lớp">
                                <i data-feather="user-x" class="w-4"></i>
                            </button>
                            <a href="student.html?studentId=${student.id}&studentName=${encodeURIComponent(student.name)}&classId=${currentClassId}" class="p-2 hover:bg-teal-50 text-teal-600 transition rounded-xl inline-flex" title="Xem tiến độ">
                                <i data-feather="external-link" class="w-4"></i>
                            </a>
                        </div>
                    </td>
                `;
                tbody.appendChild(tr);
            });

            document.getElementById('count-rows').textContent = filtered.length;
            feather.replace();
        }

        function updateStats() {
            if (allSubmissions.length === 0) {
                document.getElementById('stat-avg').textContent = "0.0";
                document.getElementById('stat-percent').textContent = "0%";
                return;
            }
            
            // 1. Tính điểm trung bình
            const sumScore = allSubmissions.reduce((acc, s) => acc + (s.score / s.totalQuestions) * 10, 0);
            document.getElementById('stat-avg').textContent = (sumScore / allSubmissions.length).toFixed(1);
            
            // 2. Tính tỷ lệ hoàn thành (Lọc các học sinh đã nộp ít nhất 1 bài để không bị lặp)
            const uniqueStudentsSubmitted = new Set(allSubmissions.map(s => s.studentId)).size;
            let completion = (uniqueStudentsSubmitted / (studentsList.length || 1)) * 100;
            
            // Đảm bảo an toàn tuyệt đối không bao giờ vượt 100%
            if (completion > 100) completion = 100;
            
            document.getElementById('stat-percent').textContent = Math.round(completion) + '%';
        }

        // Thêm hàm xử lý đuổi học sinh
        window.kickStudent = async (studentId, studentName) => {
            if (!confirm(`Bạn có chắc chắn muốn đuổi học viên "${studentName}" ra khỏi lớp không?`)) {
                return;
            }
            
            try {
                const classDocRef = doc(db, "classrooms", currentClassId);
                await updateDoc(classDocRef, {
                    students: arrayRemove(studentId)
                });
                alert(`Đã xóa học viên ${studentName} khỏi lớp thành công!`);
                window.location.reload(); // Tải lại trang để cập nhật danh sách
            } catch (error) {
                console.error("Lỗi khi đuổi học sinh:", error);
                alert("Có lỗi xảy ra. Vui lòng thử lại!");
            }
        };

        async function fetchDocsInChunks(colRef, field, ids) {
            let results = [];
            for (let i = 0; i < ids.length; i += 30) {
                const chunk = ids.slice(i, i + 30);
                const q = query(colRef, where(field, "in", chunk));
                const snap = await getDocs(q);
                snap.forEach(d => results.push({ id: d.id, ...d.data() }));
            }
            return results;
        }

        // Search & Filter Events
        document.getElementById('search-student').oninput = renderTable;
        document.getElementById('filter-test').onchange = renderTable;

        // Export Excel
        document.getElementById('btn-export').onclick = () => {
            const table = document.getElementById('table-results');
            const wb = XLSX.utils.table_to_book(table);
            XLSX.writeFile(wb, `KetQuaLopHoc_${currentClassId}.xlsx`);
        };

        document.getElementById('logout-btn').onclick = () => signOut(auth);
        feather.replace();

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