import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        const app = initializeApp(firebaseConfig);
        const auth = getAuth(app);
        const db = getFirestore(app);

        onAuthStateChanged(auth, async (user) => {
             if (user) {
                const docSnap = await getDoc(doc(db, "users", user.uid));
                if (docSnap.exists() && docSnap.data().role === 'teacher') {
                    const userData = docSnap.data();
                    document.getElementById('user-name').textContent = userData.name || 'Giáo viên';
                    const nameInitial = (userData.name || 'T').charAt(0).toUpperCase();
                    document.getElementById('user-avatar').src = `https://placehold.co/40x40/10B981/FFFFFF?text=${nameInitial}`;
                } else {
                    const userRole = docSnap.data()?.role;
                    window.location.href = userRole ? `../${userRole}/index.html` : '../auth.html';
                }
             } else {
                window.location.href = '../auth.html';
             }
        });

        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                document.body.style.opacity = '0';
                setTimeout(() => { window.location.href = this.href; }, 200);
            });
        });
        document.body.style.transition = 'opacity 0.2s ease-in-out';
        
        document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
        
        feather.replace();