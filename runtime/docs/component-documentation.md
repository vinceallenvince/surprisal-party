# Component Documentation

This document provides detailed information about the UI components available in the application, their props, and usage examples.

## Layout Components

### `PageContainer`

**Description:** A container component that provides consistent page layout with standardized padding, width, and alignment.

**Location:** `src/components/ui/layout/page-container.tsx`

**Props:**
- `children: React.ReactNode` - Content to display inside the container
- `centered?: boolean` - Whether to center the container (default: false)
- `variant?: "default" | "compact"` - Layout variant (default: "default")
- `as?: React.ElementType` - HTML element to render (default: div)
- `className?: string` - Additional class names

**Usage Example:**
```tsx
import { PageContainer } from "@/components/ui/layout";

export default function AboutPage() {
  return (
    <PageContainer centered variant="default">
      <h1>About Us</h1>
      <p>Page content goes here</p>
    </PageContainer>
  );
}
```

### `Container`

**Description:** A flexible container component for wrapping content with consistent max-width and padding.

**Location:** `src/components/ui/layout/container.tsx`

### `Section`

**Description:** A semantic section component for organizing page content.

**Location:** `src/components/ui/layout/section.tsx`

### `Grid`

**Description:** A responsive grid layout component.

**Location:** `src/components/ui/layout/grid.tsx`

## Button Components

### `Button`

**Description:** A versatile button component with multiple variants, sizes, colors, and loading states.

**Location:** `src/components/ui/button/Button.tsx`

**Props:**
- `variant?: "primary" | "secondary" | "accent" | "ghost" | "link" | "outline"` - Visual style (default: "primary")
- `color?: "default" | "success" | "warning" | "error" | "info"` - Color scheme (default: "default")
- `size?: "xs" | "sm" | "md" | "lg"` - Button size (default: "md")
- `isLoading?: boolean` - Show loading spinner (default: false)
- `leadingIcon?: React.ReactNode` - Icon before text
- `trailingIcon?: React.ReactNode` - Icon after text
- `fullWidth?: boolean` - Full width button (default: false)
- `children: React.ReactNode` - Button content

**Usage Example:**
```tsx
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

<Button variant="primary" size="md">
  Click Me
</Button>

<Button variant="outline" leadingIcon={<Mail size={16} />}>
  Send Email
</Button>

<Button isLoading>
  Submitting...
</Button>
```

**Accessibility Notes:**
- Proper `aria-disabled` and `aria-busy` attributes for loading state
- Focus-visible ring for keyboard navigation
- Color contrast meets WCAG 2.1 AA standards

### `ButtonLink`

**Description:** A button-styled link component using Next.js Link.

**Location:** `src/components/ui/button/ButtonLink.tsx`

### `IconButton`

**Description:** A button optimized for icon-only content.

**Location:** `src/components/ui/button/IconButton.tsx`

## Card Components

### `Card`

**Description:** A container component for grouping related content with optional interactive states.

**Location:** `src/components/ui/card/Card.tsx`

**Props:**
- `variant?: "default" | "outlined" | "elevated"` - Card style (default: "default")
- `color?: "default" | "primary" | "secondary" | "accent" | "info" | "success" | "warning" | "error"` - Background color
- `interactive?: boolean` - Enable hover/focus states for clickable cards (default: false)
- `className?: string` - Additional class names
- `children: React.ReactNode` - Card content

**Usage Example:**
```tsx
import { Card, CardContent } from "@/components/ui/card";

<Card variant="elevated">
  <CardContent>
    <h2>Card Title</h2>
    <p>Card content goes here</p>
  </CardContent>
</Card>

<Card variant="outlined" interactive onClick={() => console.log("clicked")}>
  <CardContent>
    <p>Clickable card</p>
  </CardContent>
</Card>
```

**Accessibility Notes:**
- Interactive cards have `role="button"` and keyboard support (Enter/Space)
- Focus-visible ring for keyboard navigation

### `CardContent`

