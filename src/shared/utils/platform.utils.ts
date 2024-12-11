// Platform detection and asset name generation for BB app downloads
export interface PlatformInfo {
	os: 'windows' | 'macos' | 'linux';
	arch: 'x64' | 'arm64';
	variant?: 'intel' | 'apple-silicon'; // for macOS
}

export function getPlatformInfo(): PlatformInfo {
	const os = 'darwin'; //Deno.build.os;
	const arch = 'x64'; //Deno.build.arch;

	if (os === 'darwin') {
		return {
			os: 'macos',
			arch: arch === 'aarch64' ? 'arm64' : 'x64',
			variant: arch === 'aarch64' ? 'apple-silicon' : 'intel',
		};
	}

	return {
		os: os === 'windows' ? 'windows' : 'linux',
		arch: arch === 'aarch64' ? 'arm64' : 'x64',
	};
}

export function getBBAppAssetName(version: string): string {
	const platform = getPlatformInfo();

	switch (platform.os) {
		case 'macos':
			return `BB-app-${version}-macos-${platform.variant}.dmg`;
		case 'windows':
			return `BB-app-${version}-windows-x64-setup.exe`;
		case 'linux':
			return `BB-app-${version}-linux-x64.AppImage`;
	}
}

export function getSecurityInstructions(): string {
	const platform = getPlatformInfo();

	switch (platform.os) {
		case 'macos':
			return 'When first launching the app:\n' +
				'- Right-click the app and select "Open", or\n' +
				'- Go to System Settings > Privacy & Security and click "Open Anyway"\n' +
				'- This security approval is only needed once, as the app is currently unsigned';
		case 'windows':
			return 'When first launching the app, you may see a SmartScreen warning:\n' +
				'- Click "More info"\n' +
				'- Click "Run anyway"\n' +
				'- This security approval is only needed once, as the app is currently unsigned';
		case 'linux':
			return 'After downloading:\n' +
				'- Make the AppImage executable: chmod +x BB-app-*.AppImage\n' +
				'- Run the AppImage';
	}
}
