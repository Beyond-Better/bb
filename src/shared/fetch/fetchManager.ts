/// <reference no-default-lib="true" />
/// <reference lib="dom" />
/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />
// https://docs.deno.com/runtime/manual/advanced/typescript/types/#using-triple-slash-directives
// The use of `document.body.innerHTML` (below) requires the "dom" lib
// This is a more complete list if full browser support is needed
// [ "dom", "dom.iterable", "dom.asynciterable", "deno.ns", "deno.unstable" ]

import { Browser, launch, Page } from 'astral';

import { InteractionId } from 'shared/types.ts';
import { logger } from 'shared/logger.ts';

class FetchManager {
	//private static instance: FetchManager;
	private browser!: Browser;
	private isInitialized: boolean = false;

	constructor(private browserFactory: () => Promise<Browser> = () => launch()) {
	}

	public async init(): Promise<FetchManager> {
		try {
			if (!this.isInitialized) {
				this.browser = await this.browserFactory();
				this.isInitialized = true;
			}
		} catch (error) {
			logger.error('Failed to initialize FetchManager:', error);
			throw error;
		}
		return this;
	}

	async cleanup(): Promise<void> {
		if (this.isInitialized) {
			await this.browser.close();
			this.isInitialized = false;
		}
	}

	//static getInstance(): FetchManager {
	//	if (!FetchManager.instance) {
	//		FetchManager.instance = new FetchManager();
	//	}
	//	return FetchManager.instance;
	//}

	async fetchPage(url: string): Promise<string> {
		let weStartedBrowser = false;
		if (!this.isInitialized) {
			weStartedBrowser = true;
			await this.init();
		}
		const page: Page = await this.browser.newPage(url);
		const content = await page.evaluate(() => {
			return document.body.innerHTML;
		}) as string;

		if (weStartedBrowser) await this.cleanup();
		return content;
	}

	async fetchScreenshot(url: string): Promise<Uint8Array> {
		let weStartedBrowser = false;
		if (!this.isInitialized) {
			weStartedBrowser = true;
			await this.init();
		}

		const page = await this.browser.newPage(url);
		const screenshot = await page.screenshot();

		if (weStartedBrowser) await this.cleanup();
		return screenshot;
	}
}

export default FetchManager;

//export const fetchManager = await FetchManager.getInstance().init();
