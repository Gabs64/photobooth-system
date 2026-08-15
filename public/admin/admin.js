// Admin Management Portal Controller

class PhotoboothAdmin {
  constructor() {
    this.currentEvent = null;
    this.allOverlays = [];
    this.allLayouts = [];
    this.selectedOverlay = null;
    this.selectedLayout = null;

    // WYSIWYG Editor State
    this.editorPos = { x: 0, y: 0, scale: 1.0 };
    this.sampleImg = new Image();
    this.overlayImg = new Image();

    this.init();
  }

  async init() {
    lucide.createIcons();
    this.bindNavigation();
    this.bindFormEvents();
    this.bindAuthEvents();
    await this.checkAuthStatus();
  }

  bindAuthEvents() {
    // Login Form Submit
    const loginForm = document.getElementById('form-admin-login');
    if (loginForm) {
      loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errBadge = document.getElementById('login-error-badge');

        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          });
          const data = await res.json();
          if (data.success) {
            if (errBadge) errBadge.style.display = 'none';
            document.getElementById('admin-login-overlay').classList.remove('active');
            await this.loadAllData();
            if (window.showModal) {
              window.showModal({ title: 'Welcome Admin!', message: 'Signed in successfully to Admin Portal.', type: 'success' });
            }
          } else {
            if (errBadge) {
              errBadge.textContent = data.error || 'Invalid username or password';
              errBadge.style.display = 'block';
            }
          }
        } catch (err) {
          if (errBadge) {
            errBadge.textContent = 'Login error: ' + err.message;
            errBadge.style.display = 'block';
          }
        }
      });
    }

    // Logout Button
    const logoutBtn = document.getElementById('btn-admin-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        document.getElementById('admin-login-overlay').classList.add('active');
        if (window.showModal) {
          window.showModal({ title: 'Logged Out', message: 'You have been logged out of the Admin Portal.', type: 'info' });
        }
      });
    }
  }

  async checkAuthStatus() {
    try {
      const res = await fetch('/api/auth/check');
      const data = await res.json();
      const overlay = document.getElementById('admin-login-overlay');
      if (data.authenticated) {
        if (overlay) overlay.classList.remove('active');
        await this.loadAllData();
      } else {
        if (overlay) overlay.classList.add('active');
      }
    } catch (err) {
      const overlay = document.getElementById('admin-login-overlay');
      if (overlay) overlay.classList.add('active');
    }
  }

  bindNavigation() {
    document.querySelectorAll('.nav-item').forEach(button => {
      button.addEventListener('click', () => {
        document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));

        button.classList.add('active');
        const tabId = button.dataset.tab;
        const targetTab = document.getElementById(tabId);
        if (targetTab) targetTab.classList.add('active');

        // Render tab specific tools
        if (tabId === 'tab-overlays') this.renderWysiwygCanvas();
        if (tabId === 'tab-layouts') this.renderLayoutBuilderCanvas();
        if (tabId === 'tab-gallery') this.loadGallery();
        if (tabId === 'tab-cloud') this.loadCloudStatus();
        if (tabId === 'tab-settings') this.loadAnalyticsAndSettings();
      });
    });

    document.getElementById('btn-quick-refresh').addEventListener('click', () => {
      this.loadAllData();
    });
  }

  async loadAllData() {
    try {
      const res = await fetch('/api/events/active');
      const data = await res.json();

      this.currentEvent = data.event;
      this.selectedOverlay = data.activeOverlay;
      this.selectedLayout = data.activeLayout;
      this.allOverlays = data.allOverlays || [];
      this.allLayouts = data.allLayouts || [];

      this.populateEventForm();
      this.populateOverlaysList();
      this.populateLayoutForm();
      this.renderWysiwygCanvas();
      this.renderLayoutBuilderCanvas();
    } catch (err) {
      console.error('Error loading admin data:', err);
    }
  }

  // --- TAB 1: EVENT BRANDING ---
  populateEventForm() {
    if (!this.currentEvent) return;
    document.getElementById('topbar-event-title').textContent = this.currentEvent.name;
    document.getElementById('evt-name').value = this.currentEvent.name;
    document.getElementById('evt-date').value = this.currentEvent.event_date;
    document.getElementById('evt-slogan').value = this.currentEvent.welcome_slogan;
    document.getElementById('evt-bg-url').value = this.currentEvent.bg_image_url || '';
    document.getElementById('evt-color-primary').value = this.currentEvent.theme_primary || '#8B5CF6';
    document.getElementById('evt-color-secondary').value = this.currentEvent.theme_secondary || '#F43F5E';
    document.getElementById('evt-color-bg').value = this.currentEvent.theme_bg_color || '#0F172A';

    this.updateThemePreview();
  }

  updateThemePreview() {
    const primary = document.getElementById('evt-color-primary').value;
    const secondary = document.getElementById('evt-color-secondary').value;
    const pill = document.getElementById('theme-preview-pill');
    pill.style.background = `linear-gradient(135deg, ${primary}, ${secondary})`;
  }

  // --- TAB 2: OVERLAY LIBRARY & WYSIWYG EDITOR ---
  populateOverlaysList() {
    const container = document.getElementById('overlays-list-grid');
    container.innerHTML = '';

    this.allOverlays.forEach(ovl => {
      const card = document.createElement('div');
      card.className = `overlay-item-card ${ovl.is_active ? 'active' : ''}`;
      card.innerHTML = `
        <div>
          <strong>${ovl.name}</strong>
          ${ovl.is_active ? '<span class="badge badge-success ml-8">ACTIVE</span>' : ''}
          ${ovl.schedule_time ? `<span class="badge badge-warning">⏰ ${ovl.schedule_time}</span>` : ''}
        </div>
        <div class="actions">
          <button class="btn-secondary btn-sm edit-ovl" data-id="${ovl.id}">Select/Edit</button>
        </div>
      `;
      container.appendChild(card);

      card.querySelector('.edit-ovl').addEventListener('click', () => {
        this.selectedOverlay = ovl;
        document.getElementById('selected-overlay-badge').textContent = `Editing: ${ovl.name}`;
        document.getElementById('slider-pos-x').value = ovl.position_x || 0;
        document.getElementById('slider-pos-y').value = ovl.position_y || 0;
        document.getElementById('slider-scale').value = ovl.scale || 1.0;
        document.getElementById('input-overlay-schedule').value = ovl.schedule_time || '';
        this.renderWysiwygCanvas();
      });
    });
  }

  renderWysiwygCanvas() {
    const canvas = document.getElementById('wysiwyg-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = 600;
    canvas.height = 800;

    // Draw Sample Photo Studio Background
    ctx.fillStyle = '#1E1B4B';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#F43F5E';
    ctx.beginPath();
    ctx.arc(canvas.width/2, canvas.height/2 - 20, 100, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#8B5CF6';
    ctx.beginPath();
    ctx.ellipse(canvas.width/2, canvas.height/2 + 220, 180, 150, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText('SAMPLE GUEST PHOTO FEED', canvas.width/2, canvas.height/2 - 20);

    // Draw Overlay Image
    if (this.selectedOverlay && this.selectedOverlay.file_path) {
      const img = new Image();
      img.onload = () => {
        const posX = parseFloat(document.getElementById('slider-pos-x').value || 0);
        const posY = parseFloat(document.getElementById('slider-pos-y').value || 0);
        const scale = parseFloat(document.getElementById('slider-scale').value || 1.0);

        ctx.save();
        ctx.translate(canvas.width / 2 + posX, canvas.height / 2 + posY);
        ctx.scale(scale, scale);
        ctx.drawImage(img, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
        ctx.restore();
      };
      img.src = this.selectedOverlay.file_path;
    }
  }

  // --- TAB 3: PRINT LAYOUT BUILDER ---
  populateLayoutForm() {
    if (!this.selectedLayout) return;
    document.getElementById('lay-name').value = this.selectedLayout.name;
    document.getElementById('lay-paper-size').value = this.selectedLayout.paper_size;
    document.getElementById('lay-orientation').value = this.selectedLayout.orientation || 'portrait';
    document.getElementById('lay-rows').value = this.selectedLayout.rows;
    document.getElementById('lay-cols').value = this.selectedLayout.cols;
    document.getElementById('lay-spacing').value = this.selectedLayout.spacing_px;
    document.getElementById('lay-margin').value = this.selectedLayout.margin_px;
    document.getElementById('lay-text-stamp').value = this.selectedLayout.text_stamp;
    document.getElementById('lay-show-qr').checked = this.selectedLayout.show_qr_on_print === 1;
  }

  renderLayoutBuilderCanvas() {
    const canvas = document.getElementById('layout-builder-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const paperSize = document.getElementById('lay-paper-size').value;
    const rows = parseInt(document.getElementById('lay-rows').value || 2);
    const cols = parseInt(document.getElementById('lay-cols').value || 2);
    const spacing = parseInt(document.getElementById('lay-spacing').value || 16);
    const margin = parseInt(document.getElementById('lay-margin').value || 20);
    const textStamp = document.getElementById('lay-text-stamp').value;

    if (paperSize === '2x6') {
      canvas.width = 400;
      canvas.height = 1200;
    } else {
      canvas.width = 800;
      canvas.height = 1200;
    }

    // Paper Base
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#8B5CF6';
    ctx.lineWidth = 12;
    ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

    // Calculate Grid Cells
    const availWidth = canvas.width - (margin * 2) - ((cols - 1) * spacing);
    const availHeight = canvas.height - 180 - (margin * 2) - ((rows - 1) * spacing);

    const cellW = availWidth / cols;
    const cellH = availHeight / rows;

    let shotNum = 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = margin + c * (cellW + spacing);
        const y = margin + 80 + r * (cellH + spacing);

        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(x, y, cellW, cellH);

        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 4;
        ctx.strokeRect(x, y, cellW, cellH);

        ctx.fillStyle = '#64748B';
        ctx.font = 'bold 24px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText(`Photo Cell ${shotNum}`, x + cellW/2, y + cellH/2);
        shotNum++;
      }
    }

    // Stamps
    ctx.fillStyle = '#8B5CF6';
    ctx.font = 'bold 26px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText("MIA'S 10TH BIRTHDAY", canvas.width / 2, 50);

    ctx.fillStyle = '#334155';
    ctx.font = 'bold 22px Plus Jakarta Sans';
    ctx.fillText(textStamp || "Mia's Birthday • Aug 15, 2026", canvas.width / 2, canvas.height - 50);
  }

  // --- TAB 4: PHOTO GALLERY ---
  async loadGallery() {
    try {
      const modeFilter = document.getElementById('filter-gallery-mode').value;
      const res = await fetch('/api/sessions/gallery');
      let photos = await res.json();

      if (modeFilter !== 'all') {
        photos = photos.filter(p => p.mode === modeFilter);
      }

      const grid = document.getElementById('gallery-cards-grid');
      grid.innerHTML = '';

      if (photos.length === 0) {
        grid.innerHTML = '<p class="text-muted">No photo sessions captured yet. Launch the kiosk to take photos!</p>';
        return;
      }

      photos.forEach(photo => {
        const card = document.createElement('div');
        card.className = 'gallery-card';
        card.innerHTML = `
          <img src="${photo.composited_path}" alt="Session Photo Sheet">
          <div class="gallery-card-body">
            <div class="flex-between">
              <strong>${photo.mode.toUpperCase()} MODE</strong>
              <span class="badge badge-success">${photo.upload_status}</span>
            </div>
            <p class="text-muted small">${new Date(photo.created_at).toLocaleString()}</p>
            <div class="actions mt-8">
              <a href="${photo.composited_path}" download="photobooth_${photo.photo_id}.jpg" class="btn-primary btn-sm">
                <i data-lucide="download"></i> HD Download
              </a>
              <a href="/share/${photo.share_token}" target="_blank" class="btn-secondary btn-sm">
                <i data-lucide="qr-code"></i> View Share
              </a>
            </div>
          </div>
        `;
        grid.appendChild(card);
      });
      lucide.createIcons();
    } catch (err) {
      console.error('Error loading gallery:', err);
    }
  }

  // --- TAB 5: CLOUD AUTO-UPLOAD ---
  async loadCloudStatus() {
    try {
      const res = await fetch('/api/cloud/status');
      const data = await res.json();

      if (data.config) {
        document.getElementById('cloud-provider').value = data.config.provider || 'google_drive';
        if (document.getElementById('cloud-client-id')) document.getElementById('cloud-client-id').value = data.config.client_id || '';
        if (document.getElementById('cloud-client-secret')) document.getElementById('cloud-client-secret').value = data.config.client_secret || '';
        document.getElementById('cloud-account').value = data.config.account_name || '';
        document.getElementById('cloud-folder').value = data.config.destination_folder || '';
        document.getElementById('cloud-sharing').value = data.config.sharing_permission || 'anyone_with_link';

        const label = document.getElementById('gdrive-account-label');
        if (data.config.is_connected && data.config.refresh_token) {
          label.innerHTML = `<span class="badge badge-success">CONNECTED</span> Authorized as <strong>${data.config.account_name}</strong>`;
        } else if (data.config.client_id || data.hasClientCredentials) {
          label.innerHTML = `<span class="badge badge-warning">READY TO CONNECT</span> API Credentials saved. Click button to authorize.`;
        } else {
          label.innerHTML = `<span class="badge badge-danger">NOT CONNECTED</span> Enter your Google OAuth Client ID & Secret below.`;
        }
      }

      document.getElementById('metric-cloud-pending').textContent = data.stats.pending;
      document.getElementById('metric-cloud-success').textContent = data.stats.success;
      document.getElementById('metric-cloud-failed').textContent = data.stats.failed;

      const list = document.getElementById('cloud-queue-list');
      list.innerHTML = '';

      data.recentUploads.forEach(item => {
        const el = document.createElement('div');
        el.className = 'queue-item-row';
        el.innerHTML = `
          <span>ID: ${item.id}</span>
          <span class="badge badge-${item.upload_status === 'success' ? 'success' : item.upload_status === 'failed' ? 'danger' : 'warning'}">${item.upload_status}</span>
          <span class="small text-muted">${new Date(item.created_at).toLocaleTimeString()}</span>
        `;
        list.appendChild(el);
      });
    } catch (err) {
      console.error('Error loading cloud status:', err);
    }
  }

  // --- TAB 6: SETTINGS & ANALYTICS ---
  async loadAnalyticsAndSettings() {
    try {
      const res = await fetch('/api/analytics/overview');
      const data = await res.json();

      document.getElementById('stat-total-sessions').textContent = data.metrics.totalSessions;
      document.getElementById('stat-total-prints').textContent = data.metrics.totalPrints;
      document.getElementById('stat-upload-rate').textContent = `${data.metrics.uploadSuccessRate}%`;

      const settingsRes = await fetch('/api/settings');
      const settings = await settingsRes.json();

      document.getElementById('set-countdown').value = settings.countdown_duration;
      document.getElementById('lbl-countdown').textContent = settings.countdown_duration;
      document.getElementById('set-retake').value = settings.retake_limit;
      document.getElementById('lbl-retake').textContent = settings.retake_limit;
      document.getElementById('set-timeout').value = settings.idle_timeout_sec;
      document.getElementById('lbl-timeout').textContent = settings.idle_timeout_sec;
      document.getElementById('set-printer-mode').value = settings.printer_mode;
      document.getElementById('set-audio').checked = settings.audio_effects_enabled === 1;
    } catch (err) {
      console.error('Error loading analytics:', err);
    }
  }

  // --- FORM HANDLERS ---
  bindFormEvents() {
    // Event Setup Form Submit
    document.getElementById('form-event-setup').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const payload = {
          name: document.getElementById('evt-name').value,
          event_date: document.getElementById('evt-date').value,
          welcome_slogan: document.getElementById('evt-slogan').value,
          bg_image_url: document.getElementById('evt-bg-url').value,
          theme_primary: document.getElementById('evt-color-primary').value,
          theme_secondary: document.getElementById('evt-color-secondary').value,
          theme_bg_color: document.getElementById('evt-color-bg').value
        };

        const res = await fetch(`/api/events/${this.currentEvent ? this.currentEvent.id : 'evt_mia10th'}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.success) {
          alert('Event profile updated successfully!');
          this.loadAllData();
        }
      } catch (err) {
        alert('Error updating event: ' + err.message);
      }
    });

    // Color Pickers Live Input
    ['evt-color-primary', 'evt-color-secondary'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.updateThemePreview());
    });

    // WYSIWYG Sliders Live Input
    ['slider-pos-x', 'slider-pos-y', 'slider-scale'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => {
        document.getElementById('val-pos-x').textContent = document.getElementById('slider-pos-x').value;
        document.getElementById('val-pos-y').textContent = document.getElementById('slider-pos-y').value;
        document.getElementById('val-scale').textContent = document.getElementById('slider-scale').value;
        this.renderWysiwygCanvas();
      });
    });

    // Set Active Overlay Button
    document.getElementById('btn-set-active-overlay').addEventListener('click', async () => {
      if (!this.selectedOverlay) return alert('Select an overlay first');
      try {
        const res = await fetch(`/api/overlays/${this.selectedOverlay.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: 1 })
        });
        const data = await res.json();
        if (data.success) {
          alert('Selected overlay set as Active Kiosk Frame!');
          this.loadAllData();
        }
      } catch (err) {
        alert('Error setting active overlay: ' + err.message);
      }
    });

    // Upload New Overlay Form Submit
    document.getElementById('form-upload-overlay').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('upload-ovl-file');
      if (!fileInput.files || fileInput.files.length === 0) return alert('Select a PNG file');

      const formData = new FormData();
      formData.append('overlay_file', fileInput.files[0]);
      formData.append('name', document.getElementById('upload-ovl-name').value);
      formData.append('event_id', this.currentEvent ? this.currentEvent.id : 'evt_mia10th');

      try {
        const res = await fetch('/api/overlays/upload', {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        if (data.success) {
          alert('New transparent overlay uploaded successfully!');
          document.getElementById('form-upload-overlay').reset();
          this.loadAllData();
        }
      } catch (err) {
        alert('Upload error: ' + err.message);
      }
    });

    // Layout Builder Inputs Live Change
    ['lay-paper-size', 'lay-rows', 'lay-cols', 'lay-spacing', 'lay-margin', 'lay-text-stamp'].forEach(id => {
      document.getElementById(id).addEventListener('input', () => this.renderLayoutBuilderCanvas());
    });

    // Save Print Layout Form Submit
    document.getElementById('form-layout-settings').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const payload = {
          name: document.getElementById('lay-name').value,
          paper_size: document.getElementById('lay-paper-size').value,
          orientation: document.getElementById('lay-orientation').value,
          rows: parseInt(document.getElementById('lay-rows').value),
          cols: parseInt(document.getElementById('lay-cols').value),
          spacing_px: parseInt(document.getElementById('lay-spacing').value),
          margin_px: parseInt(document.getElementById('lay-margin').value),
          text_stamp: document.getElementById('lay-text-stamp').value,
          show_qr_on_print: document.getElementById('lay-show-qr').checked,
          is_active: 1
        };

        const layoutId = this.selectedLayout ? this.selectedLayout.id : 'lay_4x6_grid';
        const res = await fetch(`/api/layouts/${layoutId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          alert('Print layout template updated and activated!');
          this.loadAllData();
        }
      } catch (err) {
        alert('Error saving print layout: ' + err.message);
      }
    });

    // Connect Google Drive OAuth Button
    document.getElementById('btn-connect-gdrive').addEventListener('click', async () => {
      try {
        const res = await fetch('/api/cloud/gdrive/auth-url');
        if (!res.ok) {
          const errText = await res.text();
          return alert('Server returned an error: ' + errText);
        }
        const data = await res.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        } else {
          alert(data.error || 'Failed generating authorization link');
        }
      } catch (err) {
        alert('Error connecting Google Drive: ' + err.message);
      }
    });

    // Save Cloud Storage Config Form Submit
    document.getElementById('form-cloud-config').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const payload = {
          provider: document.getElementById('cloud-provider').value,
          client_id: document.getElementById('cloud-client-id') ? document.getElementById('cloud-client-id').value.trim() : null,
          client_secret: document.getElementById('cloud-client-secret') ? document.getElementById('cloud-client-secret').value.trim() : null,
          account_name: document.getElementById('cloud-account').value,
          destination_folder: document.getElementById('cloud-folder').value,
          sharing_permission: document.getElementById('cloud-sharing').value
        };

        const res = await fetch('/api/cloud/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          alert('Cloud storage settings updated successfully!');
          this.loadCloudStatus();
        }
      } catch (err) {
        alert('Error saving cloud config: ' + err.message);
      }
    });

    // Retry Failed Uploads Button
    document.getElementById('btn-retry-failed-uploads').addEventListener('click', async () => {
      try {
        const res = await fetch('/api/cloud/retry-all', { method: 'POST' });
        const data = await res.json();
        alert(data.message || 'Queued failed uploads for retry.');
        this.loadCloudStatus();
      } catch (err) {
        alert('Error retrying uploads: ' + err.message);
      }
    });

    // Global Kiosk Settings Form Submit
    document.getElementById('form-kiosk-settings').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const payload = {
          countdown_duration: parseInt(document.getElementById('set-countdown').value),
          retake_limit: parseInt(document.getElementById('set-retake').value),
          idle_timeout_sec: parseInt(document.getElementById('set-timeout').value),
          printer_mode: document.getElementById('set-printer-mode').value,
          audio_effects_enabled: document.getElementById('set-audio').checked
        };

        const res = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          alert('Kiosk hardware settings updated!');
          this.loadAnalyticsAndSettings();
        }
      } catch (err) {
        alert('Error saving settings: ' + err.message);
      }
    });

    // Slider range label updates
    document.getElementById('set-countdown').addEventListener('input', (e) => {
      document.getElementById('lbl-countdown').textContent = e.target.value;
    });
    document.getElementById('set-retake').addEventListener('input', (e) => {
      document.getElementById('lbl-retake').textContent = e.target.value;
    });
    document.getElementById('set-timeout').addEventListener('input', (e) => {
      document.getElementById('lbl-timeout').textContent = e.target.value;
    });
  }
}

// Instantiate Admin Portal on load
window.addEventListener('DOMContentLoaded', () => {
  window.photoboothAdmin = new PhotoboothAdmin();
});
