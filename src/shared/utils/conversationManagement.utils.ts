//import { crypto } from '@std/crypto';
import { ulid } from '@std/ulid';
import { ConversationId } from 'shared/types.ts';

export function generateConversationId(): ConversationId {
	//const uuid = crypto.randomUUID();
	//return ulid.replace(/-/g, '').substring(0, 8);
	const conversationId = ulid();
	return conversationId.substring(0, 8);
}
