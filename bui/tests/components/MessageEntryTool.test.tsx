import { assertEquals } from '@std/assert';
import { MessageEntryTool } from '../../src/components/MessageEntryTool.tsx';
import { fireEvent, render } from '@testing-library/preact';

const mockContent = {
	parameters: {
		test: 'value',
		nested: {
			key: 'value',
		},
	},
};

Deno.test('MessageEntryTool renders input message correctly', () => {
	const { container } = render(
		<MessageEntryTool
			type='input'
			toolName='test_tool'
			content={mockContent}
		/>,
	);

	const title = container.querySelector('.font-semibold');
	assertEquals(
		title?.textContent?.includes('Tool Input: test_tool'),
		true,
		'Should show correct input title',
	);

	const code = container.querySelector('code.language-json');
	assertEquals(
		code !== null,
		true,
		'Should render JSON content',
	);
});

Deno.test('MessageEntryTool renders output message correctly', () => {
	const { container } = render(
		<MessageEntryTool
			type='output'
			toolName='test_tool'
			content={mockContent}
		/>,
	);

	const title = container.querySelector('.font-semibold');
	assertEquals(
		title?.textContent?.includes('Tool Output: test_tool'),
		true,
		'Should show correct output title',
	);
});

Deno.test('MessageEntryTool handles copy button click', () => {
	let copiedText = '';
	const onCopy = (text: string) => {
		copiedText = text;
	};

	const { container } = render(
		<MessageEntryTool
			type='input'
			toolName='test_tool'
			content={mockContent}
			onCopy={onCopy}
		/>,
	);

	const copyButton = container.querySelector('button');
	if (copyButton) {
		fireEvent.click(copyButton);
	}

	assertEquals(
		copiedText,
		JSON.stringify(mockContent, null, 2),
		'Should copy formatted JSON content',
	);
});

Deno.test('MessageEntryTool formats JSON with syntax highlighting', () => {
	const { container } = render(
		<MessageEntryTool
			type='input'
			toolName='test_tool'
			content={mockContent}
		/>,
	);

	const code = container.querySelector('code.hljs');
	assertEquals(
		code !== null,
		true,
		'Should apply syntax highlighting',
	);

	const content = code?.innerHTML || '';
	assertEquals(
		content.includes('hljs-'),
		true,
		'Should contain highlight.js classes',
	);
});

Deno.test('MessageEntryTool handles empty content', () => {
	const { container } = render(
		<MessageEntryTool
			type='input'
			toolName='test_tool'
			content={{}}
		/>,
	);

	const code = container.querySelector('code');
	assertEquals(
		code?.textContent?.trim(),
		'{}',
		'Should handle empty object content',
	);
});
