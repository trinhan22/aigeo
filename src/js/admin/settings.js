import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        document.addEventListener('DOMContentLoaded', () => {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            const db = getFirestore(app);

            const userNameEl = document.getElementById('user-name');
            const userAvatarEl = document.getElementById('user-avatar');
            const appNameInput = document.getElementById('app-name');
            const contactEmailInput = document.getElementById('contact-email');
            const maintenanceModeToggle = document.getElementById('maintenance-mode');
            const maintenanceDetails = document.getElementById('maintenance-details');
            const maintenanceReason = document.getElementById('maintenance-reason');
            const maintenanceStart = document.getElementById('maintenance-start');
            const maintenanceEnd = document.getElementById('maintenance-end');
            const saveSettingsBtn = document.getElementById('save-settings-btn');
            const toastContainer = document.getElementById('toast-container');
            const appNameLoader = document.getElementById('app-name-loader');
            const contactEmailLoader = document.getElementById('contact-email-loader');
            const settingsDocRef = doc(db, "system_settings", "general");

            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', function(e) {
                    e.preventDefault();
                    document.body.style.opacity = '0';
                    setTimeout(() => { window.location.href = this.href; }, 200);
                });
            });
            document.body.style.transition = 'opacity 0.2s ease-in-out';

            onAuthStateChanged(auth, async (user) => {
                 if (user) {
                    const docSnap = await getDoc(doc(db, "users", user.uid));
                    if (docSnap.exists() && docSnap.data().role === 'admin') {
                        const userData = docSnap.data();
                        userNameEl.textContent = userData.name || 'Admin';
                        const nameInitial = (userData.name || 'A').charAt(0).toUpperCase();
                        userAvatarEl.src = `https://placehold.co/40x40/DC2626/FFFFFF?text=${nameInitial}`;
                        
                        loadSettings();
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

            function formatTimestampForInput(timestamp) {
                if (!timestamp || !timestamp.toDate) return '';
                const date = timestamp.toDate();
                // Adjust for local timezone
                const timezoneOffset = date.getTimezoneOffset() * 60000;
                const localDate = new Date(date.getTime() - timezoneOffset);
                return localDate.toISOString().slice(0, 16);
            }

            async function loadSettings() {
                try {
                    const docSnap = await getDoc(settingsDocRef);
                    if (docSnap.exists()) {
                        const settings = docSnap.data();
                        appNameInput.value = settings.appName || 'AIGEO';
                        contactEmailInput.value = settings.contactEmail || '';
                        maintenanceModeToggle.checked = settings.maintenanceMode || false;

                        if (settings.maintenanceMode) {
                            maintenanceDetails.classList.remove('hidden');
                        }
                        maintenanceReason.value = settings.maintenanceReason || '';
                        maintenanceStart.value = formatTimestampForInput(settings.maintenanceStartTime);
                        maintenanceEnd.value = formatTimestampForInput(settings.maintenanceEndTime);

                    } else {
                        appNameInput.value = 'AIGEO';
                    }
                } catch (error) {
                    console.error("Error fetching settings:", error);
                    showToast('Không thể tải cài đặt.', 'error');
                } finally {
                    appNameLoader.classList.add('hidden');
                    contactEmailLoader.classList.add('hidden');
                    appNameInput.classList.remove('hidden');
                    contactEmailInput.classList.remove('hidden');
                }
            }

            maintenanceModeToggle.addEventListener('change', () => {
                maintenanceDetails.classList.toggle('hidden', !maintenanceModeToggle.checked);
            });

            saveSettingsBtn.addEventListener('click', async () => {
                const settingsToSave = {
                    appName: appNameInput.value.trim(),
                    contactEmail: contactEmailInput.value.trim(),
                    maintenanceMode: maintenanceModeToggle.checked,
                    maintenanceReason: maintenanceReason.value.trim(),
                    maintenanceStartTime: maintenanceStart.value ? new Date(maintenanceStart.value) : null,
                    maintenanceEndTime: maintenanceEnd.value ? new Date(maintenanceEnd.value) : null,
                };

                saveSettingsBtn.disabled = true;
                saveSettingsBtn.textContent = 'Đang lưu...';

                try {
                    await setDoc(settingsDocRef, settingsToSave, { merge: true });
                    showToast('Lưu cài đặt thành công!', 'success');
                } catch (error) {
                    console.error("Error saving settings:", error);
                    showToast('Có lỗi xảy ra khi lưu.', 'error');
                } finally {
                    saveSettingsBtn.disabled = false;
                    saveSettingsBtn.textContent = 'Lưu tất cả thay đổi';
                }
            });

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

            document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));
            feather.replace();
        });