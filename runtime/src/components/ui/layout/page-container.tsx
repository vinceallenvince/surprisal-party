import { cn } from '@/lib/utils';
import { Container } from './container';

type PageContainerVariant = 'default' | 'compact';

// Create a more type-safe version
type PageContainerProps = Omit<React.ComponentProps<typeof Container>, 'fluid'> & {
  centered?: boolean;
  variant?: PageContainerVariant;
};

/**
 * PageContainer component for consistent page layout
 * Provides standardized padding, width, and alignment for page content
 *
 * @param children - The content to display inside the container
 * @param className - Additional class names to apply
 * @param centered - Whether the container should be centered (true) or left-justified (false)
 * @param variant - Layout variant: 'default' (standard padding) or 'compact' (reduced padding)
 * @param as - The HTML element to render (default: div)
 * @returns A responsive container element wrapping the page content.
 * 
 * All other props from Container are also supported (ARIA attributes, data attributes, event handlers, etc.)
 */
export function PageContainer({
  children,
  className,
  centered = false,
  variant = 'default',
  as,
  ...props
}: PageContainerProps) {
  return (
    <Container
      as={as}
      fluid={centered}
      className={cn(
        'max-w-5xl',
        variant === 'default' ? 'py-12 px-12' : 'px-4 py-8',
        className
      )}
      {...props}
    >
      {children}
    </Container>
  );
} 