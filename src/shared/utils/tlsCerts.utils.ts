import { join } from '@std/path';
import { copy } from '@std/fs';
import { exists } from '@std/fs';
//import { encodeBase64 } from '@std/encoding';
//import { crypto } from '@std/crypto/crypto';

import { getBbDir, getGlobalConfigDir, writeToGlobalConfigDir } from 'shared/dataDir.ts';

const globalDir = await getGlobalConfigDir();

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

export const certificateFileExists = async (certFileName: string = 'localhost.pem') => {
	//console.debug(`${YELLOW}Checking for certificate file '${certFileName}'${NC}`);
	const globalCertFile = join(globalDir, certFileName);
	const bbCertFile = join(await getBbDir(Deno.cwd()), certFileName) || '';
	//console.debug(`${YELLOW}Need to find either '${globalCertFile}' or '${bbCertFile}'${NC}`);
	return (bbCertFile ? await exists(bbCertFile) : false) || await exists(globalCertFile);
};

export const generateCertificate = async (
	domain: string = 'localhost',
	validityDays: number = 365,
): Promise<boolean> => {
	const mkcertAvailable = await isCommandAvailable('mkcert');
	const opensslAvailable = await isCommandAvailable('openssl');
	//console.debug(`mkcert available: ${mkcertAvailable}`);
	//console.debug(`openssl available: ${opensslAvailable}`);

	if (mkcertAvailable) {
		generateCertificateMkcert(domain, validityDays);
		console.error(`${GREEN}Cert created using 'mkcert' and saved to '${globalDir}'${NC}`);
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

export const generateCertificateMkcert = async (domain: string = 'localhost', validityDays: number = 365) => {
	const certFile = join(globalDir, 'localhost.pem');
	const keyFile = join(globalDir, 'localhost-key.pem');
	const rootCaFile = join(globalDir, 'rootCA.pem');

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
	try {
		await copy(sourceRootCaFile, rootCaFile);
		// Root CA file copy log moved to try-catch block
	} catch (error) {
		console.error(`Failed to copy Root CA file: ${error.message}`);
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

// certs created with generateCertificateManual trigger error with cert encoding when using with Deno.listen
/*
export const generateCertificateManual = async () => {
	const keys = await crypto.subtle.generateKey(
		{
			name: 'RSASSA-PKCS1-v1_5',
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: 'SHA-256',
		},
		true,
		['sign', 'verify'],
	);

	const now = new Date();
	const expirationDate = new Date(now.getTime() + validityDays * 24 * 60 * 60 * 1000);

	const cert = await createSelfSignedCert(keys, domain, now, expirationDate);
	const privateKey = await crypto.subtle.exportKey('pkcs8', keys.privateKey);

	await writeToGlobalConfigDir(
		'localhost.pem',
		`-----BEGIN CERTIFICATE-----\n${encodeBase64(cert)}\n-----END CERTIFICATE-----`,
	);
	await writeToGlobalConfigDir(
		'localhost-key.pem',
		`-----BEGIN PRIVATE KEY-----\n${encodeBase64(privateKey)}\n-----END PRIVATE KEY-----`,
	);
};

function encodeLength(length: number): Uint8Array {
	if (length < 128) return new Uint8Array([length]);
	const encodedLength = [];
	while (length > 0) {
		encodedLength.unshift(length & 0xff);
		length >>= 8;
	}
	return new Uint8Array([0x80 | encodedLength.length, ...encodedLength]);
}

function encodeInteger(int: number): Uint8Array {
	const bytes = [];
	while (int > 0) {
		bytes.unshift(int & 0xff);
		int >>= 8;
	}
	return new Uint8Array([0x02, bytes.length, ...bytes]);
}

function encodeOID(oid: string): Uint8Array {
	const parts = oid.split('.').map(Number);
	const bytes = [parts[0] * 40 + parts[1]];
	for (let i = 2; i < parts.length; i++) {
		let part = parts[i];
		if (part > 127) {
			const encodedPart = [];
			while (part > 0) {
				encodedPart.unshift(part & 0x7f);
				part >>= 7;
			}
			for (let j = 0; j < encodedPart.length - 1; j++) {
				bytes.push(encodedPart[j] | 0x80);
			}
			bytes.push(encodedPart[encodedPart.length - 1]);
		} else {
			bytes.push(part);
		}
	}
	return new Uint8Array([0x06, bytes.length, ...bytes]);
}

async function createSelfSignedCert(
	keys: CryptoKeyPair,
	domain: string,
	notBefore: Date,
	notAfter: Date,
): Promise<ArrayBuffer> {
	const tbsCertificate = new Uint8Array([
		0x30,
		0x82,
		0x00,
		0x00, // Sequence, length to be filled later
		...encodeInteger(2), // Version 3
		...encodeInteger(1), // Serial number
		0x30,
		0x0d, // Signature algorithm
		...encodeOID('1.2.840.113549.1.1.11'), // SHA256 with RSA encryption
		0x05,
		0x00, // Parameters (null)
		0x30,
		0x1a, // Issuer
		0x31,
		0x18, // RDNSequence
		0x30,
		0x16, // RelativeDistinguishedName
		0x06,
		0x03,
		...encodeOID('2.5.4.3'), // Common Name
		0x0c,
		0x0f,
		...new TextEncoder().encode(domain), // UTF8String
		0x30,
		0x1e, // Validity
		0x17,
		0x0d,
		...new TextEncoder().encode(notBefore.toUTCString()), // Not Before
		0x17,
		0x0d,
		...new TextEncoder().encode(notAfter.toUTCString()), // Not After
		// Subject (same as issuer for self-signed)
		0x30,
		0x1a, // Subject
		0x31,
		0x18, // RDNSequence
		0x30,
		0x16, // RelativeDistinguishedName
		0x06,
		0x03,
		...encodeOID('2.5.4.3'), // Common Name
		0x0c,
		0x0f,
		...new TextEncoder().encode(domain), // UTF8String
		// Subject Public Key Info
		0x30,
		0x82,
		0x00,
		0x00, // To be filled with actual public key
	]);

	// Sign the TBS certificate
	const signature = await crypto.subtle.sign(
		{ name: 'RSASSA-PKCS1-v1_5' },
		keys.privateKey,
		tbsCertificate,
	);

	const certificate = new Uint8Array([
		0x30,
		0x82,
		0x00,
		0x00, // Sequence, length to be filled later
		...tbsCertificate,
		0x30,
		0x0d, // Signature algorithm
		...encodeOID('1.2.840.113549.1.1.11'), // SHA256 with RSA encryption
		0x05,
		0x00, // Parameters (null)
		0x03,
		0x82,
		0x00,
		0x00, // Bit string, length to be filled
		0x00, // Unused bits
		...new Uint8Array(signature),
	]);

	// Fill in lengths
	const fillLength = (arr: Uint8Array, offset: number) => {
		const length = arr.length - offset - 4;
		arr[offset + 2] = (length >> 8) & 0xff;
		arr[offset + 3] = length & 0xff;
	};

	fillLength(certificate, 0);
	fillLength(tbsCertificate, 0);
	fillLength(certificate, certificate.length - signature.byteLength - 3);

	return certificate.buffer;
}
 */

// fails running under Deno
/*
import { createCA, createCert } from "mkcert";

const ca = await createCA({
  organization: "Beyond Better",
  countryCode: "AU",
  state: "NSW",
  locality: "Sydney",
  validity: 365
});

const cert = await createCert({
  ca: { key: ca.key, cert: ca.cert },
  domains: ["127.0.0.1", "localhost"],
  validity: 365
});

console.log(cert.key, cert.cert); // certificate info
console.log(`${cert.cert}${ca.cert}`); // create full chain certificate by merging CA and domain certificates
 */
