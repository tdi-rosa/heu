import test from 'node:test';
import assert from 'node:assert/strict';
import { newToken } from '../shared/identity.ts';
test('LAN identity only requires getRandomValues, not secure-context randomUUID',()=>{
  const source={getRandomValues:crypto.getRandomValues.bind(crypto)};
  const a=newToken(source),b=newToken(source);
  assert.match(a,/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(a,b);
});
