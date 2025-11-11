// socket.js - Enhanced with JWT authentication, notifications, pagination, and reconnection logic
import { io } from 'socket.io-client';
import { useEffect, useState } from 'react';

// Socket.io connection URL
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// JWT Token Storage
const TOKEN_KEY = 'chat_jwt_token';

const authHelpers = {
  saveToken: (token) => {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch (error) {
      console.warn('Failed to save token:', error);
    }
  },
  
  getToken: () => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  
  removeToken: () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (error) {
      console.warn('Failed to remove token:', error);
    }
  }
};

// Create socket instance (will connect with token)
let socket = null;

// Local storage helpers for messages
const STORAGE_KEYS = {
  MESSAGES: 'chat_messages',
  NOTIFICATIONS: 'chat_notifications',
  SETTINGS: 'chat_settings',
  RECONNECTION: 'chat_reconnection_state'
};

const storageHelpers = {
  getMessages: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.MESSAGES);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  },
  
  saveMessages: (messages) => {
    try {
      localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
    } catch (error) {
      console.warn('Failed to save messages to localStorage:', error);
    }
  },
  
  getNotifications: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  },
  
  saveNotifications: (notifications) => {
    try {
      localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    } catch (error) {
      console.warn('Failed to save notifications to localStorage:', error);
    }
  },
  
  getSettings: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },
  
  saveSettings: (settings) => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (error) {
      console.warn('Failed to save settings to localStorage:', error);
    }
  },
  
  saveReconnectionState: (state) => {
    try {
      localStorage.setItem(STORAGE_KEYS.RECONNECTION, JSON.stringify({
        ...state,
        timestamp: Date.now()
      }));
    } catch (error) {
      console.warn('Failed to save reconnection state:', error);
    }
  },
  
  getReconnectionState: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.RECONNECTION);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }
};

