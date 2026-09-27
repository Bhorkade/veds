# Veds Backend — Signaling Server

The **Veds** backend is a lightweight, high-performance Node.js signaling server designed to facilitate WebRTC peer-to-peer screen sharing and real-time device connection.

## 🚀 Overview

Veds uses WebRTC for peer-to-peer media communication and a signaling server to help establish the connection. The backend does **not** relay media streams; instead, it coordinates the initial handshake (SDP offers, answers, and ICE candidates) and maintains temporary room states in memory.

* **No Database Required**: All rooms are transient and kept in memory. When devices leave, empty rooms are immediately cleaned up.
* **Room Cap**: Exactly two devices are permitted per room (`VDS-XXXXXX`). Any third device attempting to connect is cleanly rejected.
* **Low Latency**: Built on top of Express.js and Socket.IO.

---

## 📁 Tech Stack

* **Node.js** (v18+ recommended)
* **Express.js** (HTTP server and health checks)
* **Socket.IO** (Real-time WebRTC signaling relay)
* **CORS** (Cross-Origin Resource Sharing configuration)
* **dotenv** (Environment variable management)

---

## 🛠️ API & Health Endpoints

| Method | Path | Description | Response |
| :--- | :--- | :--- | :--- |
| `GET` | `/` | Root server status check | Plaintext: `"Veds signaling server is running."` |
| `GET` | `/health` | JSON health check | `{"status": "ok", "service": "Veds signaling server"}` |

---

## 📡 Socket.IO Signaling Events

### Client to Server
- `create-room`: Requests a new unique room passkey (format: `VDS-XXXXXX`).
- `join-room`: Requests to join an existing room with `{ roomCode }`.
- `offer`: Relays WebRTC Session Description (Offer) to the peer in the room.
- `answer`: Relays WebRTC Session Description (Answer) to the peer in the room.
- `ice-candidate`: Relays ICE candidates between peers for NAT traversal.
- `screen-state`: Informs the peer when screen sharing starts or stops (`{ isSharing }`).
- `leave-room`: Explicitly disconnects the device from the room.

### Server to Client
- `room-created`: Sent to creator with `{ roomCode }`.
- `room-joined`: Sent to joining device on successful room entry.
- `peer-joined`: Sent to the existing peer when a second device enters the room.
- `join-error`: Sent if the room doesn't exist or is full ("This room is already full. Please create another room.").
- `offer`: Relayed SDP offer from peer.
- `answer`: Relayed SDP answer from peer.
- `ice-candidate`: Relayed ICE candidate from peer.
- `screen-state`: Relayed screen sharing state from peer.
- `peer-left`: Sent when the other peer leaves or disconnects.

---

## ⚙️ Environment Variables

Create a `.env` file in the `backend/` directory (see `.env.example`):

```env
PORT=5000
FRONTEND_URL=http://localhost:5500
```

- `PORT`: Port on which the server listens (defaults to `5000`).
- `FRONTEND_URL`: Allowed origin for CORS (in local dev: `http://localhost:5500`; in production: your deployed Vercel domain).

---

## 💻 Local Setup & Running

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```

   The console will output:
   ```text
   Veds Server Started
   http://localhost:5000
   ```

3. **Development mode** (with auto-reload):
   ```bash
   npm run dev
   ```

---

## 🌐 Production Deployment

The Veds backend must be deployed to a host that supports persistent Node.js processes and WebSockets:
- **Render** (Web Service: Build command `npm install`, Start command `npm start`)
- **Railway**
- **Fly.io**

> **Note**: Static hosts like Vercel or Netlify frontend hosting do not support persistent long-lived WebSockets. Deploy this backend to Render or Railway, and deploy the frontend to Vercel.
