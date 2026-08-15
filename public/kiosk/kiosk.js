// Photobooth Touchscreen Kiosk Engine

class PhotoboothKiosk {
  constructor() {
    this.currentScreen = 'welcome';
    this.eventData = null;
    this.activeOverlay = null;
    this.activeLayout = null;
    this.settings = null;

    // Session State
    this.selectedMode = '3-up'; // Default mode
    this.capturedSnapshots = []; // Array of base64 data URLs
    this.currentShotIndex = 0;
    this.targetShotsCount = 3;
    this.retakesRemaining = 2;
    this.selectedAction = 'both'; // print, share, both
    this.compositedDataUrl = null;
    this.sessionResult = null;

    // Camera Stream
    this.mediaStream = null;
    this.isSimulatedCamera = false;
    this.simulatedAnimFrame = null;

    // Countdown & Timers
    this.countdownTimer = null;
    this.idleTimer = null;
    this.resetTimer = null;

    // Audio Synthesizer (Web Audio API)
    this.audioCtx = null;

    this.init();
  }

  async init() {
    try {
      lucide.createIcons();
      this.bindEvents();
      await this.loadActiveEvent();
      this.setupWebcam();
      this.resetIdleTimer();
    } catch (err) {
      console.error('Error initializing Photobooth Kiosk:', err);
    }
  }

  // --- API DATA LOADING ---
  async loadActiveEvent() {
    try {
      const res = await fetch('/api/events/active');
      const data = await res.json();

      this.eventData = data.event;
      this.activeOverlay = data.activeOverlay;
      this.activeLayout = data.activeLayout;
      this.settings = data.settings || { countdown_duration: 3, retake_limit: 2, idle_timeout_sec: 35 };
      this.retakesRemaining = this.settings.retake_limit;

      this.applyEventBranding();
    } catch (err) {
      console.error('Failed loading event config:', err);
    }
  }

  applyEventBranding() {
    if (!this.eventData) return;

    // Event Header & Welcome
    document.getElementById('header-event-name').textContent = this.eventData.name;
    document.getElementById('header-event-date').textContent = this.eventData.event_date;
    document.getElementById('welcome-title').textContent = this.eventData.name;
    document.getElementById('welcome-slogan').textContent = this.eventData.welcome_slogan;

    // Apply Overlay Image to Live Viewfinder
    if (this.activeOverlay && this.activeOverlay.file_path) {
      document.getElementById('live-overlay-img').src = this.activeOverlay.file_path;
    }

    // Apply Retake count text
    document.getElementById('retake-count-text').textContent = this.retakesRemaining;
    document.getElementById('retake-left-count').textContent = this.retakesRemaining;
  }

