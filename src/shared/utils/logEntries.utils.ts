import type { CollaborationLogDataEntry } from 'shared/types.ts';

export function createNestedLogDataEntries(entries: CollaborationLogDataEntry[]): CollaborationLogDataEntry[] {
	const childMessageIds = new Set<string>();

	const result = entries.map((entry) => {
		if (
			entry.logEntry?.entryType !== 'tool_use' ||
			entry.logEntry?.toolName !== 'delegate_tasks'
		) {
			return entry;
		}

		const children = entries.filter((child) => child.parentMessageId === entry.messageId);

		children.forEach((child) => childMessageIds.add(child.messageId!));

		const groupedChildren = children.reduce((acc, child) => {
			const interactionId = child.agentInteractionId;
			if (!interactionId) return acc;

			if (!acc[interactionId]) {
				acc[interactionId] = [];
			}
			acc[interactionId].push(child);
			return acc;
		}, {} as Record<string, CollaborationLogDataEntry[]>);

		return {
			...entry,
			children: Object.fromEntries(
				Object.entries(groupedChildren).map(([id, childEntries]) => [
					id,
					childEntries.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
				]),
			),
		};
	});

	return result.filter((entry) => !childMessageIds.has(entry.messageId!));
}

export function addLogDataEntry(
	nestedEntries: CollaborationLogDataEntry[],
	newEntry: CollaborationLogDataEntry,
): CollaborationLogDataEntry[] {
	if (!newEntry.parentMessageId || !newEntry.agentInteractionId) {
		return [...nestedEntries, newEntry];
	}

	const parentExists = nestedEntries.some((entry) => entry.messageId === newEntry.parentMessageId);
	if (!parentExists) {
		return [...nestedEntries, newEntry];
	}

	const agentInteractionId = String(newEntry.agentInteractionId);
	return nestedEntries.map((entry) => {
		if (entry.messageId !== newEntry.parentMessageId) return entry;

		return {
			...entry,
			children: {
				...entry.children,
				[agentInteractionId]: [
					...(entry.children?.[agentInteractionId] || []),
					newEntry,
				].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
			},
		};
	});
}
