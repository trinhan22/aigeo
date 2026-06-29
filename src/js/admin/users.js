import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, onSnapshot, query, orderBy, updateDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            const usersTableBody = document.getElementById('users-table-body');
            const searchInput = document.getElementById('search-input');
            const userNameEl = document.getElementById('user-name');
            const userAvatarEl = document.getElementById('user-avatar');
            const toastContainer = document.getElementById('toast-container');
            
            let allUsers = [];

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
                        const nameInitial = (userData.name || 'A').charAt(0).toUpperCase();
                        userAvatarEl.src = `https://placehold.co/40x40/DC2626/FFFFFF?text=${nameInitial}`;
                        listenForUsers();
                    } else {
                        const userRole = docSnap.data()?.role;
                        if (userRole === 'teacher' || userRole === 'student') {
                            window.location.href = `../${userRole}/index.html`;
                        } else {
                            window.location.href = '../auth.html';
                        }
                    }
                } else {
                    window.location.href = '../auth.html';
                }
            });

            function listenForUsers() {
                const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
                onSnapshot(q, (snapshot) => {
                    allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    renderTable(allUsers);
                }, (error) => {
                    console.error("Error fetching users:", error);
                    usersTableBody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-red-500">Lỗi khi tải danh sách người dùng.</td></tr>`;
                });
            }

            function renderTable(users) {
                if (!usersTableBody) return;
                usersTableBody.innerHTML = '';
                if (users.length === 0) {
                    usersTableBody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-500">Không có người dùng nào.</td></tr>`;
                    return;
                }
                
                users.forEach(user => {
                    const tr = document.createElement('tr');
                    tr.className = 'border-b hover:bg-slate-50';
                    const createdAt = user.createdAt?.toDate ? user.createdAt.toDate().toLocaleDateString('vi-VN') : 'N/A';
                    
                    const getRoleBadgeClass = (role) => {
                        switch (role) {
                            case 'admin': return 'bg-red-100 text-red-800';
                            case 'teacher': return 'bg-sky-100 text-sky-800';
                            case 'student':
                            default: return 'bg-green-100 text-green-800';
                        }
                    };

                    const roleSelectHTML = `
                        <select data-uid="${user.id}" class="role-select text-xs font-semibold rounded-full border-0 px-3 py-1.5 focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors ${getRoleBadgeClass(user.role)}" ${user.role === 'admin' ? 'disabled' : ''}>
                            <option value="student" ${user.role === 'student' ? 'selected' : ''}>Học sinh</option>
                            <option value="teacher" ${user.role === 'teacher' ? 'selected' : ''}>Giáo viên</option>
                            <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    `;

                    tr.innerHTML = `
                        <td class="p-4 font-medium text-slate-800">${user.name || '(Chưa có tên)'}</td>
                        <td class="p-4 text-slate-600">${user.email}</td>
                        <td class="p-4 text-center">${roleSelectHTML}</td>
                        <td class="p-4 text-slate-500 text-center">${createdAt}</td>
                    `;
                    usersTableBody.appendChild(tr);
                });
                feather.replace();
            }

            usersTableBody.addEventListener('change', async (e) => {
                if (e.target.classList.contains('role-select')) {
                    const selectEl = e.target;
                    const newRole = selectEl.value;
                    const uid = selectEl.dataset.uid;
                    const userToUpdate = allUsers.find(u => u.id === uid);
                    
                    const originalRole = userToUpdate.role;
                    
                    const getRoleBadgeClass = (role) => {
                        switch (role) {
                            case 'admin': return 'bg-red-100 text-red-800';
                            case 'teacher': return 'bg-sky-100 text-sky-800';
                            default: return 'bg-green-100 text-green-800';
                        }
                    };

                    // Optimistically update UI
                    selectEl.className = `role-select text-xs font-semibold rounded-full border-0 px-3 py-1.5 focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors ${getRoleBadgeClass(newRole)}`;
                    selectEl.disabled = true;

                    try {
                        await updateDoc(doc(db, "users", uid), { role: newRole });
                        showToast('Cập nhật vai trò thành công!', 'success');
                    } catch (error) {
                        console.error("Error updating role:", error);
                        showToast('Có lỗi xảy ra, không thể cập nhật vai trò.', 'error');
                        // Revert UI on error
                        selectEl.value = originalRole;
                        selectEl.className = `role-select text-xs font-semibold rounded-full border-0 px-3 py-1.5 focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 transition-colors ${getRoleBadgeClass(originalRole)}`;
                    } finally {
                        selectEl.disabled = newRole === 'admin';
                    }
                }
            });

            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const filteredUsers = allUsers.filter(user => 
                    user.name?.toLowerCase().includes(searchTerm) || 
                    user.email?.toLowerCase().includes(searchTerm)
                );
                renderTable(filteredUsers);
            });
            
            document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
        });