/* global process */
import { randomBytes } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from '../server/firebaseAdmin.js';
import { bangkokDate, buildGroupSummary, pairingHash, pushGroupSummary, validStaffUrl } from '../server/lineGroup.js';

const appId = 'my-resort-app-v1';
const ownerUid = 'UuSyhl057OdUcvznOgsrq1lHhct2';
const reply = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const settingsRef = db => db.collection('artifacts').doc(appId).collection('private').doc('lineGroup');
const dataRef = db => db.collection('artifacts').doc(appId).collection('public').doc('data');

async function ownerDb(request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/)?.[1];
  if (!token) return { error: reply({ error: 'Authentication required' }, 401) };
  let app;
  try { app = getAdminApp(); }
  catch { return { error: reply({ error: 'Server credentials are not configured' }, 503) }; }
  try {
    const decoded = await getAuth(app).verifyIdToken(token);
    if (decoded.uid !== ownerUid) return { error: reply({ error: 'Owner access required' }, 403) };
    return { db: getFirestore(app) };
  } catch {
    return { error: reply({ error: 'Authentication required' }, 401) };
  }
}

async function summary(db) {
  const staffUrl = process.env.LINE_STAFF_URL;
  if (!validStaffUrl(staffUrl)) return null;
  const data = dataRef(db);
  const [rooms, bookings] = await Promise.all([
    data.collection('rooms').get(), data.collection('bookings').get(),
  ]);
  return buildGroupSummary({
    rooms: rooms.docs.map(doc => ({ id: doc.id, ...doc.data() })),
    bookings: bookings.docs.map(doc => doc.data()),
    date: bangkokDate(), staffUrl,
  });
}

export async function GET(request) {
  const { db, error } = await ownerDb(request);
  if (error) return error;
  try {
    const settings = (await settingsRef(db).get()).data() || {};
    return reply({
      linked: Boolean(settings.groupId), groupSuffix: settings.groupId?.slice(-6) || null,
      pairingReady: Boolean(process.env.LINE_CHANNEL_SECRET),
      sendingReady: Boolean(settings.groupId && process.env.LINE_CHANNEL_ACCESS_TOKEN &&
        validStaffUrl(process.env.LINE_STAFF_URL)),
      preview: await summary(db),
    }, 200);
  } catch {
    return reply({ error: 'LINE group status unavailable' }, 500);
  }
}

export async function POST(request) {
  const { db, error } = await ownerDb(request);
  if (error) return error;
  let body;
  try { body = await request.json(); } catch { return reply({ error: 'Invalid request' }, 400); }
  if (body?.action === 'start-pairing') {
    if (!process.env.LINE_CHANNEL_SECRET) return reply({ error: 'LINE channel secret is not configured' }, 503);
    const code = randomBytes(4).toString('hex').toUpperCase();
    try {
      await settingsRef(db).set({ pairingHash: pairingHash(code), pairingExpiresAt: Date.now() + 600000 }, { merge: true });
      return reply({ code, expiresInSeconds: 600 }, 200);
    } catch { return reply({ error: 'Could not create pairing code' }, 500); }
  }
  if (body?.action === 'send-summary') {
    if (!process.env.LINE_CHANNEL_ACCESS_TOKEN || !validStaffUrl(process.env.LINE_STAFF_URL)) {
      return reply({ error: 'LINE sending is not configured' }, 503);
    }
    if (process.env.FIRESTORE_EMULATOR_HOST) return reply({ error: 'Demo mode cannot send to LINE' }, 503);
    try {
      const settings = (await settingsRef(db).get()).data() || {};
      if (!settings.groupId) return reply({ error: 'Pair a LINE group first' }, 409);
      const message = await summary(db);
      const result = await pushGroupSummary({ token: process.env.LINE_CHANNEL_ACCESS_TOKEN,
        groupId: settings.groupId, message });
      if (!result.ok) return reply({ error: 'LINE did not accept the message' }, 502);
      try { await settingsRef(db).set({ lastSentAt: new Date() }, { merge: true }); }
      catch { /* LINE already accepted the message; do not invite a duplicate retry. */ }
      return reply({ sent: true }, 200);
    } catch {
      return reply({ error: 'LINE send failed; check the group before retrying' }, 502);
    }
  }
  return reply({ error: 'Unknown action' }, 400);
}
