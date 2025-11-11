import React, { useState } from 'react';
import './PrivateMessageModal.css';

const PrivateMessageModal = ({ users, currentUser, onSendPrivateMessage, onClose }) => {
  const [selectedUser, setSelectedUser] = useState('');
  const [message, setMessage] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (selectedUser && message.trim()) {
      onSendPrivateMessage(selectedUser, message);
      setMessage('');
      onClose();
    }
  };

  const otherUsers = users.filter(user => user.username !== currentUser);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Send Private Message</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Select User</label>
            <select 
              value={selectedUser} 
              onChange={(e) => setSelectedUser(e.target.value)}
              className="user-select"
              required
            >
              <option value="">Choose a user...</option>
              {otherUsers.map(user => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </select>
          </div>
          
          <div className="form-group">
            <label>Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your private message..."
              className="message-textarea"
              rows="4"
              maxLength="500"
              required
            />
          </div>
          
          <div className="modal-actions">
            <button type="button" className="cancel-button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="send-button" disabled={!selectedUser || !message.trim()}>
              Send Private Message
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PrivateMessageModal;