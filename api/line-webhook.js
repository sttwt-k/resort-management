/* global process */
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { getAdminApp } from '../server/firebaseAdmin.js';
import { pairingFromEvent, pairingHash, verifyLineSignature } from '../server/lineGroup.js';

const appId = 'my-resort-app-v1';
const reply = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request) {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret) return reply({ error: 'Webhook not configured' }, 503);
  const raw = await request.text();
  if (raw.length > 100000 || !verifyLineSignature(raw, request.headers.get('x-line-signature'), secret)) {
    return reply({ error: 'Invalid LINE signature' }, 401);
  }
  let payload;
  try { payload = JSON.parse(raw); } catch { return reply({ error: 'Invalid webhook' }, 400); }
  if (!Array.isArray(payload.events)) return reply({ error: 'Invalid webhook' }, 400);
  const settings = getFirestore(getAdminApp()).collection('artifacts').doc(appId)
    .collection('private').doc('lineGroup');
  try {
    for (const event of payload.events) {
      const pairing = pairingFromEvent(event);
      if (!pairing || !/^C[0-9a-f]{32}$/i.test(pairing.groupId)) continue;
      await getFirestore(getAdminApp()).runTransaction(async transaction => {
        const snapshot = await transaction.get(settings);
        const current = snapshot.data() || {};
        if (!current.pairingHash || current.pairingExpiresAt < Date.now() ||
            current.pairingHash !== pairingHash(pairing.code)) return;
        transaction.set(settings, {
          groupId: pairing.groupId, pairedAt: new Date(),
          pairingHash: FieldValue.delete(), pairingExpiresAt: FieldValue.delete(),
        }, { merge: true });
      });
    }
    return reply({ ok: true }, 200);
  } catch {
    return reply({ error: 'Could not process webhook' }, 500);
  }
}
