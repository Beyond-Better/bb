# BUI Component Patterns

## Overview

This document outlines component patterns for the Beyond Better UI, considering Fresh's specific architecture and constraints. These patterns focus on reusability, maintainability, and proper state handling.

## Fresh Component Types

### 1. Islands (Interactive Components)
- Self-contained JavaScript functionality
- Own state management
- Client-side interactivity
- Limited communication between islands

Example structure:
```typescript
// islands/SomeFeature.tsx
export default function SomeFeature() {
    // State management
    const [state, handlers] = useSomeState();

    // Event handlers
    const handleAction = () => {
        handlers.someAction();
    };

    return (
        <div>
            <StatusIndicator status={state.status} />
            <ActionButton onClick={handleAction} />
        </div>
    );
}
```

### 2. Static Components
- No client-side JavaScript
- Server-side rendered
- Reusable UI elements
- Props-only configuration

Example:
```typescript
// components/Header.tsx
interface HeaderProps {
    title: string;
    theme?: 'light' | 'dark';
}

export function Header({ title, theme = 'light' }: HeaderProps) {
    return (
        <header class={`header ${theme}`}>
            <h1>{title}</h1>
        </header>
    );
}
```

## Reusable UI Components

### 1. Status Indicators
Used for showing connection, loading, or process states:
```typescript
interface StatusIndicatorProps {
    status: 'connected' | 'disconnected' | 'error';
    label?: string;
    theme?: 'light' | 'dark';
}

export function StatusIndicator({ 
    status, 
    label, 
    theme = 'light' 
}: StatusIndicatorProps) {
    const statusColors = {
        connected: 'bg-green-500',
        disconnected: 'bg-red-500',
        error: 'bg-yellow-500'
    };

    return (
        <div class="flex items-center gap-2">
            <span class={`w-2 h-2 rounded-full ${statusColors[status]}`} />
            {label && <span>{label}</span>}
        </div>
    );
}
```

### 2. Input Components
Standardized input handling with proper event management:
```typescript
interface ChatInputProps {
    onSubmit: (message: string) => void;
    disabled?: boolean;
    placeholder?: string;
}

export function ChatInput({ 
    onSubmit, 
    disabled = false,
    placeholder = 'Type your message...'
}: ChatInputProps) {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const input = e.currentTarget as HTMLInputElement;
            const message = input.value.trim();
            if (message) {
                onSubmit(message);
                input.value = '';
            }
        }
    };

    return (
        <input
            type="text"
            class="flex-1 p-2 border rounded"
            placeholder={placeholder}
            disabled={disabled}
            onKeyDown={handleKeyDown}
        />
    );
}
```

### 3. Action Buttons
Consistent button styling and behavior:
```typescript
interface ActionButtonProps {
    onClick: () => void;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'danger';
    children: preact.ComponentChildren;
}

export function ActionButton({
    onClick,
    disabled = false,
    variant = 'primary',
    children
}: ActionButtonProps) {
    const variantStyles = {
        primary: 'bg-blue-500 hover:bg-blue-600',
        secondary: 'bg-gray-500 hover:bg-gray-600',
        danger: 'bg-red-500 hover:bg-red-600'
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            class={`px-4 py-2 text-white rounded ${variantStyles[variant]}`}
        >
            {children}
        </button>
    );
}
```

## Component Composition

### 1. Layout Components
Provide consistent structure:
```typescript
interface LayoutProps {
    header?: preact.ComponentChildren;
    sidebar?: preact.ComponentChildren;
    children: preact.ComponentChildren;
}

export function Layout({ header, sidebar, children }: LayoutProps) {
    return (
        <div class="flex flex-col h-screen">
            {header && (
                <header class="bg-gray-800 text-white p-4">
                    {header}
                </header>
            )}
            <div class="flex-1 flex overflow-hidden">
                {sidebar && (
                    <aside class="w-64 bg-gray-100 overflow-y-auto">
                        {sidebar}
                    </aside>
                )}
                <main class="flex-1 overflow-y-auto p-4">
                    {children}
                </main>
            </div>
        </div>
    );
}
```

### 2. List Containers
Reusable list structures:
```typescript
interface ListContainerProps<T> {
    items: T[];
    renderItem: (item: T) => preact.ComponentChildren;
    emptyMessage?: string;
}

export function ListContainer<T>({ 
    items, 
    renderItem,
    emptyMessage = 'No items to display'
}: ListContainerProps<T>) {
    if (items.length === 0) {
        return <div class="text-gray-500">{emptyMessage}</div>;
    }

    return (
        <ul class="space-y-2">
            {items.map((item) => (
                <li class="p-2">{renderItem(item)}</li>
            ))}
        </ul>
    );
}
```

## State Handling

### 1. Component-Level State
For UI-specific state:
```typescript
function useComponentState() {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState<string | null>(null);

    return {
        isOpen,
        selectedItem,
        toggle: () => setIsOpen(prev => !prev),
        select: (item: string) => setSelectedItem(item)
    };
}
```

### 2. Controlled Components
For parent-managed state:
```typescript
interface ControlledInputProps {
    value: string;
    onChange: (value: string) => void;
}

export function ControlledInput({ value, onChange }: ControlledInputProps) {
    return (
        <input
            value={value}
            onInput={(e) => onChange(e.currentTarget.value)}
        />
    );
}
```

## Best Practices

1. Component Design
   - Single responsibility
   - Clear props interface
   - Consistent styling
   - Proper type definitions

2. State Management
   - Minimize state
   - Clear state ownership
   - Controlled vs uncontrolled
   - Proper cleanup

3. Event Handling
   - Type-safe events
   - Debounce when needed
   - Clear handler names
   - Error boundaries

4. Performance
   - Memoization when needed
   - Proper key usage
   - Avoid unnecessary renders
   - Optimize heavy operations

## Testing Components

```typescript
Deno.test({
    name: "Component: specific functionality",
    async fn() {
        const component = new SomeComponent({
            prop: "value"
        });

        // Test interaction
        await component.someAction();

        // Assert state
        assertEquals(component.state.value, expected);
    }
});
```

## Next Steps

1. Implement shared components library
2. Add component documentation
3. Create component showcase
4. Add accessibility features