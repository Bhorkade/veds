/**
 * ============================================================================
 * VEDS — Share Your Screen. Connect Instantly.
 * Frontend Application & WebRTC Signaling Logic
 * ============================================================================
 */

// ==========================================
// FRONTEND CONFIGURATION
// Default backend URL; automatically adapts to current host/port in browser.
// ==========================================
const CONFIG = {
  SOCKET_SERVER_URL: "https://veds-seven.vercel.app"
};

/**
 * Determine the correct signaling server URL:
 * - If loaded on a dev server (e.g. port 5500, 3000, 5173), connect to port 5000 on the same host/IP.
 * - If loaded directly from the backend server (e.g. port 5000) or production domain, use window.location.origin.
 */
function getSocketServerUrl() {
  if (typeof window !== "undefined" && window.location) {
    if (window.location.port && window.location.port !== "5000") {
      return `${window.location.protocol}//${window.location.hostname}:5000`;
    }
    if (window.location.origin && window.location.origin.startsWith("http")) {
      return window.location.origin;
    }
  }
  return CONFIG.SOCKET_SERVER_URL;
}

// WebRTC STUN Server Configuration
const RTC_CONFIGURATION = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" }
  ]
};

// Application State
let socket = null;
let currentRoomCode = null;
let isInitiator = false;
let polite = false; // Initiator is impolite (polite = false); joiner is polite (polite = true)
let peerConnection = null;
let localScreenStream = null;
let remoteStream = null;
let isSharingScreen = false;
let isRemoteSharing = false;
let pendingIceCandidates = [];
let makingOffer = false;
let ignoreOffer = false;

// DOM Element References
const connectView = document.getElementById("connectView");
const roomView = document.getElementById("roomView");
const btnCreateRoom = document.getElementById("btnCreateRoom");
const joinRoomForm = document.getElementById("joinRoomForm");
const passkeyInput = document.getElementById("passkeyInput");
const btnJoinRoom = document.getElementById("btnJoinRoom");

const displayPasskey = document.getElementById("displayPasskey");
const subPasskeyDisplay = document.getElementById("subPasskeyDisplay");
const btnCopyPasskey = document.getElementById("btnCopyPasskey");
const copyBtnText = document.getElementById("copyBtnText");
const btnSharePasskey = document.getElementById("btnSharePasskey");

const statusDot = document.getElementById("statusDot");
const statusText = document.getElementById("statusText");
const roomCapacityText = document.getElementById("roomCapacityText");

const videoStage = document.getElementById("videoStage");
const remoteVideo = document.getElementById("remoteVideo");
const localPreviewContainer = document.getElementById("localPreviewContainer");
const localPreviewVideo = document.getElementById("localPreviewVideo");
const videoPlaceholder = document.getElementById("videoPlaceholder");
const placeholderTitle = document.getElementById("placeholderTitle");
const placeholderSubtitle = document.getElementById("placeholderSubtitle");
const videoLiveTag = document.getElementById("videoLiveTag");

const btnShareScreen = document.getElementById("btnShareScreen");
const btnStopSharing = document.getElementById("btnStopSharing");
const btnFullscreen = document.getElementById("btnFullscreen");
const btnLeaveRoom = document.getElementById("btnLeaveRoom");
const toastContainer = document.getElementById("toastContainer");

const mobileMenuBtn = document.getElementById("mobileMenuBtn");
const navMenu = document.getElementById("navMenu");
const navConnectBtn = document.getElementById("navConnectBtn");

