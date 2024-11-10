# Conversation Management in BB

This document summarizes the implementation of conversation management in the BB project, focusing on the conversation list and loading history for selected conversations.

## Objectives System

BB uses a hierarchical objectives system to maintain context and guide conversation flow:

### Conversation Goals
- Generated at the start of each conversation
- Provides overall context for the entire conversation
- Stored with conversation metadata
- Loaded and displayed with conversation history

### Statement Objectives
- Generated for each user statement
- Stored as an ordered array
- Length matches the number of statements
- Last objective represents current focus
- Used to guide tool usage and responses

### Implementation Details
- Objectives are generated using separate LLM interactions
- Conversation goals only generated if not already set
- Statement objectives appended for each new statement
- Both types of objectives persisted with conversation data
- Tool feedback includes both objectives for context

### Usage in Components
- Chat interface displays current objectives
- Tool feedback shows both objective levels
- History view includes objectives in conversation timeline
- Objectives help maintain context across session breaks

## Overview

The conversation management functionality is primarily implemented in the `Chat.tsx` component, which is a Fresh island component. It handles both the list of conversations and the display of individual conversation histories.

## Key Components

1. `Chat.tsx`: The main component that renders the conversation list and chat interface.
2. `ApiClient`: Utility for making API calls to the backend.
3. `WebSocketManager`: Manages real-time communication for live updates.

## Conversation List

### Fetching Conversations

- The list of conversations is fetched using the `fetchConversations` function in `Chat.tsx`.
- It uses the `/api/v1/conversation` endpoint (note the singular form).
- The function is called when the component mounts and the API client is initialized.

```typescript
const fetchConversations = async () => {
  if (!apiClient.value) return;
  setIsLoadingConversations(true);
  try {
    const url = `/api/v1/conversation?startDir=${encodeURIComponent(startDir)}&limit=50`;
    const response = await apiClient.value.get(url);
    if (response.ok) {
      const data = await response.json();
      setConversations(data.conversations);
    } else {
      console.error('Failed to fetch conversations');
    }
  } catch (error) {
    console.error('Error fetching conversations:', error);
  } finally {
    setIsLoadingConversations(false);
  }
};
```

### Rendering the Conversation List

- The conversation list is rendered in the main JSX return of the `Chat` component.
- Each conversation item displays the title, ID, update time, turn count, and token usage.

## Loading Conversation History

### Selecting a Conversation

- When a user clicks on a conversation in the list, the `handleConversationSelect` function is called.
- This function sets the selected conversation ID and calls `loadConversation`.

```typescript
const handleConversationSelect = (id: string) => {
  console.log('Selected conversation:', id);
  setSelectedConversationId(id);
  loadConversation(id);
};
```

### Loading Conversation Data

- The `loadConversation` function fetches the full conversation history for a selected conversation.
- It uses the `/api/v1/conversation/{id}` endpoint.
- Each message in the conversation is formatted using the `formatLogEntry` function.

```typescript
const loadConversation = async (id: string) => {
  if (!apiClient.value) return;
  setIsLoading(true);
  try {
    const response = await apiClient.value.get(`/api/v1/conversation/${id}?startDir=${encodeURIComponent(startDir)}`);
    if (response.ok) {
      const data = await response.json();
      const formattedMessages = await Promise.all(data.messages.map(formatLogEntry));
      conversationEntries.value = formattedMessages;
      setConversationId(id);
    } else {
      console.error('Failed to load conversation');
    }
  } catch (error) {
    console.error('Error loading conversation:', error);
  } finally {
    setIsLoading(false);
  }
};
```

### Formatting Log Entries

- The `formatLogEntry` function is used to format each message in the conversation.
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

- The component uses a WebSocket connection to receive real-time updates for the current conversation.
- New entries are formatted and added to the conversation history as they are received.

```typescript
useEffect(() => {
  if (wsManager.value) {
    const subscription = wsManager.value.subscribe(async (newEntry) => {
      console.debug('Received a newEntry', newEntry);
      if ('logEntry' in newEntry) {
        const formattedEntry = await formatLogEntry(newEntry);
        conversationEntries.value = [...conversationEntries.value, formattedEntry];
      } else if ('answer' in newEntry) {
        conversationEntries.value = [...conversationEntries.value, newEntry];
      } else if ('conversationTitle' in newEntry) {
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

1. Ensure that the API endpoints are correct ('/api/v1/conversation' for the list, '/api/v1/conversation/{id}' for individual conversations).
2. The `formatLogEntry` function is crucial for properly displaying messages. Ensure it's called for both loaded and new messages.
3. The WebSocket connection is used for real-time updates. Make sure it's properly initialized and managed.
4. Error handling and loading states are implemented to provide feedback to the user during asynchronous operations.

By following these instructions and referencing the provided code snippets, you should be able to manage the conversations list and load history for selected conversations effectively in the BB project.