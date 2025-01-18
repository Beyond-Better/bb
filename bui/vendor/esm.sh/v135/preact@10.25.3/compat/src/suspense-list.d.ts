// Intentionally not using a relative path to take advantage of
// the TS version resolution mechanism
import { Component, ComponentChild, ComponentChildren } from 'https://esm.sh/v135/preact@10.25.3/src/index.d.ts';

//
// SuspenseList
// -----------------------------------

export interface SuspenseListProps {
	children?: ComponentChildren;
	revealOrder?: 'forwards' | 'backwards' | 'together';
}

export class SuspenseList extends Component<SuspenseListProps> {
	render(): ComponentChild;
}
