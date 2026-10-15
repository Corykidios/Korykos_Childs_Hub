import React from 'react';

export const YoutubeIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
    <polygon points="10 15 15 12 10 9 10 15" fill="currentColor" stroke="none" />
  </svg>
);

interface PanelToggleIconProps {
  side: 'left' | 'right';
  isCollapsed?: boolean;
  className?: string;
}

export const PanelToggleIcon: React.FC<PanelToggleIconProps> = ({ 
  side, 
  isCollapsed = false, 
  className = "w-4 h-4" 
}) => {
  if (side === 'right') {
    // Right panel (Studio) icon matching NotebookLM screenshot
    return (
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
      >
        <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" />
        <line x1="12.5" y1="3.5" x2="12.5" y2="16.5" />
        {isCollapsed ? (
          // When collapsed, arrow points left to expand
          <polyline points="9 7.5 6.5 10 9 12.5" />
        ) : (
          // When open, arrow points right towards divider to collapse
          <polyline points="6.5 7.5 9 10 6.5 12.5" />
        )}
      </svg>
    );
  }

  // Left panel (Sources) icon matching NotebookLM
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2.5" y="3.5" width="15" height="13" rx="2.5" />
      <line x1="7.5" y1="3.5" x2="7.5" y2="16.5" />
      {isCollapsed ? (
        // When collapsed, arrow points right to expand
        <polyline points="11 7.5 13.5 10 11 12.5" />
      ) : (
        // When open, arrow points left towards divider to collapse
        <polyline points="13.5 7.5 11 10 13.5 12.5" />
      )}
    </svg>
  );
};
