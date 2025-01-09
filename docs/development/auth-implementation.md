# BB Authentication Implementation Guide

## Overview

This document outlines the authentication implementation for BB, addressing both browser-based (BUI) and desktop (DUI) contexts. It covers technical implementation details and strategic considerations for the authentication flow.

## Current Challenges

1. **Session Context Mismatch**
   - Server-side middleware can't access API in production
   - Email verification creates session in browser, not DUI
   - No session sharing between browser and DUI contexts

2. **User Experience Complexity**
   - Multiple entry points (browser vs. desktop)
   - Email verification flow differences
   - Installation requirements uncertainty

## Strategic Considerations

### Option 1: DUI-First Approach
Make the desktop application (DUI) a requirement for using BB.

**Advantages:**
- Simplified authentication flow
- Consistent user experience
- Better security control
- Native system integration
- Offline capabilities
- Automatic updates

**Disadvantages:**
- Higher barrier to entry
- Installation requirement
- Platform limitations
- Distribution complexity

### Option 2: Hybrid Approach
Support both browser and desktop contexts with seamless transition.

**Advantages:**
- Lower barrier to entry
- Progressive adoption path
- Platform independence
- Easier sharing and collaboration

**Disadvantages:**
- Complex authentication flows
- Multiple session contexts
- Increased maintenance
- Feature parity challenges

## Technical Implementation

### 1. Moving Auth to Island Context

```typescript
// islands/AuthContext.tsx
export function AuthContext({ children }: { children: ComponentChildren }) {
  const { authState } = useAuthState();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (authState.value.isLocalMode) {
        setIsAuthorized(true);
        setIsLoading(false);
        return;
      }

      try {
        const { user, error } = await authState.getSessionUser(null, null);
        setIsAuthorized(!!user && !error);
      } catch (error) {
        setIsAuthorized(false);
      }
      setIsLoading(false);
    };

    checkAuth();
  }, []);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!isAuthorized) {
    const currentUrl = window.location.pathname + window.location.search;
    const loginUrl = `/auth/login?redirect=${encodeURIComponent(currentUrl)}`;
    window.location.href = loginUrl;
    return null;
  }

  return <>{children}</>;
}
```

### 2. Unified Email Verification

```typescript
// utils/verification.ts
export function generateVerificationUrl(email: string): string {
  // Always use web URL as primary link
  const baseUrl = `${BB_WEB_URL}/auth/verify`;
  
  // Include app-specific parameters
  const params = new URLSearchParams({
    email: email,
    hasApp: 'true', // Enables app download prompt if needed
  });
  
  return `${baseUrl}?${params.toString()}`;
}
```

### 3. Smart Verification Handler

```typescript
// routes/auth/verify/index.tsx
export default function VerifyPage() {
  const { isDuiContext } = useEnvironment();
  const [showAppPrompt, setShowAppPrompt] = useState(false);

  useEffect(() => {
    const handleVerification = async () => {
      const params = new URLSearchParams(window.location.search);
      
      // If in DUI context, proceed with verification
      if (isDuiContext()) {
        await handleDuiVerification(params);
        return;
      }

      // In browser context, check if user has app installed
      if (await checkAppInstalled()) {
        // Offer to open in app
        setShowAppPrompt(true);
        return;
      }

      // Proceed with browser verification
      await handleBrowserVerification(params);
    };

    handleVerification();
  }, []);

  if (showAppPrompt) {
    return <AppPromptDialog 
      onOpenInApp={() => openInApp(window.location.href)}
      onContinueInBrowser={() => handleBrowserVerification(params)}
    />;
  }

  return <VerificationContent />;
}
```

### 4. Deep Linking Integration

```rust
// src-tauri/src/main.rs
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            let handle = app.handle();
            
            // Register deep link handler
            tauri_plugin_deep_link::register("bb", move |request| {
                if let Some(window) = handle.get_window("main") {
                    let verify_url = parse_verification_url(request);
                    window.eval(&format!(
                        "window.location.href = '{}'",
                        verify_url
                    )).unwrap();
                }
            })?;
            
            Ok(())
        })
}
```

## Implementation Requirements

### Phase 1: Authentication Infrastructure

1. **Session Management**
   - Move auth checks to island components
   - Implement client-side session validation
   - Handle session refresh and expiry

2. **Environment Detection**
   - Reliable DUI context detection
   - Browser capability checking
   - App installation detection

### Phase 2: Verification Flow

1. **Email Templates**
   - Clear verification instructions
   - App download information
   - Browser fallback explanation

2. **Landing Pages**
   - Smart verification handler
   - App download prompts
   - Clear user guidance

### Phase 3: Deep Linking

1. **Protocol Registration**
   - Cross-platform deep link handling
   - Protocol security verification
   - Installation state handling

2. **Session Synchronization**
   - Context-aware session handling
   - Secure session transfer
   - Error recovery

## Recommended Approach

Based on the analysis, we recommend the following strategy:

1. **Initial Phase: Hybrid with DUI Preference**
   - Support both browser and DUI
   - Actively promote DUI installation
   - Clear upgrade path from browser to DUI

2. **Long-term: DUI-First**
   - Make DUI the primary interface
   - Keep browser for limited functionality
   - Focus development on DUI features

## Migration Plan

1. **Infrastructure Updates**
   - Move auth to island context
   - Implement deep linking
   - Update session handling

2. **User Communication**
   - Clear installation benefits
   - Smooth transition guidance
   - Feature availability explanation

3. **Monitoring & Adjustment**
   - Track usage patterns
   - Gather user feedback
   - Adjust strategy based on data

## Security Considerations

1. **Session Management**
   - Secure session storage
   - Regular validation
   - Proper cleanup

2. **Deep Linking**
   - Protocol validation
   - Parameter sanitization
   - State verification

3. **Context Switching**
   - Secure state transfer
   - Token validation
   - Error handling

## Next Steps

1. Begin infrastructure updates
2. Implement verification flow
3. Add deep linking support
4. Update documentation
5. Plan user communication
6. Monitor and gather feedback

## Open Questions

1. Timeline for DUI requirement
2. Browser support longevity
3. Feature parity requirements
4. Installation friction acceptance
5. Enterprise deployment considerations