import { assertEquals } from '@std/assert';
import { fireEvent, render } from '@testing-library/preact';
import { MessageEntry } from '../../src/components/MessageEntry.tsx';
import { MessageEntryTool } from '../../src/components/MessageEntryTool.tsx';
import { Toast } from '../../src/components/Toast.tsx';
import { ErrorMessage } from '../../src/components/ErrorMessage.tsx';

// Test data
const markdownEntry = {
	logEntry: {
		entryType: 'assistant',
		content: '# Heading\n\n```typescript\nconst x: number = 42;\n```\n\n- List item\n- Another item',
		timestamp: new Date().toISOString(),
	},
	timestamp: new Date().toISOString(),
	tokenUsageInteraction: {
		totalTokensTotal: 100,
	},
};

const toolEntry = {
	logEntry: {
		entryType: 'tool_use',
		toolName: 'find_resources',
		content: {
			type: 'tool_use',
			toolName: 'find_resources',
			parameters: {
				filePattern: '*.ts',
				contentPattern: 'function',
			},
		},
		timestamp: new Date().toISOString(),
	},
	timestamp: new Date().toISOString(),
	tokenUsageInteraction: {
		totalTokensTotal: 100,
	},
};

// Message Entry Tests
Deno.test('MessageEntry - Markdown Rendering', () => {
	const { container } = render(
		<MessageEntry
			entry={markdownEntry}
			index={0}
			onCopy={() => {}}
		/>,
	);

	// Check heading
	const heading = container.querySelector('h1');
	assertEquals(heading?.textContent, 'Heading');

	// Check code block
	const codeBlock = container.querySelector('code.hljs.typescript');
	assertEquals(codeBlock !== null, true);

	// Check list
	const listItems = container.querySelectorAll('li');
	assertEquals(listItems.length, 2);
});

Deno.test('MessageEntry - Tool Message Rendering', () => {
	const { container } = render(
		<MessageEntry
			entry={toolEntry}
			index={0}
			onCopy={() => {}}
		/>,
	);

	const toolMessage = container.querySelector('.tool-message');
	assertEquals(toolMessage !== null, true);

	const toolName = container.querySelector('.font-semibold');
	assertEquals(
		toolName?.textContent?.includes('Tool Input: find_resources'),
		true,
	);
});

// Tool Message Tests
Deno.test('MessageEntryTool - Parameters Display', () => {
	const { container } = render(
		<MessageEntryTool
			type='input'
			toolName='find_resources'
			content={{
				parameters: {
					test: 'value',
				},
			}}
		/>,
	);

	const parameters = container.querySelector('pre');
	assertEquals(parameters?.textContent?.includes('"test": "value"'), true);
});

// Toast Tests
Deno.test('Toast - Auto Dismiss', async () => {
	const onClose = () => closeCalled = true;
	let closeCalled = false;

	render(
		<Toast
			message='Test message'
			duration={100}
			onClose={onClose}
		/>,
	);

	await new Promise((resolve) => setTimeout(resolve, 150));
	assertEquals(closeCalled, true);
});

// Error Message Tests
Deno.test('ErrorMessage - Close Button', () => {
	let closeCalled = false;
	const { container } = render(
		<ErrorMessage
			message='Test error'
			onClose={() => closeCalled = true}
		/>,
	);

	const closeButton = container.querySelector('button');
	if (closeButton) {
		fireEvent.click(closeButton);
	}
	assertEquals(closeCalled, true);
});

// Integration Tests
Deno.test('Message Formatting Integration', () => {
	const complexEntry = {
		logEntry: {
			entryType: 'assistant',
			content: [
				"Here's some markdown:\n\n```typescript\nconst x = 42;\n```",
				{
					type: 'tool_use',
					toolName: 'test_tool',
					content: {
						parameters: { test: 'value' },
					},
				},
				'More text with *emphasis*',
			],
			timestamp: new Date().toISOString(),
		},
		timestamp: new Date().toISOString(),
		tokenUsageInteraction: {
			totalTokensTotal: 100,
		},
	};

	const { container } = render(
		<MessageEntry
			entry={complexEntry}
			index={0}
			onCopy={() => {}}
		/>,
	);

	// Check markdown rendering
	const codeBlock = container.querySelector('code.hljs.typescript');
	assertEquals(codeBlock !== null, true);

	// Check tool message
	const toolMessage = container.querySelector('.tool-message');
	assertEquals(toolMessage !== null, true);

	// Check emphasis
	const emphasis = container.querySelector('em');
	assertEquals(emphasis?.textContent, 'emphasis');
});
