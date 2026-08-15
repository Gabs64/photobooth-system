// Custom Liquid Glass Modal Dialog Engine
(function() {
  function createModalDOM() {
    let overlay = document.getElementById('custom-modal-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'custom-modal-overlay';
    overlay.className = 'custom-modal-overlay';
    overlay.innerHTML = `
      <div class="custom-modal-box glass-panel">
        <div id="custom-modal-icon" class="custom-modal-icon icon-info">
          <i data-lucide="info"></i>
        </div>
        <h3 id="custom-modal-title">Notice</h3>
        <p id="custom-modal-message">Message text</p>
        <div class="custom-modal-actions">
          <button id="btn-modal-cancel" class="btn-secondary" style="display:none;">Cancel</button>
          <button id="btn-modal-confirm" class="btn-primary">OK</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  window.showModal = function(options) {
    if (typeof options === 'string') {
      options = { message: options };
    }
    return new Promise((resolve) => {
      const overlay = createModalDOM();
      const titleEl = document.getElementById('custom-modal-title');
      const msgEl = document.getElementById('custom-modal-message');
      const iconEl = document.getElementById('custom-modal-icon');
      const confirmBtn = document.getElementById('btn-modal-confirm');
      const cancelBtn = document.getElementById('btn-modal-cancel');

      titleEl.textContent = options.title || 'Notice';
      msgEl.textContent = options.message || '';

      const type = options.type || (options.isConfirm ? 'warning' : 'info');
      iconEl.className = 'custom-modal-icon icon-' + type;

      let iconName = 'info';
      if (type === 'success') iconName = 'check-circle-2';
      if (type === 'warning') iconName = 'alert-triangle';
      if (type === 'danger') iconName = 'alert-circle';
      iconEl.innerHTML = `<i data-lucide="${iconName}"></i>`;

      confirmBtn.textContent = options.confirmText || 'OK';

      if (options.showCancel || options.isConfirm) {
        cancelBtn.style.display = 'inline-flex';
        cancelBtn.textContent = options.cancelText || 'Cancel';
      } else {
        cancelBtn.style.display = 'none';
      }

      overlay.classList.add('active');
      if (window.lucide) lucide.createIcons();

      const cleanup = (result) => {
        overlay.classList.remove('active');
        resolve(result);
      };

      confirmBtn.onclick = () => {
        if (options.onConfirm) options.onConfirm();
        cleanup(true);
      };

      cancelBtn.onclick = () => {
        if (options.onCancel) options.onCancel();
        cleanup(false);
      };
    });
  };

  // Override native browser alert with custom liquid glass modal
  window.alert = function(message) {
    let type = 'info';
    const lower = typeof message === 'string' ? message.toLowerCase() : '';
    if (lower.includes('error') || lower.includes('failed') || lower.includes('no retakes')) {
      type = 'danger';
    } else if (lower.includes('success') || lower.includes('updated') || lower.includes('saved') || lower.includes('copied')) {
      type = 'success';
    }
    window.showModal({ title: 'Notice', message, type });
  };
})();
