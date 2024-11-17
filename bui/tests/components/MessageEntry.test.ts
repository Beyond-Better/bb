import { assertEquals } from 'std/testing/asserts.ts';
import { MessageEntry } from '../../src/components/MessageEntry.tsx';
import { render } from '@testing-library/preact';

const mockEntry = {
	logEntry: {
		entryType: 'user',
		content: 'Test message with **markdown**',
		timestamp: new Date().toISOString(),
	},
	timestamp: new Date().toISOString(),
	tokenUsageConversation: {
		totalTokensTotal: 100,
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
	tokenUsageConversation: {
		totalTokensTotal: 100,
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
