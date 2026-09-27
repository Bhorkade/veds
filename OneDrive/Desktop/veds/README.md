# Veds — Share Your Screen. Connect Instantly.

**Veds** is a full-stack, browser-based web application that connects two devices through a temporary passkey and shares screens directly using real-time WebRTC peer-to-peer technology.

No USB cables, no HDMI cords, no capture cards, no hardware dongles, no user registration, and no databases are required.

---

## 📑 Table of Contents

1. [Features](#features)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Folder Structure](#folder-structure)
5. [Prerequisites](#prerequisites)
6. [Installation & Local Setup](#installation--local-setup)
   - [Backend Setup](#backend-setup)
   - [Frontend Setup](#frontend-setup)
7. [Environment Variables](#environment-variables)
8. [How It Works](#how-it-works)
   - [Creating a Room](#creating-a-room)
   - [Joining a Room](#joining-a-room)
   - [Two-Way Screen Sharing](#two-way-screen-sharing)
   - [Stopping & Leaving](#stopping--leaving)
9. [Step-by-Step Testing Guides](#step-by-step-testing-guides)
   - [Test 1: Laptop-to-Laptop Testing](#test-1-laptop-to-laptop-testing)
   - [Test 2: Laptop-to-Phone Testing](#test-2-laptop-to-phone-testing)
10. [WebRTC & Signaling Details](#webrtc--signaling-details)
11. [Production Deployment](#production-deployment)
    - [Frontend Deployment (Vercel)](#frontend-deployment-vercel)
    - [Backend Deployment (Render / Railway / Fly.io)](#backend-deployment-render--railway--flyio)
    - [Production Configuration Change](#production-configuration-change)
12. [Troubleshooting & FAQs](#troubleshooting--faqs)
13. [Browser & OS Limitations](#browser--os-limitations)
14. [Security & Privacy Disclaimer](#security--privacy-disclaimer)

---

## 🌟 Features

* **Instant Passkey Generation**: Secure, temporary 6-digit passkey formatted as `VDS-XXXXXX` (e.g. `VDS-583921`).
* **Strict Room Capacity**: Limits each room to exactly **2 devices**. Third-party connections are rejected with a clear message: `"This room is already full. Please create another room."`
* **Real WebRTC Screen Sharing**: Leverages `navigator.mediaDevices.getDisplayMedia()` and `RTCPeerConnection` for direct peer-to-peer streaming.
* **True Two-Way Switching**: Both connected devices can broadcast their screen without tearing down the connection via `RTCRtpSender.replaceTrack()`.
* **Zero Database Overhead**: Rooms are transient and stored in backend memory. Once both users disconnect, rooms are automatically purged.
* **Responsive SaaS UI**: Polished layout, responsive from 360px up to 4K displays with touch-friendly controls.
* **Native Browser Detection**: Auto-detects when the user clicks the native browser "Stop Sharing" control (`track.onended`).
* **Clipboard & Share API**: One-click copying and native mobile sharing via the Web Share API.

---

## 💻 Technology Stack

### Frontend
* **HTML5**: Accessible semantic markup, responsive meta tags, standard `<video>` elements with `playsinline` and `autoplay`.
* **CSS3 (Vanilla)**: Modern CSS variables, flexbox, grid, subtle micro-interactions, responsive breakpoints.
* **JavaScript (ES6+ Vanilla)**: Native WebRTC (`RTCPeerConnection`, `MediaStream`, `RTCIceCandidate`), Socket.IO client.

### Backend
* **Node.js**: Asynchronous event-driven runtime (v18+).
* **Express.js**: REST routing and health endpoints.
* **Socket.IO**: Real-time bidirectional WebRTC signaling relay.
* **CORS**: Configurable cross-origin resource sharing.
* **dotenv**: Environment variable management.

---

## 🏗️ Architecture Overview

```text
[ Device A (Browser) ]                        [ Device B (Browser) ]
         │                                              │
         │             1. Socket.IO Signaling           │
         ├───────────────────► [ Backend ] ◄────────────┤
         │                      Port 5000               │
         │               (Rooms & SDP/ICE Relay)        │
         │                                              │
         │         2. Direct WebRTC P2P (DTLS/SRTP)     │
         ◄══════════════════════════════════════════════►
                      Screen MediaStream
```

* **Signaling Phase**: Devices exchange room credentials, SDP Offers/Answers, and ICE candidates through the lightweight Socket.IO server.
* **Streaming Phase**: Audio/video packets flow directly between devices via peer-to-peer encrypted channels (DTLS/SRTP), bypassing the backend server entirely.

---

## 📂 Folder Structure

```text
Veds/
│
├── frontend/
│   ├── index.html       # Web application landing page & screen sharing workspace
│   ├── style.css        # Responsive styling and design system
│   ├── script.js        # WebRTC client logic and Socket.IO connection
│   └── README.md        # Frontend documentation & guide
│
├── backend/
│   ├── package.json     # Node dependencies & startup scripts
│   ├── server.js        # Express & Socket.IO signaling server
│   ├── .env.example     # Template environment variables
│   └── README.md        # Backend architecture & API reference
│
├── README.md            # Comprehensive project documentation
└── .gitignore           # Git ignore rules for node_modules and .env
```

---

## 📋 Prerequisites

* **Node.js**: Version 18 or higher.
* **npm**: Version 9 or higher.
* **Web Browser**: Google Chrome, Microsoft Edge, Mozilla Firefox, Brave, or Safari (supporting WebRTC and `getDisplayMedia`).

---

## 🚀 Installation & Local Setup

### Backend Setup

1. Open your terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. (Optional) Create a `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Start the server:
   ```bash
   npm start
   ```

   You should see:
   ```text
   Veds Server Started
   http://localhost:5000
   ```

   * Health check: `http://localhost:5000/health`

---

### Frontend Setup

Because modern browsers enforce security policies on `getDisplayMedia()`, **do not open `frontend/index.html` directly as a local file (`file:///...`)**. Serve it via an HTTP development server.

#### Option A: VS Code Live Server
1. In VS Code, install the **Live Server** extension.
2. Right click `frontend/index.html` and choose **"Open with Live Server"**.
3. Access at: `http://localhost:5500`

#### Option B: Using `npx serve`
```bash
npx serve frontend -l 5500
```

#### Option C: Python Simple Server
```bash
cd frontend
python -m http.server 5500
```

---

## ⚙️ Environment Variables

Located in `backend/.env` (see `backend/.env.example`):

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `5000` | The port on which the signaling server listens |
| `FRONTEND_URL` | `http://localhost:5500` | The allowed origin for CORS requests |

---

## 📖 How It Works

### Creating a Room
1. Open the frontend in your browser.
2. Click **"Create Room"**.
3. The server generates a unique passkey (e.g. `VDS-583921`).
4. The UI displays your passkey along with **Copy** and **Share** buttons.
5. The status displays `Waiting for another device...` (Room Capacity: `1/2 Devices`).

### Joining a Room
1. On the second device, open the Veds application.
2. Under "Join Room", enter the passkey (e.g. `VDS-583921`).
3. Click **"Join Room"**.
4. Both devices connect immediately.
5. The status changes to `Connected` (Room Capacity: `2/2 Devices`).

### Two-Way Screen Sharing
1. Either device can click **"Share My Screen"**.
2. The browser prompts you to select a screen, window, or tab.
3. Once selected, the stream is broadcast to the other device.
4. A local picture-in-picture preview shows what you are sharing.
5. To switch, the sharing device clicks **"Stop Sharing"**, and the other device can click **"Share My Screen"**.

### Stopping & Leaving
* **Stop Sharing**: Click **"Stop Sharing"** or use the browser's native stop sharing bar.
* **Fullscreen**: Click **"Fullscreen"** to expand the remote view.
* **Leave Room**: Click **"Leave Room"** to disconnect and return to the home screen.

---

## 🧪 Step-by-Step Testing Guides

### Test 1: Laptop-to-Laptop Testing

1. **Start Backend**: Ensure the backend is running (`http://localhost:5000`).
2. **Device A (Laptop 1)**:
   - Open `http://localhost:5500`.
   - Click **"Create Room"**.
   - Note the passkey: `VDS-XXXXXX`.
3. **Device B (Laptop 2 or a second browser window / profile)**:
   - Open `http://localhost:5500` (or `http://<your-lan-ip>:5500`).
   - Enter `VDS-XXXXXX` into the **Join Room** input.
   - Click **"Join Room"**.
4. **Verification**:
   - Both screens update to status `Connected`.
5. **Screen Share**:
   - On Device A, click **"Share My Screen"** and select a window.
   - Device B immediately displays Device A's live screen in the video area.
6. **Reverse Direction**:
   - On Device A, click **"Stop Sharing"**.
   - On Device B, click **"Share My Screen"**.
   - Device A immediately displays Device B's screen.

---

### Test 2: Laptop-to-Phone Testing

1. Connect both devices to the same local Wi-Fi network (or deploy to public URLs).
2. **Laptop**:
   - Open `http://localhost:5500` (or your deployed URL).
   - Click **"Create Room"**.
   - Copy the passkey.
3. **Phone**:
   - Open Chrome or Safari and navigate to the application URL.
   - Enter the passkey and click **"Join Room"**.
4. **Broadcast**:
   - On the Laptop, click **"Share My Screen"**.
   - The phone displays the laptop's desktop cleanly, scaling smoothly to the mobile viewport.

---

## 📡 WebRTC & Signaling Details

Veds uses standard WebRTC APIs:
1. `RTCPeerConnection`: Manages the peer-to-peer connection life cycle.
2. **STUN Servers**: Public Google STUN servers (`stun:stun.l.google.com:19302` and `stun:stun1.l.google.com:19302`) resolve public IP addresses and ports across NATs.
3. `RTCRtpSender.replaceTrack()`: Enables swapping video streams dynamically without renegotiation.
4. **ICE Candidate Queuing**: Buffers candidate packets if they arrive prior to remote description configuration to prevent race conditions.

---

## 🌐 Production Deployment

### Frontend Deployment (Vercel)

1. Push your repository to GitHub.
2. Sign in to [Vercel](https://vercel.com).
3. Import your project repository.
4. Under **Project Settings**:
   - **Root Directory**: `frontend`
   - **Framework Preset**: `Other`
5. Click **Deploy**.

---

### Backend Deployment (Render / Railway / Fly.io)

Because Socket.IO requires a persistent server process and WebSocket support, deploy the backend to a dedicated Node.js host.

#### Deploying on Render:
1. Sign in to [Render](https://render.com).
2. Click **New +** -> **Web Service**.
3. Connect your repository.
4. Set the following configuration:
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Under **Environment Variables**:
   - `PORT`: `5000` (or Render's assigned port)
   - `FRONTEND_URL`: `https://your-frontend-app.vercel.app`
6. Click **Create Web Service**.
7. Copy your backend URL (e.g. `https://veds-backend.onrender.com`).

---

### Production Configuration Change

Once your backend is deployed, update `frontend/script.js`:

```javascript
// ==========================================
// FRONTEND CONFIGURATION
// For production, replace localhost with the deployed Veds backend URL.
// ==========================================
const CONFIG = {
  SOCKET_SERVER_URL: "https://your-real-veds-backend.onrender.com" // <-- Replace with live URL
};
```

---

## ❓ Troubleshooting & FAQs

### Error: "Room not found. Please check your passkey."
* Ensure both devices are connected to the same signaling backend URL.
* Check that the passkey was typed correctly (including the `VDS-` prefix).

### Error: "This room is already full. Please create another room."
* Veds enforces a strict limit of 2 devices per room. If two devices are already in the room, create a new room.

### Error: "Screen sharing permission was denied."
* Ensure you granted screen capture permission in the browser prompt.
* On macOS, ensure your browser has permission under **System Settings > Privacy & Security > Screen & System Audio Recording**.

### Video appears black or doesn't update
* Check that both devices have an active internet connection.
* If behind strict corporate firewalls, a TURN relay server may be required.

---

## 📱 Browser & OS Limitations

* **Desktop Browsers**: Google Chrome, Edge, Brave, and Firefox offer full two-way capture and viewing.
* **Android**: Chrome 72+ allows screen sharing.
* **iOS / iPadOS**: Mobile Safari permits **viewing** incoming remote screen streams with full audio/video, but iOS blocks web browsers from sharing the entire device screen due to OS-level sandbox policies.

---

## 🔒 Security & Privacy Disclaimer

"Veds uses WebRTC for peer-to-peer media communication and a signaling server to help establish the connection."

* **No Video Stored**: Media streams are transferred peer-to-peer between devices and are never saved or recorded on the server.
* **Encrypted Media**: Real-time traffic is encrypted end-to-end via standard WebRTC DTLS/SRTP protocols.
* **Temporary Rooms**: Rooms exist exclusively in server memory and are wiped when empty.
