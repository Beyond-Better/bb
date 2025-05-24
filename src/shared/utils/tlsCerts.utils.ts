import { join } from '@std/path';
import { copy } from '@std/fs';
import { exists } from '@std/fs';
import { createCA, createCert } from 'npm:mkcert';
import * as crypto from 'node_crypto';
//import { encodeBase64 } from '@std/encoding';

import {
	getBbDir,
	getGlobalConfigDir,
	getProjectId,
	getWorkingRootFromStartDir,
	writeToGlobalConfigDir,
} from 'shared/dataDir.ts';

interface CertInfo {
	isSelfSigned: boolean;
	issuer: string;
	subject: string;
	validFrom: Date;
	validTo: Date;
}

const globalDir = await getGlobalConfigDir();

const BB_CA_NAME = 'Beyond Better CA';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BOLD = '\x1b[1m';
const NC = '\x1b[0m';

const isCommandAvailable = async (command: string): Promise<boolean> => {
	try {
		const cmd = new Deno.Command(
			Deno.build.os === 'windows' ? 'where' : 'which',
			{ args: [command] },
		);
		const { success } = await cmd.output();
		return success;
	} catch {
		return false;
	}
};

/**
 * Parse a date string from X509Certificate format
 * Example format: "Oct  1 06:47:11 2024 +00:00"
 */
function parseX509Date(dateStr: string): Date {
	// Remove multiple spaces and ensure single space between components
	const normalizedStr = dateStr.replace(/\s+/g, ' ').trim();
	return new Date(normalizedStr);
}

/**
 * Get detailed information about a certificate including its validity period and self-signed status.
 * Uses Node's X509Certificate class via Deno's Node compatibility layer.
 *
 * @param certPem - The certificate content in PEM format
 * @returns CertInfo | null - Certificate information or null if parsing fails
 * @see {@link https://docs.deno.com/api/node/crypto/~/X509Certificate}
 */
export function getCertificateInfo(certPem: string): CertInfo | null {
	try {
		const cert = new crypto.X509Certificate(certPem);
		return {
			isSelfSigned: cert.issuer === cert.subject,
			issuer: cert.issuer,
			subject: cert.subject,
			validFrom: parseX509Date(cert.validFrom),
			validTo: parseX509Date(cert.validTo),
		};
	} catch (error) {
		console.error('Error getting certificate info:', error);
		return null;
	}
}

/**
 * Check if a certificate is self-signed by parsing its PEM content.
 * Uses Node's X509Certificate class via Deno's Node compatibility layer.
 * A certificate is self-signed if its issuer matches its subject.
 *
 * @param certPem - The certificate content in PEM format
 * @returns Promise<boolean> - True if the certificate is self-signed
 * @see {@link https://docs.deno.com/api/node/crypto/~/X509Certificate}
 */
export async function isCertSelfSigned(certPem: string): Promise<boolean> {
	try {
		const cert = new crypto.X509Certificate(certPem);
		return cert.issuer === cert.subject;
	} catch (error) {
		console.error('Error checking certificate:', error);
		return false;
	}
}

export const certificateFileExists = async (certFileName: string = 'localhost.pem') => {
	//console.debug(`${YELLOW}Checking for certificate file '${certFileName}'${NC}`);
	const globalCertFile = join(globalDir, certFileName);
	const workingRoot = await getWorkingRootFromStartDir(Deno.cwd());
	const projectId = await getProjectId(workingRoot);
	if (!projectId) throw new Error(`Could not find a project for: ${workingRoot}`);
	const bbCertFile = join(await getBbDir(projectId), certFileName) || '';
	//console.debug(`${YELLOW}Need to find either '${globalCertFile}' or '${bbCertFile}'${NC}`);
	return (bbCertFile ? await exists(bbCertFile) : false) || await exists(globalCertFile);
};

export const generateCertificate = async (
	domain: string = 'localhost',
	validityDays: number = 365,
): Promise<boolean> => {
	// Try npm mkcert first
	try {
		await generateCertificateMkcert(domain, validityDays);
		console.error(`${GREEN}Cert created using internal mkcert and saved to '${globalDir}'${NC}`);
		return true;
	} catch (error) {
		console.error(`${YELLOW}npm:mkcert failed, falling back to CLI tools${NC}`);
		console.error(`Error was: ${(error as Error).message}`);
	}

	const mkcertAvailable = await isCommandAvailable('mkcert');
	const opensslAvailable = await isCommandAvailable('openssl');
	//console.debug(`mkcert available: ${mkcertAvailable}`);
	//console.debug(`openssl available: ${opensslAvailable}`);

	// Fall back to CLI tools
	if (mkcertAvailable) {
		await generateCertificateMkcertCli(domain, validityDays);
		console.error(`${GREEN}Cert created using 'mkcert' CLI and saved to '${globalDir}'${NC}`);
		return true;
	} else if (opensslAvailable) {
		generateCertificateOpenssl(domain, validityDays);
		console.error(`${GREEN}Cert created using 'openssl' and saved to '${globalDir}'${NC}`);
		return true;
	} else {
		console.error(
			`${RED}Either 'mkcert' or 'openssl' must be installed to generate certs. 'mkcert' is recommended${NC}`,
		);
		if (Deno.build.os === 'windows') {
			if (!await isCommandAvailable('choco')) {
				console.error(
					`${YELLOW}Install choco first:\n${NC}${GREEN}Follow installation instructions at: https://chocolatey.org/install#individual${NC}`,
				);
			}
			console.error(`${YELLOW}Install using choco:\n${NC}${GREEN}choco install mkcert${NC}`);
			console.error(`${YELLOW}Then restart the Command Prompt and run 'bb.exe init' again.${NC}`);
		} else {
			if (!await isCommandAvailable('brew')) {
				console.error(
					`${YELLOW}Install brew first:\n${NC}${GREEN}/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"${NC}`,
				);
			}
			console.error(`${YELLOW}Install using brew:\n${NC}${GREEN}brew install mkcert && brew install nss${NC}`);
		}
		return false;
	}
};

