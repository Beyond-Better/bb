# Auto-Save and Page Reload Protection Implementation

## Overview
This document describes the implementation of auto-save functionality and page reload protection for the BB Browser UI to prevent content loss during development hot-reloads and other page reloads.

## Features Implemented

### 1. Auto-Save Mechanism
- **Location**: `bui/src/components/ChatInput.tsx`
- **Storage**: Uses localStorage with conversation-specific keys
- **Trigger**: Input changes with 1-second debounce
- **Restoration**: Automatic restoration when conversation loads

#### Auto-Save Behavior:
```typescript
// Saves input after 1 second of inactivity
const SAVE_DEBOUNCE = 1000; // 1 second

// Storage key format: bb-chat-current-{collaborationId}
const currentInputKey = `bb-chat-current-${collaborationId}`;
```

#### Content Management:
- **Save**: Input with content ≥ 1 character
- **Clear**: Empty input, successful message send, conversation change
- **Restore**: On conversation load if input is empty

### 2. Page Reload Protection
- **Location**: `bui/src/components/ChatInput.tsx`
- **Mechanism**: `beforeunload` event handler
- **Trigger**: Any attempt to reload/leave page with unsaved content

#### Browser Confirmation:
```typescript
const handleBeforeUnload = (e: BeforeUnloadEvent) => {
  if (chatInputText.value.trim()) {
    e.preventDefault();
    e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    return e.returnValue;
  }
};
```

## Implementation Details

### Auto-Save Infrastructure
The implementation leverages the existing `useChatInputHistory` hook:

```typescript
const {
  saveCurrentInput,    // Save input to localStorage
  getSavedInput,       // Retrieve saved input
  clearCurrentInput,   // Clear saved input
} = useChatInputHistory(collaborationIdSignal);
```

### Key Integration Points

1. **Input Change Handler**:
   ```typescript
   // Debounced auto-save on input changes
   saveDebounceRef.current = setTimeout(handleAutoSave, SAVE_DEBOUNCE);
   ```

2. **Message Send Success**:
   ```typescript
   addToHistory(currentValue);
   clearCurrentInput(); // Clear auto-save after successful send
   ```

3. **Error Recovery**:
   ```typescript
   saveCurrentInput(currentValue); // Preserve input on send failure
   ```

4. **Conversation Load**:
   ```typescript
   const saved = getSavedInput();
   if (saved && !chatInputText.value) {
     onChange(saved); // Restore saved content
   }
   ```

## Development Experience

### Hot-Reload Scenarios
1. **Developer modifies BUI code** → Page hot-reloads
2. **User has content in prompt input** → Content auto-saved to localStorage
3. **Page finishes reloading** → Content automatically restored
4. **User can continue typing** → No content loss

### Browser Reload Protection
1. **User accidentally hits Cmd+R** → Browser shows confirmation dialog
2. **User can cancel** → Returns to page with content intact
3. **User confirms reload** → Content restored after reload via auto-save

## Testing Scenarios

### Auto-Save Testing
1. Type content in chat input
2. Wait 1 second for auto-save
3. Refresh page manually
4. Verify content is restored

### Confirmation Dialog Testing
1. Type content in chat input
2. Try to reload page (Cmd+R, F5, or browser refresh)
3. Verify browser shows confirmation dialog
4. Test both "Cancel" and "Leave" options

### Edge Cases
1. **Empty input**: No save, no confirmation
2. **Message sent**: Auto-save cleared, no confirmation  
3. **Network error**: Content preserved for retry
4. **Conversation switch**: Previous auto-save cleared

## Browser Compatibility

### beforeunload Support
- **Chrome/Edge**: Full support
- **Firefox**: Full support  
- **Safari**: Full support
- **Mobile browsers**: Limited (iOS Safari may not show custom message)

### localStorage Support
- **All modern browsers**: Full support
- **Private/Incognito mode**: May have limitations
- **Storage quota**: Negligible impact (small text content)

## Configuration

### Storage Keys
```typescript
// Auto-save key pattern
bb-chat-current-{collaborationId}

// History key pattern  
bb-chat-history-{collaborationId}
```

### Timing Constants
```typescript
const SAVE_DEBOUNCE = 1000;     // 1 second auto-save delay
const INPUT_DEBOUNCE = 16;      // UI update debounce (1 frame @ 60fps)
```

## Future Enhancements

1. **Cross-tab synchronization**: Sync auto-save across browser tabs
2. **Offline support**: Queue content for when connection returns
3. **Periodic backup**: Additional save triggers beyond input changes
4. **User preferences**: Allow users to disable auto-save
5. **Content versioning**: Keep multiple versions of unsent content

## Troubleshooting

### Common Issues
1. **Content not restored**: Check browser localStorage settings
2. **No confirmation dialog**: Verify modern browser and non-incognito mode
3. **Auto-save not working**: Check console for errors and localStorage permissions

### Debug Information
The implementation includes comprehensive logging:
```typescript
console.info('ChatInput: Found saved input to restore', { savedLength });
console.info('ChatInput: Auto-save triggered', { collaborationId, length });
console.info('ChatInput: Preventing page reload with unsaved content');
```

## Related Files
- `bui/src/components/ChatInput.tsx` - Main implementation
- `bui/src/hooks/useChatInputHistory.ts` - Storage infrastructure  
- `bui/src/islands/Chat.tsx` - Integration point
- `bui/CONVENTIONS.md` - BUI development guidelines