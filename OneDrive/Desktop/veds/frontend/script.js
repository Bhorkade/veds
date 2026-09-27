/**
 * ============================================================================
 * VEDS — Share Your Screen. Connect Instantly.
 * Frontend + WebRTC + Socket.IO Signaling
 * ============================================================================
 */

/* ============================================================================
   CONFIGURATION
   ============================================================================ */

const CONFIG = {
  PRODUCTION_SOCKET_SERVER_URL: "https://veds-gdrg.onrender.com",
  LOCAL_SOCKET_SERVER_URL: "http://localhost:5000"
};

/* ============================================================================
   SOCKET SERVER URL
   ============================================================================ */

function getSocketServerUrl() {
  const hostname = window.location.hostname;
  const port = window.location.port;

  // Local development
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1"
  ) {
    return CONFIG.LOCAL_SOCKET_SERVER_URL;
  }

  // Production
  return CONFIG.SOCKET_SERVER_URL;
}


/* ============================================================================
   WEBRTC CONFIGURATION
   ============================================================================ */

const RTC_CONFIGURATION = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302"
    },
    {
      urls: "stun:stun1.l.google.com:19302"
    },
    {
      urls: "stun:stun2.l.google.com:19302"
    }
  ]
};


/* ============================================================================
   APPLICATION STATE
   ============================================================================ */

let socket = null;

let currentRoomCode = null;

let isInitiator = false;

let polite = false;

let peerConnection = null;

let localScreenStream = null;

let remoteStream = null;

let isSharingScreen = false;

let isRemoteSharing = false;

let pendingIceCandidates = [];

let makingOffer = false;

let ignoreOffer = false;

let isSocketInitializing = false;


/* ============================================================================
   DOM ELEMENTS
   ============================================================================ */

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

const localPreviewContainer =
  document.getElementById("localPreviewContainer");

const localPreviewVideo =
  document.getElementById("localPreviewVideo");

const videoPlaceholder =
  document.getElementById("videoPlaceholder");

const placeholderTitle =
  document.getElementById("placeholderTitle");

const placeholderSubtitle =
  document.getElementById("placeholderSubtitle");

const videoLiveTag =
  document.getElementById("videoLiveTag");

const btnShareScreen =
  document.getElementById("btnShareScreen");

const btnStopSharing =
  document.getElementById("btnStopSharing");

const btnFullscreen =
  document.getElementById("btnFullscreen");

const btnLeaveRoom =
  document.getElementById("btnLeaveRoom");

const toastContainer =
  document.getElementById("toastContainer");

const mobileMenuBtn =
  document.getElementById("mobileMenuBtn");

const navMenu =
  document.getElementById("navMenu");

const navConnectBtn =
  document.getElementById("navConnectBtn");


/* ============================================================================
   TOAST
   ============================================================================ */

