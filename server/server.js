// server.js - Enhanced with JWT authentication, notifications, and pagination
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Fix for __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// Store connected users and messages per room
const rooms = {
  'general': {
    users: {},
    messages: [],
    typingUsers: {}
  },
  'random': {
    users: {},
    messages: [],
    typingUsers: {}
  },
  'tech': {
    users: {},
    messages: [],
    typingUsers: {}
  }
};

const readReceipts = {};
const messageReactions = {};
const userNotifications = {};

// ============ JWT AUTHENTICATION ============

// Login endpoint - generates JWT token
app.post('/api/auth/login', (req, res) => {
  const { username } = req.body;
  
  if (!username || !username.trim()) {
    return res.status(400).json({ error: 'Username is required' });
  }
  
  // Generate JWT token
  const token = jwt.sign(
    { 
      username: username.trim(),
      loginTime: Date.now()
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  console.log(`Login successful for: ${username}`);
  
  res.json({
    success: true,
    token,
    username: username.trim()
  });
});

// Verify JWT token endpoint
app.post('/api/auth/verify', (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ 
      success: true, 
      username: decoded.username 
    });
  } catch (error) {
    res.status(401).json({ 
      error: 'Invalid or expired token' 
    });
  }
});

// ============ SOCKET.IO WITH JWT ============

