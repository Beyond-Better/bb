# BB Browser User Interface (BUI) Development Instructions

## Overview

The BB Browser User Interface (BUI) is being developed using Deno Fresh to
provide a web-based interface for the BB project. The BUI aims to offer the
same core functionality as the CLI, with a focus on conversation management and
interaction with the BB system.

## Key Features

1. WebSocket-based real-time communication with the BB API
2. Conversation management (start new, continue existing)
3. Chat interface for interacting with BB
4. Setting and using the current working directory for project context

## Current Implementation

The main component of the BUI is the `Chat.tsx` file located in
`bui/src/islands/Chat.tsx`. This component handles:

1. WebSocket connection management with retry logic
2. User input for messages and current working directory
3. Displaying conversation history
4. Error handling and display

## Important Notes

1. The `generateConversationId` function is imported from
   `shared/conversationManagement.ts`. This import should not be changed without
   explicit instruction.
2. The `startDir` (current working directory) is crucial for the BB system and
   must be sent with each message.
3. A greeting message is sent automatically when the WebSocket connection is
   established.
4. The default `startDir` is set to `~/bb/`.
5. The WebSocket server is expected to be running on `localhost:3000`.

## WebSocket Implementation

- The WebSocket connection is established using the browser's native WebSocket
  API.
- The connection URL is constructed using `localhost:3000` as the host and the
  generated conversation ID.
- Reconnection attempts use exponential backoff with jitter to avoid
  overwhelming the server.

## Future Improvements

1. Implement input validation for the `startDir` to ensure it's a valid
   directory path.
2. Add a visual indicator to show the WebSocket connection status (connected,
   disconnected, reconnecting).
3. Implement error handling for cases where the server rejects the `startDir` as
   invalid.
4. Improve the UI/UX of the chat interface.
5. Add more robust error handling or input validation.
6. Implement additional features like conversation history or file uploads.
7. Optimize performance if needed.

## Testing

When testing the BUI, focus on:

1. Setting and using custom working directories.
2. Verifying that the greeting message is sent and received properly.
3. Testing the conversation flow by sending and receiving messages.
4. Checking the reconnection mechanism by intentionally disconnecting.
5. Ensure the WebSocket connection is properly established with the server at
   `localhost:3000`.

## Development Guidelines

1. Maintain consistency in import statements, especially for shared utilities.
2. Ensure all user inputs are properly sanitized and validated.
3. Keep error messages informative and user-friendly.
4. Maintain a responsive and accessible design for various screen sizes.
5. Document any new features or significant changes in this file.

## API Integration

The BUI communicates with the BB API primarily through WebSocket connections.
Ensure that any changes to the API are reflected in the BUI, particularly in the
message structure and handling.

Remember to update this document as the BUI evolves to keep it as a current and
useful reference for ongoing development.