// Add CA certificate to system trust store
export async function addToSystemTrustStore(): Promise<void> {
	const os = Deno.build.os;

	console.log(`Adding CA certificate to ${os} system trust store...`);

	const globalDir = await getGlobalConfigDir();
	const certPath = join(globalDir, 'rootCA.pem');
	try {
		if (!await exists(certPath)) {
			throw new Error(`CA certificate does not exist: ${certPath}`);
		}

		switch (os) {
			case 'darwin':
				await addToMacTrustStore(certPath);
				break;
			case 'windows':
				await addToWindowsTrustStore(certPath);
				break;
			case 'linux':
				await addToLinuxTrustStore(certPath);
				break;
			default:
				throw new Error(`Unsupported operating system: ${os}`);
		}
		console.log(`${GREEN}CA certificate added to system trust store${NC}`);
	} catch (error) {
		console.error(`${YELLOW}Failed to add certificate to trust store: ${(error as Error).message}${NC}`);
		console.error(`${YELLOW}You may need to manually trust the CA certificate at: ${certPath}${NC}`);
		throw error;
	}
}

// Add CA certificate to macOS trust store
async function addToMacTrustStore(certPath: string): Promise<void> {
	const process = new Deno.Command('sudo', {
		args: [
			'security',
			'add-trusted-cert',
			'-d',
			'-r',
			'trustRoot',
			'-k',
			'/Library/Keychains/System.keychain',
			certPath,
		],
	});

	const { code, stderr } = await process.output();
	if (code !== 0) {
		const error = new TextDecoder().decode(stderr);
		throw new Error(`Failed to add certificate to trust store: ${error}`);
	}
}

// Add CA certificate to Windows trust store
async function addToWindowsTrustStore(certPath: string): Promise<void> {
	// Try PowerShell first
	try {
		const process = new Deno.Command('powershell', {
			args: [
				'-Command',
				`Import-Certificate -FilePath "${certPath}" -CertStoreLocation Cert:\\LocalMachine\\Root`,
			],
		});

		const { code, stderr } = await process.output();
		if (code === 0) return;

		const error = new TextDecoder().decode(stderr);
		console.error(`PowerShell import failed: ${error}`);
		console.log('Falling back to certutil...');
	} catch (error) {
		console.error(`PowerShell import failed: ${(error as Error).message}`);
		console.log('Falling back to certutil...');
	}

	// Fall back to certutil
	const process = new Deno.Command('certutil', {
		args: ['-addstore', 'ROOT', certPath],
	});

	const { code, stderr } = await process.output();
	if (code !== 0) {
		const error = new TextDecoder().decode(stderr);
		throw new Error(`Failed to add certificate to trust store: ${error}`);
	}
}

// Add CA certificate to Linux trust store
async function addToLinuxTrustStore(certPath: string): Promise<void> {
	// Determine the Linux distribution and certificate location
	let certDir = '';
	let updateCommand = '';

	// Check for common Linux distributions
	if (await exists('/etc/debian_version')) {
		// Debian/Ubuntu
		certDir = '/usr/local/share/ca-certificates';
		updateCommand = 'update-ca-certificates';
	} else if (await exists('/etc/redhat-release')) {
		// RHEL/CentOS/Fedora
		certDir = '/etc/pki/ca-trust/source/anchors';
		updateCommand = 'update-ca-trust';
	} else {
		// Default to Debian-style if can't determine
		certDir = '/usr/local/share/ca-certificates';
		updateCommand = 'update-ca-certificates';
	}

	// Copy certificate to the system certificate directory
	const destPath = join(certDir, 'bb-ca.crt');
	const copyProcess = new Deno.Command('sudo', {
		args: ['cp', certPath, destPath],
	});

	const { code: copyCode, stderr: copyStderr } = await copyProcess.output();
	if (copyCode !== 0) {
		const error = new TextDecoder().decode(copyStderr);
		throw new Error(`Failed to copy certificate: ${error}`);
	}

	// Update the CA certificates
	const updateProcess = new Deno.Command('sudo', {
		args: [updateCommand],
	});

	const { code: updateCode, stderr: updateStderr } = await updateProcess.output();
	if (updateCode !== 0) {
		const error = new TextDecoder().decode(updateStderr);
		throw new Error(`Failed to update CA certificates: ${error}`);
	}
}

