import React, { useState } from 'react';
import './Login.css';

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (username.trim()) {
      onLogin(username.trim());
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">Chat Application</h1>
          <p className="login-subtitle">Join the conversation</p>
        </div>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label htmlFor="username" className="input-label">
              Choose your username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              className="username-input"
              maxLength={20}
              autoFocus
            />
          </div>
          
          <button 
            type="submit" 
            className="login-button"
            disabled={!username.trim()}
          >
            Join Chat
          </button>
        </form>
        
        <div className="login-footer">
          <p>Real-time communication powered by Socket.io</p>
        </div>
      </div>
    </div>
  );
};

export default Login;