  // --- WEBCAM & SIMULATED CAMERA FALLBACK ---
  async setupWebcam() {
    const videoEl = document.getElementById('webcam-feed');
    const canvasEl = document.getElementById('simulated-feed-canvas');

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' },
          audio: false
        });
        videoEl.srcObject = this.mediaStream;
        videoEl.style.display = 'block';
        canvasEl.style.display = 'none';
        this.isSimulatedCamera = false;
        console.log('[Kiosk] Hardware camera stream connected.');
      } else {
        throw new Error('getUserMedia not supported on browser');
      }
    } catch (err) {
      console.warn('[Kiosk] Hardware camera not available. Switching to realistic Simulated Camera feed:', err.message);
      videoEl.style.display = 'none';
      canvasEl.style.display = 'block';
      this.isSimulatedCamera = true;
      this.startSimulatedCameraFeed(canvasEl);
    }
  }

  startSimulatedCameraFeed(canvas) {
    const ctx = canvas.getContext('2d');
    canvas.width = 1280;
    canvas.height = 960;
    let frame = 0;

    const renderSimulatedFrame = () => {
      frame++;
      // Draw festive studio backdrop with animated party glow & simulated posing guest avatar
      ctx.fillStyle = '#1E1B4B';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Radial Studio Spotlight
      const grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 50, canvas.width/2, canvas.height/2, 600);
      grad.addColorStop(0, '#312E81');
      grad.addColorStop(1, '#0F172A');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Party Bokeh Lights
      for (let i = 0; i < 15; i++) {
        const x = (Math.sin(frame * 0.02 + i) * 0.4 + 0.5) * canvas.width;
        const y = (Math.cos(frame * 0.03 + i) * 0.4 + 0.5) * canvas.height;
        ctx.beginPath();
        ctx.arc(x, y, 30 + (i % 5) * 10, 0, Math.PI * 2);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(236, 72, 153, 0.25)' : 'rgba(245, 158, 11, 0.25)';
        ctx.fill();
      }

      // Animated Posing Silhouettes / Party Props
      ctx.fillStyle = '#F43F5E';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, canvas.height / 2 - 40, 140, 0, Math.PI * 2); // Head
      ctx.fill();

      ctx.fillStyle = '#8B5CF6';
      ctx.beginPath();
      ctx.ellipse(canvas.width / 2, canvas.height / 2 + 320, 260, 220, 0, 0, Math.PI * 2); // Body
      ctx.fill();

      // Party Hat
      ctx.fillStyle = '#FDE047';
      ctx.beginPath();
      ctx.moveTo(canvas.width / 2 - 80, canvas.height / 2 - 160);
      ctx.lineTo(canvas.width / 2, canvas.height / 2 - 340);
      ctx.lineTo(canvas.width / 2 + 80, canvas.height / 2 - 160);
      ctx.closePath();
      ctx.fill();

      // Live "SIMULATED WEBCAM FEED" text badge
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.font = 'bold 24px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('LIVE STUDIO CAMERA FEED', canvas.width / 2, canvas.height - 40);

      this.simulatedAnimFrame = requestAnimationFrame(renderSimulatedFrame);
    };

    renderSimulatedFrame();
  }

  // --- AUDIO SYNTHESIZER ---
  playAudioBeep(freq = 800, duration = 0.15) {
    if (this.settings && this.settings.audio_effects_enabled === 0) return;
    try {
      if (!this.audioCtx) this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.3, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {}
  }

  playShutterSound() {
    this.playAudioBeep(1200, 0.08);
    setTimeout(() => this.playAudioBeep(600, 0.1), 90);
  }

  playSuccessFanfare() {
    this.playAudioBeep(523.25, 0.12);
    setTimeout(() => this.playAudioBeep(659.25, 0.12), 140);
    setTimeout(() => this.playAudioBeep(783.99, 0.3), 280);
  }

  // --- NAVIGATION & SCREENS ---
  switchScreen(screenId) {
    document.querySelectorAll('.kiosk-screen').forEach(s => s.classList.remove('active'));
    const target = document.getElementById(`screen-${screenId}`);
    if (target) {
      target.classList.add('active');
      this.currentScreen = screenId;
    }
    this.resetIdleTimer();
  }

  resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.currentScreen !== 'welcome') {
      const timeoutSec = (this.settings && this.settings.idle_timeout_sec) || 35;
      this.idleTimer = setTimeout(() => {
        console.log('[Kiosk] Session idle timeout reached. Returning to Welcome screen.');
        this.resetSessionState();
        this.switchScreen('welcome');
      }, timeoutSec * 1000);
    }
  }

  resetSessionState() {
    this.capturedSnapshots = [];
    this.currentShotIndex = 0;
    this.retakesRemaining = (this.settings && this.settings.retake_limit) || 2;
    this.compositedDataUrl = null;
    this.sessionResult = null;
    if (this.resetTimer) clearInterval(this.resetTimer);
  }

  // --- EVENT BINDINGS ---
  bindEvents() {
    // Touch screen anywhere on welcome screen or click button
    document.getElementById('btn-start-session').addEventListener('click', () => {
      this.playAudioBeep(800, 0.1);
      this.switchScreen('mode');
    });

    // Mode Selection Cards
    document.querySelectorAll('.mode-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedMode = card.dataset.mode;
        this.playAudioBeep(700, 0.1);
      });
    });

    document.getElementById('btn-mode-back').addEventListener('click', () => this.switchScreen('welcome'));
    document.getElementById('btn-mode-next').addEventListener('click', () => {
      // Determine shots count
      if (this.selectedMode === '1-up') this.targetShotsCount = 1;
      else if (this.selectedMode === '3-up') this.targetShotsCount = 3;
      else if (this.selectedMode === '4-up') this.targetShotsCount = 4;
      else this.targetShotsCount = 4;

      this.switchScreen('capture');
      this.setupCaptureScreen();
    });

    // Manual Capture Trigger
    document.getElementById('btn-trigger-capture').addEventListener('click', () => {
      this.startCountdownCaptureSequence();
    });

    // Back to Layouts from Capture Screen
    const captureBackBtn = document.getElementById('btn-capture-back');
    if (captureBackBtn) {
      captureBackBtn.addEventListener('click', () => {
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        const countdownOverlay = document.getElementById('countdown-overlay');
        if (countdownOverlay) countdownOverlay.classList.remove('active');
        this.playAudioBeep(600, 0.1);
        this.capturedSnapshots = [];
        this.currentShotIndex = 0;
        this.switchScreen('mode');
      });
    }

    // Action button on preview
    const shareBtn = document.getElementById('btn-action-share');
    if (shareBtn) {
      shareBtn.addEventListener('click', () => {
        this.selectedAction = 'share';
        this.playAudioBeep(600, 0.1);
      });
    }

    // Retake Button
    document.getElementById('btn-preview-retake').addEventListener('click', () => {
      if (this.retakesRemaining > 0) {
        this.retakesRemaining--;
        document.getElementById('retake-count-text').textContent = this.retakesRemaining;
        document.getElementById('retake-left-count').textContent = this.retakesRemaining;
        this.capturedSnapshots = [];
        this.currentShotIndex = 0;
        this.switchScreen('capture');
        this.setupCaptureScreen();
      } else {
        alert('No retakes remaining for this session!');
      }
    });

    // Confirm & Submit Session
    document.getElementById('btn-confirm-session').addEventListener('click', () => {
      this.submitPhotoSession();
    });

    // Finish Early button on complete screen
    document.getElementById('btn-finish-early').addEventListener('click', () => {
      this.resetSessionState();
      this.switchScreen('welcome');
    });
  }

  // --- CAMERA CAPTURE SEQUENCE ---
  setupCaptureScreen() {
    this.capturedSnapshots = [];
    this.currentShotIndex = 0;
    this.updateShotProgressDots();
  }

  updateShotProgressDots() {
    const dotsContainer = document.getElementById('shot-dots-container');
    dotsContainer.innerHTML = '';
    for (let i = 0; i < this.targetShotsCount; i++) {
      const dot = document.createElement('div');
      dot.className = 'shot-dot';
      if (i < this.currentShotIndex) dot.classList.add('done');
      else if (i === this.currentShotIndex) dot.classList.add('active');
      dotsContainer.appendChild(dot);
    }
    document.getElementById('shot-progress-text').textContent = `Shot ${this.currentShotIndex + 1} of ${this.targetShotsCount}`;
  }

  startCountdownCaptureSequence() {
    const countdownOverlay = document.getElementById('countdown-overlay');
    const countdownNum = document.getElementById('countdown-number');
    let count = (this.settings && this.settings.countdown_duration) || 3;

    countdownOverlay.classList.add('active');
    countdownNum.textContent = count;
    this.playAudioBeep(600, 0.15);

    this.countdownTimer = setInterval(() => {
      count--;
      if (count > 0) {
        countdownNum.textContent = count;
        this.playAudioBeep(600, 0.15);
      } else {
        clearInterval(this.countdownTimer);
        countdownOverlay.classList.remove('active');
        this.takeSnapshot();
      }
    }, 1000);
  }

  takeSnapshot() {
    // Shutter Flash Effect
    const flashEl = document.getElementById('flash-layer');
    flashEl.classList.add('flash-active');
    this.playShutterSound();
    setTimeout(() => flashEl.classList.remove('flash-active'), 500);

    // Grab Frame from Video or Simulated Canvas
    let snapshotDataUrl = null;
    if (!this.isSimulatedCamera && this.mediaStream) {
      const video = document.getElementById('webcam-feed');
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = video.videoWidth || 1280;
      tempCanvas.height = video.videoHeight || 960;
      const ctx = tempCanvas.getContext('2d');
      // Flip horizontally for true photo orientation
      ctx.translate(tempCanvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
      snapshotDataUrl = tempCanvas.toDataURL('image/jpeg', 0.92);
    } else {
      const simCanvas = document.getElementById('simulated-feed-canvas');
      snapshotDataUrl = simCanvas.toDataURL('image/jpeg', 0.92);
    }

    this.capturedSnapshots.push(snapshotDataUrl);
    this.currentShotIndex++;

    if (this.currentShotIndex < this.targetShotsCount) {
      this.updateShotProgressDots();
      // Auto-trigger next shot after brief 1.5s pose pause
      setTimeout(() => this.startCountdownCaptureSequence(), 1500);
    } else {
      // All shots completed! Render print sheet layout
      this.updateShotProgressDots();
      this.renderCompositedPrintSheet();
    }
  }

  // --- CLIENT-SIDE CANVAS PRINT SHEET COMPOSITOR (LANDSCAPE ORIENTATION) ---
  renderCompositedPrintSheet() {
    // Dynamically match layout grid to selected mode (Landscape orientation)
    let rows = 2;
    let cols = 2;
    let paperSize = '4x6';

    if (this.selectedMode === '1-up' || this.capturedSnapshots.length === 1) {
      rows = 1;
      cols = 1;
      paperSize = '4x6';
    } else if (this.selectedMode === '3-up' || this.capturedSnapshots.length === 3) {
      rows = 1;
      cols = 3;
      paperSize = '2x6';
    } else if (this.selectedMode === '4-up' || this.capturedSnapshots.length === 4) {
      rows = 2;
      cols = 2;
      paperSize = '4x6';
    } else {
      cols = Math.ceil(Math.sqrt(this.capturedSnapshots.length));
      rows = Math.ceil(this.capturedSnapshots.length / cols);
    }

    const layout = {
      paper_size: paperSize,
      orientation: 'landscape',
      rows: rows,
      cols: cols,
      spacing_px: paperSize === '2x6' ? 14 : 18,
      margin_px: paperSize === '2x6' ? 18 : 26,
      border_color: '#FFFFFF',
      border_width_px: 6,
      text_stamp: (this.eventData ? this.eventData.name : "Mia's 10th Birthday!") + " • " + (this.eventData ? this.eventData.event_date : "Aug 15, 2026")
    };

    const canvas = document.getElementById('final-composite-canvas');
    const ctx = canvas.getContext('2d');

    // Resolution: High-DPI 6x4" Landscape print quality (1800 x 1200 px) or 6x2" horizontal strip (1800 x 600 px)
    if (layout.paper_size === '2x6') {
      canvas.width = 1800;
      canvas.height = 600;
    } else {
      canvas.width = 1800;
      canvas.height = 1200;
    }

    // 1. Draw Paper Background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative Paper Border
    ctx.strokeStyle = this.eventData ? this.eventData.theme_primary : '#8B5CF6';
    ctx.lineWidth = 16;
    ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);

    // 2. Calculate Grid Cell Positions
    const margin = layout.margin_px * 2;
    const spacing = layout.spacing_px * 2;
    const headerFooterHeight = 220; // Space for event header and bottom text stamp

    const availableWidth = canvas.width - (margin * 2) - ((layout.cols - 1) * spacing);
    const availableHeight = canvas.height - headerFooterHeight - (margin * 2) - ((layout.rows - 1) * spacing);

    const cellWidth = availableWidth / layout.cols;
    const cellHeight = availableHeight / layout.rows;

    let shotIdx = 0;
    const loadedImages = new Array(this.capturedSnapshots.length);
    let imagesProcessed = 0;

    const drawGridAndOverlay = () => {
      for (let r = 0; r < layout.rows; r++) {
        for (let c = 0; c < layout.cols; c++) {
          if (shotIdx >= loadedImages.length) break;

          const x = margin + c * (cellWidth + spacing);
          const y = margin + 110 + r * (cellHeight + spacing);

          // Draw Photo Frame Drop Shadow
          ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
          ctx.shadowBlur = 12;
          ctx.fillStyle = '#F8FAFC';
          ctx.fillRect(x, y, cellWidth, cellHeight);
          ctx.shadowBlur = 0;

          // Draw Image with Object-Fit Cover Cropping
          const img = loadedImages[shotIdx];
          if (img) {
            const imgAspect = img.width / img.height;
            const cellAspect = cellWidth / cellHeight;
            let sx, sy, sw, sh;

            if (imgAspect > cellAspect) {
              sh = img.height;
              sw = img.height * cellAspect;
              sx = (img.width - sw) / 2;
              sy = 0;
            } else {
              sw = img.width;
              sh = img.width / cellAspect;
              sx = 0;
              sy = (img.height - sh) / 2;
            }

            ctx.drawImage(img, sx, sy, sw, sh, x, y, cellWidth, cellHeight);
          }

          // Cell Inner Border
          ctx.strokeStyle = layout.border_color || '#FFFFFF';
          ctx.lineWidth = layout.border_width_px || 6;
          ctx.strokeRect(x, y, cellWidth, cellHeight);

          shotIdx++;
        }
      }

      // 3. Draw Event Header Stamp
      ctx.fillStyle = this.eventData ? this.eventData.theme_primary : '#8B5CF6';
      ctx.font = 'bold ' + (layout.paper_size === '2x6' ? '30px' : '38px') + ' Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((this.eventData ? this.eventData.name : "Mia's Birthday").toUpperCase(), canvas.width / 2, 70);

      // 4. Draw Bottom Date & Text Stamp
      ctx.fillStyle = layout.text_color || '#334155';
      ctx.font = 'bold ' + (layout.paper_size === '2x6' ? '24px' : '30px') + ' Plus Jakarta Sans, sans-serif';
      ctx.fillText(layout.text_stamp || "Mia's 10th Birthday! • Aug 15, 2026", canvas.width / 2, canvas.height - 70);

      // 5. Draw PNG Overlay over entire sheet if active
      if (this.activeOverlay && this.activeOverlay.file_path) {
        const overlayImg = new Image();
        overlayImg.onload = () => {
          ctx.drawImage(overlayImg, 0, 0, canvas.width, canvas.height);
          this.compositedDataUrl = canvas.toDataURL('image/jpeg', 0.94);
          this.switchScreen('preview');
        };
        overlayImg.onerror = () => {
          this.compositedDataUrl = canvas.toDataURL('image/jpeg', 0.94);
          this.switchScreen('preview');
        };
        overlayImg.src = this.activeOverlay.file_path;
      } else {
        this.compositedDataUrl = canvas.toDataURL('image/jpeg', 0.94);
        this.switchScreen('preview');
      }
    };

    // Preload captured images in exact sequence order
    this.capturedSnapshots.forEach((src, idx) => {
      const img = new Image();
      img.onload = () => {
        loadedImages[idx] = img;
        imagesProcessed++;
        if (imagesProcessed === this.capturedSnapshots.length) {
          drawGridAndOverlay();
        }
      };
      img.src = src;
    });
  }

  // --- SUBMIT SESSION & QR RESULT ---
  async submitPhotoSession() {
    try {
      // 1. Immediately transition to completion page so user doesn't wait on preview page
      this.switchScreen('complete');
      this.showPendingCompletionScreen();

      const payload = {
        event_id: this.eventData ? this.eventData.id : 'evt_mia10th',
        mode: this.selectedMode,
        retakes_used: (this.settings.retake_limit || 2) - this.retakesRemaining,
        guest_action: this.selectedAction,
        raw_images: this.capturedSnapshots,
        composited_image: this.compositedDataUrl
      };

      const res = await fetch('/api/sessions/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Failed saving session');

      this.sessionResult = result;
      this.playSuccessFanfare();
      this.displayCompletionScreen(result);
    } catch (err) {
      console.error('Error saving session:', err);
      const qrUrlText = document.getElementById('final-qr-url');
      if (qrUrlText) qrUrlText.textContent = 'Error saving session: ' + err.message;
    }
  }

  showPendingCompletionScreen() {
    const loadingBox = document.getElementById('qr-loading-container');
    const imgWrapper = document.getElementById('qr-img-wrapper');
    const qrLinkBadge = document.getElementById('final-qr-link-badge');
    const qrTipText = document.getElementById('qr-tip-text');
    const boxTitle = document.getElementById('qr-box-title');

    if (loadingBox) loadingBox.style.display = 'flex';
    if (imgWrapper) imgWrapper.style.display = 'none';
    if (qrLinkBadge) qrLinkBadge.style.display = 'none';
    if (qrTipText) qrTipText.style.display = 'none';
    if (boxTitle) boxTitle.textContent = 'Preparing Your Photo...';
    if (window.lucide) lucide.createIcons();
  }

  displayCompletionScreen(result) {
    const loadingBox = document.getElementById('qr-loading-container');
    const imgWrapper = document.getElementById('qr-img-wrapper');
    const qrImg = document.getElementById('final-qr-img');
    const qrUrlText = document.getElementById('final-qr-url');
    const qrLinkBadge = document.getElementById('final-qr-link-badge');
    const qrTipText = document.getElementById('qr-tip-text');
    const boxTitle = document.getElementById('qr-box-title');

    const showQrSuccess = (qrUrl, driveUrl) => {
      if (loadingBox) loadingBox.style.display = 'none';
      if (imgWrapper) imgWrapper.style.display = 'inline-block';
      if (qrImg) {
        qrImg.src = qrUrl.startsWith('data:') ? qrUrl : (qrUrl + '?t=' + Date.now());
        qrImg.style.display = 'block';
      }
      if (qrUrlText) qrUrlText.textContent = driveUrl;
      if (qrLinkBadge) {
        qrLinkBadge.href = driveUrl;
        qrLinkBadge.style.display = 'inline-flex';
      }
      if (qrTipText) qrTipText.style.display = 'flex';
      if (boxTitle) boxTitle.textContent = 'Scan QR Code to Download';
      if (window.lucide) lucide.createIcons();
    };

    const isGDriveUrl = (url) => typeof url === 'string' && (url.includes('drive.google.com') || url.includes('google.com'));

    // Check if initial result already contains a direct Google Drive link
    if (result && isGDriveUrl(result.cloudUrl) && (result.qrDataUrl || result.qrCodeUrl)) {
      showQrSuccess(result.qrDataUrl || result.qrCodeUrl, result.cloudUrl);
    } else {
      if (loadingBox) loadingBox.style.display = 'flex';
      if (imgWrapper) imgWrapper.style.display = 'none';
      if (qrLinkBadge) qrLinkBadge.style.display = 'none';
      if (qrTipText) qrTipText.style.display = 'none';
      if (boxTitle) boxTitle.textContent = 'Preparing Your Photo...';
    }

    if (result && result.photoId) {
      // Poll background cloud worker status until Google Drive upload completes with direct GDrive link
      const pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`/api/sessions/status/${result.photoId}`);
          const statusData = await res.json();
          
          if (statusData.upload_status === 'success' && statusData.cloud_url && isGDriveUrl(statusData.cloud_url) && statusData.qr_code_path) {
            clearInterval(pollInterval);
            showQrSuccess(statusData.qr_code_path, statusData.cloud_url);
          } else if (statusData.upload_status === 'failed') {
            clearInterval(pollInterval);
            if (loadingBox) loadingBox.style.display = 'none';
            if (qrUrlText) qrUrlText.textContent = 'Upload failed: ' + (statusData.last_error || 'Unknown error');
          }
        } catch (e) {}
      }, 500);
    }
  }
}

// Instantiate Kiosk Application on load
window.addEventListener('DOMContentLoaded', () => {
  window.photoboothKiosk = new PhotoboothKiosk();
});
