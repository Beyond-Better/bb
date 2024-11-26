import { assertEquals } from 'std/testing/asserts';
import { MessageEntry } from '../../src/components/MessageEntry.tsx';
import { render } from '@testing-library/preact';

const mockEntry = {
	logEntry: {
		entryType: 'user',
		content: 'Test message with **markdown**',
		timestamp: new Date().toISOString(),
	},
	timestamp: new Date().toISOString(),
	tokenUsageTurn: {
		inputTokens: 30,
		outputTokens: 70,
		totalTokens: 100,
		cacheCreationInputTokens: 20,
		cacheReadInputTokens: 10,
	},
	tokenUsageConversation: {
		inputTokensTotal: 300,
		outputTokensTotal: 700,
		totalTokensTotal: 1000,
	},
};

const mockToolEntry = {
	logEntry: {
		entryType: 'tool_use',
		toolName: 'test_tool',
		content: {
			type: 'tool_use',
			toolName: 'test_tool',
			parameters: { test: 'value' },
		},
		timestamp: new Date().toISOString(),
	},
	timestamp: new Date().toISOString(),
	tokenUsageTurn: {
		inputTokens: 40,
		outputTokens: 60,
		totalTokens: 100,
	},
	tokenUsageConversation: {
		inputTokensTotal: 400,
		outputTokensTotal: 600,
		totalTokensTotal: 1000,
	},
};

Deno.test('MessageEntry renders user message with markdown', () => {
	const { container } = render(
		<MessageEntry
			entry={mockEntry}
			index={0}
			onCopy={() => {}}
		/>,
	);

	const content = container.querySelector('.prose');
	assertEquals(
		content?.innerHTML.includes('<strong>markdown</strong>'),
		true,
		'Should render markdown correctly',
	);
});

Deno.test('MessageEntry renders tool message', () => {
	const { container } = render(
		<MessageEntry
			entry={mockToolEntry}
			index={0}
			onCopy={() => {}}
		/>,
	);

	const toolMessage = container.querySelector('.tool-message');
	assertEquals(
		toolMessage !== null,
		true,
		'Should render tool message component',
	);
});

Deno.test('MessageEntry renders code blocks with syntax highlighting', () => {
	const codeEntry = {
		...mockEntry,
		logEntry: {
			...mockEntry.logEntry,
			content: '```typescript\nconst x: number = 42;\n```',
		},
	};

	const { container } = render(
		<MessageEntry
			entry={codeEntry}
			index={0}
			onCopy={() => {}}
		/>,
	);

	const codeBlock = container.querySelector('code.hljs.typescript');
	assertEquals(
		codeBlock !== null,
		true,
		'Should render highlighted code block',
	);
});

Deno.test('MessageEntry displays token usage information correctly', () => {
	const { container } = render(
		<MessageEntry
			entry={mockEntry}
			index={0}
			onCopy={() => {}}
		/>,
	);

	// Check turn token display
	const turnTokens = container.querySelector('span[title="Input/Output tokens for this turn"]');
	assertEquals(
		turnTokens?.textContent?.trim(),
		'Turn: 30↑/70↓',
		'Should show correct turn input/output tokens',
	);

	// Check turn total display
	const turnTotal = container.querySelector('span[title="Total tokens for this turn"]');
	assertEquals(
		turnTotal?.textContent?.trim(),
		'(100)',
		'Should show correct turn total tokens',
	);

	// Check conversation token display
	const totalTokens = container.querySelector('span[title="Total conversation tokens (input/output)"]');
	assertEquals(
		totalTokens?.textContent?.trim(),
		'Total: 300↑/700↓',
		'Should show correct total input/output tokens',
	);

	// Check conversation total display
	const conversationTotal = container.querySelector('span[title="Total conversation tokens"]');
	assertEquals(
		conversationTotal?.textContent?.trim(),
		'(1000)',
		'Should show correct conversation total tokens',
	);

	// Check cache token display
	const cacheTokens = container.querySelector('span[title="Cache tokens (creation/read)"]');
	assertEquals(
		cacheTokens?.textContent?.trim(),
		'Cache: 20c/10r',
		'Should show correct cache tokens',
	);
});

Deno.test('MessageEntry handles missing cache tokens correctly', () => {
	const entryWithoutCache = {
		...mockEntry,
		tokenUsageTurn: {
			inputTokens: 30,
			outputTokens: 70,
			totalTokens: 100,
		},
	};

	const { container } = render(
		<MessageEntry
			entry={entryWithoutCache}
			index={0}
			onCopy={() => {}}
		/>,
	);

	// Verify cache section is not present
	const cacheTokens = container.querySelector('span[title="Cache tokens (creation/read)"]');
	assertEquals(
		cacheTokens,
		null,
		'Should not show cache tokens when not present',
	);
});

Deno.test('MessageEntry shows correct message type styles', () => {
	const types = ['user', 'assistant', 'tool_use', 'tool_result', 'auxiliary'];

	types.forEach((type) => {
		const entry = {
			...mockEntry,
			logEntry: {
				...mockEntry.logEntry,
				entryType: type,
			},
		};

		const { container } = render(
			<MessageEntry
				entry={entry}
				index={0}
				onCopy={() => {}}
			/>,
		);

		const messageContainer = container.firstChild;
		const expectedClass = type === 'user'
			? 'bg-blue-50'
			: type === 'assistant'
			? 'bg-green-50'
			: type === 'tool_use' || type === 'tool_result'
			? 'bg-yellow-50'
			: type === 'auxiliary'
			? 'bg-purple-50'
			: '';

		assertEquals(
			messageContainer?.classList.contains(expectedClass),
			true,
			`Should have correct style for ${type} message`,
		);
	});
});
