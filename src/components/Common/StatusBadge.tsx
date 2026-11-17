import React from 'react';
import { BootstrapIcon } from './BootstrapIcon';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const normalized = status.toLowerCase().replace(/\s+/g, '-');
  const iconName = ['paid', 'succeeded', 'approved', 'available', 'active', 'converted'].includes(normalized)
    ? 'check'
    : ['pending', 'processing', 'partial', 'reserved'].includes(normalized)
      ? 'hourglass'
      : ['overdue', 'rejected', 'failed', 'void', 'voided', 'maintenance', 'ended', 'terminated'].includes(normalized)
        ? 'x-circle'
        : undefined;
  return (
    <span className={`status-badge status-${normalized} size-${size}${iconName ? ' has-icon' : ''}`}>
      {iconName && <BootstrapIcon name={iconName} className="status-icon" />}
      {status}
    </span>
  );
};