// ============================================================================
// Notification / Toast Feedback
// ============================================================================
function showToast(message, type = "info") {
  if (!toastContainer) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  let iconSvg = "";
  if (type === "success") {
    iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" width="20" height="20"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else if (type === "error") {
    iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" width="20" height="20"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
  } else if (type === "warning") {
    iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2.5" width="20" height="20"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`;
  } else {
    iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" width="20" height="20"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  toast.innerHTML = `${iconSvg}<span>${message}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  }, 4000);
}

// ============================================================================
// Socket.IO Connection Setup & Event Listeners
// ============================================================================
function initSocket() {
  if (socket && socket.connected) return;

  const serverUrl = getSocketServerUrl();
  console.log(`[Socket.IO] Connecting to Veds signaling server at: ${serverUrl}`);

  socket = io(serverUrl, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000
  });

  socket.on("connect", () => {
    console.log("[Socket.IO] Connected. Socket ID:", socket.id);
  });

  socket.on("connect_error", (error) => {
    console.warn("[Socket.IO] Connection error:", error.message);
    setConnectionStatus("failed", "Signaling server is connecting...");
    resetActionButtons();
  });

  // Room Creation Success
  socket.on("room-created", ({ roomCode }) => {
    console.log("[Socket.IO] Room created successfully:", roomCode);
    currentRoomCode = roomCode;
    isInitiator = true;
    polite = false; // Room creator acts as impolite peer in negotiation
    showRoomView(roomCode);
    setConnectionStatus("waiting", "Waiting for another device...");
    setRoomCapacity(1, 2);
  });

  // Room Join Success
  socket.on("room-joined", ({ roomCode }) => {
    console.log("[Socket.IO] Successfully joined room:", roomCode);
    currentRoomCode = roomCode;
    isInitiator = false;
    polite = true; // Callee / joiner acts as polite peer in negotiation
    showRoomView(roomCode);
    setConnectionStatus("connecting", "Connecting to device...");
    setRoomCapacity(2, 2);
    // Prepare peer connection to receive offer
    setupPeerConnection();
  });

  // Peer Joined Event (Received by Room Creator when second device arrives)
  socket.on("peer-joined", async ({ peerId }) => {
    console.log("[Socket.IO] Peer joined room:", peerId);
    setConnectionStatus("connected", "Connected");
    setRoomCapacity(2, 2);
    showToast("Device Connected", "success");

    // Room creator initializes WebRTC and initiates the handshake
    setupPeerConnection();
    await createAndSendOffer();
  });

  // Join Room Error from server (e.g. room full, invalid passkey)
  socket.on("join-error", ({ message }) => {
    console.error("[Socket.IO] Join error:", message);
    resetActionButtons();
    showToast(message, "error");
  });

  // Signaling Offer Received
  socket.on("offer", async ({ sdp, senderId }) => {
    console.log("[WebRTC] Received offer from:", senderId);
    if (!peerConnection) {
      setupPeerConnection();
    }

    try {
      const offerCollision = (sdp.type === "offer") &&
        (makingOffer || peerConnection.signalingState !== "stable");

      ignoreOffer = !polite && offerCollision;
      if (ignoreOffer) {
        console.warn("[WebRTC] Impolite peer ignoring offer collision");
        return;
      }

      if (offerCollision) {
        console.log("[WebRTC] Polite peer rolling back local offer");
        await peerConnection.setLocalDescription({ type: "rollback" });
      }

      await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
      console.log("[WebRTC] Remote description (offer) set successfully");

      // Flush queued ICE candidates
      flushPendingIceCandidates();

      // Create and send answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      console.log("[WebRTC] Local description (answer) set and sending");

      socket.emit("answer", {
        roomCode: currentRoomCode,
        sdp: peerConnection.localDescription
      });
      setConnectionStatus("connected", "Connected");
    } catch (err) {
      console.error("[WebRTC] Error handling offer:", err);
      showToast("Unable to establish the peer connection. Retrying...", "error");
    }
  });

  // Signaling Answer Received
  socket.on("answer", async ({ sdp, senderId }) => {
    console.log("[WebRTC] Received answer from:", senderId);
    if (!peerConnection) return;

    try {
      if (peerConnection.signalingState === "have-local-offer") {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
        console.log("[WebRTC] Remote description (answer) set successfully");
        flushPendingIceCandidates();
        setConnectionStatus("connected", "Connected");
      }
    } catch (err) {
      console.error("[WebRTC] Error handling answer:", err);
    }
  });

  // Signaling ICE Candidate Received
  socket.on("ice-candidate", async ({ candidate, senderId }) => {
    if (!candidate) return;
    if (peerConnection && peerConnection.remoteDescription && peerConnection.remoteDescription.type) {
      try {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.warn("[WebRTC] Error adding remote ICE candidate:", err);
      }
    } else {
      pendingIceCandidates.push(candidate);
    }
  });

  // Screen State Broadcast
  socket.on("screen-state", ({ isSharing, senderId }) => {
    console.log("[Screen State] Peer screen sharing status:", isSharing);
    isRemoteSharing = Boolean(isSharing);
    if (isRemoteSharing) {
      showRemoteScreenUI();
    } else {
      hideRemoteScreenUI();
    }
  });

  // Peer Left Event
  socket.on("peer-left", ({ peerId }) => {
    console.log("[Socket.IO] Peer left room:", peerId);
    showToast("Remote device left the room", "warning");
    resetPeerConnection();
    setConnectionStatus("waiting", "Waiting for another device...");
    setRoomCapacity(1, 2);
    hideRemoteScreenUI();
  });

  // Confirmation that local socket left
  socket.on("left-room", () => {
    resetAllState();
  });
}

