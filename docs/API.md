# BB API Documentation

This document provides details about the endpoints available in the BB API.

## Base URL

All endpoints are relative to: `https://<hostname>:<port>/api/v1`

## Endpoints

### API Status
- **GET** `/status`
  - Check the status of the API and TLS configuration.
  - Query Parameters:
    - `projectId` (string, optional): Project ID for project-specific configuration
  - Headers:
    - `Accept`: Use `text/html` for HTML response, defaults to JSON
  - Response (JSON): 
    ```json
    {
      "status": "OK",
      "message": "API is running",
      "platform": "darwin|windows|linux",
      "platformDisplay": "macOS|Windows|Linux",
      "trustStoreLocation": "/path/to/trust/store",
      "tls": {
        "enabled": true,
        "certType": "custom|self-signed",
        "certPath": "path/to/cert.pem",
        "certSource": "config|project|global",
        "validFrom": "2024-01-01T00:00:00.000Z",
        "validUntil": "2025-01-01T00:00:00.000Z",
        "issuer": "Certificate issuer",
        "subject": "Certificate subject",
        "expiryStatus": "valid|expiring|expired"
      },
      "configType": "project|global",
      "projectName": "optional project name"
    }
    ```
  - HTML Response:
    - Provides a user-friendly status page
    - Shows detailed certificate information
    - Includes platform-specific guidance
    - Displays trust store status
    - Provides troubleshooting help

### Conversation Management

#### List Conversations
- **GET** `/conversation`
  - Retrieve a list of conversations with pagination and filtering options.
  - Query Parameters:
    - `page` (integer, default: 1): Page number for pagination
    - `pageSize` (integer, default: 10): Number of items per page
    - `startDate` (string, format: date): Filter conversations starting from this date
    - `endDate` (string, format: date): Filter conversations up to this date
    - `llmProviderName` (string): Filter conversations by LLM provider name
    - `projectId` (string, required): The ID for the project
  - Response: List of conversations with pagination details

#### Get Conversation
- **GET** `/conversation/:id`
  - Retrieve details of a specific conversation.
  - Query Parameters:
    - `projectId` (string, required): The ID for the project
  - Response: Conversation details including messages, LLM provider, and token usage

#### Continue Conversation
- **POST** `/conversation/:id`
  - Continue an existing conversation.
  - Request Body:
    ```json
    {
      "statement": "string",
      "projectId": "string"
    }
    ```
  - Response: LLM-generated response with conversation details

#### Delete Conversation
- **DELETE** `/conversation/:id`
  - Delete a specific conversation.
  - Query Parameters:
    - `projectId` (string, required): The ID for the project
  - Response: Deletion confirmation message

#### Clear Conversation
- **POST** `/conversation/:id/clear`
  - Clear the history of a specific conversation.
  - Query Parameters:
    - `projectId` (string, required): The ID for the project
  - Response: Confirmation message

### WebSocket Connection
- **GET** `/ws/conversation/:id`
  - Establish a WebSocket connection for real-time conversation updates.
  - The client can send messages with the following format:
    ```json
    {
      "task": "greeting" | "converse" | "cancel",
      "statement": "string",
      "projectId": "string"
    }
    ```
  - The server will emit events for conversation updates, including:
    - `conversationReady`
    - `conversationContinue`
    - `conversationAnswer`
    - `conversationError`
    - `conversationCancelled`

## LLM Tools

The BB API supports various LLM tools that can be used within conversations. Here are the available tools:

### move_files

Moves one or more files or directories to a new location within the project.

**Parameters:**
- `sources`: Array of strings representing the paths of files or directories to be moved.
- `destination`: String representing the path of the destination directory.
- `overwrite` (optional): Boolean indicating whether to overwrite existing files at the destination (default: false).

**Example usage in a conversation:**
```json
{
  "toolName": "move_files",
  "toolInput": {
    "sources": ["path/to/file1.txt", "path/to/directory"],
    "destination": "path/to/new/location",
    "overwrite": true
  }
}
```

## Note on Unimplemented Features

The following features are mentioned in the codebase but are not fully implemented or exposed through the API:

- Adding files to a conversation
- Removing files from a conversation
- Listing files in a conversation
- Retrieving token usage
- Running CLI commands
- Loading external content
- Retrieving conversation logs
- Undoing the last change in a conversation

These features may be implemented in future versions of the API.

## Error Handling

All endpoints may return appropriate HTTP status codes for various error conditions. Common error responses include:

- 400 Bad Request: For invalid input or missing required parameters
- 404 Not Found: When a requested resource (e.g., conversation) is not found
- 500 Internal Server Error: For unexpected server-side errors

Detailed error messages will be provided in the response body when applicable.

## Authentication

The current implementation does not include authentication. It is designed for local use only. Ensure proper security measures are in place when deploying this API in a production environment.

## Versioning

This documentation is for API version 1 (`v1`). Future versions may introduce changes to the endpoint structure or functionality.