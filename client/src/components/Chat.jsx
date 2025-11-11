import React, { useState, useRef, useEffect } from 'react';
import PrivateMessageModal from './PrivateMessageModal';
import FileUpload from './FileUpload';
import './Chat.css';

const Chat = ({ socket, currentUser }) => {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showPrivateModal, setShowPrivateModal] = useState(false);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showReadReceiptsModal, setShowReadReceiptsModal] = useState(false);
  const [showReactionsModal, setShowReactionsModal] = useState(false);
  const [selectedUserForPM, setSelectedUserForPM] = useState(null);
  const [selectedMessageReceipts, setSelectedMessageReceipts] = useState(null);
  const [selectedMessageReactions, setSelectedMessageReactions] = useState(null);
  const [showReactionPicker, setShowReactionPicker] = useState(null);
  const [reactionPickerPosition, setReactionPickerPosition] = useState({ top: 0, left: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);
  const messagesEndRef = useRef(null);
  const messageRefs = useRef({});
  const searchInputRef = useRef(null);

  // Safe access to socket properties
  const isSocketConnected = socket?.isConnected || false;
  const socketId = socket?.socket?.id || null;
  const messages = socket?.messages || [];
  const users = socket?.users || [];
  const typingUsers = socket?.typingUsers || [];
  const currentRoom = socket?.currentRoom || 'general';
  const availableRooms = socket?.availableRooms || ['general', 'random', 'tech'];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Fixed read receipts useEffect
  useEffect(() => {
    const markMessagesAsRead = () => {
      if (!socketId || !socket?.markMessageAsRead) return;
      
      messages.forEach(msg => {
        // Only mark messages from others as read
        if (msg.senderId !== socketId && !msg.readBy?.includes(socketId)) {
          socket.markMessageAsRead(msg.id);
        }
      });
    };

    // Mark messages as read when component mounts or messages update
    markMessagesAsRead();

    // Also mark as read when user becomes active (clicks, types, etc.)
    const handleUserActivity = () => {
      markMessagesAsRead();
    };

    window.addEventListener('click', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);

    return () => {
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
    };
  }, [messages, socketId, socket?.markMessageAsRead]);

  // Search functionality
  useEffect(() => {
    if (searchQuery.trim()) {
      setIsSearching(true);
      const results = messages.filter(msg => {
        if (msg.system) return false; // Don't search system messages
        
        const searchLower = searchQuery.toLowerCase();
        const messageText = msg.message?.toLowerCase() || '';
        const senderName = msg.sender?.toLowerCase() || '';
        
        return messageText.includes(searchLower) || senderName.includes(searchLower);
      });
      
      setSearchResults(results);
      setCurrentSearchIndex(-1);
    } else {
      setSearchResults([]);
      setCurrentSearchIndex(-1);
      setIsSearching(false);
    }
  }, [searchQuery, messages]);

  // Focus search input when search is opened
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Keyboard shortcuts for search
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ctrl+F or Cmd+F to open search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
      
      // Escape to close search
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery('');
      }
      
      // Enter to find next result when search is open
      if (e.key === 'Enter' && showSearch && searchQuery.trim()) {
        e.preventDefault();
        findNextResult();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSearch, searchQuery, searchResults, currentSearchIndex]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (message.trim() && socket?.sendMessage) {
      socket.sendMessage(message);
      setMessage('');
      if (socket.setTyping) {
        socket.setTyping(false);
      }
    }
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);
    
    if (!socket?.setTyping) return;
    
    if (e.target.value && !isTyping) {
      setIsTyping(true);
      socket.setTyping(true);
    } else if (!e.target.value && isTyping) {
      setIsTyping(false);
      socket.setTyping(false);
    }
  };

  const handlePrivateMessage = (to, privateMessage) => {
    if (socket?.sendPrivateMessage) {
      socket.sendPrivateMessage(to, privateMessage);
    }
  };

  const handleFileUpload = (fileData) => {
    if (socket?.sendFile) {
      socket.sendFile(fileData);
    }
  };

  const handleUserClick = (user) => {
    if (user.id !== socketId) {
      setSelectedUserForPM(user);
      setShowPrivateModal(true);
    }
  };

  const handleRoomChange = (newRoom) => {
    if (newRoom !== currentRoom && socket?.changeRoom) {
      socket.changeRoom(newRoom);
      // Close search when changing rooms
      setShowSearch(false);
      setSearchQuery('');
    }
  };

  const handleReadReceiptsClick = (msg) => {
    setSelectedMessageReceipts(msg);
    setShowReadReceiptsModal(true);
  };

  const handleReactionClick = (msg, reaction = null, event = null) => {
    if (reaction && socket?.reactToMessage) {
      socket.reactToMessage(msg.id, reaction);
      setShowReactionPicker(null);
    } else if (event) {
      // Calculate position for reaction picker
      const buttonRect = event.target.getBoundingClientRect();
      const messagesContainer = document.querySelector('.messages-container');
      const containerRect = messagesContainer?.getBoundingClientRect();
      
      if (containerRect) {
        setReactionPickerPosition({
          top: buttonRect.top - containerRect.top - 50, // Position above the button
          left: buttonRect.left - containerRect.left
        });
      }
      setShowReactionPicker(showReactionPicker === msg.id ? null : msg.id);
    }
  };

  const handleReactionsView = (msg) => {
    setSelectedMessageReactions(msg);
    setShowReactionsModal(true);
  };

  // Search functions
  const handleSearch = (query) => {
    setSearchQuery(query);
  };

  const findNextResult = () => {
    if (searchResults.length === 0) return;
    
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    
    // Scroll to the found message
    const foundMessage = searchResults[nextIndex];
    const messageElement = messageRefs.current[foundMessage.id];
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Add highlight effect
      messageElement.classList.add('search-highlight');
      setTimeout(() => {
        messageElement.classList.remove('search-highlight');
      }, 2000);
    }
  };

  const findPreviousResult = () => {
    if (searchResults.length === 0) return;
    
    const prevIndex = currentSearchIndex <= 0 ? searchResults.length - 1 : currentSearchIndex - 1;
    setCurrentSearchIndex(prevIndex);
    
    // Scroll to the found message
    const foundMessage = searchResults[prevIndex];
    const messageElement = messageRefs.current[foundMessage.id];
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Add highlight effect
      messageElement.classList.add('search-highlight');
      setTimeout(() => {
        messageElement.classList.remove('search-highlight');
      }, 2000);
    }
  };

  const closeSearch = () => {
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    setCurrentSearchIndex(-1);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const isPrivateMessage = (msg) => {
    return msg.isPrivate || msg.message?.includes('(Private)');
  };

  // WhatsApp-style read receipts
  const getReadReceiptInfo = (msg) => {
    if (!msg.readBy || msg.senderId !== socketId) return null;
    
    const readCount = msg.readBy.length;
    const totalUsers = users.length;
    
    // Don't count the sender in read receipts
    const otherUsersRead = readCount - 1;
    const totalOtherUsers = totalUsers - 1;

    if (otherUsersRead === totalOtherUsers && totalOtherUsers > 0) {
      return { status: 'read', count: otherUsersRead, total: totalOtherUsers };
    } else if (otherUsersRead > 0) {
      return { status: 'read-some', count: otherUsersRead, total: totalOtherUsers };
    } else if (readCount > 1) {
      return { status: 'delivered', count: 0, total: 0 };
    }
    return { status: 'sent', count: 0, total: 0 };
  };

  const renderReadReceipt = (msg) => {
    const receiptInfo = getReadReceiptInfo(msg);
    if (!receiptInfo) return null;

    const { status } = receiptInfo;

    return (
      <div 
        className={`read-receipt ${status}`}
        onClick={() => handleReadReceiptsClick(msg)}
        title="Click to see read info"
      >
        {status === 'sent' && <span>✓</span>}
        {status === 'delivered' && <span>✓✓</span>}
        {status === 'read-some' && <span>✓✓</span>}
        {status === 'read' && <span className="blue-ticks">✓✓</span>}
      </div>
    );
  };

  const getReactionSummary = (msg) => {
    if (!msg.reactions || Object.keys(msg.reactions).length === 0) return null;
    
    const reactionCounts = {};
    Object.values(msg.reactions).forEach(reaction => {
      reactionCounts[reaction] = (reactionCounts[reaction] || 0) + 1;
    });
    
    return Object.entries(reactionCounts)
      .map(([reaction, count]) => `${reaction} ${count}`)
      .join(' ');
  };

  const renderMessageReactions = (msg) => {
    // Don't show reactions for system messages
    if (msg.system) return null;
    
    const reactionSummary = getReactionSummary(msg);
    
    return (
      <div className="message-reactions">
        {reactionSummary && (
          <div 
            className="reactions-summary"
            onClick={() => handleReactionsView(msg)}
          >
            {reactionSummary}
          </div>
        )}
        <button 
          className="add-reaction-button"
          onClick={(e) => handleReactionClick(msg, null, e)}
          title="Add reaction"
        >
          <i className="fas fa-smile"></i>
        </button>
        
        {showReactionPicker === msg.id && (
          <div 
            className="reaction-picker"
            style={{
              top: `${reactionPickerPosition.top}px`,
              left: `${reactionPickerPosition.left}px`
            }}
          >
            {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(reaction => (
              <button
                key={reaction}
                className="reaction-option"
                onClick={() => handleReactionClick(msg, reaction)}
              >
                {reaction}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderMessageContent = (msg) => {
    if (msg.type === 'file') {
      return (
        <div className="file-message">
          <div className="file-icon">
            <i className="fas fa-file"></i>
          </div>
          <div className="file-info">
            <div className="file-name">{msg.fileName}</div>
            <div className="file-details">
              {msg.fileType} • {formatFileSize(msg.fileSize)}
            </div>
            <a 
              href={msg.fileUrl} 
              download={msg.fileName}
              className="download-button"
            >
              Download File
            </a>
          </div>
        </div>
      );
    }
    
    // Highlight search terms in message content
    if (searchQuery.trim() && !msg.system) {
      const searchLower = searchQuery.toLowerCase();
      const messageText = msg.message || '';
      const parts = messageText.split(new RegExp(`(${searchQuery})`, 'gi'));
      
      return (
        <span>
          {parts.map((part, index) => 
            part.toLowerCase() === searchLower ? (
              <mark key={index} className="search-match">{part}</mark>
            ) : (
              part
            )
          )}
        </span>
      );
    }
    
    return msg.message;
  };

  const getReadReceiptUsers = (msg) => {
    if (!msg.readBy) return [];
    
    return msg.readBy
      .map(userId => users.find(user => user.id === userId))
      .filter(user => user && user.id !== socketId); // Exclude sender
  };

  const getReactionUsers = (msg) => {
    if (!msg.reactions) return [];
    
    return Object.entries(msg.reactions).map(([userId, reaction]) => {
      const user = users.find(u => u.id === userId);
      return user ? { ...user, reaction } : null;
    }).filter(Boolean);
  };

  // Close reaction picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showReactionPicker && !event.target.closest('.message-reactions')) {
        setShowReactionPicker(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showReactionPicker]);

  // Show loading state if socket is not connected
  if (!isSocketConnected) {
    return (
      <div className="chat-container">
        <div className="chat-disconnected">
          <p>Connecting to chat...</p>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="chat-interface">
        {/* Rooms Sidebar */}
        <div className="rooms-sidebar">
          <h3 className="sidebar-title">Chat Rooms</h3>
          <div className="rooms-list">
            {availableRooms.map(room => (
              <div
                key={room}
                className={`room-item ${room === currentRoom ? 'active-room' : ''}`}
                onClick={() => handleRoomChange(room)}
              >
                <div className="room-icon">
                  <i className="fas fa-hashtag"></i>
                </div>
                <span className="room-name">{room}</span>
                {room === currentRoom && <div className="active-indicator"></div>}
              </div>
            ))}
          </div>

          {/* Online Users Section */}
          <div className="users-section">
            <h4 className="sidebar-subtitle">Online Users ({users.length})</h4>
            <div className="users-list">
              {users.map(user => (
                <div 
                  key={user.id} 
                  className={`user-item ${user.id === socketId ? 'current-user' : 'clickable-user'}`}
                  onClick={() => user.id !== socketId && handleUserClick(user)}
                >
                  <div className="user-avatar">
                    {user.username?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <span className="user-name">
                    {user.username}
                    {user.id === socketId && ' (You)'}
                  </span>
                  <div className="online-indicator"></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Main Chat Area */}
        <div className="chat-main">
          {/* Room Header */}
          <div className="room-header">
            <div className="room-header-left">
              <h2>#{currentRoom}</h2>
              <div className="room-info">
                <span>{users.length} users online</span>
              </div>
            </div>
            
            <div className="room-header-actions">
              {/* Search Button */}
              <button 
                className="search-button"
                onClick={() => setShowSearch(!showSearch)}
                title="Search messages (Ctrl+F)"
              >
                <i className="fas fa-search"></i>
              </button>
            </div>
          </div>

          {/* Search Bar */}
          {showSearch && (
            <div className="search-bar">
              <div className="search-input-container">
                <i className="fas fa-search search-icon"></i>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={`Search in #${currentRoom}...`}
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="search-input"
                />
                {searchQuery && (
                  <button 
                    className="clear-search"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                )}
              </div>
              
              {searchQuery && (
                <div className="search-results-info">
                  <span className="results-count">
                    {searchResults.length} result{searchResults.length !== 1 ? 's' : ''}
                  </span>
                  
                  {searchResults.length > 0 && (
                    <div className="search-navigation">
                      <button 
                        className="nav-button"
                        onClick={findPreviousResult}
                        disabled={searchResults.length === 0}
                        title="Previous result (↑)"
                      >
                        <i className="fas fa-chevron-up"></i>
                      </button>
                      
                      <span className="current-result">
                        {currentSearchIndex + 1} / {searchResults.length}
                      </span>
                      
                      <button 
                        className="nav-button"
                        onClick={findNextResult}
                        disabled={searchResults.length === 0}
                        title="Next result (↓)"
                      >
                        <i className="fas fa-chevron-down"></i>
                      </button>
                    </div>
                  )}
                  
                  <button 
                    className="close-search-button"
                    onClick={closeSearch}
                    title="Close search (Esc)"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Messages Container */}
          <div className="messages-container">
            {messages.length === 0 ? (
              <div className="no-messages">
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  ref={(el) => (messageRefs.current[msg.id] = el)}
                  className={`message ${
                    msg.senderId === socketId ? 'own-message' : 
                    msg.system ? 'system-message' : 'other-message'
                  } ${isPrivateMessage(msg) ? 'private-message' : ''} ${
                    msg.type === 'file' ? 'file-message-container' : ''
                  } ${searchResults.some(r => r.id === msg.id) ? 'search-result' : ''} ${
                    searchResults[currentSearchIndex]?.id === msg.id ? 'current-search-result' : ''
                  }`}
                >
                  {!msg.system && (
                    <div className="message-sender">
                      {msg.sender}
                      {isPrivateMessage(msg) && <i className="fas fa-lock"></i>}
                    </div>
                  )}
                  <div className="message-content">
                    {renderMessageContent(msg)}
                  </div>
                  
                  {/* Message Reactions - Only for non-system messages */}
                  {renderMessageReactions(msg)}
                  
                  <div className="message-footer">
                    <div className="message-time">
                      {formatTime(msg.timestamp)}
                    </div>
                    {msg.senderId === socketId && !msg.system && (
                      renderReadReceipt(msg)
                    )}
                  </div>
                </div>
              ))
            )}
            
            {/* Typing Indicator */}
            {typingUsers.length > 0 && (
              <div className="typing-indicator">
                <div className="typing-dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span className="typing-text">
                  {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
                </span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <form onSubmit={handleSendMessage} className="message-form">
            <div className="input-container">
              <button 
                type="button"
                className="file-button"
                onClick={() => setShowFileUpload(true)}
                title="Share file"
              >
                <i className="fas fa-paperclip"></i>
              </button>
              <input
                type="text"
                value={message}
                onChange={handleTyping}
                placeholder={`Message #${currentRoom}`}
                className="message-input"
                maxLength={500}
              />
              <button 
                type="submit" 
                className="send-button"
                disabled={!message.trim()}
              >
                Send
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Private Message Modal */}
      {showPrivateModal && (
        <PrivateMessageModal
          users={users}
          currentUser={currentUser}
          onSendPrivateMessage={handlePrivateMessage}
          onClose={() => {
            setShowPrivateModal(false);
            setSelectedUserForPM(null);
          }}
        />
      )}

      {/* File Upload Modal */}
      {showFileUpload && (
        <FileUpload
          onFileUpload={handleFileUpload}
          onClose={() => setShowFileUpload(false)}
        />
      )}

      {/* Read Receipts Info Modal */}
      {showReadReceiptsModal && selectedMessageReceipts && (
        <div className="modal-overlay" onClick={() => setShowReadReceiptsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Read Receipts</h3>
              <button className="close-button" onClick={() => setShowReadReceiptsModal(false)}>×</button>
            </div>
            
            <div className="receipts-list">
              <div className="receipt-item">
                <span className="receipt-status">Sent:</span>
                <span className="receipt-time">{formatTime(selectedMessageReceipts.timestamp)}</span>
              </div>
              
              <div className="receipt-item">
                <span className="receipt-status">Delivered:</span>
                <span className="receipt-time">{formatTime(selectedMessageReceipts.timestamp)}</span>
              </div>
              
              {getReadReceiptUsers(selectedMessageReceipts).map((user, index) => (
                <div key={user.id} className="receipt-item">
                  <span className="receipt-status">Read by {user.username}:</span>
                  <span className="receipt-time">
                    {formatTime(selectedMessageReceipts.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reactions Info Modal */}
      {showReactionsModal && selectedMessageReactions && (
        <div className="modal-overlay" onClick={() => setShowReactionsModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reactions</h3>
              <button className="close-button" onClick={() => setShowReactionsModal(false)}>×</button>
            </div>
            
            <div className="reactions-list">
              {getReactionUsers(selectedMessageReactions).map((user, index) => (
                <div key={user.id} className="reaction-item">
                  <span className="reaction-emoji">{user.reaction}</span>
                  <span className="reaction-user">{user.username}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Chat;