export const generateCertificateMkcert = async (domain: string = 'localhost', validityDays: number = 365) => {
	const certFile = join(globalDir, 'localhost.pem');
	const keyFile = join(globalDir, 'localhost-key.pem');
	const rootCaFile = join(globalDir, 'rootCA.pem');
	const rootCaKeyFile = join(globalDir, 'rootCA-key.pem');

	console.log('Creating CA certificate...');
	const ca = await createCA({
		organization: BB_CA_NAME,
		//commonName: BB_CA_NAME,
		countryCode: 'AU',
		state: 'NSW',
		locality: 'Sydney',
		validity: 3650, // 10 years
	});

	// Save CA files
	await Deno.writeTextFile(rootCaFile, ca.cert);
	await Deno.writeTextFile(rootCaKeyFile, ca.key);
	console.log('CA certificate and key created and saved');

	// Add CA to system trust store
	await addToSystemTrustStore();

	console.log('Creating server certificate...');
	const cert = await createCert({
		ca: { key: ca.key, cert: ca.cert },
		domains: [domain, '127.0.0.1', '::1'],
		validity: validityDays,
	});

	// Save server certificate files
	await Deno.writeTextFile(certFile, cert.cert);
	await Deno.writeTextFile(keyFile, cert.key);

	console.log('Server certificate created and saved');
};

export const generateCertificateMkcertCli = async (domain: string = 'localhost', validityDays: number = 365) => {
	const certFile = join(globalDir, 'localhost.pem');
	const keyFile = join(globalDir, 'localhost-key.pem');
	const rootCaFile = join(globalDir, 'rootCA.pem');
	const rootCaKeyFile = join(globalDir, 'rootCA-key.pem');

	const commandCaRoot = new Deno.Command('mkcert', {
		args: [
			'-install',
		],
	});
	const { code: codeCaRoot, stdout: stdoutCaRoot, stderr: stderrCaRoot } = await commandCaRoot.output();
	if (codeCaRoot !== 0) {
		console.error(new TextDecoder().decode(stderrCaRoot));
		throw new Error('Certificate root generation failed');
	}
	console.log(new TextDecoder().decode(stdoutCaRoot));

	// Get the CAROOT directory
	const commandCaRootDir = new Deno.Command('mkcert', {
		args: [
			'-CAROOT',
		],
	});
	const { code: codeRootDir, stdout: stdoutRootDir } = await commandCaRootDir.output();
	if (codeRootDir !== 0) {
		throw new Error('Failed to get CAROOT directory');
	}
	const caRootDir = new TextDecoder().decode(stdoutRootDir).trim();

	// Copy rootCA.pem to the specified rootCaFile path
	const sourceRootCaFile = join(caRootDir, 'rootCA.pem');
	const sourceRootCaKeyFile = join(caRootDir, 'rootCA-key.pem');
	try {
		await copy(sourceRootCaFile, rootCaFile);
		await copy(sourceRootCaKeyFile, rootCaKeyFile);
		// Root CA file copy log moved to try-catch block
	} catch (error) {
		console.error(`Failed to copy Root CA file: ${(error as Error).message}`);
		throw new Error('Failed to copy Root CA file');
	}

	const command = new Deno.Command('mkcert', {
		args: [
			'-cert-file',
			certFile,
			'-key-file',
			keyFile,
			domain,
		],
	});

	const { code, stdout, stderr } = await command.output();
	if (code !== 0) {
		console.error(new TextDecoder().decode(stderr));
		throw new Error('Certificate generation failed');
	}

	const stdoutText = new TextDecoder().decode(stdout);
	if (stdoutText.trim()) console.log(stdoutText);

	console.log(`Root CA file copied to ${rootCaFile}`);
};

export const generateCertificateOpenssl = async (domain: string = 'localhost', validityDays: number = 365) => {
	const certFile = join(globalDir, 'localhost.pem');
	const keyFile = join(globalDir, 'localhost-key.pem');
	const command = new Deno.Command('openssl', {
		args: [
			'req',
			'-x509',
			'-newkey',
			'rsa:4096',
			'-sha256',
			'-days',
			validityDays.toString(),
			'-nodes',
			'-keyout',
			keyFile,
			'-out',
			certFile,
			'-subj',
			`/CN=${domain}`,
			'-addext',
			`subjectAltName=DNS:${domain},DNS:www.${domain}`,
		],
	});

	const { code, stdout, stderr } = await command.output();
	if (code !== 0) {
		console.error(new TextDecoder().decode(stderr));
		throw new Error('Certificate generation failed');
	}

	const stdoutText = new TextDecoder().decode(stdout);
	if (stdoutText.trim()) console.log(stdoutText);
};
