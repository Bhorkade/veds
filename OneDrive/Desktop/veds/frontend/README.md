# Veds Frontend — Web Client

The **Veds** frontend is a lightweight, responsive client designed for instant browser-based screen sharing using Vanilla JavaScript, CSS3, HTML5, and native WebRTC APIs.

---

## 🌟 Highlights

* **No Framework Bloat**: Pure HTML5, CSS3, and modern ES6+ JavaScript. Fast, crisp, and responsive across all device screen sizes (360px up to 4K).
* **Native WebRTC Integration**: Direct peer-to-peer screen streaming with fallback STUN servers.
* **True Two-Way Screen Sharing**: Both devices in the room can initiate and toggle screen broadcasting using `RTCRtpSender.replaceTrack()`.
* **Zero Accounts / Zero Database**: Temporary random passkey authentication (`VDS-XXXXXX`).
* **Hardware Free**: No capture cards, HDMI dongles, cables, or proprietary hardware required.

---

## 📂 File Structure

```text
frontend/
├── index.html   # Main application markup & accessible semantic structure
├── style.css    # Professional SaaS theme, responsive breakpoints & micro-interactions
├── script.js    # WebRTC peer connection, Socket.IO client signaling & UI controller
└── README.md    # Frontend documentation & deployment guide
```

---

## 🛠️ Local Development & Running

Because WebRTC and MediaDevices APIs require a secure context (`localhost` or `https://`), **do not open the HTML file using the `file:///` protocol**.

### Recommended Method 1: VS Code Live Server
1. Install the **Live Server** extension in VS Code.
2. Right-click `frontend/index.html` and click **"Open with Live Server"**.
3. Your browser will open the frontend at:
   ```text
   http://localhost:5500
   ```

### Recommended Method 2: Node `http-server` or `serve`
From the project root:
```bash
npx serve frontend -l 5500
```
or
```bash
npx http-server frontend -p 5500
```

---

## ⚙️ Configuration

Open `frontend/script.js` to inspect or modify the backend signaling URL:

```javascript
// ==========================================
// FRONTEND CONFIGURATION
// For production, replace localhost with the deployed Veds backend URL.
// ==========================================
const CONFIG = {
  SOCKET_SERVER_URL: "http://localhost:5000"
};
```

* In **Local Development**: Keep `"http://localhost:5000"`.
* In **Production**: Replace with your deployed backend WebSocket URL (e.g. `https://your-veds-backend.onrender.com`).

---

## 🚀 Two-Way Screen Sharing Flow

1. **Room Creator (Device A)** clicks **Create Room**:
   - Backend registers `VDS-XXXXXX` in memory.
   - Device A waits for peer.
2. **Device B** clicks **Join Room** and inputs `VDS-XXXXXX`:
   - Both devices join the room.
   - WebRTC `RTCPeerConnection` initializes with STUN servers (`stun.l.google.com:19302`).
   - Offer and Answer are negotiated via Socket.IO, and ICE candidates are exchanged.
3. **Sharing**:
   - Either device clicks **"Share My Screen"**.
   - The browser prompts `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })`.
   - The video track is seamlessly attached or replaced via `RTCRtpSender.replaceTrack()`.
   - The peer immediately views the high-definition stream in `<video id="remoteVideo">`.
4. **Switching / Stopping**:
   - Device A stops sharing (or clicks native browser "Stop sharing" banner).
   - Device B can now click "Share My Screen" to broadcast back to Device A.

---

## 📱 Mobile Compatibility & Browser Notes

* **Receiving Screen Shares**: Works smoothly on virtually all modern mobile browsers (iOS Safari, Android Chrome, Firefox mobile).
* **Broadcasting Screen From Mobile**:
  - **Android**: Chrome 72+ supports screen capture via `getDisplayMedia()`.
  - **iOS (iPhone/iPad)**: Safari currently has strict system restrictions on third-party in-browser display capture APIs. Mobile devices can always view the incoming desktop/laptop screen stream with full responsiveness.

---

## 🌐 Production Deployment (Vercel)

Deploying the frontend to Vercel is straightforward:

1. Push your repository to GitHub / GitLab / Bitbucket.
2. Log into [Vercel](https://vercel.com) and click **"New Project"**.
3. Select your repository.
4. Set the **Root Directory** to `frontend`.
5. Keep Framework Preset as **Other** (Static Site).
6. Click **Deploy**.
7. In `frontend/script.js`, ensure `CONFIG.SOCKET_SERVER_URL` points to your live backend domain.