function showToast(message, type = "info") {
  if (!toastContainer) return;

  const toast = document.createElement("div");

  toast.className = `toast toast-${type}`;

  let iconSvg = "";

  if (type === "success") {
    iconSvg = `
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#10b981"
        stroke-width="2.5"
        width="20"
        height="20"
      >
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `;
  }

  else if (type === "error") {
    iconSvg = `
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ef4444"
        stroke-width="2.5"
        width="20"
        height="20"
      >
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
    `;
  }

  else if (type === "warning") {
    iconSvg = `
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#f59e0b"
        stroke-width="2.5"
        width="20"
        height="20"
      >
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
        <line x1="12" y1="9" x2="12" y2="13"></line>
        <line x1="12" y1="17" x2="12.01" y2="17"></line>
      </svg>
    `;
  }

  else {
    iconSvg = `
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#3b82f6"
        stroke-width="2.5"
        width="20"
        height="20"
      >
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="16" x2="12" y2="12"></line>
        <line x1="12" y1="8" x2="12.01" y2="8"></line>
      </svg>
    `;
  }

  toast.innerHTML = `
    ${iconSvg}
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(100%)";

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 250);
  }, 4000);
}


/* ============================================================================
   SOCKET.IO INITIALIZATION
   ============================================================================ */

function initSocket() {
  if (socket && socket.connected) {
    return socket;
  }

  if (isSocketInitializing && socket) {
    return socket;
  }

  isSocketInitializing = true;

  const serverUrl = getSocketServerUrl();

  console.log(
    "[Socket.IO] Connecting to:",
    serverUrl
  );

  socket = io(serverUrl, {
    transports: ["websocket", "polling"],

    reconnection: true,

    reconnectionAttempts: Infinity,

    reconnectionDelay: 1000,

    reconnectionDelayMax: 5000,

    timeout: 10000,

    autoConnect: true
  });


  /* ------------------------------------------------------------
     CONNECT
     ------------------------------------------------------------ */

  socket.on("connect", () => {
    isSocketInitializing = false;

    console.log(
      "[Socket.IO] Connected:",
      socket.id
    );

    showToast(
      "Connected to Veds server",
      "success"
    );
  });


  /* ------------------------------------------------------------
     DISCONNECT
     ------------------------------------------------------------ */

  socket.on("disconnect", (reason) => {
    console.warn(
      "[Socket.IO] Disconnected:",
      reason
    );

    if (currentRoomCode) {
      setConnectionStatus(
        "disconnected",
        "Server disconnected"
      );
    }
  });


  /* ------------------------------------------------------------
     CONNECT ERROR
     ------------------------------------------------------------ */

  socket.on("connect_error", (error) => {
    isSocketInitializing = false;

    console.error(
      "[Socket.IO] Connection error:",
      error
    );

    setConnectionStatus(
      "failed",
      "Unable to connect to server"
    );
  });


  /* ============================================================
     ROOM CREATED
     ============================================================ */

  socket.on("room-created", ({ roomCode }) => {
    console.log(
      "[Room] Created:",
      roomCode
    );

    currentRoomCode = roomCode;

    isInitiator = true;

    polite = false;

    showRoomView(roomCode);

    setConnectionStatus(
      "waiting",
      "Waiting for another device..."
    );

    setRoomCapacity(1, 2);

    showToast(
      "Room created successfully",
      "success"
    );
  });


  /* ============================================================
     ROOM JOINED
     ============================================================ */

  socket.on("room-joined", ({ roomCode }) => {
    console.log(
      "[Room] Joined:",
      roomCode
    );

    currentRoomCode = roomCode;

    isInitiator = false;

    polite = true;

    showRoomView(roomCode);

    setConnectionStatus(
      "connecting",
      "Connecting to device..."
    );

    setRoomCapacity(2, 2);

    setupPeerConnection();
  });


  /* ============================================================
     PEER JOINED
     ============================================================ */

  socket.on("peer-joined", async ({ peerId }) => {
    console.log(
      "[Room] Peer joined:",
      peerId
    );

    setConnectionStatus(
      "connecting",
      "Connecting to device..."
    );

    setRoomCapacity(2, 2);

    showToast(
      "Device connected",
      "success"
    );

    setupPeerConnection();

    await createAndSendOffer();
  });


  /* ============================================================
     JOIN ERROR
     ============================================================ */

  socket.on("join-error", ({ message }) => {
    console.error(
      "[Room] Join error:",
      message
    );

    resetActionButtons();

    showToast(
      message || "Unable to join room",
      "error"
    );
  });


  /* ============================================================
     OFFER
     ============================================================ */

  socket.on(
    "offer",
    async ({ sdp, senderId }) => {

      console.log(
        "[WebRTC] Offer received from:",
        senderId
      );

      if (!peerConnection) {
        setupPeerConnection();
      }

      try {

        const offerCollision =
          sdp.type === "offer" &&
          (
            makingOffer ||
            peerConnection.signalingState !== "stable"
          );

        ignoreOffer =
          !polite &&
          offerCollision;

        if (ignoreOffer) {
          console.warn(
            "[WebRTC] Ignoring offer collision"
          );

          return;
        }

        if (offerCollision) {

          console.log(
            "[WebRTC] Rolling back local offer"
          );

          await peerConnection.setLocalDescription({
            type: "rollback"
          });
        }

        await peerConnection.setRemoteDescription(
          new RTCSessionDescription(sdp)
        );

        flushPendingIceCandidates();

        const answer =
          await peerConnection.createAnswer();

        await peerConnection.setLocalDescription(
          answer
        );

        socket.emit("answer", {
          roomCode: currentRoomCode,
          sdp: peerConnection.localDescription
        });

        console.log(
          "[WebRTC] Answer sent"
        );

      } catch (error) {

        console.error(
          "[WebRTC] Offer error:",
          error
        );

        showToast(
          "Connection negotiation failed",
          "error"
        );
      }
    }
  );


  /* ============================================================
     ANSWER
     ============================================================ */

  socket.on(
    "answer",
    async ({ sdp, senderId }) => {

      console.log(
        "[WebRTC] Answer received from:",
        senderId
      );

      if (!peerConnection) {
        return;
      }

      try {

        if (
          peerConnection.signalingState ===
          "have-local-offer"
        ) {

          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(sdp)
          );

          flushPendingIceCandidates();

          setConnectionStatus(
            "connected",
            "Connected"
          );
        }

      } catch (error) {

        console.error(
          "[WebRTC] Answer error:",
          error
        );
      }
    }
  );


  /* ============================================================
     ICE CANDIDATE
     ============================================================ */

  socket.on(
    "ice-candidate",
    async ({ candidate }) => {

      if (!candidate) {
        return;
      }

      if (
        peerConnection &&
        peerConnection.remoteDescription &&
        peerConnection.remoteDescription.type
      ) {

        try {

          await peerConnection.addIceCandidate(
            new RTCIceCandidate(candidate)
          );

        } catch (error) {

          console.warn(
            "[WebRTC] ICE candidate error:",
            error
          );
        }

      } else {

        pendingIceCandidates.push(candidate);
      }
    }
  );


  /* ============================================================
     SCREEN STATE
     ============================================================ */

  socket.on(
    "screen-state",
    ({ isSharing }) => {

      console.log(
        "[Screen State]:",
        isSharing
      );

      isRemoteSharing =
        Boolean(isSharing);

      if (isRemoteSharing) {
        showRemoteScreenUI();
      } else {
        hideRemoteScreenUI();
      }
    }
  );


  /* ============================================================
     PEER LEFT
     ============================================================ */

  socket.on(
    "peer-left",
    () => {

      console.log(
        "[Room] Peer left"
      );

      showToast(
        "Remote device left the room",
        "warning"
      );

      resetPeerConnection();

      setConnectionStatus(
        "waiting",
        "Waiting for another device..."
      );

      setRoomCapacity(1, 2);

      hideRemoteScreenUI();
    }
  );


  /* ============================================================
     LEFT ROOM
     ============================================================ */

  socket.on(
    "left-room",
    () => {

      console.log(
        "[Room] Successfully left"
      );

      resetAllState();
    }
  );


  return socket;
}


/* ============================================================================
   FLUSH ICE CANDIDATES
   ============================================================================ */

async function flushPendingIceCandidates() {

  if (!peerConnection) {
    return;
  }

  while (
    pendingIceCandidates.length > 0
  ) {

    const candidate =
      pendingIceCandidates.shift();

    try {

      await peerConnection.addIceCandidate(
        new RTCIceCandidate(candidate)
      );

    } catch (error) {

      console.warn(
        "[WebRTC] Buffered ICE error:",
        error
      );
    }
  }
}


/* ============================================================================
   CREATE PEER CONNECTION
   ============================================================================ */

function setupPeerConnection() {

  if (peerConnection) {
    return peerConnection;
  }

  console.log(
    "[WebRTC] Creating RTCPeerConnection"
  );

  peerConnection =
    new RTCPeerConnection(
      RTC_CONFIGURATION
    );


  /* ------------------------------------------------------------
     Remote Media Stream
     ------------------------------------------------------------ */

  remoteStream =
    new MediaStream();

  if (remoteVideo) {
    remoteVideo.srcObject =
      remoteStream;
  }


  /* ------------------------------------------------------------
     ICE Candidate
     ------------------------------------------------------------ */

  peerConnection.onicecandidate =
    (event) => {

      if (
        event.candidate &&
        currentRoomCode &&
        socket
      ) {

        socket.emit(
          "ice-candidate",
          {
            roomCode: currentRoomCode,
            candidate: event.candidate
          }
        );
      }
    };


  /* ------------------------------------------------------------
     Remote Track
     ------------------------------------------------------------ */

  peerConnection.ontrack =
    (event) => {

      console.log(
        "[WebRTC] Remote track:",
        event.track.kind
      );

      if (!remoteStream) {
        remoteStream =
          new MediaStream();
      }

      const exists =
        remoteStream
          .getTracks()
          .some(
            track =>
              track.id === event.track.id
          );

      if (!exists) {

        remoteStream.addTrack(
          event.track
        );
      }

      remoteVideo.srcObject =
        remoteStream;

      event.track.onunmute =
        () => {

          console.log(
            "[WebRTC] Remote video active"
          );

          if (event.track.kind === "video") {
            isRemoteSharing = true;
            showRemoteScreenUI();
          }
        };

      event.track.onmute =
        () => {

          console.log(
            "[WebRTC] Remote track muted"
          );
        };

      event.track.onended =
        () => {

          console.log(
            "[WebRTC] Remote track ended"
          );

          if (event.track.kind === "video") {
            isRemoteSharing = false;
            hideRemoteScreenUI();
          }
        };
    };


  /* ------------------------------------------------------------
     Connection State
     ------------------------------------------------------------ */

  peerConnection.onconnectionstatechange =
    () => {

      if (!peerConnection) {
        return;
      }

      const state =
        peerConnection.connectionState;

      console.log(
        "[WebRTC] Connection:",
        state
      );

      switch (state) {

        case "connected":

          setConnectionStatus(
            "connected",
            "Connected"
          );

          break;

        case "connecting":

          setConnectionStatus(
            "connecting",
            "Connecting..."
          );

          break;

        case "disconnected":

          setConnectionStatus(
            "disconnected",
            "Disconnected"
          );

          break;

        case "failed":

          setConnectionStatus(
            "failed",
            "Connection Failed"
          );

          showToast(
            "WebRTC connection failed",
            "error"
          );

          break;

        case "closed":

          setConnectionStatus(
            "disconnected",
            "Connection closed"
          );

          break;
      }
    };


  /* ------------------------------------------------------------
     ICE Connection State
     ------------------------------------------------------------ */

  peerConnection.oniceconnectionstatechange =
    () => {

      if (!peerConnection) {
        return;
      }

      console.log(
        "[WebRTC] ICE:",
        peerConnection.iceConnectionState
      );

      if (
        peerConnection.iceConnectionState ===
        "failed"
      ) {

        try {

          peerConnection.restartIce();

        } catch (error) {

          console.warn(
            "[WebRTC] ICE restart failed:",
            error
          );
        }
      }
    };


  /* ------------------------------------------------------------
     Add Existing Screen Track
     ------------------------------------------------------------ */

  if (localScreenStream) {

    localScreenStream
      .getTracks()
      .forEach(track => {

        peerConnection.addTrack(
          track,
          localScreenStream
        );

      });

  } else {

    /*
     * Create transceivers so both devices
     * can share screen later.
     */

    peerConnection.addTransceiver(
      "video",
      {
        direction: "sendrecv"
      }
    );

    peerConnection.addTransceiver(
      "audio",
      {
        direction: "sendrecv"
      }
    );
  }


  /* ------------------------------------------------------------
     Negotiation Needed
     ------------------------------------------------------------ */

  peerConnection.onnegotiationneeded =
    async () => {

      try {

        if (makingOffer) {
          return;
        }

        if (
          !isInitiator &&
          peerConnection.signalingState ===
          "stable" &&
          !peerConnection.currentRemoteDescription
        ) {

          return;
        }

        makingOffer = true;

        await peerConnection.setLocalDescription();

        if (
          socket &&
          currentRoomCode &&
          peerConnection.localDescription
        ) {

          socket.emit(
            "offer",
            {
              roomCode: currentRoomCode,
              sdp:
                peerConnection.localDescription
            }
          );
        }

      } catch (error) {

        console.error(
          "[WebRTC] Negotiation error:",
          error
        );

      } finally {

        makingOffer = false;
      }
    };


  return peerConnection;
}


/* ============================================================================
   CREATE OFFER
   ============================================================================ */

async function createAndSendOffer() {

  if (!peerConnection) {
    setupPeerConnection();
  }

  if (!socket || !currentRoomCode) {
    return;
  }

  try {

    makingOffer = true;

    const offer =
      await peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      });

    await peerConnection.setLocalDescription(
      offer
    );

    socket.emit(
      "offer",
      {
        roomCode: currentRoomCode,
        sdp:
          peerConnection.localDescription
      }
    );

    console.log(
      "[WebRTC] Offer sent"
    );

  } catch (error) {

    console.error(
      "[WebRTC] Offer creation error:",
      error
    );

  } finally {

    makingOffer = false;
  }
}


/* ============================================================================
   START SCREEN SHARING
   ============================================================================ */

async function startSharingScreen() {

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getDisplayMedia
  ) {

    showToast(
      "Screen sharing is not supported in this browser.",
      "error"
    );

    return;
  }


  if (
    !peerConnection ||
    !currentRoomCode
  ) {

    showToast(
      "Please connect another device first.",
      "warning"
    );

    return;
  }


  try {

    console.log(
      "[ScreenShare] Requesting screen..."
    );

    let stream;


    /* ------------------------------------------------------------
       Try Screen + Audio
       ------------------------------------------------------------ */

    try {

      stream =
        await navigator.mediaDevices
          .getDisplayMedia({
            video: true,
            audio: true
          });

    } catch (error) {

      /*
       * Browser may not support system audio.
       * Try video-only.
       */

      if (
        error.name === "NotAllowedError"
      ) {

        throw error;
      }

      console.warn(
        "[ScreenShare] Retrying video only"
      );

      stream =
        await navigator.mediaDevices
          .getDisplayMedia({
            video: true
          });
    }


    localScreenStream =
      stream;

    isSharingScreen = true;


    /* ------------------------------------------------------------
       Local Preview
       ------------------------------------------------------------ */

    if (localPreviewVideo) {

      localPreviewVideo.srcObject =
        localScreenStream;

      localPreviewVideo.muted = true;

      localPreviewVideo
        .play()
        .catch(() => { });
    }

    localPreviewContainer
      ?.classList
      .remove("hidden");


    /* ------------------------------------------------------------
       Buttons
       ------------------------------------------------------------ */

    btnShareScreen
      ?.classList
      .add("hidden");

    btnStopSharing
      ?.classList
      .remove("hidden");


    /* ------------------------------------------------------------
       Video Track
       ------------------------------------------------------------ */

    const videoTrack =
      stream.getVideoTracks()[0];

    if (!videoTrack) {

      throw new Error(
        "No video track was created."
      );
    }


    const audioTrack =
      stream.getAudioTracks()[0];


    /* ------------------------------------------------------------
       Find Video Sender
       ------------------------------------------------------------ */

    let videoSender =
      peerConnection
        .getSenders()
        .find(
          sender =>
            sender.track &&
            sender.track.kind === "video"
        );


    if (!videoSender) {

      const videoTransceiver =
        peerConnection
          .getTransceivers()
          .find(
            transceiver =>
              transceiver.receiver?.track?.kind ===
              "video"
          );

      if (videoTransceiver) {

        videoSender =
          videoTransceiver.sender;
      }
    }


    if (videoSender) {

      await videoSender.replaceTrack(
        videoTrack
      );

    } else {

      peerConnection.addTrack(
        videoTrack,
        stream
      );
    }


    /* ------------------------------------------------------------
       Audio
       ------------------------------------------------------------ */

    if (audioTrack) {

      let audioSender =
        peerConnection
          .getSenders()
          .find(
            sender =>
              sender.track &&
              sender.track.kind === "audio"
          );

      if (!audioSender) {

        const audioTransceiver =
          peerConnection
            .getTransceivers()
            .find(
              transceiver =>
                transceiver.receiver?.track?.kind ===
                "audio"
            );

        if (audioTransceiver) {
          audioSender =
            audioTransceiver.sender;
        }
      }

      if (audioSender) {

        await audioSender.replaceTrack(
          audioTrack
        );

      } else {

        peerConnection.addTrack(
          audioTrack,
          stream
        );
      }
    }


    /* ------------------------------------------------------------
       Notify Peer
       ------------------------------------------------------------ */

    if (
      socket &&
      currentRoomCode
    ) {

      socket.emit(
        "screen-state",
        {
          roomCode: currentRoomCode,
          isSharing: true
        }
      );
    }


    showToast(
      "Screen sharing started",
      "success"
    );


    /* ------------------------------------------------------------
       Browser Stop Sharing
       ------------------------------------------------------------ */

    videoTrack.onended =
      () => {

        console.log(
          "[ScreenShare] Browser stopped sharing"
        );

        stopSharingScreen();
      };


  } catch (error) {

    console.error(
      "[ScreenShare] Error:",
      error
    );

    if (
      error.name === "NotAllowedError"
    ) {

      showToast(
        "Screen sharing permission was denied.",
        "warning"
      );

    } else {

      showToast(
        "Unable to start screen sharing.",
        "error"
      );
    }
  }
}


/* ============================================================================
   STOP SCREEN SHARING
   ============================================================================ */

async function stopSharingScreen() {

  if (localScreenStream) {

    localScreenStream
      .getTracks()
      .forEach(track => {
        track.stop();
      });

    localScreenStream = null;
  }

  isSharingScreen = false;


  /* ------------------------------------------------------------
     Local Preview
     ------------------------------------------------------------ */

  if (localPreviewVideo) {
    localPreviewVideo.srcObject = null;
  }

  localPreviewContainer
    ?.classList
    .add("hidden");


  /* ------------------------------------------------------------
     Buttons
     ------------------------------------------------------------ */

  btnShareScreen
    ?.classList
    .remove("hidden");

  btnStopSharing
    ?.classList
    .add("hidden");


  /* ------------------------------------------------------------
     Remove Local Tracks
     ------------------------------------------------------------ */

  if (peerConnection) {

    const senders =
      peerConnection.getSenders();

    for (const sender of senders) {

      if (sender.track) {

        try {

          await sender.replaceTrack(null);

        } catch (error) {

          console.warn(
            "[WebRTC] Track removal error:",
            error
          );
        }
      }
    }
  }


  /* ------------------------------------------------------------
     Notify Remote Device
     ------------------------------------------------------------ */

  if (
    socket &&
    currentRoomCode
  ) {

    socket.emit(
      "screen-state",
      {
        roomCode: currentRoomCode,
        isSharing: false
      }
    );
  }


  showToast(
    "Screen sharing stopped",
    "info"
  );
}


/* ============================================================================
   ROOM UI
   ============================================================================ */

function showRoomView(roomCode) {

  if (displayPasskey) {
    displayPasskey.textContent =
      roomCode;
  }

  if (subPasskeyDisplay) {
    subPasskeyDisplay.textContent =
      roomCode;
  }

  connectView
    ?.classList
    .add("hidden");

  roomView
    ?.classList
    .remove("hidden");

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* ============================================================================
   SHOW REMOTE SCREEN
   ============================================================================ */

function showRemoteScreenUI() {

  remoteVideo
    ?.classList
    .add("active");

  videoPlaceholder
    ?.classList
    .add("hidden");

  videoLiveTag
    ?.classList
    .remove("hidden");


  if (
    remoteStream &&
    remoteVideo.srcObject !== remoteStream
  ) {

    remoteVideo.srcObject =
      remoteStream;
  }


  if (remoteVideo) {

    remoteVideo.muted = false;

    const playPromise =
      remoteVideo.play();

    if (playPromise) {

      playPromise.catch(
        error => {

          console.warn(
            "[Video] Autoplay blocked:",
            error
          );

          /*
           * Retry muted if browser blocks
           * autoplay with audio.
           */

          remoteVideo.muted = true;

          remoteVideo
            .play()
            .catch(() => { });
        }
      );
    }
  }
}


/* ============================================================================
   HIDE REMOTE SCREEN
   ============================================================================ */

function hideRemoteScreenUI() {

  remoteVideo
    ?.classList
    .remove("active");

  videoPlaceholder
    ?.classList
    .remove("hidden");

  videoLiveTag
    ?.classList
    .add("hidden");


  if (
    peerConnection &&
    (
      peerConnection.connectionState ===
      "connected" ||
      peerConnection.iceConnectionState ===
      "connected"
    )
  ) {

    if (placeholderTitle) {
      placeholderTitle.textContent =
        "Device connected";
    }

    if (placeholderSubtitle) {
      placeholderSubtitle.textContent =
        "Click 'Share My Screen' below to start broadcasting, or wait for the other device to share.";
    }

  } else {

    if (placeholderTitle) {
      placeholderTitle.textContent =
        "Waiting for screen broadcast";
    }

    if (placeholderSubtitle) {

      placeholderSubtitle.innerHTML =
        `
        Connect device 2 using passkey
        <strong>
          ${currentRoomCode || "VDS-XXXXXX"}
        </strong>.
        Once connected, either device can click
        "Share My Screen".
        `;
    }
  }
}


/* ============================================================================
   CONNECTION STATUS
   ============================================================================ */

function setConnectionStatus(
  type,
  message
) {

  if (statusDot) {

    statusDot.className =
      "status-dot";

    statusDot.classList.add(
      `dot-${type}`
    );
  }

  if (statusText) {
    statusText.textContent =
      message;
  }


  if (
    type === "connected" &&
    placeholderTitle
  ) {

    if (
      placeholderTitle.textContent ===
      "Waiting for screen broadcast"
    ) {

      placeholderTitle.textContent =
        "Device connected";

      placeholderSubtitle.textContent =
        "Click 'Share My Screen' below to start broadcasting, or wait for the other device to share.";
    }
  }
}


/* ============================================================================
   ROOM CAPACITY
   ============================================================================ */

function setRoomCapacity(
  current,
  max
) {

  if (roomCapacityText) {

    roomCapacityText.textContent =
      `${current}/${max} Devices`;
  }
}


/* ============================================================================
   RESET PEER CONNECTION
   ============================================================================ */

function resetPeerConnection() {

  if (peerConnection) {

    peerConnection.ontrack = null;

    peerConnection.onicecandidate = null;

    peerConnection.onconnectionstatechange = null;

    peerConnection.oniceconnectionstatechange = null;

    peerConnection.onnegotiationneeded = null;

    try {
      peerConnection.close();
    } catch (error) {
      console.warn(error);
    }

    peerConnection = null;
  }


  if (remoteStream) {

    remoteStream
      .getTracks()
      .forEach(track => {
        track.stop();
      });

    remoteStream = null;
  }


  if (remoteVideo) {
    remoteVideo.srcObject = null;
  }


  pendingIceCandidates = [];

  makingOffer = false;

  ignoreOffer = false;

  isRemoteSharing = false;
}


/* ============================================================================
   RESET BUTTONS
   ============================================================================ */

function resetActionButtons() {

  if (btnJoinRoom) {

    btnJoinRoom.disabled = false;

    btnJoinRoom.innerHTML = `
      <span>Join Room</span>

      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    `;
  }


  if (btnCreateRoom) {

    btnCreateRoom.disabled = false;

    btnCreateRoom.innerHTML = `
      <span>Create Room</span>

      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <polyline points="9 18 15 12 9 6"></polyline>
      </svg>
    `;
  }
}


/* ============================================================================
   RESET EVERYTHING
   ============================================================================ */

function resetAllState() {

  if (isSharingScreen) {
    stopSharingScreen();
  }

  resetPeerConnection();

  currentRoomCode = null;

  isInitiator = false;

  polite = false;

  isSharingScreen = false;

  isRemoteSharing = false;


  roomView
    ?.classList
    .add("hidden");

  connectView
    ?.classList
    .remove("hidden");


  resetActionButtons();


  if (passkeyInput) {
    passkeyInput.value = "";
  }


  hideRemoteScreenUI();
}


/* ============================================================================
   COPY PASSKEY
   ============================================================================ */

async function copyPasskey() {

  if (!currentRoomCode) {
    return;
  }

  try {

    if (
      navigator.clipboard &&
      navigator.clipboard.writeText
    ) {

      await navigator.clipboard.writeText(
        currentRoomCode
      );

    } else {

      throw new Error(
        "Clipboard API unavailable"
      );
    }


    showToast(
      "Passkey copied!",
      "success"
    );


    if (copyBtnText) {

      copyBtnText.textContent =
        "Copied!";

      setTimeout(() => {

        copyBtnText.textContent =
          "Copy";

      }, 2000);
    }

  } catch (error) {

    const tempInput =
      document.createElement("input");

    tempInput.value =
      currentRoomCode;

    document.body.appendChild(
      tempInput
    );

    tempInput.select();

    try {

      document.execCommand("copy");

      showToast(
        "Passkey copied!",
        "success"
      );

    } catch (copyError) {

      showToast(
        `Passkey: ${currentRoomCode}`,
        "info"
      );
    }

    document.body.removeChild(
      tempInput
    );
  }
}


/* ============================================================================
   SHARE PASSKEY
   ============================================================================ */

async function sharePasskey() {

  if (!currentRoomCode) {
    return;
  }

  if (navigator.share) {

    try {

      await navigator.share({
        title: "Join Veds Screen Share",

        text:
          `Connect with my device on Veds using passkey: ${currentRoomCode}`,

        url:
          window.location.href
      });

    } catch (error) {

      if (
        error.name !==
        "AbortError"
      ) {

        await copyPasskey();
      }
    }

  } else {

    await copyPasskey();
  }
}


/* ============================================================================
   FULLSCREEN
   ============================================================================ */

function toggleFullscreen() {

  const container =
    document.getElementById(
      "videoStage"
    );

  if (!container) {
    return;
  }


  if (!document.fullscreenElement) {

    if (container.requestFullscreen) {

      container.requestFullscreen();

    } else if (
      container.webkitRequestFullscreen
    ) {

      container.webkitRequestFullscreen();
    }

  } else {

    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}


/* ============================================================================
   EVENT LISTENERS
   ============================================================================ */

window.addEventListener(
  "DOMContentLoaded",
  () => {

    console.log(
      "===================================="
    );

    console.log(
      "VEDS Screen Share Started"
    );

    console.log(
      "Socket Server:",
      getSocketServerUrl()
    );

    console.log(
      "===================================="
    );


    /* ------------------------------------------------------------
       Start Socket
       ------------------------------------------------------------ */

    initSocket();


    /* ============================================================
       CREATE ROOM
       ============================================================ */

    btnCreateRoom?.addEventListener(
      "click",
      () => {

        if (
          !socket ||
          !socket.connected
        ) {

          showToast(
            "Connecting to server...",
            "warning"
          );

          initSocket();

          setTimeout(() => {

            if (
              socket &&
              socket.connected
            ) {

              createRoom();
            } else {

              showToast(
                "Server is not connected.",
                "error"
              );

              resetActionButtons();
            }

          }, 1000);

          return;
        }


        createRoom();
      }
    );


    /* ============================================================
       CREATE ROOM FUNCTION
       ============================================================ */

    function createRoom() {

      btnCreateRoom.disabled = true;

      btnCreateRoom.innerHTML = `
        <span>Creating...</span>
      `;


      socket.emit(
        "create-room",
        (response) => {

          if (
            response &&
            response.success === false
          ) {

            resetActionButtons();

            showToast(
              response.message ||
              "Failed to create room.",
              "error"
            );
          }
        }
      );


      setTimeout(() => {

        if (
          btnCreateRoom.disabled &&
          connectView &&
          !connectView.classList.contains(
            "hidden"
          )
        ) {

          resetActionButtons();

        }

      }, 10000);
    }


    /* ============================================================
       JOIN ROOM
       ============================================================ */

    joinRoomForm?.addEventListener(
      "submit",
      (event) => {

        event.preventDefault();


        let code =
          passkeyInput.value
            .trim()
            .toUpperCase();


        if (!code) {

          showToast(
            "Please enter a valid passkey.",
            "warning"
          );

          return;
        }


        /* --------------------------------------------------------
           123456
           -> VDS-123456
           -------------------------------------------------------- */

        if (
          /^\d{6}$/.test(code)
        ) {

          code =
            `VDS-${code}`;

          passkeyInput.value =
            code;
        }


        /* --------------------------------------------------------
           VDS123456
           -> VDS-123456
           -------------------------------------------------------- */

        if (
          /^VDS\d{6}$/.test(code)
        ) {

          code =
            `VDS-${code.slice(3)}`;

          passkeyInput.value =
            code;
        }


        /* --------------------------------------------------------
           Validate
           -------------------------------------------------------- */

        if (
          !/^VDS-[A-Z0-9]{6}$/.test(code)
        ) {

          showToast(
            "Passkey format should be VDS-XXXXXX",
            "warning"
          );

          return;
        }


        btnJoinRoom.disabled = true;

        btnJoinRoom.innerHTML = `
          <span>Connecting...</span>
        `;


        const joinRoom = () => {

          if (
            !socket ||
            !socket.connected
          ) {

            showToast(
              "Server is not connected.",
              "error"
            );

            resetActionButtons();

            return;
          }


          socket.emit(
            "join-room",
            {
              roomCode: code
            },
            (response) => {

              if (
                response &&
                response.success === false
              ) {

                resetActionButtons();

                showToast(
                  response.message ||
                  "Unable to join room.",
                  "error"
                );
              }
            }
          );
        };


        if (
          socket &&
          socket.connected
        ) {

          joinRoom();

        } else {

          initSocket();

          setTimeout(
            joinRoom,
            1000
          );
        }


        setTimeout(() => {

          if (
            btnJoinRoom.disabled &&
            connectView &&
            !connectView.classList.contains(
              "hidden"
            )
          ) {

            resetActionButtons();

          }

        }, 10000);
      }
    );


    /* ============================================================
       PASSKEY INPUT
       ============================================================ */

    passkeyInput?.addEventListener(
      "input",
      (event) => {

        let value =
          event.target.value
            .toUpperCase()
            .replace(/\s/g, "");

        event.target.value =
          value;
      }
    );


    /* ============================================================
       BUTTONS
       ============================================================ */

    btnCopyPasskey?.addEventListener(
      "click",
      copyPasskey
    );

    btnSharePasskey?.addEventListener(
      "click",
      sharePasskey
    );


    btnShareScreen?.addEventListener(
      "click",
      startSharingScreen
    );


    btnStopSharing?.addEventListener(
      "click",
      stopSharingScreen
    );


    btnFullscreen?.addEventListener(
      "click",
      toggleFullscreen
    );


    /* ============================================================
       LEAVE ROOM
       ============================================================ */

    btnLeaveRoom?.addEventListener(
      "click",
      () => {

        if (
          !confirm(
            "Are you sure you want to leave this room?"
          )
        ) {

          return;
        }


        if (
          socket &&
          socket.connected &&
          currentRoomCode
        ) {

          socket.emit(
            "leave-room"
          );
        }


        resetAllState();


        showToast(
          "Left room",
          "info"
        );
      }
    );


    /* ============================================================
       MOBILE MENU
       ============================================================ */

    mobileMenuBtn?.addEventListener(
      "click",
      () => {

        navMenu?.classList.toggle(
          "show"
        );
      }
    );


    /* ============================================================
       NAV CONNECT
       ============================================================ */

    navConnectBtn?.addEventListener(
      "click",
      (event) => {

        if (
          roomView &&
          roomView.classList.contains(
            "hidden"
          )
        ) {

          event.preventDefault();

          document
            .getElementById("connect")
            ?.scrollIntoView({
              behavior: "smooth"
            });
        }
      }
    );

  }
);