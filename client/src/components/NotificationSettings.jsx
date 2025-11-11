import React from 'react';
import './NotificationSettings.css';

const NotificationSettings = ({ settings, onUpdateSettings, onClose }) => {
  const handleSettingChange = (key, value) => {
    onUpdateSettings({ [key]: value });
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h3>Notification Settings</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="settings-content">
          <div className="setting-item">
            <div className="setting-info">
              <h4>Sound Notifications</h4>
              <p>Play sound when receiving new messages</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.sound}
                onChange={(e) => handleSettingChange('sound', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <h4>Browser Notifications</h4>
              <p>Show desktop notifications when app is in background</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.browser}
                onChange={(e) => handleSettingChange('browser', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="setting-item">
            <div className="setting-info">
              <h4>Desktop Notifications</h4>
              <p>Show system notifications (requires permission)</p>
            </div>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={settings.desktop}
                onChange={(e) => handleSettingChange('desktop', e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>

          <div className="settings-help">
            <p><strong>Tip:</strong> Notifications are automatically muted when you're active in the chat room.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationSettings;