import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';
const source=ts.transpileModule(fs.readFileSync(new URL('../src/notificationLinks.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;const context={exports:{}};vm.runInNewContext(source,context);const parse=context.exports.notificationScreen;
test('push links route only to known groups and ride/booking details',()=>{assert.equal(parse('/chat?group=2').groupId,2);const id='12345678-1234-1234-1234-123456789abc';assert.equal(parse('/rides/'+id).kind,'ride');assert.equal(parse('/bookings/'+id).kind,'booking');});
test('push links reject external URLs, malformed IDs and unsafe routes',()=>{for(const link of ['https://evil.example/login','/chat?group=-1','/chat?group=0','/rides/not-a-uuid','/settings','javascript:alert(1)',null])assert.equal(parse(link),undefined);});
