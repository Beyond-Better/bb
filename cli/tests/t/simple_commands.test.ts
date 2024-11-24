import { assertEquals } from '@std/assert';
import { apiStatus } from '../../src/commands/apiStatus.ts';
import { init } from '../../src/commands/init.ts';
//import { Application } from 'https://deno.land/x/oak/mod.ts';
//import { superoak } from 'https://deno.land/x/superoak@4.7.0/mod.ts';

Deno.test('apiStatus command exists', () => {
	assertEquals(typeof apiStatus.parse, 'function');
});

Deno.test('init command exists', () => {
	assertEquals(typeof init.parse, 'function');
});
