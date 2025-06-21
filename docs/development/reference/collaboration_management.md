# Collaboration Management in BB

This document summarizes the implementation of collaboration management in the BB project, focusing on the collaboration list and loading history for selected collaborations.

## Objectives System

BB uses a hierarchical objectives system to maintain context and guide collaboration flow:

### Collaboration Goals
- Generated at the start of each collaboration
- Provides overall context for the entire collaboration
- Stored with collaboration metadata
- Loaded and displayed with collaboration history

### Statement Objectives
- Generated for each user statement
- Stored as an ordered array
- Length matches the number of statements
- Last objective represents current focus
- Used to guide tool usage and responses

### Implementation Details
- Objectives are generated using separate LLM interactions
- Collaboration goals only generated if not already set
- Statement objectives appended for each new statement
- Both types of objectives persisted with collaboration data
- Tool feedback includes both objectives for context

### Usage in Components
- Chat interface displays current objectives
- Tool feedback shows both objective levels
- History view includes objectives in collaboration timeline
- Objectives help maintain context across session breaks

## Overview

The collaboration management functionality is primarily implemented in the `Chat.tsx` component, which is a Fresh island component. It handles both the list of collaborations and the display of individual collaboration histories.

## Key Components

1. `Chat.tsx`: The main component that renders the collaboration list and chat interface.
2. `ApiClient`: Utility for making API calls to the backend.
3. `WebSocketManager`: Manages real-time communication for live updates.

## Collaboration List

### Fetching Collaborations

- The list of collaborations is fetched using the `fetchCollaborations` function in `Chat.tsx`.
- It uses the `/api/v1/collaboration` endpoint (note the singular form).
- The function is called when the component mounts and the API client is initialized.

```typescript
const fetchCollaborations = async () => {
  if (!apiClient.value) return;
  setIsLoadingCollaborations(true);
  try {
    const url = `/api/v1/collaboration?projectId=${encodeURIComponent(projectId)}&limit=50`;
    const response = await apiClient.value.get(url);
    if (response.ok) {
      const data = await response.json();
      setCollaborations(data.collaborations);
    } else {
      console.error('Failed to fetch collaborations');
    }
  } catch (error) {
    console.error('Error fetching collaborations:', error);
  } finally {
    setIsLoadingCollaborations(false);
  }
};
```

### Rendering the Collaboration List

- The collaboration list is rendered in the main JSX return of the `Chat` component.
- Each collaboration item displays the title, ID, update time, turn count, and token usage.

## Loading Collaboration History

### Selecting a Collaboration

- When a user clicks on a collaboration in the list, the `handleCollaborationSelect` function is called.
- This function sets the selected collaboration ID and calls `loadInteraction`.

```typescript
const handleCollaborationSelect = (id: string) => {
  console.log('Selected collaboration:', id);
  setSelectedCollaborationId(id);
  loadInteraction(id);
};
```

### Loading Collaboration Data

- The `loadInteraction` function fetches the full collaboration history for a selected collaboration.
- It uses the `/api/v1/collaboration/{id}` endpoint.
- Each message in the collaboration is formatted using the `formatLogEntry` function.

```typescript
const loadInteraction = async (id: string) => {
  if (!apiClient.value) return;
  setIsLoading(true);
  try {
    const response = await apiClient.value.get(`/api/v1/collaboration/${id}?projectId=${encodeURIComponent(projectId)}`);
    if (response.ok) {
      const data = await response.json();
      const formattedMessages = await Promise.all(data.messages.map(formatLogEntry));
      collaborationEntries.value = formattedMessages;
      setCollaborationId(id);
    } else {
      console.error('Failed to load collaboration');
    }
  } catch (error) {
    console.error('Error loading collaboration:', error);
  } finally {
    setIsLoading(false);
  }
};
```

### Formatting Log Entries

- The `formatLogEntry` function is used to format each message in the collaboration.
- It makes a POST request to `/api/v1/format_log_entry/browser/{entryType}` to get the formatted content.

```typescript
const formatLogEntry = async (entry: any) => {
  if (!apiClient.value) return entry;
  try {
    const formatterResponse = await apiClient.value.post(
      `/api/v1/format_log_entry/browser/${entry.logEntry.entryType}`,
      entry.logEntry
    );
    if (!formatterResponse.ok) {
      throw new Error(`Failed to fetch formatted response: ${formatterResponse.statusText}`);
    }
    const responseContent = await formatterResponse.json();
    return { ...entry, formattedContent: responseContent.formattedContent };
  } catch (error) {
    console.error(`Error formatting log entry: ${error.message}`);
    return { ...entry, formattedContent: entry.logEntry.content || JSON.stringify(entry.logEntry) };
  }
};
```

## Real-time Updates

- The component uses a WebSocket connection to receive real-time updates for the current collaboration.
- New entries are formatted and added to the collaboration history as they are received.

```typescript
useEffect(() => {
  if (wsManager.value) {
    const subscription = wsManager.value.subscribe(async (newEntry) => {
      console.debug('Received a newEntry', newEntry);
      if ('logEntry' in newEntry) {
        const formattedEntry = await formatLogEntry(newEntry);
        collaborationEntries.value = [...collaborationEntries.value, formattedEntry];
      } else if ('answer' in newEntry) {
        collaborationEntries.value = [...collaborationEntries.value, newEntry];
      } else if ('collaborationTitle' in newEntry) {
        wsManager.value.isReady.value = true;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }
}, [wsManager.value]);
```

## Important Notes

1. Ensure that the API endpoints are correct ('/api/v1/collaboration' for the list, '/api/v1/collaboration/{id}' for individual collaborations).
2. The `formatLogEntry` function is crucial for properly displaying messages. Ensure it's called for both loaded and new messages.
3. The WebSocket connection is used for real-time updates. Make sure it's properly initialized and managed.
4. Error handling and loading states are implemented to provide feedback to the user during asynchronous operations.

By following these instructions and referencing the provided code snippets, you should be able to manage the collaborations list and load history for selected collaborations effectively in the BB project.