**Description:** A wrapper for card body content with consistent padding.

**Location:** `src/components/ui/card/CardContent.tsx`

### `CardGrid`

**Description:** A responsive grid layout for displaying multiple cards.

**Location:** `src/components/ui/card/CardGrid.tsx`

## Form Components

### `Input`

**Description:** A styled text input with error state support.

**Location:** `src/components/ui/form/Input.tsx`

**Props:**
- `error?: boolean` - Show error styling (default: false)
- All standard HTML input attributes

**Usage Example:**
```tsx
import { Input } from "@/components/ui/form";

<Input
  type="email"
  placeholder="Enter your email"
  error={hasError}
  aria-describedby="email-error"
/>
```

**Accessibility Notes:**
- `aria-invalid` attribute reflects error state
- Supports `aria-describedby` for error messages

### `FormField`

**Description:** A wrapper component combining label, input, and error message.

**Location:** `src/components/ui/form/FormField.tsx`

### Other Form Components

- `Checkbox` - `src/components/ui/form/Checkbox.tsx`
- `Radio` - `src/components/ui/form/Radio.tsx`
- `RadioGroup` - `src/components/ui/form/RadioGroup.tsx`
- `Select` - `src/components/ui/form/Select.tsx`
- `Switch` - `src/components/ui/form/Switch.tsx`
- `Textarea` - `src/components/ui/form/Textarea.tsx`

## Navigation Components

### `Navbar`

**Description:** The main navigation bar component with responsive mobile menu.

**Location:** `src/components/ui/navigation/Navbar.tsx`

### `LocaleSwitcher`

**Description:** A dropdown component for switching between supported locales (English/Spanish).

**Location:** `src/components/ui/locale-switcher/LocaleSwitcher.tsx`

### `SkipToContent`

**Description:** An accessibility component that allows keyboard users to skip navigation.

**Location:** `src/components/ui/navigation/SkipToContent.tsx`

## Feedback Components

### `Toast`

**Description:** A notification component for displaying success, error, or info messages.

**Location:** `src/components/ui/toast/toast.tsx`

**Props:**
- `message: string` - The notification message
- `type: "success" | "error" | "info"` - Toast type
- `onDismiss: () => void` - Callback when dismissed

**Usage (via hook):**
```tsx
"use client";
import { useToast } from "@/app/providers/toast-provider";

function MyComponent() {
  const { showToast } = useToast();

  const handleSuccess = () => {
    showToast("Operation completed!", "success");
  };

  return <button onClick={handleSuccess}>Save</button>;
}
```

**Accessibility Notes:**
- Uses `role="alert"` for screen reader announcements
- Dismiss button has descriptive `aria-label`

## Typography Components

### `H1`, `H2`, `H3`, `H4`

**Description:** Semantic heading components with consistent styling.

**Location:** `src/components/ui/typography/heading.tsx`

### `Text`

**Description:** A paragraph component with variant support.

**Location:** `src/components/ui/typography/text.tsx`

## Utility Components

### `ThemeToggle`

**Description:** A button for toggling between light and dark themes.

**Location:** `src/components/ui/theme-toggle.tsx`

## Best Practices

### Component Development Guidelines

1. **Use Server Components by Default** - Only add `"use client"` when needed for interactivity
2. **Type All Props** - Use TypeScript interfaces with JSDoc comments
3. **Ensure Accessibility** - Include ARIA attributes, keyboard support, and focus states
4. **Use the `cn()` Utility** - Combine class names with `cn()` from `@/lib/utils`
5. **Follow DaisyUI Conventions** - Use DaisyUI component classes consistently
6. **Support Theming** - Use DaisyUI semantic colors (`primary`, `base-100`, etc.)

### Creating New Components

1. Create the component in the appropriate directory under `src/components/ui/`
2. Define a TypeScript interface for props
3. Add JSDoc comments for documentation
4. Include proper ARIA attributes for accessibility
5. Export from the category's `index.ts` barrel file
6. Add usage examples to this documentation
