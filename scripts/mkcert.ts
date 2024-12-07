#!deno run --allow-read --allow-write --allow-env --allow-run

import { generateCertificate } from 'shared/tlsCerts.ts';

const domain = 'localhost';
const validityDays = 365;

await generateCertificate(domain, validityDays);
