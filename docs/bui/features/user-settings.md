# User Settings

## Overview

Beyond Better's user settings manage user preferences, appearance, and account settings. This document outlines the user settings features and their implementation, considering Fresh's island architecture and state management constraints.

## Core Concepts

### 1. User Preferences
```typescript
interface UserPreferences {
    // Display settings
    theme: 'light' | 'dark' | 'system';
    fontSize: 'small' | 'medium' | 'large';
    language: string;
    timezone: string;

    // Project preferences
    defaultProjectId?: string;
    recentProjects: string[];
    projectViewMode: 'list' | 'grid';

    // Notification settings
    emailNotifications: boolean;
    desktopNotifications: boolean;
    notificationTypes: {
        projectUpdates: boolean;
        teamInvites: boolean;
        systemAlerts: boolean;
    };
}
```

### 2. Account Settings
```typescript
interface AccountSettings {
    // Profile
    displayName: string;
    email: string;
    avatar?: string;

    // Account status
    billingPlan: 'free' | 'pro' | 'team';
    planExpiryDate?: string;
    teamId?: string;

    // Security
    mfaEnabled: boolean;
    lastPasswordChange: string;
    sessionTimeout: number;
}
```

## Features

### 1. Settings Management
Main settings interface:
```typescript
// islands/UserSettings.tsx
export default function UserSettings() {
    const [preferences, setPreferences] = useState<UserPreferences | null>(null);
    const [account, setAccount] = useState<AccountSettings | null>(null);

    // Load settings
    useEffect(() => {
        loadUserSettings();
    }, []);

    const handlePreferenceUpdate = async (
        updates: Partial<UserPreferences>
    ) => {
        await updateUserPreferences(updates);
        setPreferences(prev => ({ ...prev, ...updates }));
    };

    return (
        <Layout>
            <PreferencesPanel
                preferences={preferences}
                onUpdate={handlePreferenceUpdate}
            />
            <AccountPanel
                settings={account}
                onUpdate={handleAccountUpdate}
            />
        </Layout>
    );
}
```

### 2. Theme Management
Handles theme preferences:
```typescript
function ThemeSettings({ 
    current: string, 
    onChange: (theme: string) => void 
}) {
    const handleChange = (theme: string) => {
        onChange(theme);
        if (IS_BROWSER) {
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        }
    };

    return (
        <div class="space-y-2">
            <h3>Theme</h3>
            <select
                value={current}
                onChange={(e) => handleChange(e.currentTarget.value)}
            >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System</option>
            </select>
        </div>
    );
}
```

### 3. Profile Management
Handles user profile:
```typescript
function ProfileSettings({
    account,
    onUpdate
}: {
    account: AccountSettings;
    onUpdate: (updates: Partial<AccountSettings>) => void;
}) {
    const handleSubmit = async (e: Event) => {
        e.preventDefault();
        const form = e.target as HTMLFormElement;
        const updates = {
            displayName: form.displayName.value,
            email: form.email.value,
        };
        await onUpdate(updates);
    };

    return (
        <form onSubmit={handleSubmit}>
            <input
                name="displayName"
                value={account.displayName}
                placeholder="Display Name"
            />
            <input
                name="email"
                value={account.email}
                placeholder="Email"
            />
            <button type="submit">Update Profile</button>
        </form>
    );
}
```

## State Management

### 1. Settings Context
```typescript
interface SettingsContext {
    preferences: UserPreferences;
    account: AccountSettings;
    updatePreferences: (updates: Partial<UserPreferences>) => Promise<void>;
    updateAccount: (updates: Partial<AccountSettings>) => Promise<void>;
}

const settingsContext = signal<SettingsContext>({
    preferences: defaultPreferences,
    account: defaultAccount,
    updatePreferences: async () => {},
    updateAccount: async () => {},
});
```

### 2. Settings Persistence
```typescript
// Load settings on startup
async function initializeSettings() {
    if (IS_BROWSER) {
        // Load from localStorage first for immediate display
        const cached = localStorage.getItem('userPreferences');
        if (cached) {
            settingsContext.value.preferences = JSON.parse(cached);
        }

        // Then fetch from server
        try {
            const [preferences, account] = await Promise.all([
                fetchUserPreferences(),
                fetchAccountSettings()
            ]);

            settingsContext.value = {
                ...settingsContext.value,
                preferences,
                account
            };

            // Update cache
            localStorage.setItem(
                'userPreferences',
                JSON.stringify(preferences)
            );
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }
}
```

## Integration Points

### 1. Project Management
- Default project selection
- Project view preferences
- Recent projects tracking
- Access settings

### 2. Chat Interface
- Message display preferences
- Input settings
- Notification preferences
- History settings

### 3. Billing Integration
- Plan status display
- Feature availability
- Usage tracking
- Payment management

## Implementation Phases

### Phase 1: Basic Settings
1. Theme management
2. Basic preferences
3. Profile settings
4. Local storage

### Phase 2: Enhanced Features
1. Advanced preferences
2. Notification settings
3. Security settings
4. Server sync

### Phase 3: Integration
1. Billing integration
2. Team settings
3. Advanced security
4. Analytics

## Testing Strategy

### 1. Settings Operations
```typescript
Deno.test({
    name: "Settings: update and persist",
    async fn() {
        // Update preferences
        await updateUserPreferences({
            theme: 'dark'
        });

        // Verify persistence
        const preferences = await loadUserPreferences();
        assertEquals(preferences.theme, 'dark');
    }
});
```

### 2. Theme Testing
```typescript
Deno.test({
    name: "Theme: system preference handling",
    async fn() {
        // Set theme preference
        await updateUserPreferences({
            theme: 'system'
        });

        // Verify theme application
        if (IS_BROWSER) {
            const theme = document.documentElement.getAttribute('data-theme');
            assertExists(theme);
        }
    }
});
```

## Best Practices

1. Settings Management
   - Validate all updates
   - Handle offline state
   - Provide defaults
   - Cache appropriately

2. State Updates
   - Batch related changes
   - Optimize persistence
   - Handle conflicts
   - Provide feedback

3. Security
   - Validate permissions
   - Sanitize inputs
   - Secure storage
   - Audit changes

4. Performance
   - Minimize storage
   - Batch updates
   - Cache effectively
   - Clean up unused data

## Next Steps

1. Implement settings island
2. Add theme management
3. Create profile settings
4. Add notification preferences
5. Integrate with billing