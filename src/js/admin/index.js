import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, collection, onSnapshot, query, where, orderBy, limit } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        const userNameEl = document.getElementById('user-name');
        const userAvatarEl = document.getElementById('user-avatar');
        const recentUsersContainer = document.getElementById('recent-users-container');
        const recentFeedbackContainer = document.getElementById('recent-feedback-container');

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                document.body.style.opacity = '0';
                setTimeout(() => { window.location.href = this.href; }, 250);
            });
        });
        document.body.style.transition = 'opacity 0.25s ease-in-out';
        
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const docSnap = await getDoc(doc(db, "users", user.uid));
                
                if (docSnap.exists() && docSnap.data().role === 'admin') {
                    const userData = docSnap.data();
                    userNameEl.textContent = userData.name || 'Admin AIGEO';
                    const welcomeMsg = document.getElementById('welcome-message');
                    welcomeMsg.textContent = `Chào mừng, ${userData.name || 'Admin'}!`;
                    
                    const nameInitial = (userData.name || 'A').charAt(0).toUpperCase();
                    userAvatarEl.src = `https://placehold.co/40x40/DC2626/FFFFFF?text=${nameInitial}`;
                    
                    listenForStats();
                    listenForRecentData();
                    animateWelcomeMessage();

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

        function listenForStats() {
            const collections = ['users', 'subjects', 'tests', 'questions'];
            collections.forEach(key => {
                onSnapshot(collection(db, key), (snapshot) => {
                    const el = document.getElementById(`stats-${key}`);
                    if (el) el.textContent = snapshot.size;
                });
            });

            const feedbackQuery = query(collection(db, "feedback"), where("status", "==", "new"));
            onSnapshot(feedbackQuery, (snapshot) => {
                const el = document.getElementById(`stats-feedback`);
                if (el) el.textContent = snapshot.size;
            });
        }

        function listenForRecentData() {
            const usersQuery = query(collection(db, "users"), orderBy("createdAt", "desc"), limit(5));
            onSnapshot(usersQuery, (snapshot) => {
                const users = snapshot.docs.map(d => d.data());
                renderRecentUsers(users);
            });
            
            const feedbackQuery = query(collection(db, "feedback"), orderBy("createdAt", "desc"), limit(3));
            onSnapshot(feedbackQuery, (snapshot) => {
                const feedbacks = snapshot.docs.map(d => d.data());
                renderRecentFeedback(feedbacks);
            });
        }
        
        function renderRecentUsers(users) {
            recentUsersContainer.innerHTML = '';
            if(users.length === 0) {
                recentUsersContainer.innerHTML = '<p class="text-sm text-slate-500 text-center py-4">Chưa có người dùng nào.</p>';
                return;
            }
            const list = document.createElement('div');
            list.className = 'space-y-4';
            users.forEach(user => {
                const roleBg = {
                    'student': 'bg-green-100 text-green-800',
                    'teacher': 'bg-sky-100 text-sky-800',
                    'admin': 'bg-red-100 text-red-800'
                }[user.role] || 'bg-slate-100 text-slate-800';
                
                const userDiv = document.createElement('div');
                userDiv.className = 'flex items-center justify-between';
                userDiv.innerHTML = `
                    <div class="flex items-center space-x-3">
                        <img class="h-9 w-9 rounded-full object-cover" src="https://placehold.co/40x40/E2E8F0/475569?text=${(user.name || 'U').charAt(0).toUpperCase()}" alt="Avatar">
                        <div>
                            <p class="font-semibold text-sm text-slate-700">${user.name || '(Chưa có tên)'}</p>
                            <p class="text-xs text-slate-500">${user.email}</p>
                        </div>
                    </div>
                    <span class="text-xs font-semibold px-2 py-1 rounded-full ${roleBg}">${user.role}</span>
                `;
                list.appendChild(userDiv);
            });
            recentUsersContainer.appendChild(list);
        }
        
        function renderRecentFeedback(feedbacks) {
            recentFeedbackContainer.innerHTML = '';
             if(feedbacks.length === 0) {
                recentFeedbackContainer.innerHTML = '<p class="text-sm text-slate-500 text-center py-4">Chưa có góp ý nào.</p>';
                return;
            }
            const list = document.createElement('div');
            list.className = 'space-y-3';
            feedbacks.forEach(fb => {
                const fbDiv = document.createElement('div');
                fbDiv.className = 'p-3 bg-slate-50 rounded-lg';
                fbDiv.innerHTML = `
                    <p class="text-sm text-slate-700 truncate">${fb.content}</p>
                    <p class="text-xs text-slate-500 mt-1">bởi ${fb.userName || 'N/A'}</p>
                `;
                list.appendChild(fbDiv);
            });
            recentFeedbackContainer.appendChild(list);
        }
        
        function animateWelcomeMessage() {
            const welcomeMsg = document.getElementById('welcome-message');
            if(welcomeMsg) {
                welcomeMsg.innerHTML = welcomeMsg.textContent.replace(/(\S)/g, "<span class='letter'>$&</span>");
                anime.timeline({loop: false})
                .add({
                    targets: '#welcome-message .letter',
                    translateY: ["1.1em", 0],
                    translateX: ["0.55em", 0],
                    translateZ: 0,
                    rotateZ: [180, 0],
                    opacity: [0, 1],
                    easing: "easeOutExpo",
                    duration: 750,
                    delay: (el, i) => 50 * i
                });
            }
        }

        document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
        
        feather.replace();