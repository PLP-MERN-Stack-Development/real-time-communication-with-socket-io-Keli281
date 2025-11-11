import React, { useState } from 'react';
import { useSocket } from './socket/socket';
import Chat from './components/Chat';
import Notifications from './components/Notifications';
import NotificationSettings from './components/NotificationSettings';
import './App.css';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const socket = useSocket();

  const handleLogin = (username) => {
    setCurrentUser(username);
    socket.connect(username);
  };

  const handleLogout = () => {
    socket.disconnect();
    setCurrentUser(null);
    setShowNotifications(false);
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
    if (showNotificationSettings) {
      setShowNotificationSettings(false);
    }
  };

  const toggleNotificationSettings = () => {
    setShowNotificationSettings(!showNotificationSettings);
    if (showNotifications) {
      setShowNotifications(false);
    }
  };

  const handleMarkNotificationAsRead = (notificationId) => {
    socket.markNotificationAsRead(notificationId);
  };

  const handleClearNotifications = () => {
    socket.clearNotifications();
  };

  const getConnectionStatusColor = () => {
    switch (socket.connectionStatus) {
      case 'connected': return '#4CAF50'; // Green
      case 'connecting': return '#FF9800'; // Orange
      case 'reconnecting': return '#FF9800'; // Orange
      case 'error': return '#F44336'; // Red
      default: return '#9E9E9E'; // Gray
    }
  };

  const getConnectionStatusText = () => {
    switch (socket.connectionStatus) {
      case 'connected': return '🟢 Connected';
      case 'connecting': return '🟡 Connecting...';
      case 'reconnecting': return `🟡 Reconnecting... (Attempt ${socket.reconnectionAttempts})`;
      case 'error': return '🔴 Connection Error';
      case 'disconnected': return '⚫ Disconnected';
      default: return '⚫ Unknown';
    }
  };

  if (!currentUser) {
    return (
      <div className="login-container">
        <div className="login-card">
          <div className="login-header">
            <h1 className="login-title">Chat Application</h1>
            <p className="login-subtitle">Join the conversation</p>
          </div>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            const username = e.target.username.value;
            if (username.trim()) handleLogin(username.trim());
          }} className="login-form">
            <div className="input-group">
              <label htmlFor="username" className="input-label">
                Choose your username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                placeholder="Enter your name"
                className="username-input"
                maxLength={20}
                autoFocus
                required
              />
            </div>
            
            <button type="submit" className="login-button">
              Join Chat
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {/* Header */}
      <div className="app-header">
        <div className="header-left">
          <h1>Chat Application</h1>
          <div className="room-indicator">
            <span># {socket.currentRoom}</span>
            <span className="online-count">{socket.users.length} online</span>
          </div>
        </div>
        
        <div className="header-right">
          <div className="user-info">
            <span>Welcome, {currentUser}</span>
            <span 
              className="connection-status"
              style={{ color: getConnectionStatusColor() }}
              title={socket.lastDisconnectReason ? `Last disconnect: ${socket.lastDisconnectReason}` : ''}
            >
              {getConnectionStatusText()}
            </span>
          </div>
          
          <div className="header-actions">
            {/* Reconnect Button (show when disconnected) */}
            {(socket.connectionStatus === 'error' || socket.connectionStatus === 'disconnected') && (
              <button 
                className="reconnect-button"
                onClick={socket.reconnect}
                title="Reconnect to chat"
              >
                <i className="fas fa-sync-alt"></i>
                Reconnect
              </button>
            )}

            {/* Notifications Bell */}
            <button 
              className={`notification-bell ${socket.unreadCount > 0 ? 'has-notifications' : ''}`}
              onClick={toggleNotifications}
              title="Notifications"
            >
              <i className="fas fa-bell"></i>
              {socket.unreadCount > 0 && (
                <span className="notification-badge">{socket.unreadCount}</span>
              )}
            </button>

            {/* Settings Button */}
            <button 
              className="settings-button"
              onClick={toggleNotificationSettings}
              title="Notification settings"
            >
              <i className="fas fa-cog"></i>
            </button>

            {/* Logout Button */}
            <button 
              className="logout-button"
              onClick={handleLogout}
            >
              <i className="fas fa-sign-out-alt"></i>
              Logout
            </button>
          </div>

        </div>
      </div>

      {/* Connection Status Banner */}
      {socket.connectionStatus === 'reconnecting' && (
        <div className="connection-banner reconnecting">
          <div className="banner-content">
            <i className="fas fa-sync-alt fa-spin"></i>
            <span>Reconnecting to chat... (Attempt {socket.reconnectionAttempts})</span>
          </div>
        </div>
      )}

      {socket.connectionStatus === 'error' && (
        <div className="connection-banner error">
          <div className="banner-content">
            <i className="fas fa-exclamation-triangle"></i>
            <span>Connection lost. </span>
            <button onClick={socket.reconnect} className="banner-reconnect-button">
              Try to Reconnect
            </button>
          </div>
        </div>
      )}

      {/* Main Chat Area */}
      <Chat socket={socket} currentUser={currentUser} />

      {/* Notifications Panel */}
      {showNotifications && (
        <div className="notifications-overlay">
          <Notifications
            notifications={socket.notifications}
            unreadCount={socket.unreadCount}
            onMarkAsRead={handleMarkNotificationAsRead}
            onMarkAllAsRead={socket.markAllNotificationsAsRead}
            onClearAll={handleClearNotifications}
            onSettingsClick={toggleNotificationSettings}
            onClose={toggleNotifications}
          />
        </div>
      )}

      {/* Notification Settings Panel */}
      {showNotificationSettings && (
        <div className="notifications-overlay">
          <NotificationSettings
            settings={socket.notificationSettings}
            onUpdateSettings={socket.updateNotificationSettings}
            onClose={() => setShowNotificationSettings(false)}
          />
        </div>
      )}
    </div>
  );
}

export default App;