// Flush buffered ICE candidates
function flushPendingIceCandidates() {
  if (!peerConnection) return;
  while (pendingIceCandidates.length > 0) {
    const candidate = pendingIceCandidates.shift();
    try {
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (candErr) {
      console.warn("[WebRTC] Error adding buffered candidate:", candErr);
    }
  }
}

// ============================================================================
// WebRTC RTCPeerConnection Management
// ============================================================================
function setupPeerConnection() {
  if (peerConnection) return peerConnection;

  console.log("[WebRTC] Initializing new RTCPeerConnection");
  peerConnection = new RTCPeerConnection(RTC_CONFIGURATION);

  // Initialize remote stream container
  remoteStream = new MediaStream();
  remoteVideo.srcObject = remoteStream;

  // Send local ICE candidates to peer via Socket.IO
  peerConnection.onicecandidate = (event) => {
    if (event.candidate && currentRoomCode) {
      socket.emit("ice-candidate", {
        roomCode: currentRoomCode,
        candidate: event.candidate
      });
    }
  };

  // Handle incoming remote media tracks (Screen sharing from peer)
  peerConnection.ontrack = (event) => {
    console.log("[WebRTC] Received remote track:", event.track.kind);
    if (!remoteStream) {
      remoteStream = new MediaStream();
    }

    // Add track if not already in remoteStream
    if (!remoteStream.getTracks().some(t => t.id === event.track.id)) {
      remoteStream.addTrack(event.track);
    }
    remoteVideo.srcObject = remoteStream;

    // Detect when video frames begin flowing
    event.track.onunmute = () => {
      console.log("[WebRTC] Remote track unmuted (active stream)");
      showRemoteScreenUI();
    };

    event.track.onmute = () => {
      console.log("[WebRTC] Remote track muted");
      if (!isRemoteSharing) {
        hideRemoteScreenUI();
      }
    };

    event.track.onended = () => {
      console.log("[WebRTC] Remote track ended");
      hideRemoteScreenUI();
    };
  };

  // Monitor connection state
  peerConnection.onconnectionstatechange = () => {
    console.log("[WebRTC] Connection state:", peerConnection.connectionState);
    if (peerConnection.connectionState === "connected") {
      setConnectionStatus("connected", "Connected");
    } else if (peerConnection.connectionState === "connecting") {
      setConnectionStatus("connecting", "Connecting...");
    } else if (peerConnection.connectionState === "disconnected") {
      setConnectionStatus("disconnected", "Disconnected");
    } else if (peerConnection.connectionState === "failed") {
      setConnectionStatus("failed", "Connection Failed");
      showToast("WebRTC connection failed. Attempting reconnect...", "error");
      if (peerConnection.restartIce) {
        peerConnection.restartIce();
      }
    }
  };

  peerConnection.oniceconnectionstatechange = () => {
    console.log("[WebRTC] ICE state:", peerConnection.iceConnectionState);
    if (peerConnection.iceConnectionState === "failed" && peerConnection.restartIce) {
      peerConnection.restartIce();
    }
  };

  // If local stream is already active when peer connection is created, attach it
  if (localScreenStream) {
    localScreenStream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, localScreenStream);
    });
  } else if (isInitiator) {
    // Room creator pre-adds transceivers with sendrecv so either device can share with replaceTrack
    peerConnection.addTransceiver("video", { direction: "sendrecv" });
    peerConnection.addTransceiver("audio", { direction: "sendrecv" });
  }

  // Handle renegotiation needed (Perfect Negotiation)
  peerConnection.onnegotiationneeded = async () => {
    try {
      if (makingOffer) return;
      // Do not auto-negotiate on joiner before initial offer from creator arrives
      if (!isInitiator && peerConnection.signalingState === "stable" && !peerConnection.currentRemoteDescription) {
        return;
      }
      makingOffer = true;
      console.log("[WebRTC] Negotiation needed, creating offer");
      await peerConnection.setLocalDescription();
      socket.emit("offer", {
        roomCode: currentRoomCode,
        sdp: peerConnection.localDescription
      });
    } catch (err) {
      console.error("[WebRTC] Negotiation error:", err);
    } finally {
      makingOffer = false;
    }
  };

  return peerConnection;
}

