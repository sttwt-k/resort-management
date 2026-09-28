import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { buildGroupSummary, pairingFromEvent, pushGroupSummary, validStaffUrl, verifyLineSignature } from '../server/lineGroup.js';

test('LINE webhook signature is checked against the raw body', () => {
  const body = '{"events":[]}';
  const secret = 'demo-only-secret';
  const signature = createHmac('sha256', secret).update(body).digest('base64');
  assert.equal(verifyLineSignature(body, signature, secret), true);
  assert.equal(verifyLineSignature(`${body} `, signature, secret), false);
  assert.equal(verifyLineSignature(body, 'bad', secret), false);
});

test('pairing accepts only an explicit group command', () => {
  const source = { type: 'group', groupId: `C${'a'.repeat(32)}` };
  assert.deepEqual(pairingFromEvent({ source, message: { type: 'text', text: '/เชื่อม A1B2C3D4' } }),
    { groupId: source.groupId, code: 'A1B2C3D4' });
  assert.equal(pairingFromEvent({ source: { type: 'user' }, message: { type: 'text', text: '/เชื่อม A1B2C3D4' } }), null);
  assert.equal(pairingFromEvent({ source, message: { type: 'text', text: 'hello' } }), null);
});

test('group summary contains only room availability and a safe staff URL', () => {
  const staffUrl = 'https://resort.example/?staff=1';
  const message = buildGroupSummary({
    date: '2026-09-28', staffUrl,
    rooms: [
      { id: '1', name: 'บ้าน 1', cleaningStatus: 'clean' },
      { id: '2', name: 'บ้าน 2', cleaningStatus: 'clean' },
      { id: '3', name: 'บ้าน 3', cleaningStatus: 'dirty' },
    ],
    bookings: [{ roomId: '2', status: 'occupied', checkInDate: '2026-09-27',
      checkOutDate: '2026-09-28', guestName: 'Private Guest', phone: '0999999999', totalPaid: 500 }],
  });
  assert.match(message, /พร้อมรับ 1 จาก 3 ห้อง/);
  assert.match(message, /บ้าน 1/);
  assert.doesNotMatch(message, /Private Guest|0999999999|500|บ้าน 2|บ้าน 3/);
  assert.ok(message.includes(staffUrl));
  assert.equal(validStaffUrl('http://127.0.0.1:5173/?staff=1'), false);
});

test('push request targets one group with a retry key and the prepared message', async () => {
  const groupId = `C${'a'.repeat(32)}`;
  let request;
  const response = await pushGroupSummary({ token: 'demo-token', groupId, message: 'safe summary',
    fetcher: async (url, options) => { request = { url, options }; return { ok: true }; } });
  assert.equal(response.ok, true);
  assert.equal(request.url, 'https://api.line.me/v2/bot/message/push');
  assert.equal(request.options.headers.Authorization, 'Bearer demo-token');
  assert.match(request.options.headers['X-Line-Retry-Key'], /^[0-9a-f-]{36}$/);
  assert.deepEqual(JSON.parse(request.options.body), { to: groupId,
    messages: [{ type: 'text', text: 'safe summary' }] });
});
