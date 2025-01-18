import { VNode } from 'https://esm.sh/v135/preact@10.25.3/src/index.d.ts';

export default function renderToString<P = {}>(
	vnode: VNode<P>,
	context?: any
): string;

export function render<P = {}>(vnode: VNode<P>, context?: any): string;
export function renderToString<P = {}>(vnode: VNode<P>, context?: any): string;
export function renderToStringAsync<P = {}>(
	vnode: VNode<P>,
	context?: any
): string | Promise<string>;
export function renderToStaticMarkup<P = {}>(
	vnode: VNode<P>,
	context?: any
): string;
