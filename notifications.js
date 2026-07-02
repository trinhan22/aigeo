import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, query, where, orderBy, updateDoc, doc, arrayUnion, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

document.addEventListener('DOMContentLoaded', () => {
    // Check if firebaseConfig is defined (it should be loaded in HTML before this script)
    if (typeof firebaseConfig === 'undefined') {
        console.error("firebaseConfig is missing. Please ensure firebase-config.js is loaded before notifications.js");
        return;
    }

    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);

    // --- DARK MODE CSS INJECTION ---
    const darkCssUrl = new URL('./dark-mode.css?v=9', import.meta.url).href;
    const darkCss = document.createElement('link');
    darkCss.rel = 'stylesheet';
    darkCss.href = darkCssUrl;
    document.head.appendChild(darkCss);

    const bellContainer = document.getElementById('global-notification-bell');
    if (!bellContainer) return;

    let popupEl = null;
    let badgeEl = null;
    let unreadCount = 0;
    let currentUserUid = null;
    let currentUserRole = null;

    // Build Bell HTML dynamically inside the container
    bellContainer.className = 'flex items-center gap-1 sm:gap-2';
    bellContainer.innerHTML = `
        <button id="dark-mode-btn" class="p-2 text-slate-400 hover:text-teal-600 transition-colors focus:outline-none rounded-full hover:bg-slate-100">
            <i data-feather="moon" class="w-5 h-5"></i>
        </button>
        <div class="relative flex items-center justify-center">
            <button id="noti-bell-btn" class="relative p-2 text-slate-400 hover:text-teal-600 transition-colors focus:outline-none rounded-full hover:bg-slate-100">
                <i data-feather="bell" class="w-5 h-5"></i>
                <span id="noti-badge" class="hidden absolute top-1 right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-800"></span>
            </button>
            <div id="noti-popup" class="hidden absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[100] overflow-hidden origin-top-right transition-all">
                <div class="p-4 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                    <h3 class="font-bold text-slate-800 text-sm">Thông báo</h3>
                    <span id="noti-count-text" class="text-xs font-semibold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">0 mới</span>
                </div>
                <div id="noti-list" class="max-h-[350px] overflow-y-auto custom-scrollbar">
                    <div class="p-8 text-center text-slate-400">
                        <i data-feather="bell-off" class="w-8 h-8 mx-auto mb-3 opacity-20"></i>
                        <p class="text-xs font-medium">Không có thông báo nào</p>
                    </div>
                </div>
                <div class="p-3 border-t border-slate-50 text-center bg-slate-50/50">
                    <button id="mark-all-read-btn" class="text-xs font-bold text-slate-500 hover:text-teal-600 transition-colors">Đánh dấu tất cả đã đọc</button>
                </div>
            </div>
        </div>
    `;
    
    // Replace feather icon
    if (typeof feather !== 'undefined') feather.replace();

    const notiBtn = document.getElementById('noti-bell-btn');
    const darkModeBtn = document.getElementById('dark-mode-btn');
    popupEl = document.getElementById('noti-popup');
    badgeEl = document.getElementById('noti-badge');
    const listEl = document.getElementById('noti-list');
    const countTextEl = document.getElementById('noti-count-text');
    const markAllReadBtn = document.getElementById('mark-all-read-btn');

    // --- DARK MODE LOGIC ---
    const htmlEl = document.documentElement;
    const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        htmlEl.classList.add('dark');
        darkModeBtn.innerHTML = '<i data-feather="sun" class="w-5 h-5"></i>';
    }

    darkModeBtn.addEventListener('click', () => {
        if (htmlEl.classList.contains('dark')) {
            htmlEl.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            darkModeBtn.innerHTML = '<i data-feather="moon" class="w-5 h-5"></i>';
        } else {
            htmlEl.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            darkModeBtn.innerHTML = '<i data-feather="sun" class="w-5 h-5"></i>';
        }
        if (typeof feather !== 'undefined') feather.replace();
    });

    let currentNotifications = [];

    // Toggle popup
    notiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        popupEl.classList.toggle('hidden');
    });

    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!popupEl.classList.contains('hidden') && !bellContainer.contains(e.target)) {
            popupEl.classList.add('hidden');
        }
    });

    // Stop propagation inside popup
    popupEl.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUserUid = user.uid;
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    currentUserRole = userDoc.data().role;
                }
            } catch (e) {
                console.error("Error fetching user role for notifications:", e);
            }
            listenToNotifications();
        }
    });

    function isRead(noti) {
        return noti.readBy && noti.readBy.includes(currentUserUid);
    }

    function listenToNotifications() {
        const notiRef = collection(db, 'notifications');
        const q = query(notiRef, orderBy('createdAt', 'desc'));
        
        onSnapshot(q, (snapshot) => {
            const allDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Filter for this user
            currentNotifications = allDocs.filter(n => 
                n.target === 'all' || 
                n.target === currentUserUid || 
                (currentUserRole && n.target === `role_${currentUserRole}`)
            );
            
            renderNotifications();
        }, (error) => {
            console.error("Error listening to notifications:", error);
        });
    }

    function renderNotifications() {
        listEl.innerHTML = '';
        unreadCount = 0;

        if (currentNotifications.length === 0) {
            listEl.innerHTML = `
                <div class="p-8 text-center text-slate-400">
                    <i data-feather="bell-off" class="w-8 h-8 mx-auto mb-3 opacity-20"></i>
                    <p class="text-xs font-medium">Không có thông báo nào</p>
                </div>
            `;
            if (typeof feather !== 'undefined') feather.replace();
            updateBadge();
            return;
        }

        currentNotifications.forEach(noti => {
            const read = isRead(noti);
            if (!read) unreadCount++;

            const timeStr = noti.createdAt?.toDate ? noti.createdAt.toDate().toLocaleString('vi-VN') : 'Vừa xong';
            
            const item = document.createElement('div');
            item.className = `p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${read ? 'opacity-60' : 'bg-teal-50/20'}`;
            item.innerHTML = `
                <div class="flex gap-3">
                    <div class="shrink-0 mt-1">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center ${read ? 'bg-slate-100 text-slate-400' : 'bg-teal-100 text-teal-600'}">
                            <i data-feather="${(noti.target === 'all' || noti.target.startsWith('role_')) ? 'radio' : 'user'}" class="w-4 h-4"></i>
                        </div>
                    </div>
                    <div class="flex-1">
                        <h4 class="text-sm font-bold ${read ? 'text-slate-600' : 'text-slate-800'} mb-1 leading-tight">${noti.title}</h4>
                        <p class="text-xs ${read ? 'text-slate-400' : 'text-slate-600'} line-clamp-2 leading-relaxed mb-1">${noti.message}</p>
                        <p class="text-[9px] font-bold text-slate-400">${timeStr}</p>
                    </div>
                    ${!read ? '<div class="shrink-0 mt-1"><div class="w-2 h-2 rounded-full bg-teal-500"></div></div>' : ''}
                </div>
            `;

            item.addEventListener('click', async () => {
                if (!read) {
                    try {
                        await updateDoc(doc(db, 'notifications', noti.id), {
                            readBy: arrayUnion(currentUserUid)
                        });
                    } catch(e) {
                        console.error('Error marking as read:', e);
                    }
                }
            });

            listEl.appendChild(item);
        });

        if (typeof feather !== 'undefined') feather.replace();
        updateBadge();
    }

    function updateBadge() {
        countTextEl.textContent = `${unreadCount} mới`;
        if (unreadCount > 0) {
            badgeEl.classList.remove('hidden');
        } else {
            badgeEl.classList.add('hidden');
        }
    }

    markAllReadBtn.addEventListener('click', async () => {
        if (unreadCount === 0) return;
        const unreadNotis = currentNotifications.filter(n => !isRead(n));
        for (const noti of unreadNotis) {
            try {
                await updateDoc(doc(db, 'notifications', noti.id), {
                    readBy: arrayUnion(currentUserUid)
                });
            } catch (e) {
                console.error(e);
            }
        }
    });

    // Optional style injection for custom-scrollbar in notifications
    const style = document.createElement('style');
    style.innerHTML = `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #E2E8F0; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #CBD5E1; }
    `;
    document.head.appendChild(style);
});
