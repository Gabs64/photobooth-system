# Vercel Deployment & Admin Security Guide

## 1. Generated Admin Security Credentials

The Admin Management Portal is now secured with password authentication.

* **Admin Portal URL**: `/admin`
* **Username**: `admin`
* **Password**: `photobooth2026!`

---

## 2. Vercel Deployment Options

### **Option A: Deploy via Vercel CLI (Recommended)**
1. Install the Vercel CLI globally (if not already installed):
   ```bash
   npm i -g vercel
   ```
2. Open terminal in the project root folder:
   ```bash
   cd "c:\Users\m4408\OneDrive\Documents\Photobooth System"
   ```
3. Run the deploy command:
   ```bash
   vercel
   ```
4. Follow the prompt instructions (use default project settings). To deploy to production:
   ```bash
   vercel --prod
   ```

---

### **Option B: Deploy via GitHub & Vercel Dashboard**
1. Push your repository to GitHub or GitLab.
2. Log into your [Vercel Dashboard](https://vercel.com/dashboard).
3. Click **"Add New"** → **"Project"**.
4. Import your repository.
5. In **Environment Variables**, add the following optional variables:
   - `PORT`: `3000`
   - `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID
   - `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret
   - `ADMIN_SESSION_SECRET`: Any random string (for signing admin session cookies)
6. Click **Deploy**.

---

## 3. Environment Variables Configuration

| Variable | Description | Example / Value |
| :--- | :--- | :--- |
| `PORT` | Server Port | `3000` |
| `GOOGLE_CLIENT_ID` | Google Drive OAuth Client ID | `your-google-client-id.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google Drive OAuth Secret | `your-google-client-secret` |
| `GOOGLE_REDIRECT_URI` | OAuth Redirect Handler | `https://your-vercel-domain.vercel.app/api/cloud/gdrive/callback` |
| `ADMIN_SESSION_SECRET` | Secret key for signing admin cookies | `photobooth_admin_secret_key_2026` |

---

## 4. Key Security & Architecture Features
* **Liquid Glass Login Modal**: Unauthenticated attempts to access `/admin` are gated by a secure modal login overlay.
* **Cookie-Based Sessions**: Returns HTTP-only session tokens for security.
* **Serverless Compatibility**: Optimized with `/tmp` fallback paths for Vercel's read-only file system.
