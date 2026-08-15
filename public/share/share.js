// Public Guest Download Portal Engine

class GuestSharePortal {
  constructor() {
    this.token = this.extractTokenFromUrl();
    this.photoData = null;
    this.init();
  }

  extractTokenFromUrl() {
    const parts = window.location.pathname.split('/');
    return parts[parts.length - 1] || '';
  }

  async init() {
    lucide.createIcons();
    if (!this.token) {
      alert('Invalid or missing photo token');
      return;
    }
    await this.fetchPhotoDetails();
    this.bindEvents();
  }

  async fetchPhotoDetails() {
    try {
      const res = await fetch(`/api/sessions/share/${this.token}`);
      if (!res.ok) throw new Error('Photo not found');

      const data = await res.json();
      this.photoData = data;

      // Populate UI
      document.getElementById('share-event-name').textContent = data.event_name || "Mia's 10th Birthday Bash!";
      document.getElementById('share-event-date').textContent = data.event_date || 'August 15, 2026';

      const imgEl = document.getElementById('share-photo-img');
      imgEl.src = data.composited_path;

      const downloadBtn = document.getElementById('btn-download-hd');
      downloadBtn.href = data.composited_path;
      downloadBtn.download = `photobooth_memory_${data.share_token}.jpg`;

      if (data.cloud_url) {
        const gdriveBtn = document.getElementById('btn-open-gdrive');
        gdriveBtn.href = data.cloud_url;
        gdriveBtn.style.display = 'inline-flex';
      }

      // Populate Raw Snapshots
      const rawGrid = document.getElementById('raw-shots-grid');
      rawGrid.innerHTML = '';
      if (Array.isArray(data.raw_paths) && data.raw_paths.length > 0) {
        data.raw_paths.forEach((path, idx) => {
          const img = document.createElement('img');
          img.src = path;
          img.alt = `Raw Snapshot ${idx + 1}`;
          rawGrid.appendChild(img);
        });
      } else {
        document.getElementById('raw-shots-section').style.display = 'none';
      }

    } catch (err) {
      console.error('Error fetching share photo:', err);
      alert('Photo memory not found or expired.');
    }
  }

  bindEvents() {
    // WhatsApp Share
    document.getElementById('btn-share-whatsapp').addEventListener('click', () => {
      const text = encodeURIComponent(`Check out my photobooth picture from ${this.photoData ? this.photoData.event_name : 'the party'}! ${window.location.href}`);
      window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    });

    // Native Web Share API
    document.getElementById('btn-share-native').addEventListener('click', async () => {
      if (navigator.share) {
        try {
          await navigator.share({
            title: this.photoData ? this.photoData.event_name : 'Party Photobooth',
            text: 'Check out my photobooth photo!',
            url: window.location.href
          });
        } catch (e) {}
      } else {
        alert('Web Share API not supported on this browser. Copy the URL to share!');
      }
    });

    // Copy Link
    document.getElementById('btn-copy-link').addEventListener('click', () => {
      navigator.clipboard.writeText(window.location.href);
      alert('Photo link copied to clipboard!');
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GuestSharePortal();
});
