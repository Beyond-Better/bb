# Features API Documentation

The Features API provides secure, granular access control for BB features, models, datasources, and tools. It supports both user-level and team-level feature checking with comprehensive caching and batch operations.

## Overview

The API provides two main scopes:
- **User Features**: `/api/v1/user/features/*` - Individual user feature access
- **Team Features**: `/api/v1/team/{teamId}/features/*` - Team-level feature access

## Authentication

All endpoints require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <access_token>
```

## User Features API

### Get User Feature Profile
`GET /api/v1/user/features`

Returns the complete feature profile for the authenticated user.

**Response:**
```json
{
  "profile": {
    "models": ["claude.haiku", "claude.sonnet", "openai.gpt4"],
    "datasources": [
      {"name": "filesystem", "read": true, "write": true},
      {"name": "github", "read": true, "write": false}
    ],
    "tools": ["builtin", "external"],
    "limits": {
      "tokensPerMinute": 1000,
      "requestsPerMinute": 60
    },
    "support": {
      "community": true,
      "email": true,
      "priorityQueue": false,
      "earlyAccess": false,
      "workspaceIsolation": false,
      "sso": false,
      "dedicatedCSM": false,
      "onPremises": false
    }
  }
}
```

### Check Feature Access
`POST /api/v1/user/features/check`

Checks if the user has access to a specific feature.

**Request:**
```json
{
  "featureKey": "models.claude.sonnet"
}
```

**Response:**
```json
{
  "result": {
    "access_granted": true,
    "feature_value": null,
    "access_reason": "plan_feature",
    "resolved_from": "subscription_plan"
  }
}
```

### Batch Check Feature Access
`POST /api/v1/user/features/batch`

Checks access to multiple features simultaneously.

**Request:**
```json
{
  "featureKeys": [
    "models.claude.sonnet",
    "datasources.github",
    "tools.builtin"
  ]
}
```

**Response:**
```json
{
  "results": {
    "models.claude.sonnet": {
      "access_granted": true,
      "feature_value": null,
      "access_reason": "plan_feature",
      "resolved_from": "subscription_plan"
    },
    "datasources.github": {
      "access_granted": true,
      "feature_value": {"read": true, "write": false},
      "access_reason": "plan_feature",
      "resolved_from": "subscription_plan"
    },
    "tools.builtin": {
      "access_granted": true,
      "feature_value": null,
      "access_reason": "plan_feature",
      "resolved_from": "subscription_plan"
    }
  }
}
```

### Get Available Models
`GET /api/v1/user/features/models`

Returns all models the user has access to.

**Response:**
```json
{
  "models": ["claude.haiku", "claude.sonnet", "openai.gpt4"]
}
```

### Get Available Datasources
`GET /api/v1/user/features/datasources`

Returns all datasources the user has access to with their permissions.

**Response:**
```json
{
  "datasources": [
    {"name": "filesystem", "read": true, "write": true},
    {"name": "github", "read": true, "write": false},
    {"name": "notion", "read": true, "write": true}
  ]
}
```

### Get Rate Limits
`GET /api/v1/user/features/limits`

Returns the user's current rate limits.

**Response:**
```json
{
  "limits": {
    "tokensPerMinute": 1000,
    "requestsPerMinute": 60
  }
}
```

### Refresh Feature Cache
`POST /api/v1/user/features/cache/refresh`

Refreshes the feature cache for the authenticated user.

**Response:**
```json
{
  "refreshed": 15
}
```

## Team Features API

### Get Team Feature Profile
`GET /api/v1/team/{teamId}/features`

Returns the complete feature profile for a team.

**Parameters:**
- `teamId` (path): Team ID

**Response:**
```json
{
  "profile": {
    "teamId": "team_123",
    "models": ["claude.haiku", "claude.sonnet", "openai.gpt4"],
    "datasources": [
      {"name": "filesystem", "read": true, "write": true}
    ],
    "tools": ["builtin", "external"],
    "limits": {
      "tokensPerMinute": 5000,
      "requestsPerMinute": 300
    },
    "support": {
      "community": true,
      "email": true,
      "priorityQueue": true,
      "earlyAccess": true,
      "workspaceIsolation": true,
      "sso": true,
      "dedicatedCSM": false,
      "onPremises": false
    }
  }
}
```

### Check Team Feature Access
`POST /api/v1/team/{teamId}/features/check`

Checks if a team has access to a specific feature.

**Parameters:**
- `teamId` (path): Team ID

**Request:**
```json
{
  "featureKey": "models.claude.opus"
}
```

**Response:**
```json
{
  "result": {
    "access_granted": true,
    "feature_value": null,
    "access_reason": "team_subscription",
    "resolved_from": "team_plan"
  }
}
```

### Get Team Available Models
`GET /api/v1/team/{teamId}/features/models`

Returns all models the team has access to.

**Parameters:**
- `teamId` (path): Team ID

**Response:**
```json
{
  "models": ["claude.haiku", "claude.sonnet", "claude.opus", "openai.gpt4"]
}
```

## Feature Keys

The API uses hierarchical feature keys for granular access control:

### Models
- `models.claude` - Base Claude access
- `models.claude.haiku` - Claude Haiku access
- `models.claude.sonnet` - Claude Sonnet access
- `models.claude.opus` - Claude Opus access
- `models.openai` - Base OpenAI access
- `models.openai.gpt3` - GPT-3.5 access
- `models.openai.gpt4` - GPT-4 access

### Datasources
- `datasources.filesystem` - Filesystem access
- `datasources.github` - GitHub access
- `datasources.notion` - Notion access
- `datasources.supabase` - Supabase access

### Tools
- `tools.builtin` - Built-in tools access
- `tools.external` - External tools (MCP) access

### Limits
- `limits.tokens_per_minute` - Token rate limit
- `limits.requests_per_minute` - Request rate limit

### Support & Features
- `support.community` - Community support
- `support.email` - Email support
- `support.priority_queue` - Priority queue access
- `features.early_access` - Early access features
- `features.workspace_isolation` - Workspace isolation
- `features.sso` - Single sign-on
- `features.dedicated_csm` - Dedicated CSM
- `features.on_prem` - On-premises option

## Error Responses

All endpoints return standard HTTP status codes:

- `200` - Success
- `400` - Bad Request (invalid parameters)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (access denied)
- `404` - Not Found (resource not found)
- `500` - Internal Server Error

Error response format:
```json
{
  "error": "Error message description"
}
```

## Best Practices

1. **Use Batch Checking**: For multiple feature checks, use `/batch` endpoint to reduce API calls
2. **Cache Results**: Feature access results are cached; use cache refresh sparingly
3. **Specific Endpoints**: Use specific endpoints (`/models`, `/datasources`, etc.) when you need structured data
4. **Error Handling**: Always handle 403 responses gracefully in your UI
5. **Team Access**: Verify team membership before making team feature requests

## Integration Examples

### React Hook Example
```typescript
const useFeatureAccess = (featureKey: string) => {
  const [access, setAccess] = useState<boolean | null>(null);
  
  useEffect(() => {
    api.post('/api/v1/user/features/check', { featureKey })
      .then(response => setAccess(response.data.result.access_granted))
      .catch(() => setAccess(false));
  }, [featureKey]);
  
  return access;
};
```

### Batch Check Example
```typescript
const checkMultipleFeatures = async (features: string[]) => {
  const response = await api.post('/api/v1/user/features/batch', {
    featureKeys: features
  });
  
  return response.data.results;
};
```