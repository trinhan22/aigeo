// global-ui.js

(function() {
    // Make sure we only initialize once
    if (window.aigeoGlobalUIInitialized) return;
    window.aigeoGlobalUIInitialized = true;

    // SVG Icons
    const ICONS = {
        success: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
        error: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
        info: `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" style="width: 16px; height: 16px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
    };

    const ALERT_ICON = `<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

    // Wait for DOM
    document.addEventListener('DOMContentLoaded', () => {
        let toastContainer = document.getElementById('aigeo-toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'aigeo-toast-container';
            document.body.appendChild(toastContainer);
        }
    });

    // Custom Toast Function
    window.showToast = function(message, type = 'success', duration = 3000) {
        let toastContainer = document.getElementById('aigeo-toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'aigeo-toast-container';
            if(document.body) document.body.appendChild(toastContainer);
        }

        // Fallback type if invalid
        if (!ICONS[type]) type = 'success';

        const toast = document.createElement('div');
        toast.className = 'aigeo-toast';
        
        toast.innerHTML = `
            <div class="aigeo-toast-icon ${type}">
                ${ICONS[type]}
            </div>
            <div class="aigeo-toast-text">${message}</div>
        `;

        if(toastContainer) toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-hiding');
            toast.addEventListener('animationend', () => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            });
        }, duration);
    };

    // Override native alert globally
    window.alert = function(message) {
        // If an alert is already open, remove it
        const existingAlert = document.getElementById('aigeo-alert-overlay');
        if (existingAlert) {
            existingAlert.parentNode.removeChild(existingAlert);
        }

        const overlay = document.createElement('div');
        overlay.id = 'aigeo-alert-overlay';
        overlay.className = 'aigeo-alert-overlay';
        
        overlay.innerHTML = `
            <div class="aigeo-alert-box">
                <div class="aigeo-alert-icon">
                    ${ALERT_ICON}
                </div>
                <div class="aigeo-alert-text">${message}</div>
                <button class="aigeo-alert-btn" id="aigeo-alert-close-btn">Đã hiểu</button>
            </div>
        `;
        
        if(document.body) document.body.appendChild(overlay);

        const closeBtn = document.getElementById('aigeo-alert-close-btn');
        if (closeBtn) {
            closeBtn.onclick = function() {
                overlay.classList.add('alert-hiding');
                overlay.addEventListener('animationend', () => {
                    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
                });
            };
        }
    };

    // Auto-patch existing `showAlert` if some files defined it locally
    // to ensure consistency across the board
    window.showAlert = function(msg) {
        window.alert(msg);
    };
})();
