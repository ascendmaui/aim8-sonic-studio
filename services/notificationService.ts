// Notification Service — in-app toasts only (push notifications are not part of the open-source build)

/**
 * Show an in-app toast notification
 */
export function showToast(title: string, body: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    const colors = {
        info: 'border-cyan-500/30 bg-cyan-500/10',
        success: 'border-emerald-500/30 bg-emerald-500/10',
        warning: 'border-amber-500/30 bg-amber-500/10',
        error: 'border-red-500/30 bg-red-500/10',
    };
    const icons = { info: '💡', success: '✅', warning: '⚠️', error: '❌' };

    toast.className = `fixed top-4 right-4 z-[9999] max-w-sm p-4 rounded-2xl border ${colors[type]} backdrop-blur-xl shadow-2xl transition-all duration-500 transform translate-x-full`;

    // Build toast content using safe DOM APIs (no innerHTML) to prevent XSS
    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-start gap-3';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'text-lg';
    iconSpan.textContent = icons[type];

    const textDiv = document.createElement('div');
    textDiv.className = 'flex-1 min-w-0';

    const titleEl = document.createElement('p');
    titleEl.className = 'text-sm font-bold text-white';
    titleEl.textContent = title;

    const bodyEl = document.createElement('p');
    bodyEl.className = 'text-xs text-slate-400 mt-0.5';
    bodyEl.textContent = body;

    textDiv.appendChild(titleEl);
    textDiv.appendChild(bodyEl);

    const closeBtn = document.createElement('button');
    closeBtn.className = 'text-slate-500 hover:text-white text-lg leading-none';
    closeBtn.textContent = '\u00D7';
    closeBtn.addEventListener('click', () => toast.remove());

    wrapper.appendChild(iconSpan);
    wrapper.appendChild(textDiv);
    wrapper.appendChild(closeBtn);
    toast.appendChild(wrapper);

    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
    });

    // Auto-remove after 5s
    setTimeout(() => {
        toast.style.transform = 'translateX(120%)';
        setTimeout(() => toast.remove(), 500);
    }, 5000);
}
