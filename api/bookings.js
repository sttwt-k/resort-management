import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getAdminApp } from '../server/firebaseAdmin.js';
import {
  applyBookingMutations, BookingConflictError, BookingForbiddenError, BookingInputError, hydrate,
} from '../server/bookingCore.js';

const appId = 'my-resort-app-v1';
const ownerUid = 'UuSyhl057OdUcvznOgsrq1lHhct2';

const reply = (body, status) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request) {
  if (Number(request.headers.get('content-length') || 0) > 100000) return reply({ error: 'Request too large' }, 413);
  const bearer = request.headers.get('authorization')?.match(/^Bearer (.+)$/);
  if (!bearer) return reply({ error: 'Authentication required' }, 401);
  try {
    const app = getAdminApp();
    const decoded = await getAuth(app).verifyIdToken(bearer[1]);
    const body = await request.json();
    if (!Array.isArray(body?.mutations) || body.mutations.some(mutation => !mutation || typeof mutation !== 'object')) {
      throw new BookingInputError('Expected booking changes');
    }
    const mutations = body.mutations.map(mutation => ({
      ...mutation, data: hydrate(mutation.data, Timestamp),
    }));
    const ids = await applyBookingMutations({
      db: getFirestore(app), uid: decoded.uid, ownerUid, appId, mutations,
    });
    return reply({ ids }, 200);
  } catch (error) {
    if (error instanceof BookingConflictError) return reply({ error: 'Booking changed or room unavailable' }, 409);
    if (error instanceof BookingForbiddenError) return reply({ error: error.message }, 403);
    if (error instanceof BookingInputError || error instanceof SyntaxError) return reply({ error: error.message }, 400);
    if (error.code?.startsWith('auth/')) return reply({ error: 'Authentication required' }, 401);
    console.error('Booking API failed:', error.code || error.name);
    return reply({ error: 'Booking service unavailable' }, 500);
  }
}
