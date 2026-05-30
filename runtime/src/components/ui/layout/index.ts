/**
 * Layout Component Exports
 * 
 * This file exports layout components that provide consistent spacing,
 * alignment, and structure throughout the application. These components
 * create a flexible and responsive layout system based on Tailwind CSS.
 * 
 * Organization Strategy:
 * - Container: Handles max-width and horizontal padding
 * - PageContainer: Pre-configured container specifically for page content
 * - Grid: Provides CSS Grid-based layout with responsive columns
 * - Section: Defines vertical spacing and background colors for page sections
 * - Spacing: Utilities for consistent margins and paddings (Stack, Spacer, Divider)
 * 
 * These components create a cohesive system for consistent layouts and
 * reduce the need for repetitive Tailwind classes.
 */

export * from './container';
export * from './page-container';
export * from './grid';
export * from './section';
export * from './spacing'; 