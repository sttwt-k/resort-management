/* global process */
import assert from 'node:assert/strict';
import { createHmac, randomInt } from 'node:crypto';
import { initializeApp as initializeAdmin } from 'firebase-admin/app';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously, signInWithEmailAndPassword } from 'firebase/auth';
import { GET, POST } from '../api/line-group.js';
import { POST as webhookPOST } from '../api/line-webhook.js';

if (process.env.FIREBASE_PROJECT_ID !== 'demo-resort' || !process.env.FIRESTORE_EMULATOR_HOST ||
    !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('demo-resort emulators required');
process.env.LINE_CHANNEL_SECRET = 'demo-only-line-secret';
process.env.LINE_CHANNEL_ACCESS_TOKEN = 'demo-only-token';
process.env.LINE_STAFF_URL = 'https://resort.example/?staff=1';

const admin = initializeAdmin({ projectId: 'demo-resort' });
const db = getFirestore(admin);
const ownerUid = 'UuSyhl057OdUcvznOgsrq1lHhct2';
const password = String(randomInt(100000, 1000000));
await getAdminAuth(admin).createUser({ uid: ownerUid, email: 'owner@janchpa.internal', password });
const data = db.collection('artifacts').doc('my-resort-app-v1').collection('public').doc('data');
await Promise.all([
  data.collection('rooms').doc('1').set({ name: 'Demo room 1', cleaningStatus: 'clean', price: 500 }),
  data.collection('rooms').doc('2').set({ name: 'Demo room 2', cleaningStatus: 'clean', price: 500 }),
]);
await data.collection('bookings').doc('private-guest').set({ roomId: '2', status: 'occupied',
  checkInDate: '2026-01-01', checkOutDate: '2026-01-02', guestName: 'Secret Guest', totalPaid: 500 });

const ownerApp = initializeApp({ apiKey: 'demo-key', projectId: 'demo-resort' }, 'line-owner');
const staffApp = initializeApp({ apiKey: 'demo-key', projectId: 'demo-resort' }, 'line-staff');
const ownerAuth = getAuth(ownerApp);
const staffAuth = getAuth(staffApp);
connectAuthEmulator(ownerAuth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
connectAuthEmulator(staffAuth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
try {
  await signInWithEmailAndPassword(ownerAuth, 'owner@janchpa.internal', password);
  await signInAnonymously(staffAuth);
  const request = async (token, method, action) => new Request('http://localhost/api/line-group', {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(action ? { body: JSON.stringify({ action }) } : {}),
  });
  const ownerToken = await ownerAuth.currentUser.getIdToken();
  const staffToken = await staffAuth.currentUser.getIdToken();
  assert.equal((await GET(await request(staffToken, 'GET'))).status, 403);
  assert.equal((await POST(await request(staffToken, 'POST', 'start-pairing'))).status, 403);
  const before = await (await GET(await request(ownerToken, 'GET'))).json();
  assert.equal(before.linked, false);
  assert.ok(before.preview.includes('Demo room 1'));
  assert.ok(!before.preview.includes('Secret Guest'));

  const pairing = await POST(await request(ownerToken, 'POST', 'start-pairing'));
  assert.equal(pairing.status, 200);
  const code = (await pairing.json()).code;
  const groupId = `C${'a'.repeat(32)}`;
  const body = JSON.stringify({ events: [{ source: { type: 'group', groupId },
    message: { type: 'text', text: `/เชื่อม ${code}` } }] });
  const signed = createHmac('sha256', process.env.LINE_CHANNEL_SECRET).update(body).digest('base64');
  assert.equal((await webhookPOST(new Request('http://localhost/api/line-webhook', {
    method: 'POST', headers: { 'x-line-signature': 'invalid' }, body,
  }))).status, 401);
  const wrongBody = body.replace(code, 'FFFFFFFF');
  const wrongSignature = createHmac('sha256', process.env.LINE_CHANNEL_SECRET).update(wrongBody).digest('base64');
  assert.equal((await webhookPOST(new Request('http://localhost/api/line-webhook', {
    method: 'POST', headers: { 'x-line-signature': wrongSignature }, body: wrongBody,
  }))).status, 200);
  assert.equal((await (await GET(await request(ownerToken, 'GET'))).json()).linked, false);
  assert.equal((await webhookPOST(new Request('http://localhost/api/line-webhook', {
    method: 'POST', headers: { 'x-line-signature': signed }, body,
  }))).status, 200);
  const after = await (await GET(await request(ownerToken, 'GET'))).json();
  assert.equal(after.linked, true);
  assert.equal(after.groupSuffix, groupId.slice(-6));
  assert.equal((await POST(await request(ownerToken, 'POST', 'send-summary'))).status, 503,
    'emulator must never send a real LINE message');
  process.stdout.write('PASS owner-only pairing, signed group webhook, private summary, emulator send guard\n');
} finally {
  await deleteApp(ownerApp);
  await deleteApp(staffApp);
}
