# Configuration System Tests

## Running Tests

### Using Task Commands

```bash
# Run all config system tests
deno task test:config

# Watch mode for development
deno task test:config:watch

# Run tests with coverage reporting
deno task test:config:coverage
```

### Manual Test Run

```bash
# Run all config system tests
deno test src/shared/config/v2/tests/

# Run specific test file
deno test src/shared/config/v2/tests/configManager.test.ts
deno test src/shared/config/v2/tests/types.test.ts
```

### Development Mode

```bash
# Watch mode - reruns tests on file changes
deno test --watch src/shared/config/v2/tests/
```

### With Coverage

```bash
# Run tests with coverage reporting
deno test --coverage=coverage src/shared/config/v2/tests/

# Generate coverage report
deno coverage coverage
```

### Test Options

```bash
# Run tests with all permissions needed
deno test --allow-read --allow-write --allow-env src/shared/config/v2/tests/

# Run tests in quiet mode
deno test --quiet src/shared/config/v2/tests/

# Filter specific tests
deno test --filter "Global Configuration" src/shared/config/v2/tests/
```

## Test Organization

### Core Test Files

- `configManager.test.ts` - Tests for ConfigManager implementation
- `types.test.ts` - Tests for type system and interfaces
- `testUtils.ts` - Shared test utilities and fixtures

### Test Categories

1. Configuration Loading/Saving
   - Default config loading
   - Config file reading/writing
   - Cache management

2. Project Management
   - Project creation
   - Project ID generation
   - Project root resolution
   - Registry management

3. Migration Process
   - V1 to V2 migration
   - Backup creation
   - Change tracking
   - Error handling

4. Validation Logic
   - Schema validation
   - Type checking
   - Required fields
   - Component validation

## Adding New Tests

1. Create test file in `tests/` directory
2. Import test utilities:

```typescript
import { assertEquals, assertExists } from '@std/testing/asserts';
import { describe, it } from '@std/testing/bdd';
import { createTestEnv, mockFileSystem } from './testUtils.ts';
```

3. Use test structure:

```typescript
describe('Feature Name', () => {
	let testEnv: { testDir: string; cleanup: () => Promise<void> };

	beforeEach(async () => {
		testEnv = await createTestEnv();
	});

	afterEach(async () => {
		await testEnv.cleanup();
	});

	it('should do something', async () => {
		// Test implementation
	});
});
```

## Common Test Patterns

### Testing File Operations

```typescript
const fs = mockFileSystem();
try {
	// Test file operations
} finally {
	fs.cleanup();
}
```

### Testing Migrations

```typescript
import { sampleV1GlobalConfig } from './testUtils.ts';

const result = await configManager.migrateConfig(sampleV1GlobalConfig);
assertEquals(result.success, true);
```

### Testing Validation

```typescript
import { sampleV22GlobalConfig } from './testUtils.ts';

const result = await configManager.validateConfig(sampleV22GlobalConfig);
assertEquals(result.isValid, true);
```

## Troubleshooting

### Permission Errors

If you see permission errors, make sure to run tests with required permissions:

```bash
deno test --allow-read --allow-write --allow-env src/shared/config/v2/tests/
```

### File System Errors

- Check that test directories are cleaned up properly
- Use `mockFileSystem()` for file system operations
- Ensure proper path handling for your OS

### Test Isolation

- Use `beforeEach` and `afterEach` for setup/cleanup
- Don't share state between tests
- Use fresh test directories for each test
