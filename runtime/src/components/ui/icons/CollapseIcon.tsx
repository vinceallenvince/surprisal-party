import { IconProps } from './index';

interface CollapseIconProps extends IconProps {
  isCollapsed: boolean;
}

export const CollapseIcon: React.FC<CollapseIconProps> = ({ isCollapsed, size = 16, className }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none' }}
      aria-hidden="true"
    >
      {isCollapsed ? (
        // Collapsed state (arrow pointing right)
        <>
          <line x1="5" y1="12" x2="19" y2="12"></line>
          <polyline points="12 5 19 12 12 19"></polyline>
        </>
      ) : (
        // Expanded state (arrow pointing left)
        <>
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </>
      )}
    </svg>
  );
} 