// Create and emit SDP offer
async function createAndSendOffer() {
  if (!peerConnection) return;
  try {
    makingOffer = true;
    const offer = await peerConnection.createOffer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: true
    });
    await peerConnection.setLocalDescription(offer);
    console.log("[WebRTC] Local offer created & sent");

    socket.emit("offer", {
      roomCode: currentRoomCode,
      sdp: peerConnection.localDescription
    });
  } catch (err) {
    console.error("[WebRTC] Error creating offer:", err);
  } finally {
    makingOffer = false;
  }
}

// ============================================================================
// Screen Sharing (getDisplayMedia & replaceTrack / addTrack)
// ============================================================================
async function startSharingScreen() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    showToast("Screen sharing is not supported in this browser.", "error");
    return;
  }

  try {
    console.log("[ScreenShare] Requesting getDisplayMedia...");
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
    } catch (captureErr) {
      // If error was not cancellation, attempt video-only capture
      if (captureErr.name !== "NotAllowedError") {
        console.warn("[ScreenShare] Audio+video capture rejected, trying video only:", captureErr);
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      } else {
        throw captureErr;
      }
    }

    localScreenStream = stream;
    isSharingScreen = true;

    // Show local preview thumbnail
    localPreviewVideo.srcObject = localScreenStream;
    localPreviewContainer.classList.remove("hidden");

    // Update UI controls
    btnShareScreen.classList.add("hidden");
    btnStopSharing.classList.remove("hidden");

    // Attach stream to WebRTC peer connection
    if (!peerConnection) {
      setupPeerConnection();
    }

    const videoTrack = stream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    // Find existing video sender from transceivers or senders
    const transceivers = peerConnection.getTransceivers ? peerConnection.getTransceivers() : [];
    const videoTransceiver = transceivers.find((t) =>
      (t.receiver && t.receiver.track && t.receiver.track.kind === "video") ||
      (t.sender && t.sender.track && t.sender.track.kind === "video")
    );
    const videoSender = videoTransceiver ? videoTransceiver.sender :
      peerConnection.getSenders().find((s) => s.track && s.track.kind === "video");

    if (videoSender) {
      console.log("[WebRTC] Replacing video track with screen track");
      await videoSender.replaceTrack(videoTrack);
    } else {
      console.log("[WebRTC] Adding new screen video track");
      peerConnection.addTrack(videoTrack, localScreenStream);
    }

    // Audio sender if available
    if (audioTrack) {
      const audioTransceiver = transceivers.find((t) =>
        (t.receiver && t.receiver.track && t.receiver.track.kind === "audio") ||
        (t.sender && t.sender.track && t.sender.track.kind === "audio")
      );
      const audioSender = audioTransceiver ? audioTransceiver.sender :
        peerConnection.getSenders().find((s) => s.track && s.track.kind === "audio");
      if (audioSender) {
        await audioSender.replaceTrack(audioTrack);
      } else {
        peerConnection.addTrack(audioTrack, localScreenStream);
      }
    }

    // Notify peer that screen sharing has started
    if (socket && currentRoomCode) {
      socket.emit("screen-state", {
        roomCode: currentRoomCode,
        isSharing: true
      });
    }

    showToast("Screen sharing active", "success");

    // Listen to native browser "Stop Sharing" button
    videoTrack.onended = () => {
      console.log("[ScreenShare] Native stop sharing triggered");
      stopSharingScreen();
    };

  } catch (err) {
    console.error("[ScreenShare] Error starting screen share:", err);
    if (err.name === "NotAllowedError") {
      showToast("Screen sharing permission was denied.", "warning");
    } else {
      showToast("Unable to start screen sharing: " + (err.message || "Unknown error"), "error");
    }
  }
}

// Stop Screen Sharing
async function stopSharingScreen() {
  if (localScreenStream) {
    localScreenStream.getTracks().forEach((track) => track.stop());
    localScreenStream = null;
  }

  isSharingScreen = false;

  // Clear local preview
  localPreviewVideo.srcObject = null;
  localPreviewContainer.classList.add("hidden");

  // Reset buttons
  btnShareScreen.classList.remove("hidden");
  btnStopSharing.classList.add("hidden");

  // Clear track from sender so peer sees standby
  if (peerConnection) {
    const transceivers = peerConnection.getTransceivers ? peerConnection.getTransceivers() : [];
    transceivers.forEach((t) => {
      if (t.sender && t.sender.track) {
        t.sender.replaceTrack(null).catch((e) => console.warn(e));
      }
    });
  }

  // Notify peer that we stopped sharing
  if (socket && currentRoomCode) {
    socket.emit("screen-state", {
      roomCode: currentRoomCode,
      isSharing: false
    });
  }

  showToast("Screen sharing stopped", "info");
}