// Custom hook for using socket.io with JWT
export const useSocket = () => {
  // Load initial state from localStorage
  const storedSettings = storageHelpers.getSettings();
  const storedNotifications = storageHelpers.getNotifications();
  const storedMessages = storageHelpers.getMessages();

  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected'); // 'connected', 'connecting', 'reconnecting', 'disconnected', 'error'
  const [lastMessage, setLastMessage] = useState(null);
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [currentRoom, setCurrentRoom] = useState('general');
  const [availableRooms, setAvailableRooms] = useState(['general', 'random', 'tech']);
  const [notifications, setNotifications] = useState(storedNotifications);
  const [unreadCounts, setUnreadCounts] = useState({}); // Track per room
  const [totalUnreadCount, setTotalUnreadCount] = useState(0); // Total across all rooms
  const [notificationSettings, setNotificationSettings] = useState(
    storedSettings || {
      sound: true,
      browser: true,
      desktop: false
    }
  );
  const [authError, setAuthError] = useState(null);
  const [paginationInfo, setPaginationInfo] = useState({
    hasMore: false,
    totalMessages: 0,
    loadedMessages: 0
  });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [reconnectionAttempts, setReconnectionAttempts] = useState(0);
  const [lastDisconnectReason, setLastDisconnectReason] = useState('');

  // Calculate total unread count across all rooms
  const calculateTotalUnread = (counts) => {
    return Object.values(counts).reduce((total, count) => total + count, 0);
  };

  // ============ JWT LOGIN ============
  const login = async (username) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username }),
      });

      const data = await response.json();

      if (data.success && data.token) {
        // Save JWT token
        authHelpers.saveToken(data.token);
        return { success: true, token: data.token, username: data.username };
      } else {
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Network error' };
    }
  };

  // ============ ENHANCED CONNECTION WITH RECONNECTION LOGIC ============
  const connect = async (username, room = 'general') => {
    // First, login to get JWT token
    const loginResult = await login(username);
    
    if (!loginResult.success) {
      setAuthError(loginResult.error);
      setConnectionStatus('error');
      return false;
    }

    const token = loginResult.token;

    // Enhanced socket configuration with robust reconnection
    socket = io(SOCKET_URL, {
      auth: {
        token: token
      },
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10, // Increased attempts
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      transports: ['websocket', 'polling'] // Fallback transport
    });

    setConnectionStatus('connecting');

    // Enhanced connection events
    socket.on('connect', () => {
      console.log('Connected with JWT authentication');
      setIsConnected(true);
      setConnectionStatus('connected');
      setAuthError(null);
      setReconnectionAttempts(0);
      setLastDisconnectReason('');
      
      // Save connection state
      storageHelpers.saveReconnectionState({
        username: username,
        room: room,
        connected: true
      });
      
      // Join room after connection
      socket.emit('user_join', { room });
      setCurrentRoom(room);
      
      // Load messages for this room from localStorage
      const roomMessages = storedMessages[room] || [];
      setMessages(roomMessages);
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error.message);
      setConnectionStatus('error');
      setAuthError(`Connection failed: ${error.message}`);
      setIsConnected(false);
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected from server:', reason);
      setIsConnected(false);
      setLastDisconnectReason(reason);
      
      // Handle different disconnect reasons
      if (reason === 'io server disconnect') {
        // Server intentionally disconnected (e.g., server restart)
        setConnectionStatus('disconnected');
        setAuthError('Server disconnected. Please refresh the page.');
      } else if (reason === 'io client disconnect') {
        // Client intentionally disconnected
        setConnectionStatus('disconnected');
      } else {
        // Unexpected disconnect (network issues, etc.)
        setConnectionStatus('reconnecting');
      }
      
      // Save disconnection state
      storageHelpers.saveReconnectionState({
        username: username,
        room: room,
        connected: false,
        disconnectReason: reason
      });
    });

    socket.on('reconnect_attempt', (attempt) => {
      console.log(`Reconnection attempt ${attempt}`);
      setReconnectionAttempts(attempt);
      setConnectionStatus('reconnecting');
    });

    socket.on('reconnect', (attempt) => {
      console.log(`Reconnected after ${attempt} attempts`);
      setConnectionStatus('connected');
      setReconnectionAttempts(0);
      
      // Restore user state after reconnection
      socket.emit('user_join', { room: currentRoom });
      
      // Show reconnection notification
      addNotification({
        message: 'Reconnected to chat server',
        room: 'system',
        type: 'system'
      });
    });

    socket.on('reconnect_error', (error) => {
      console.error('Reconnection error:', error);
      setConnectionStatus('error');
    });

    socket.on('reconnect_failed', () => {
      console.error('Reconnection failed after all attempts');
      setConnectionStatus('error');
      setAuthError('Failed to reconnect. Please refresh the page.');
    });

    return true;
  };

  // Manual reconnection
  const reconnect = async () => {
    if (socket) {
      setConnectionStatus('connecting');
      socket.connect();
    }
  };

  // Manual disconnection
  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    authHelpers.removeToken();
    setIsConnected(false);
    setConnectionStatus('disconnected');
    
    // Clear all state
    setMessages([]);
    setUsers([]);
    setTypingUsers([]);
    setCurrentRoom('general');
    setNotifications([]);
    setUnreadCounts({});
    setTotalUnreadCount(0);
    setPaginationInfo({
      hasMore: false,
      totalMessages: 0,
      loadedMessages: 0
    });
    
    // Clear reconnection state
    localStorage.removeItem(STORAGE_KEYS.RECONNECTION);
  };

  // Load more messages (pagination)
  const loadMoreMessages = () => {
    if (socket && !isLoadingMore && paginationInfo.hasMore) {
      setIsLoadingMore(true);
      socket.emit('load_more_messages', {
        room: currentRoom,
        currentCount: messages.length
      });
    }
  };

  // Clear unread count for a specific room
  const clearUnreadCount = (room) => {
    if (socket) {
      socket.emit('clear_unread_count', room);
    }
    
    setUnreadCounts(prev => {
      const updated = { ...prev, [room]: 0 };
      const total = calculateTotalUnread(updated);
      setTotalUnreadCount(total);
      return updated;
    });
  };

  // Change room
  const changeRoom = (newRoom) => {
    if (socket) {
      socket.emit('change_room', newRoom);
      setCurrentRoom(newRoom);
      
      // Clear unread count when user actively switches to this room
      clearUnreadCount(newRoom);
      
      // Load messages for new room from localStorage
      const roomMessages = storedMessages[newRoom] || [];
      setMessages(roomMessages);
      
      // Mark notifications as read when switching to that room
      setNotifications(prev => {
        const updated = prev.map(notif => 
          notif.room === newRoom ? { ...notif, read: true } : notif
        );
        storageHelpers.saveNotifications(updated);
        return updated;
      });
      updateUnreadCount();
    }
  };

  // Send a message
  const sendMessage = (message) => {
    if (socket) {
      socket.emit('send_message', { message });
    }
  };

  // Send a private message
  const sendPrivateMessage = (to, message) => {
    if (socket) {
      socket.emit('private_message', { to, message });
    }
  };

  // Send a file
  const sendFile = (fileData) => {
    if (socket) {
      socket.emit('send_file', fileData);
    }
  };

  // React to a message
  const reactToMessage = (messageId, reaction) => {
    if (socket) {
      socket.emit('message_reaction', { messageId, reaction });
    }
  };

  // Mark message as read
  const markMessageAsRead = (messageId) => {
    if (socket) {
      socket.emit('message_read', messageId);
    }
  };

  // Set typing status
  const setTyping = (isTyping) => {
    if (socket) {
      socket.emit('typing', isTyping);
    }
  };

  // Update notification settings
  const updateNotificationSettings = (settings) => {
    const newSettings = { ...notificationSettings, ...settings };
    setNotificationSettings(newSettings);
    storageHelpers.saveSettings(newSettings);
    if (socket) {
      socket.emit('update_notification_settings', newSettings);
    }
  };

  // Add notification
  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now(),
      ...notification,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    setNotifications(prev => {
      const updated = [newNotification, ...prev.slice(0, 49)]; // Keep last 50
      storageHelpers.saveNotifications(updated);
      return updated;
    });
    
    // Play sound if enabled
    if (notificationSettings.sound && notification.type !== 'private') {
      playNotificationSound();
    }
    
    // Show browser notification if enabled and permitted
    if (notificationSettings.browser && document.hidden) {
      showBrowserNotification(notification);
    }
    
    updateUnreadCount();
  };

  // Mark notification as read
  const markNotificationAsRead = (notificationId) => {
    setNotifications(prev => {
      const updated = prev.map(notif =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      );
      storageHelpers.saveNotifications(updated);
      return updated;
    });
    updateUnreadCount();
  };

  // Mark all notifications as read
  const markAllNotificationsAsRead = () => {
    setNotifications(prev => {
      const updated = prev.map(notif => ({ ...notif, read: true }));
      storageHelpers.saveNotifications(updated);
      return updated;
    });
    updateUnreadCount();
  };

  // Clear all notifications
  const clearNotifications = () => {
    setNotifications([]);
    storageHelpers.saveNotifications([]);
    setTotalUnreadCount(0);
  };

  // Update unread count
  const updateUnreadCount = () => {
    const count = notifications.filter(notif => !notif.read).length;
    setTotalUnreadCount(count);
    
    // Update browser tab title
    document.title = count > 0 ? `(${count}) Chat App` : 'Chat App';
  };

  // Play notification sound
  const playNotificationSound = () => {
    const audio = new Audio('/notification.mp3');
    audio.volume = 0.3;
    audio.play().catch(() => {
      // Fallback: Use browser's built-in audio context for a simple beep
      const context = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      setTimeout(() => {
        oscillator.stop();
      }, 100);
    });
  };

  // Show browser notification
  const showBrowserNotification = (notification) => {
    if (!('Notification' in window)) return;
    
    if (Notification.permission === 'granted') {
      new Notification('Chat App', {
        body: notification.message,
        icon: '/favicon.ico',
        tag: 'chat-notification'
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          new Notification('Chat App', {
            body: notification.message,
            icon: '/favicon.ico',
            tag: 'chat-notification'
          });
        }
      });
    }
  };

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Socket event listeners - SAFE VERSION
  useEffect(() => {
    if (!socket) return;

    // Message events
    const onReceiveMessage = (message) => {
      setLastMessage(message);
      setMessages((prev) => {
        const newMessages = [...prev, message];
        // Save to localStorage
        const allMessages = storageHelpers.getMessages();
        storageHelpers.saveMessages({
          ...allMessages,
          [currentRoom]: newMessages
        });
        return newMessages;
      });
    };

    const onRoomMessages = (roomMessages) => {
      setMessages(roomMessages);
      // Save to localStorage
      const allMessages = storageHelpers.getMessages();
      storageHelpers.saveMessages({
        ...allMessages,
        [currentRoom]: roomMessages
      });
    };

    const onMoreMessagesLoaded = (moreMessages) => {
      setMessages(prev => {
        const newMessages = [...moreMessages, ...prev];
        // Save to localStorage
        const allMessages = storageHelpers.getMessages();
        storageHelpers.saveMessages({
          ...allMessages,
          [currentRoom]: newMessages
        });
        return newMessages;
      });
      setIsLoadingMore(false);
    };

    const onPrivateMessage = (message) => {
      setLastMessage(message);
      setMessages((prev) => {
        const newMessages = [...prev, message];
        // Save to localStorage
        const allMessages = storageHelpers.getMessages();
        storageHelpers.saveMessages({
          ...allMessages,
          [currentRoom]: newMessages
        });
        return newMessages;
      });
    };

    // Pagination events
    const onPaginationInfo = (info) => {
      setPaginationInfo(info);
    };

    // Unread count events
    const onUnreadCountUpdate = (data) => {
      setUnreadCounts(prev => {
        const updated = { ...prev, [data.room]: data.count };
        const total = calculateTotalUnread(updated);
        setTotalUnreadCount(total);
        return updated;
      });
    };

    // Notification events
    const onNewMessageNotification = (notification) => {
      // Don't show notifications for current room
      if (notification.room !== currentRoom) {
        addNotification(notification);
      }
    };

    // Reaction events
    const onMessageReactionUpdate = (data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, reactions: data.reactions }
            : msg
        )
      );
    };

    // Read receipt events
    const onReadReceiptUpdate = (data) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === data.messageId
            ? { ...msg, readBy: data.readBy }
            : msg
        )
      );
    };

    // User events
    const onUserList = (userList) => {
      setUsers(userList);
    };

    const onUserJoined = (user) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} joined the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    const onUserLeft = (user) => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          system: true,
          message: `${user.username} left the chat`,
          timestamp: new Date().toISOString(),
        },
      ]);
    };

    // Typing events
    const onTypingUsers = (users) => {
      setTypingUsers(users);
    };

    // Register event listeners
    socket.on('receive_message', onReceiveMessage);
    socket.on('room_messages', onRoomMessages);
    socket.on('more_messages_loaded', onMoreMessagesLoaded);
    socket.on('private_message', onPrivateMessage);
    socket.on('pagination_info', onPaginationInfo);
    socket.on('unread_count_update', onUnreadCountUpdate);
    socket.on('new_message_notification', onNewMessageNotification);
    socket.on('message_reaction_update', onMessageReactionUpdate);
    socket.on('read_receipt_update', onReadReceiptUpdate);
    socket.on('user_list', onUserList);
    socket.on('user_joined', onUserJoined);
    socket.on('user_left', onUserLeft);
    socket.on('typing_users', onTypingUsers);

    // Clean up event listeners - SAFE VERSION
    return () => {
      if (socket) {
        socket.off('receive_message', onReceiveMessage);
        socket.off('room_messages', onRoomMessages);
        socket.off('more_messages_loaded', onMoreMessagesLoaded);
        socket.off('private_message', onPrivateMessage);
        socket.off('pagination_info', onPaginationInfo);
        socket.off('unread_count_update', onUnreadCountUpdate);
        socket.off('new_message_notification', onNewMessageNotification);
        socket.off('message_reaction_update', onMessageReactionUpdate);
        socket.off('read_receipt_update', onReadReceiptUpdate);
        socket.off('user_list', onUserList);
        socket.off('user_joined', onUserJoined);
        socket.off('user_left', onUserLeft);
        socket.off('typing_users', onTypingUsers);
      }
    };
  }, [currentRoom, socket]);

  // Update unread count when notifications change
  useEffect(() => {
    updateUnreadCount();
  }, [notifications]);

  return {
    socket,
    isConnected,
    connectionStatus, // New: Detailed connection status
    lastMessage,
    messages,
    users,
    typingUsers,
    currentRoom,
    availableRooms,
    notifications,
    unreadCount: totalUnreadCount,
    unreadCounts,
    notificationSettings,
    authError,
    paginationInfo,
    isLoadingMore,
    reconnectionAttempts, // New: Track reconnection attempts
    lastDisconnectReason, // New: Reason for last disconnect
    connect,
    disconnect,
    reconnect, // New: Manual reconnection function
    changeRoom,
    sendMessage,
    sendPrivateMessage,
    sendFile,
    reactToMessage,
    markMessageAsRead,
    setTyping,
    updateNotificationSettings,
    addNotification,
    markNotificationAsRead,
    markAllNotificationsAsRead, // New: Mark all as read function
    clearNotifications,
    clearUnreadCount,
    loadMoreMessages,
  };
};

export default socket;