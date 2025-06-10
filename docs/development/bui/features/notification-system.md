# Notification System Implementation

## Overview

A comprehensive notification strategy that provides clear, multi-channel user alerts when BB completes processing statements. The system is designed to maximize user awareness through sound, system, and mobile notification options, especially for users who are away from their computer.

## Architecture

### Core Components

1. **User Persistence Module** (`bui/src/storage/userPersistence.ts`)
   - Cloud-first storage with local fallback
   - Manages notification preferences and user settings
   - Automatic sync between local and cloud storage
   - Works in both authenticated and local-only modes

2. **Notification Manager** (`bui/src/utils/notificationManager.ts`)
   - Handles all notification types
   - Smart user activity tracking
   - Permission management
   - Audio playback with Web Audio API

3. **Settings Interface** (`bui/src/islands/AppSettings/NotificationSettings.tsx`)
   - Complete configuration UI
   - Test functionality
   - Real-time permission status

4. **API Integration** (`api/src/routes/api/userPreferences.handlers.ts`)
   - RESTful endpoints for preferences management
   - Stores preferences in `user_profiles.preferences` JSONB field

## Notification Types

### 1. Audio Notifications
- **Technology**: Web Audio API with HTML Audio fallback
- **Features**:
  - Customizable volume (0-100%)
  - Custom sound URL support
  - Default notification sound included
- **User Control**: Toggle on/off, volume slider, custom audio URL

### 2. Browser Push Notifications
- **Technology**: Web Notifications API
- **Features**:
  - System-level notifications
  - Works when BB is in background
  - Persistent until user interaction
- **User Control**: Toggle on/off, automatic permission request

### 3. Visual Indicators
- **Technology**: DOM manipulation
- **Features**:
  - Tab title updates with checkmark and count
  - Favicon badge support (extensible)
  - Auto-clear after timeout or user return
- **User Control**: Toggle on/off

## Smart Notification Logic

### User Activity Tracking
The system tracks user activity to determine when to send notifications:

- **Activity Events**: Mouse movement, clicks, key presses, scrolling, touch
- **Away Detection**: 30-second timeout after last activity
- **Page Visibility**: Uses `document.visibilityState` API
- **Smart Triggering**: Only sends intrusive notifications when user appears away

### Notification Decision Flow
```
Statement Complete → Check User State → Decide Notification Level
                                    ↓
                     Active User: Subtle visual indicator only
                     Away User: Full notifications (audio + browser + visual)
```

### Auto-Clear Behavior
Notifications automatically clear when:
- User returns to page (visibility change)
- User focuses window
- User interacts with page
- Timeout expires (5 minutes for visual indicators)

## Integration Points

### Chat State Integration
Modified `useChatState.ts` to trigger notifications when 'answer' log entries are received:

```typescript
// In handleMessage for 'answer' type
if (data.msgType === 'answer') {
    // ... existing logic ...
    
    // **TRIGGER NOTIFICATION**
    try {
        await notificationManager.notifyStatementComplete(
            'Your statement has been processed and is ready for review'
        );
    } catch (error) {
        console.warn('Failed to send completion notification:', error);
    }
}
```

### Settings Integration
Added to main app settings as a dedicated tab:
- Path: `/app/settings?tab=notifications`
- Component: `NotificationSettings`
- Icon: Bell icon with notification styling

## User Experience

### Configuration Options
Users can configure:
- **Audio**: Enable/disable, volume control, custom sound URL
- **Browser**: Enable/disable push notifications
- **Visual**: Enable/disable tab title and favicon changes

### Permission Handling
- Graceful permission request flow
- Clear status indicators
- Helpful error messages
- Test functionality to verify setup

### Accessibility
- All controls are keyboard accessible
- Screen reader friendly labels
- Clear visual feedback
- Progressive enhancement

## Technical Implementation

### Storage Strategy
- **Cloud Mode**: Preferences stored in `user_profiles.preferences` JSONB field
- **Local Mode**: Preferences stored in `localStorage`
- **Hybrid**: Automatic sync with conflict resolution

### Error Handling
- Graceful fallbacks for each notification type
- No notification failures crash the app
- Clear error reporting in settings UI
- Comprehensive logging for debugging

### Performance Considerations
- Lazy initialization of audio context
- Debounced preference saving
- Minimal DOM manipulation
- Event listener cleanup

## API Endpoints

### GET /api/v1/user/preferences
Returns user preferences including notification settings.

### PUT /api/v1/user/preferences
Updates user preferences with merge strategy.

### Schema
```typescript
interface NotificationPreferences {
    audioEnabled: boolean;
    browserNotifications: boolean;
    visualIndicators: boolean;
    customAudioUrl?: string;
    volume: number; // 0.0 to 1.0
}
```

## Future Enhancements

### Planned Features
1. **Mobile Push Notifications**
   - Integration with services like Pushover
   - Telegram bot notifications
   - Email notifications for long-running tasks

2. **Advanced Customization**
   - Multiple notification sounds
   - Custom notification messages
   - Time-based notification rules

3. **Analytics**
   - Notification effectiveness tracking
   - User preference analytics
   - A/B testing for notification timing

### Extension Points
- Plugin system for custom notification providers
- Webhook support for external integrations
- Integration with home automation systems

## Testing

### Manual Testing
1. Enable notifications in settings
2. Grant browser permissions
3. Start a statement in BB
4. Switch to another tab/app
5. Verify notifications arrive when processing completes
6. Return to BB and verify notifications clear

### Test Cases
- [ ] Audio notifications play with correct volume
- [ ] Browser notifications appear when page hidden
- [ ] Visual indicators update tab title correctly
- [ ] Notifications clear when user returns
- [ ] Settings persist across sessions
- [ ] Local mode works without authentication
- [ ] Permission requests work correctly
- [ ] Test button triggers all enabled notifications

## Browser Compatibility

### Supported Features
- **Audio**: All modern browsers with Web Audio API
- **Push Notifications**: Chrome 42+, Firefox 44+, Safari 16+
- **Page Visibility**: All modern browsers
- **Local Storage**: Universal support

### Graceful Degradation
- Audio falls back to HTML Audio element
- Visual indicators work without advanced APIs
- Settings save to localStorage if cloud unavailable

This notification system provides the "really obvious notification for users who are away from the computer" that was requested, with multiple channels and smart behavior to avoid being intrusive when users are actively using BB.