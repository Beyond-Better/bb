# ExternalLink Component

The `ExternalLink` component is a reusable UI element designed to handle links consistently across both BUI (Browser User Interface) and DUI (Desktop User Interface) environments, with intelligent behavior based on link type and environment.

## Purpose

This component solves several challenges related to link handling:

1. **Smart Link Detection** - Automatically detects whether a link is internal or external
2. **Environment-Aware Behavior** - Adapts behavior based on BUI vs DUI environments
3. **Optimal User Experience** - Preserves standard navigation for internal links while handling external links appropriately
4. **Security** - Applies security best practices for external links
5. **Consistent Interface** - Provides a unified API for all link types

## Features

- **Intelligent Link Type Detection**:
  - Automatically identifies internal vs external links
  - Routes links appropriately based on type

- **Environment-Optimized Behavior**:
  - In Browser UI:
    - Internal links use standard navigation (preserves history/back button)
    - External links can be configured to open in new tab
  - In Desktop UI:
    - Internal links work normally within the app
    - External links open in the system's default browser

- **Implementation Flexibility**:
  - href modification using custom bblink:// protocol
  - Click handler approach for more control
  - Automatic selection of best approach based on environment

- **Enhanced User Experience**:
  - Optional toast notifications for external links in DUI
  - Download attribute support
  - Custom toast messages

- **Security & Standards**:
  - Secure attributes for external links (`target="_blank"`, `rel="noopener noreferrer"`)
  - Full TypeScript support with comprehensive JSDoc documentation
  - Forwards all standard anchor element attributes

## Usage

### Basic Example

```tsx
<ExternalLink href="https://github.com/Beyond-Better/bb">
  GitHub
</ExternalLink>
```

### With Custom Styling

```tsx
<ExternalLink 
  href="https://github.com/Beyond-Better/bb/releases" 
  className="text-purple-600 hover:text-purple-800"
>
  View releases
</ExternalLink>
```

### With Download Attribute

```tsx
<ExternalLink 
  href="https://github.com/Beyond-Better/bb/releases/download/v1.0.0/bb-app.dmg"
  download
  toastMessage="Downloading BB App"
>
  Download App
</ExternalLink>
```

### With Custom Configuration

```tsx
<ExternalLink 
  href="https://example.com" 
  useClickHandler={false} // Use href modification instead of click handler
  secureAttributes={false} // Don't add target and rel attributes
  showToast={false} // Don't show toast in DUI environment
>
  Example Link
</ExternalLink>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `href` | string | (required) | The URL to link to |
| `openInNewTab` | boolean | `false` | Whether external links should always open in a new tab/window |
| `showToast` | boolean | `true` | Whether to show a toast notification when external links open in system browser (DUI only) |
| `useClickHandler` | boolean | `true` | Whether to use click handler approach instead of href modification for DUI environment |
| `secureAttributes` | boolean | `true` | Whether to automatically add target and rel attributes for external links |
| `toastMessage` | string | | Optional custom message to show in toast notification |
| `download` | boolean\|string | | HTML download attribute for the link |
| ...props | | | All other standard anchor element attributes |

## Implementation Details

### Smart Link Detection

The component intelligently determines whether a link is internal or external:

```typescript
const isExternalLink = useMemo(() => {
  // Simple check if this is a link to an external site vs app navigation
  if (!href) return false;
  const isHttp = href.startsWith('http://') || href.startsWith('https://');
  
  if (!isHttp) return false; // Relative links are internal
  
  // In SSR context, we can't check location
  if (typeof window === 'undefined' || !window.location) return true;
  
  try {
    // Check if the link is to the same domain
    const url = new URL(href);
    const currentDomain = window.location.hostname;
    return url.hostname !== currentDomain;
  } catch (e) {
    // If URL parsing fails, assume it's external
    return true;
  }
}, [href]);
```

### Environment-Specific Behavior

The component adapts its behavior based on both the link type and the current environment:

1. **Internal Links** (same domain or relative paths):
   - In Browser UI: Standard navigation with history preservation
   - In DUI: Standard in-app navigation

2. **External Links** (different domains):
   - In Browser UI: Optional new tab with security attributes
   - In DUI: Opens in system browser with toast notification

### Core Utility Functions

The component uses enhanced utility functions from `shared/externalLinkHelper.ts`:

- `isDuiEnvironment()` - Detects if running in DUI environment using multiple methods:
  - URL parameters (`platform=dui` or `platform=tauri`)
  - Presence of Tauri global object
  - User agent detection
  - DUI-specific globals

- `getExternalHref()` - Generates appropriate href for external links in DUI

- `getExternalClickHandler()` - Creates an optimized click handler with:
  - Tauri shell integration for reliable external opening
  - bblink:// protocol support
  - Fallback mechanisms
  - Toast notification support

## Testing

The component has comprehensive tests in `bui/test/ExternalLink.test.tsx` covering:

- Rendering as an anchor tag with proper attributes
- Environment-specific behavior
- Click handling
- Props forwarding

## Migration Guide

To migrate existing anchor tags to use the ExternalLink component:

1. Replace `<a>` with `<ExternalLink>`
2. Remove manual environment checks (e.g., `{...(!isDuiEnvironment() ? {...} : {})}`)
3. Remove manual calls to `getExternalHref()`
4. Add `openInNewTab={true}` for links that should open in a new tab
5. Keep all className and other standard props

### External Links (GitHub, documentation sites, etc.)

**Before:**
```tsx
<a
  href={getExternalHref(url)}
  target="_blank"
  rel="noopener noreferrer"
  className="text-blue-600"
>
  Link Text
</a>
```

**After:**
```tsx
<ExternalLink
  href={url}
  className="text-blue-600"
  openInNewTab={true}  // Optional, will open in new tab in browser
>
  Link Text
</ExternalLink>
```

### Internal App Navigation

**Before:**
```tsx
<a
  href="/app/settings"
  className="text-blue-600"
>
  Settings
</a>
```

**After:**
```tsx
<ExternalLink
  href="/app/settings"
  className="text-blue-600"
>
  Settings
</ExternalLink>
```

### Download Links

**Before:**
```tsx
<a
  href={getExternalHref(downloadUrl)}
  download
  className="download-button"
>
  Download File
</a>
```

**After:**
```tsx
<ExternalLink
  href={downloadUrl}
  download
  toastMessage="Downloading file"
  className="download-button"
>
  Download File
</ExternalLink>
```