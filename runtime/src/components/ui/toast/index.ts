/**
 * Toast Component Export
 * 
 * This file exports the Toast notification component used to display
 * temporary messages to users (success, error, info).
 * 
 * Organization Strategy:
 * - Separates the component from its provider (located in app/providers)
 * - Types are stored in a separate file (src/types/toast.ts) to avoid circular dependencies
 * - The Toast component itself is purely presentational and receives props from the provider
 */

export { Toast } from './toast'; 