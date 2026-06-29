import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
        
        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists()) {
                        const userData = docSnap.data();
                        if (userData.role !== 'student') {
                           if (userData.role === 'admin' || userData.role === 'teacher') {
                               window.location.href = `../${userData.role}/index.html`;
                           } else {
                               window.location.href = '../auth.html';
                           }
                           return;
                        }
                        document.getElementById('user-name').textContent = userData.name || 'Học sinh';
                        const nameInitial = (userData.name || 'S').charAt(0).toUpperCase();
                        document.getElementById('user-avatar').src = `https://placehold.co/40x40/10B981/FFFFFF?text=${nameInitial}`;
                    } else {
                         window.location.href = '../auth.html';
                    }
                } else {
                    window.location.href = '../auth.html';
                }
            });

            document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
            
            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    document.body.style.opacity = '0';
                    setTimeout(() => { window.location.href = this.href; }, 200);
                });
            });
            document.body.style.transition = 'opacity 0.2s ease-in-out';

            feather.replace();
        });