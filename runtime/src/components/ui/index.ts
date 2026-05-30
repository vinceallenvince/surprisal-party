/**
 * UI Component Exports
 *
 * This file serves as the central export point for all shared UI components.
 * It follows the pattern of re-exporting components from their respective modules,
 * making them available through a single import statement like:
 * `import { Button, Card, ... } from '@/components/ui'`
 *
 * Organization Strategy:
 * - Components are grouped by functional category (layout, typography, etc.)
 * - Each component type lives in its own directory with its own index.ts
 * - This file aggregates all exports to simplify imports throughout the application
 * - Route-specific UI components remain in their respective route folders
 */

export * from './layout';
export * from './typography';
export * from './theme-toggle';
export * from './card';
export * from './form';
export * from './button';
export * from './icons';
export * from './toast';
