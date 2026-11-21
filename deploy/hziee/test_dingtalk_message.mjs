import assert from 'node:assert/strict';
import {test} from 'node:test';
import {dingTalkTemporaryCode} from '../../client/atrust/auth/dingtalk_message.mjs';

test('DingTalk temporary-code string is accepted only from the current QR window', () => {
  const source = {};
  assert.equal(dingTalkTemporaryCode({origin: 'https://login.dingtalk.com', source, data: 'temporary-code'}, source), 'temporary-code');
  for (const event of [
    {origin: 'https://other.example.com', source, data: 'temporary-code'},
    {origin: 'https://login.dingtalk.com', source: {}, data: 'temporary-code'},
    {origin: 'https://login.dingtalk.com', source, data: ''},
    {origin: 'https://login.dingtalk.com', source, data: {success: true}},
    {origin: 'https://login.dingtalk.com', source, data: 'code\n'},
    {origin: 'https://login.dingtalk.com', source, data: 'a'.repeat(4097)},
  ]) {
    assert.equal(dingTalkTemporaryCode(event, source), '');
  }
});
