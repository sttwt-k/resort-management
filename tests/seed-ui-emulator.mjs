/* global process */
import { randomInt } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (process.env.FIREBASE_PROJECT_ID !== 'demo-resort' || !process.env.FIRESTORE_EMULATOR_HOST ||
    !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error('Seed script requires demo-resort Auth and Firestore emulators');
}

const ownerUid = 'UuSyhl057OdUcvznOgsrq1lHhct2';
const app = initializeApp({ projectId: 'demo-resort' });
const password = String(randomInt(100000, 1000000));
await getAuth(app).createUser({ uid: ownerUid, email: 'owner@janchpa.internal', password });

const db = getFirestore(app);
const data = db.collection('artifacts').doc('my-resort-app-v1').collection('public').doc('data');
const date = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());
const dayAfter = days => new Date(Date.parse(`${date}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

await Promise.all([
  ...['1', '2', '3'].map(id => data.collection('rooms').doc(id).set({
    id, name: `Demo room ${id}`, type: 'Demo', price: 500, cleaningStatus: 'clean',
  })),
  data.collection('bookings').doc('later-night').set({
    roomId: '2', roomName: 'Demo room 2', status: 'booked', guestName: 'Demo reservation',
    checkInDate: dayAfter(1), checkOutDate: dayAfter(2), nights: 1,
    roomPrice: 500, totalPrice: 500, deposit: 0, updatedAt: new Date(),
  }),
  data.collection('expenses').doc('owner-only').set({
    title: 'Demo owner expense', amount: 123, date, category: 'Demo', createdAt: new Date(),
  }),
]);

process.stdout.write(`DEMO_OWNER_PASSWORD=${password}\nDEMO_TODAY=${date}\n`);
