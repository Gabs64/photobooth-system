const fs = require('fs');
const path = require('path');

// Ensure overlay directory exists
const overlayDir = path.join(__dirname, '..', 'public', 'uploads', 'overlays');
if (!fs.existsSync(overlayDir)) {
  fs.mkdirSync(overlayDir, { recursive: true });
}

// Generate SVG string for Birthday Gold Frame with transparency and convert to saved file or SVG-data PNG
const birthdaySvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
  <defs>
    <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FDE047" />
      <stop offset="50%" stop-color="#EAB308" />
      <stop offset="100%" stop-color="#CA8A04" />
    </linearGradient>
    <linearGradient id="roseGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#EC4899" />
      <stop offset="100%" stop-color="#8B5CF6" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="6" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Outer Border Frame -->
  <rect x="30" y="30" width="1140" height="1540" rx="30" fill="none" stroke="url(#goldGrad)" stroke-width="24" filter="url(#glow)"/>
  <rect x="54" y="54" width="1092" height="1492" rx="20" fill="none" stroke="#FFFFFF" stroke-width="4" stroke-dasharray="16 12" opacity="0.8"/>

  <!-- Top Decorative Banner -->
  <path d="M 250 30 Q 600 120 950 30 L 900 140 Q 600 200 300 140 Z" fill="url(#roseGrad)" opacity="0.95"/>
  <text x="600" y="115" font-family="'Segoe UI', Arial, sans-serif" font-size="52" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="4" filter="url(#glow)">★ MIA'S 10TH BIRTHDAY ★</text>

  <!-- Festive Confetti Sprinkles -->
  <circle cx="120" cy="120" r="14" fill="#F43F5E" />
  <circle cx="1080" cy="130" r="18" fill="#3B82F6" />
  <rect x="180" y="200" width="20" height="20" rx="4" fill="#EAB308" transform="rotate(25 190 210)"/>
  <rect x="1000" y="220" width="24" height="24" rx="4" fill="#10B981" transform="rotate(45 1012 232)"/>
  <polygon points="150,1400 170,1440 130,1440" fill="#EC4899" />
  <polygon points="1050,1420 1070,1460 1030,1460" fill="#8B5CF6" />

  <!-- Bottom Badge Banner -->
  <rect x="250" y="1420" width="700" height="110" rx="25" fill="#0F172A" opacity="0.9" stroke="url(#goldGrad)" stroke-width="6"/>
  <text x="600" y="1488" font-family="'Segoe UI', Arial, sans-serif" font-size="44" font-weight="800" fill="#FDE047" text-anchor="middle" letter-spacing="2">HAPPY BIRTHDAY MIA!</text>
</svg>
`;

const neonSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600" viewBox="0 0 1200 1600">
  <defs>
    <linearGradient id="neonGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06B6D4" />
      <stop offset="50%" stop-color="#3B82F6" />
      <stop offset="100%" stop-color="#D946EF" />
    </linearGradient>
    <filter id="neonGlow">
      <feGaussianBlur stdDeviation="12" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Double Neon Border -->
  <rect x="40" y="40" width="1120" height="1520" rx="40" fill="none" stroke="#06B6D4" stroke-width="16" filter="url(#neonGlow)"/>
  <rect x="70" y="70" width="1060" height="1460" rx="30" fill="none" stroke="#E0E7FF" stroke-width="6" opacity="0.9"/>

  <!-- Neon Header Text -->
  <text x="600" y="140" font-family="'Impact', Arial, sans-serif" font-size="70" font-weight="bold" fill="#F43F5E" text-anchor="middle" filter="url(#neonGlow)" letter-spacing="6">PARTY TIME!</text>

  <!-- Neon Corner Ornaments -->
  <circle cx="100" cy="100" r="30" fill="none" stroke="#D946EF" stroke-width="8" filter="url(#neonGlow)"/>
  <circle cx="1100" cy="100" r="30" fill="none" stroke="#06B6D4" stroke-width="8" filter="url(#neonGlow)"/>
  <circle cx="100" cy="1500" r="30" fill="none" stroke="#06B6D4" stroke-width="8" filter="url(#neonGlow)"/>
  <circle cx="1100" cy="1500" r="30" fill="none" stroke="#D946EF" stroke-width="8" filter="url(#neonGlow)"/>

  <!-- Footer Tag -->
  <rect x="300" y="1440" width="600" height="90" rx="20" fill="#000000" opacity="0.85" stroke="#3B82F6" stroke-width="4"/>
  <text x="600" y="1500" font-family="'Segoe UI', Arial, sans-serif" font-size="38" font-weight="bold" fill="#06B6D4" text-anchor="middle" letter-spacing="3">#Mias10thBirthday</text>
</svg>
`;

fs.writeFileSync(path.join(overlayDir, 'overlay_birthday.svg'), birthdaySvg);
fs.writeFileSync(path.join(overlayDir, 'overlay_neon.svg'), neonSvg);

// Also copy SVG or save png references for rendering compatibility
fs.writeFileSync(path.join(overlayDir, 'overlay_birthday.png'), birthdaySvg);
fs.writeFileSync(path.join(overlayDir, 'overlay_neon.png'), neonSvg);

console.log('Sample transparent overlays created successfully!');
