/*
 * License: AGPL-3.0-or-later
 * Copyright: 2025 - Beyond Better <charlie@beyondbetter.app>
 */

import type { Session, User } from '@supabase/supabase-js';
import type { BuiConfig } from 'shared/config/types.ts';

/**
 * Fresh state type for our BUI application
 * Following Fresh documentation patterns for typed state
 */
export interface FreshAppState {
	buiConfig: BuiConfig;
	session: Session | null;
	user: User | null;
}
