const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configure CORS: reflect request origin to safely allow credentials from any local/network origin
app.use(cors({
  origin: true,
  methods: ['GET', 'POST'],
  credentials: true
}));

app.use(express.json());

// Serve frontend static files
const frontendDir = path.join(__dirname, '../frontend');
app.use(express.static(frontendDir));

// In-memory room store: roomCode -> { code: string, clients: Set<socketId>, createdAt: number }
const rooms = new Map();
// Mapping: socketId -> roomCode
const socketToRoom = new Map();

/**
 * Generate a cryptographically random room passkey formatted as VDS-XXXXXX (6 digits)
 */
function generateRoomCode() {
  let code;
  let attempts = 0;
  do {
    const randomDigits = crypto.randomInt(100000, 999999).toString();
    code = `VDS-${randomDigits}`;
    attempts++;
  } while (rooms.has(code) && attempts < 100);
  return code;
}

// Health endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Veds signaling server'
  });
});

// Create HTTP server and bind Socket.IO
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Socket.IO signaling logic
io.on('connection', (socket) => {
  console.log(`[Socket Connected] ID: ${socket.id}`);

  // Helper to remove a socket from a room and clean up
  const leaveCurrentRoom = () => {
    const roomCode = socketToRoom.get(socket.id);
    if (!roomCode) return;

    socketToRoom.delete(socket.id);
    socket.leave(roomCode);

    const room = rooms.get(roomCode);
    if (room) {
      room.clients.delete(socket.id);
      console.log(`[Room Update] Socket ${socket.id} left room ${roomCode}. Remaining clients: ${room.clients.size}`);

      // Notify the remaining peer that this peer left
      socket.to(roomCode).emit('peer-left', { peerId: socket.id });

      // If room is now empty, delete it from memory
      if (room.clients.size === 0) {
        rooms.delete(roomCode);
        console.log(`[Room Deleted] Room ${roomCode} was cleaned up (empty).`);
      }
    }
  };

  // 1. Create Room
  socket.on('create-room', (callback) => {
    try {
      // Leave any existing room first
      leaveCurrentRoom();

      const roomCode = generateRoomCode();
      const roomData = {
        code: roomCode,
        clients: new Set([socket.id]),
        createdAt: Date.now()
      };

      rooms.set(roomCode, roomData);
      socketToRoom.set(socket.id, roomCode);
      socket.join(roomCode);

      console.log(`[Room Created] Room: ${roomCode} by Socket: ${socket.id}`);

      // Send response via direct event and callback if provided
      socket.emit('room-created', { roomCode });
      if (typeof callback === 'function') {
        callback({ success: true, roomCode });
      }
    } catch (err) {
      console.error('[Create Room Error]:', err);
      socket.emit('error-message', { message: 'Failed to create room. Please try again.' });
      if (typeof callback === 'function') {
        callback({ success: false, message: 'Failed to create room.' });
      }
    }
  });

  // 2. Join Room
  socket.on('join-room', (payload, callback) => {
    try {
      const rawCode = typeof payload === 'string' ? payload : (payload && payload.roomCode);
      if (!rawCode) {
        const errorMsg = 'Please enter a valid passkey.';
        socket.emit('join-error', { message: errorMsg });
        if (typeof callback === 'function') callback({ success: false, message: errorMsg });
        return;
      }

      const roomCode = rawCode.trim().toUpperCase();
      const room = rooms.get(roomCode);

      // Check if room exists
      if (!room) {
        const errorMsg = 'Room not found. Please check your passkey.';
        console.log(`[Join Failed] Room ${roomCode} not found for socket ${socket.id}`);
        socket.emit('join-error', { message: errorMsg });
        if (typeof callback === 'function') callback({ success: false, message: errorMsg });
        return;
      }

      // Check if socket is already in this room
      if (room.clients.has(socket.id)) {
        socket.emit('room-joined', { roomCode, isInitiator: false });
        if (typeof callback === 'function') callback({ success: true, roomCode });
        return;
      }

      // Check room limit: Exactly 2 devices maximum
      if (room.clients.size >= 2) {
        const errorMsg = 'This room is already full. Please create another room.';
        console.log(`[Join Failed] Room ${roomCode} is full (already has ${room.clients.size} devices). Rejected socket ${socket.id}`);
        socket.emit('join-error', { message: errorMsg });
        if (typeof callback === 'function') callback({ success: false, message: errorMsg });
        return;
      }

      // Leave any existing room
      leaveCurrentRoom();

      // Add socket to room
      room.clients.add(socket.id);
      socketToRoom.set(socket.id, roomCode);
      socket.join(roomCode);

      console.log(`[Room Joined] Socket ${socket.id} joined room ${roomCode}. Total devices: ${room.clients.size}`);

      // Notify the joining socket
      socket.emit('room-joined', { roomCode, isInitiator: false });

      // Notify the existing peer that a peer joined
      socket.to(roomCode).emit('peer-joined', { peerId: socket.id });

      if (typeof callback === 'function') {
        callback({ success: true, roomCode });
      }
    } catch (err) {
      console.error('[Join Room Error]:', err);
      const errorMsg = 'An error occurred while joining the room.';
      socket.emit('join-error', { message: errorMsg });
      if (typeof callback === 'function') callback({ success: false, message: errorMsg });
    }
  });

  // 3. WebRTC Signaling: Offer
  socket.on('offer', (data) => {
    const roomCode = data.roomCode || socketToRoom.get(socket.id);
    if (!roomCode) return;
    console.log(`[Signaling Offer] Relay offer from ${socket.id} in ${roomCode}`);
    socket.to(roomCode).emit('offer', {
      sdp: data.sdp,
      senderId: socket.id
    });
  });

  // 4. WebRTC Signaling: Answer
  socket.on('answer', (data) => {
    const roomCode = data.roomCode || socketToRoom.get(socket.id);
    if (!roomCode) return;
    console.log(`[Signaling Answer] Relay answer from ${socket.id} in ${roomCode}`);
    socket.to(roomCode).emit('answer', {
      sdp: data.sdp,
      senderId: socket.id
    });
  });

  // 5. WebRTC Signaling: ICE Candidate
  socket.on('ice-candidate', (data) => {
    const roomCode = data.roomCode || socketToRoom.get(socket.id);
    if (!roomCode) return;
    socket.to(roomCode).emit('ice-candidate', {
      candidate: data.candidate,
      senderId: socket.id
    });
  });

  // 6. Screen Sharing Status Notification
  socket.on('screen-state', (data) => {
    const roomCode = data.roomCode || socketToRoom.get(socket.id);
    if (!roomCode) return;
    console.log(`[Screen State] Socket ${socket.id} sharing state: ${data.isSharing}`);
    socket.to(roomCode).emit('screen-state', {
      isSharing: Boolean(data.isSharing),
      senderId: socket.id
    });
  });

  // 7. Explicit Leave Room
  socket.on('leave-room', () => {
    leaveCurrentRoom();
    socket.emit('left-room');
  });

  // 8. Disconnect
  socket.on('disconnect', (reason) => {
    console.log(`[Socket Disconnected] ID: ${socket.id}, reason: ${reason}`);
    leaveCurrentRoom();
  });
});

// Fallback route for SPA
app.get('*', (req, res, next) => {
  if (req.accepts('html')) {
    res.sendFile(path.join(frontendDir, 'index.html'));
  } else {
    next();
  }
});

// Start the server on all network interfaces
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log('Veds Server Started');
  console.log(`Local:   http://localhost:${PORT}`);
  console.log(`Network: http://<your-lan-ip>:${PORT}`);
});