// ============================================================================
// UI State & Transitions
// ============================================================================
function showRoomView(roomCode) {
  displayPasskey.textContent = roomCode;
  subPasskeyDisplay.textContent = roomCode;

  connectView.classList.add("hidden");
  roomView.classList.remove("hidden");

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showRemoteScreenUI() {
  remoteVideo.classList.add("active");
  videoPlaceholder.classList.add("hidden");
  videoLiveTag.classList.remove("hidden");

  // Re-verify remote stream is bound
  if (remoteStream && remoteVideo.srcObject !== remoteStream) {
    remoteVideo.srcObject = remoteStream;
  }

  // Handle browser video autoplay policies with fallback
  const playPromise = remoteVideo.play();
  if (playPromise !== undefined) {
    playPromise.catch((err) => {
      console.warn("[Video] Autoplay blocked, attempting muted playback:", err);
      remoteVideo.muted = true;
      remoteVideo.play().catch((e) => console.warn("[Video] Play error:", e));
    });
  }
}

function hideRemoteScreenUI() {
  remoteVideo.classList.remove("active");
  videoPlaceholder.classList.remove("hidden");
  videoLiveTag.classList.add("hidden");

  if (peerConnection && (peerConnection.connectionState === "connected" || peerConnection.iceConnectionState === "connected")) {
    placeholderTitle.textContent = "Device connected";
    placeholderSubtitle.textContent = "Click 'Share My Screen' below to start broadcasting, or wait for the other device to share.";
  } else {
    placeholderTitle.textContent = "Waiting for screen broadcast";
    placeholderSubtitle.innerHTML = `Connect device 2 using passkey <strong>${currentRoomCode || "VDS-XXXXXX"}</strong>. Once connected, either device can click "Share My Screen" below.`;
  }
}

function setConnectionStatus(type, message) {
  statusDot.className = "status-dot";
  statusDot.classList.add(`dot-${type}`);
  statusText.textContent = message;

  if (type === "connected") {
    if (placeholderTitle.textContent === "Waiting for screen broadcast") {
      placeholderTitle.textContent = "Device connected";
      placeholderSubtitle.textContent = "Click 'Share My Screen' below to start broadcasting, or wait for the other device to share.";
    }
  }
}

function setRoomCapacity(current, max) {
  roomCapacityText.textContent = `${current}/${max} Devices`;
}

function resetPeerConnection() {
  if (peerConnection) {
    peerConnection.ontrack = null;
    peerConnection.onicecandidate = null;
    peerConnection.onconnectionstatechange = null;
    peerConnection.oniceconnectionstatechange = null;
    peerConnection.onnegotiationneeded = null;
    peerConnection.close();
    peerConnection = null;
  }
  if (remoteStream) {
    remoteStream.getTracks().forEach((track) => track.stop());
    remoteStream = null;
  }
  remoteVideo.srcObject = null;
  pendingIceCandidates = [];
  makingOffer = false;
  ignoreOffer = false;
  isRemoteSharing = false;
}

function resetActionButtons() {
  btnJoinRoom.disabled = false;
  btnJoinRoom.innerHTML = `<span>Join Room</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="9 18 15 12 9 6"></polyline></svg>`;

  btnCreateRoom.disabled = false;
  btnCreateRoom.innerHTML = `<span>Create Room</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
}

function resetAllState() {
  stopSharingScreen();
  resetPeerConnection();

  currentRoomCode = null;
  isInitiator = false;
  polite = false;

  roomView.classList.add("hidden");
  connectView.classList.remove("hidden");

  resetActionButtons();
  passkeyInput.value = "";

  hideRemoteScreenUI();
}

// ============================================================================
// Passkey Operations (Copy & Share)
// ============================================================================
async function copyPasskey() {
  if (!currentRoomCode) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(currentRoomCode);
    } else {
      throw new Error("Clipboard API not available");
    }
    showToast("Passkey copied!", "success");
    copyBtnText.textContent = "Copied!";
    setTimeout(() => {
      copyBtnText.textContent = "Copy";
    }, 2000);
  } catch (err) {
    // Fallback using temporary textarea
    const tempInput = document.createElement("input");
    tempInput.value = currentRoomCode;
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
      document.execCommand("copy");
      showToast("Passkey copied!", "success");
      copyBtnText.textContent = "Copied!";
      setTimeout(() => {
        copyBtnText.textContent = "Copy";
      }, 2000);
    } catch (e) {
      showToast(`Passkey: ${currentRoomCode}`, "info");
    }
    document.body.removeChild(tempInput);
  }
}

async function sharePasskey() {
  if (!currentRoomCode) return;
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Join Veds Screen Share",
        text: `Connect with my device on Veds using passkey: ${currentRoomCode}`,
        url: window.location.href
      });
    } catch (err) {
      if (err.name !== "AbortError") {
        copyPasskey();
      }
    }
  } else {
    copyPasskey();
  }
}

// ============================================================================
// Fullscreen Control
// ============================================================================
function toggleFullscreen() {
  const container = document.getElementById("videoStage");
  if (!document.fullscreenElement) {
    if (container.requestFullscreen) {
      container.requestFullscreen();
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    }
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

// ============================================================================
// Event Listeners
// ============================================================================
window.addEventListener("DOMContentLoaded", () => {
  initSocket();

  // Create Room Click
  btnCreateRoom.addEventListener("click", () => {
    btnCreateRoom.disabled = true;
    btnCreateRoom.innerHTML = `<span>Creating...</span>`;

    initSocket();
    socket.emit("create-room", (response) => {
      if (!response || !response.success) {
        resetActionButtons();
        showToast(response?.message || "Failed to create room.", "error");
      }
    });

    // Safety timeout in case of network stall
    setTimeout(() => {
      if (btnCreateRoom.disabled && connectView && !connectView.classList.contains("hidden")) {
        resetActionButtons();
      }
    }, 8000);
  });

  // Join Room Submit
  joinRoomForm.addEventListener("submit", (e) => {
    e.preventDefault();
    let code = passkeyInput.value.trim().toUpperCase();

    if (!code) {
      showToast("Please enter a valid passkey.", "warning");
      return;
    }

    // Auto-prefix VDS- if user typed only the 6 digits (e.g. 583921)
    if (/^\d{6}$/.test(code)) {
      code = `VDS-${code}`;
      passkeyInput.value = code;
    }
    // Auto-hyphenate if user typed VDS583921
    if (/^VDS\d{6}$/.test(code)) {
      code = `VDS-${code.slice(3)}`;
      passkeyInput.value = code;
    }

    if (!code.startsWith("VDS-") || code.length < 7) {
      showToast("Passkey format should be VDS-XXXXXX", "warning");
      return;
    }

    btnJoinRoom.disabled = true;
    btnJoinRoom.innerHTML = `<span>Connecting...</span>`;

    initSocket();
    socket.emit("join-room", { roomCode: code }, (response) => {
      if (response && !response.success) {
        resetActionButtons();
      }
    });

    // Safety timeout
    setTimeout(() => {
      if (btnJoinRoom.disabled && connectView && !connectView.classList.contains("hidden")) {
        resetActionButtons();
      }
    }, 8000);
  });

  // Auto format passkey typing
  passkeyInput.addEventListener("input", (e) => {
    e.target.value = e.target.value.toUpperCase();
  });

  // Copy & Share buttons
  btnCopyPasskey.addEventListener("click", copyPasskey);
  btnSharePasskey.addEventListener("click", sharePasskey);

  // Screen Sharing buttons
  btnShareScreen.addEventListener("click", startSharingScreen);
  btnStopSharing.addEventListener("click", stopSharingScreen);
  btnFullscreen.addEventListener("click", toggleFullscreen);

  // Leave Room
  btnLeaveRoom.addEventListener("click", () => {
    if (confirm("Are you sure you want to leave this room?")) {
      if (socket && currentRoomCode) {
        socket.emit("leave-room");
      }
      resetAllState();
      showToast("Left room", "info");
    }
  });

  // Mobile menu toggle
  mobileMenuBtn.addEventListener("click", () => {
    navMenu.classList.toggle("show");
  });

  // Quick connect button in navbar
  navConnectBtn.addEventListener("click", (e) => {
    if (roomView.classList.contains("hidden")) {
      e.preventDefault();
      document.getElementById("connect").scrollIntoView({ behavior: "smooth" });
    }
  });
});
