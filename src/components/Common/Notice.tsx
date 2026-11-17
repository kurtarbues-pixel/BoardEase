import React from 'react';

export interface NoticeData {
  message: string;
  kind?: 'success' | 'error' | 'warning' | 'info';
}

interface NoticeProps {
  notice: NoticeData | null;
  onDismiss: () => void;
}

export const Notice: React.FC<NoticeProps> = ({ notice, onDismiss }) => {
  if (!notice) return null;

  return (
    <div className={`notice notice-toast notice-${notice.kind || 'info'}`} role={notice.kind === 'error' ? 'alert' : 'status'} aria-live={notice.kind === 'error' ? 'assertive' : 'polite'}>
      <span>{notice.message}</span>
      <button
        type="button"
        className="notice-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss message"
      >
        ×
      </button>
    </div>
  );
};

