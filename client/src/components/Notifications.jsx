import React, { useState } from 'react';
import './Notifications.css';

const Notifications = ({ 
  notifications, 
  unreadCount, 
  onMarkAsRead, 
  onMarkAllAsRead,
  onClearAll, 
  onSettingsClick, 
  onClose 
}) => {
  const [selectedNotification, setSelectedNotification] = useState(null);
  const [showNotificationDetail, setShowNotificationDetail] = useState(false);

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleDateString([], {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'private': return <i className="fas fa-lock"></i>;
      case 'file': return <i className="fas fa-file"></i>;
      case 'system': return <i className="fas fa-info-circle"></i>;
      default: return <i className="fas fa-comment"></i>;
    }
  };

  const getNotificationTypeLabel = (type) => {
    switch (type) {
      case 'private': return 'Private Message';
      case 'file': return 'File Shared';
      case 'system': return 'System';
      default: return 'Message';
    }
  };

  const handleNotificationClick = (notification) => {
    // Mark as read when clicked
    if (!notification.read) {
      onMarkAsRead(notification.id);
    }
    
    // Show detailed view
    setSelectedNotification(notification);
    setShowNotificationDetail(true);
  };

  const handleCloseDetail = () => {
    setShowNotificationDetail(false);
    setSelectedNotification(null);
  };

  const handleClearAllWithConfirm = () => {
    if (notifications.length > 0) {
      if (window.confirm('Are you sure you want to clear all notifications?')) {
        onClearAll();
      }
    }
  };

  // If showing notification detail view
  if (showNotificationDetail && selectedNotification) {
    return (
      <div className="notifications-panel">
        <div className="notifications-header">
          <button 
            className="back-button"
            onClick={handleCloseDetail}
            title="Back to notifications"
          >
            <i className="fas fa-arrow-left"></i>
          </button>
          <h3>Notification Details</h3>
          <button 
            className="close-button"
            onClick={onClose}
            title="Close notifications"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="notification-detail">
          <div className="detail-header">
            <div className="detail-icon">
              {getNotificationIcon(selectedNotification.type)}
            </div>
            <div className="detail-meta">
              <h4 className="detail-title">{getNotificationTypeLabel(selectedNotification.type)}</h4>
              <div className="detail-time">
                <span>{formatDate(selectedNotification.timestamp)}</span>
                <span>{formatTime(selectedNotification.timestamp)}</span>
              </div>
            </div>
          </div>

          <div className="detail-content">
            <p className="detail-message">{selectedNotification.message}</p>
            
            {selectedNotification.room && selectedNotification.room !== 'private' && (
              <div className="detail-room">
                <i className="fas fa-hashtag"></i>
                <span>Room: {selectedNotification.room}</span>
              </div>
            )}
            
            {selectedNotification.sender && (
              <div className="detail-sender">
                <i className="fas fa-user"></i>
                <span>From: {selectedNotification.sender}</span>
              </div>
            )}
          </div>

          <div className="detail-actions">
            {selectedNotification.room && selectedNotification.room !== 'private' && selectedNotification.room !== 'system' && (
              <button className="action-button primary">
                <i className="fas fa-arrow-right"></i>
                Go to {selectedNotification.room}
              </button>
            )}
            <button 
              className="action-button secondary"
              onClick={() => {
                onMarkAsRead(selectedNotification.id);
                handleCloseDetail();
              }}
              disabled={selectedNotification.read}
            >
              <i className="fas fa-check"></i>
              {selectedNotification.read ? 'Already Read' : 'Mark as Read'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main notifications list view
  return (
    <div className="notifications-panel">
      <div className="notifications-header">
        <h3>Notifications</h3>
        <div className="notifications-actions">
          <button 
            className="settings-button"
            onClick={onSettingsClick}
            title="Notification settings"
          >
            <i className="fas fa-cog"></i>
          </button>
          {notifications.length > 0 && (
            <button 
              className="clear-button"
              onClick={handleClearAllWithConfirm}
            >
              <i className="fas fa-trash"></i>
              Clear All
            </button>
          )}
          <button 
            className="close-button"
            onClick={onClose}
            title="Close notifications"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      </div>

      <div className="notifications-list">
        {notifications.length === 0 ? (
          <div className="no-notifications">
            <div className="no-notifications-icon">
              <i className="fas fa-bell-slash"></i>
            </div>
            <p>No notifications</p>
            <span>You're all caught up!</span>
          </div>
        ) : (
          notifications.map(notification => (
            <div
              key={notification.id}
              className={`notification-item ${notification.read ? 'read' : 'unread'}`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="notification-icon">
                {getNotificationIcon(notification.type)}
              </div>
              <div className="notification-content">
                <p className="notification-message">{notification.message}</p>
                <div className="notification-meta">
                  <span className="notification-type">
                    {getNotificationTypeLabel(notification.type)}
                  </span>
                  {notification.room && notification.room !== 'private' && (
                    <span className="notification-room">#{notification.room}</span>
                  )}
                  <span className="notification-time">
                    {formatTime(notification.timestamp)}
                  </span>
                </div>
              </div>
              {!notification.read && <div className="unread-indicator"></div>}
              
              {/* Click hint */}
              <div className="click-hint">
                <i className="fas fa-chevron-right"></i>
              </div>
            </div>
          ))
        )}
      </div>

      {unreadCount > 0 && (
        <div className="notifications-footer">
          <span>{unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}</span>
          <button 
            className="mark-all-read"
            onClick={onMarkAllAsRead}
          >
            Mark all as read
          </button>
        </div>
      )}
    </div>
  );
};

export default Notifications;