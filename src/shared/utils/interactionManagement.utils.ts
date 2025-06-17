//import { crypto } from '@std/crypto';
import { ulid } from '@std/ulid';
import { InteractionId } from 'shared/types.ts';

export function generateInteractionId(): InteractionId {
	//const uuid = crypto.randomUUID();
	//return ulid.replace(/-/g, '').substring(0, 8);
	const conversationId = ulid();
	//return conversationId.substring(0, 8);
	return conversationId;
}

export function shortenInteractionId(ulid: string): string {
	// First 10 chars are timestamp (sortable), take 6 of these
	const timestampPart = ulid.substring(0, 6);
	// Last 16 chars are random, take last 4 for uniqueness
	const randomPart = ulid.substring(ulid.length - 4);

	return timestampPart + randomPart;
}