// JWT Middleware for Socket.io
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication error: No token provided'));
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.username = decoded.username;
    socket.userId = decoded.username; // Use username as userId for simplicity
    next();
  } catch (error) {
    next(new Error('Authentication error: Invalid token'));
  }
});

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.username} (${socket.id})`);
  
  let currentRoom = 'general';
  const currentUsername = socket.username;

  // Handle user joining
  socket.on('user_join', ({ room = 'general' }) => {
    currentRoom = room;
    
    // Leave previous room if any
    Object.keys(rooms).forEach(roomName => {
      if (rooms[roomName].users[socket.id]) {
        delete rooms[roomName].users[socket.id];
        delete rooms[roomName].typingUsers[socket.id];
        socket.leave(roomName);
      }
    });
    
    // Join new room
    rooms[room].users[socket.id] = { 
      username: currentUsername, 
      id: socket.id, 
      room,
      unreadCounts: {} // Initialize unread counts
    };
    socket.join(room);
    
    // Notify room
    io.to(room).emit('user_list', Object.values(rooms[room].users));
    io.to(room).emit('user_joined', { username: currentUsername, id: socket.id });
    
    // Send recent messages to the user (last 20 messages for pagination)
    const recentMessages = rooms[room].messages.slice(-20);
    socket.emit('room_messages', recentMessages);
    socket.emit('pagination_info', {
      hasMore: rooms[room].messages.length > 20,
      totalMessages: rooms[room].messages.length,
      loadedMessages: recentMessages.length
    });
    
    console.log(`${currentUsername} joined ${room}`);
  });

  // Handle room change
  socket.on('change_room', (newRoom) => {
    if (rooms[newRoom]) {
      const oldRoom = currentRoom;
      currentRoom = newRoom;
      
      // Leave old room
      if (rooms[oldRoom].users[socket.id]) {
        delete rooms[oldRoom].users[socket.id];
        delete rooms[oldRoom].typingUsers[socket.id];
        socket.leave(oldRoom);
        io.to(oldRoom).emit('user_list', Object.values(rooms[oldRoom].users));
      }
      
      // Join new room
      rooms[newRoom].users[socket.id] = { 
        username: currentUsername, 
        id: socket.id, 
        room: newRoom,
        unreadCounts: rooms[newRoom].users[socket.id]?.unreadCounts || {} 
      };
      socket.join(newRoom);
      
      // Notify new room
      io.to(newRoom).emit('user_list', Object.values(rooms[newRoom].users));
      io.to(newRoom).emit('user_joined', { username: currentUsername, id: socket.id });
      
      // Send recent messages to the user
      const recentMessages = rooms[newRoom].messages.slice(-20);
      socket.emit('room_messages', recentMessages);
      socket.emit('pagination_info', {
        hasMore: rooms[newRoom].messages.length > 20,
        totalMessages: rooms[newRoom].messages.length,
        loadedMessages: recentMessages.length
      });
      
      console.log(`${currentUsername} moved to ${newRoom}`);
    }
  });

  // Handle loading more messages (pagination)
  socket.on('load_more_messages', ({ room, currentCount }) => {
    if (rooms[room]) {
      const messages = rooms[room].messages;
      const startIndex = Math.max(0, messages.length - currentCount - 20);
      const endIndex = messages.length - currentCount;
      const moreMessages = messages.slice(startIndex, endIndex);
      
      socket.emit('more_messages_loaded', moreMessages);
      socket.emit('pagination_info', {
        hasMore: startIndex > 0,
        totalMessages: messages.length,
        loadedMessages: currentCount + moreMessages.length
      });
      
      console.log(`Loaded ${moreMessages.length} more messages for ${currentUsername} in ${room}`);
    }
  });

  // Handle chat messages
  socket.on('send_message', (messageData) => {
    const message = {
      ...messageData,
      id: Date.now(),
      sender: currentUsername,
      senderId: socket.id,
      timestamp: new Date().toISOString(),
      room: currentRoom
    };
    
    rooms[currentRoom].messages.push(message);
    readReceipts[message.id] = [socket.id];
    
    // Limit stored messages to prevent memory issues (keep last 100 messages)
    if (rooms[currentRoom].messages.length > 100) {
      const removed = rooms[currentRoom].messages.shift();
      delete readReceipts[removed.id];
      if (messageReactions[removed.id]) {
        delete messageReactions[removed.id];
      }
    }
    
    // Track unread messages for all users in the room except sender
    Object.keys(rooms[currentRoom].users).forEach(userSocketId => {
      if (userSocketId !== socket.id) {
        const user = rooms[currentRoom].users[userSocketId];
        if (!user.unreadCounts) {
          user.unreadCounts = {};
        }
        user.unreadCounts[currentRoom] = (user.unreadCounts[currentRoom] || 0) + 1;
        
        // Emit updated unread count to each user
        io.to(userSocketId).emit('unread_count_update', {
          room: currentRoom,
          count: user.unreadCounts[currentRoom]
        });
      }
    });
    
    // Send notification to all users in the room except sender
    socket.to(currentRoom).emit('new_message_notification', {
      message: `New message in #${currentRoom} from ${currentUsername}`,
      room: currentRoom,
      sender: currentUsername,
      type: 'message'
    });
    
    io.to(currentRoom).emit('receive_message', message);
  });

  // Handle file sharing
  socket.on('send_file', (fileData) => {
    const message = {
      id: Date.now(),
      type: 'file',
      fileName: fileData.fileName,
      fileType: fileData.fileType,
      fileSize: fileData.fileSize,
      fileUrl: fileData.fileUrl,
      sender: currentUsername,
      senderId: socket.id,
      timestamp: new Date().toISOString(),
      room: currentRoom
    };
    
    rooms[currentRoom].messages.push(message);
    readReceipts[message.id] = [socket.id];
    
    if (rooms[currentRoom].messages.length > 100) {
      const removed = rooms[currentRoom].messages.shift();
      delete readReceipts[removed.id];
      if (messageReactions[removed.id]) {
        delete messageReactions[removed.id];
      }
    }
    
    // Track unread messages for files
    Object.keys(rooms[currentRoom].users).forEach(userSocketId => {
      if (userSocketId !== socket.id) {
        const user = rooms[currentRoom].users[userSocketId];
        if (!user.unreadCounts) {
          user.unreadCounts = {};
        }
        user.unreadCounts[currentRoom] = (user.unreadCounts[currentRoom] || 0) + 1;
        
        io.to(userSocketId).emit('unread_count_update', {
          room: currentRoom,
          count: user.unreadCounts[currentRoom]
        });
      }
    });
    
    // Send file notification
    socket.to(currentRoom).emit('new_message_notification', {
      message: `${currentUsername} shared a file in #${currentRoom}`,
      room: currentRoom,
      sender: currentUsername,
      type: 'file'
    });
    
    io.to(currentRoom).emit('receive_message', message);
  });

  // Handle clearing unread count when user views a room
  socket.on('clear_unread_count', (room) => {
    if (rooms[room] && rooms[room].users[socket.id]) {
      const user = rooms[room].users[socket.id];
      if (user.unreadCounts && user.unreadCounts[room]) {
        user.unreadCounts[room] = 0;
        
        // Emit updated unread count to the user
        socket.emit('unread_count_update', {
          room: room,
          count: 0
        });
        
        console.log(`Cleared unread count for ${currentUsername} in ${room}`);
      }
    }
  });

  // Handle message reactions
  socket.on('message_reaction', ({ messageId, reaction }) => {
    if (!messageReactions[messageId]) {
      messageReactions[messageId] = {};
    }
    
    if (!messageReactions[messageId][socket.id]) {
      messageReactions[messageId][socket.id] = reaction;
    } else {
      // Toggle reaction - remove if same reaction clicked again
      if (messageReactions[messageId][socket.id] === reaction) {
        delete messageReactions[messageId][socket.id];
      } else {
        messageReactions[messageId][socket.id] = reaction;
      }
    }
    
    // Find which room this message belongs to
    let messageRoom = 'general';
    Object.keys(rooms).forEach(roomName => {
      const msg = rooms[roomName].messages.find(m => m.id === messageId);
      if (msg) messageRoom = roomName;
    });
    
    io.to(messageRoom).emit('message_reaction_update', {
      messageId,
      reactions: messageReactions[messageId]
    });
  });

  // Handle read receipts
  socket.on('message_read', (messageId) => {
    if (readReceipts[messageId]) {
      if (!readReceipts[messageId].includes(socket.id)) {
        readReceipts[messageId].push(socket.id);
        
        // Update the message with read receipt info
        Object.keys(rooms).forEach(roomName => {
          const messageIndex = rooms[roomName].messages.findIndex(msg => msg.id === messageId);
          if (messageIndex !== -1) {
            rooms[roomName].messages[messageIndex].readBy = readReceipts[messageId];
          }
        });
        
        // Emit to appropriate room
        let messageRoom = 'general';
        Object.keys(rooms).forEach(roomName => {
          const msg = rooms[roomName].messages.find(m => m.id === messageId);
          if (msg) messageRoom = roomName;
        });
        
        io.to(messageRoom).emit('read_receipt_update', {
          messageId,
          readBy: readReceipts[messageId]
        });
      }
    }
  });

  // Handle typing indicator
  socket.on('typing', (isTyping) => {
    if (rooms[currentRoom].users[socket.id]) {
      if (isTyping) {
        rooms[currentRoom].typingUsers[socket.id] = currentUsername;
      } else {
        delete rooms[currentRoom].typingUsers[socket.id];
      }
      
      io.to(currentRoom).emit('typing_users', Object.values(rooms[currentRoom].typingUsers));
    }
  });

  // Handle private messages
  socket.on('private_message', ({ to, message }) => {
    const messageData = {
      id: Date.now(),
      sender: currentUsername,
      senderId: socket.id,
      message,
      timestamp: new Date().toISOString(),
      isPrivate: true,
    };
    
    // Send private message notification to recipient
    socket.to(to).emit('new_message_notification', {
      message: `Private message from ${currentUsername}`,
      room: 'private',
      sender: currentUsername,
      type: 'private'
    });
    
    socket.to(to).emit('private_message', messageData);
    socket.emit('private_message', messageData);
    
    // Store private messages
    const privateRoom = 'private_' + [socket.id, to].sort().join('_');
    if (!rooms[privateRoom]) {
      rooms[privateRoom] = { users: {}, messages: [], typingUsers: {} };
    }
    rooms[privateRoom].messages.push(messageData);
    readReceipts[messageData.id] = [socket.id];
  });

  // Handle notification settings
  socket.on('update_notification_settings', (settings) => {
    userNotifications[socket.id] = {
      ...userNotifications[socket.id],
      ...settings
    };
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    Object.keys(rooms).forEach(roomName => {
      if (rooms[roomName].users[socket.id]) {
        io.to(roomName).emit('user_left', { username: currentUsername, id: socket.id });
        console.log(`${currentUsername} left ${roomName}`);
        
        delete rooms[roomName].users[socket.id];
        delete rooms[roomName].typingUsers[socket.id];
        
        io.to(roomName).emit('user_list', Object.values(rooms[roomName].users));
        io.to(roomName).emit('typing_users', Object.values(rooms[roomName].typingUsers));
      }
    });
    
    delete userNotifications[socket.id];
  });
});

// API routes
app.get('/api/rooms', (req, res) => {
  res.json(Object.keys(rooms).filter(room => !room.startsWith('private_')));
});

app.get('/api/messages/:room', (req, res) => {
  const room = req.params.room;
  if (rooms[room]) {
    res.json(rooms[room].messages);
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

app.get('/api/users/:room', (req, res) => {
  const room = req.params.room;
  if (rooms[room]) {
    res.json(Object.values(rooms[room].users));
  } else {
    res.status(404).json({ error: 'Room not found' });
  }
});

// Root route
app.get('/', (req, res) => {
  res.send('Socket.io Chat Server is running with JWT Authentication');
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`JWT Authentication enabled`);
  console.log(`Message pagination enabled (stores last 100 messages per room)`);
});

export { app, server, io };