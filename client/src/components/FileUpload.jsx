import React, { useRef } from 'react';
import './FileUpload.css';

const FileUpload = ({ onFileUpload, onClose }) => {
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileData = {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileUrl: event.target.result
      };
      onFileUpload(fileData);
      onClose();
    };
    reader.readAsDataURL(file);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="file-upload-overlay" onClick={onClose}>
      <div className="file-upload-content" onClick={(e) => e.stopPropagation()}>
        <div className="file-upload-header">
          <h3>Share File</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="file-upload-body">
          <div className="upload-area" onClick={handleClick}>
            <div className="upload-icon">
              <i className="fas fa-cloud-upload-alt"></i>
            </div>
            <p>Click to select a file</p>
            <p className="upload-hint">Max file size: 5MB</p>
          </div>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
        
        <div className="file-upload-footer">
          <button className="cancel-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;