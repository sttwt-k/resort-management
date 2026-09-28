/* global process */
import assert from 'node:assert/strict';
import { initializeApp as initializeAdmin } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getFirestore as getClientFirestore, setDoc } from 'firebase/firestore';
import { applyBookingMutations, BookingConflictError } from '../server/bookingCore.js';
import { POST } from '../api/bookings.js';

const projectId = 'demo-resort';
const appId = 'my-resort-app-v1';
const ownerUid = 'owner';
const admin = initializeAdmin({ projectId });
const db = getFirestore(admin);
const bookings = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('bookings');
const rooms = db.collection('artifacts').doc(appId).collection('public').doc('data').collection('rooms');
const booking = (roomId, start, end, status = 'booked') => ({
  roomId, status, roomName: `Room ${roomId}`, guestName: 'Test guest',
  checkInDate: start, checkOutDate: end, roomPrice: 500, totalPrice: 1000, deposit: 0,
});
const create = (id, data) => ({ mode: 'create', id, data });
const expected = data => ({
  status: data.status, roomId: data.roomId, checkInDate: data.checkInDate,
  checkOutDate: data.checkOutDate, updatedAt: data.updatedAt?.toMillis?.() ?? null,
});
const update = (id, data, patch) => ({ mode: 'update', id, data: patch, expected: expected(data) });
const commit = (mutations, uid = ownerUid) => applyBookingMutations({ db, uid, ownerUid, appId, mutations });
const bangkokDate = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

async function main() {
  const app = initializeApp({ apiKey: 'fake-key', projectId }, 'booking-test');
  const auth = getAuth(app);
  const clientDb = getClientFirestore(app);
  const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
  const [firestoreHost, firestorePort] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
  connectAuthEmulator(auth, `http://${authHost}`, { disableWarnings: true });
  connectFirestoreEmulator(clientDb, firestoreHost, Number(firestorePort));
  await signInAnonymously(auth);
  try {
    await Promise.all(Array.from({ length: 7 }, (_, index) =>
      rooms.doc(String(index + 1)).set({ name: `Room ${index + 1}`, price: 500 })));
    const staffWalkIn = {
      roomId: '4', status: 'occupied', guestName: 'Walk-in guest', phone: '0000000000',
      checkInDate: '2026-11-10', checkOutDate: '2026-11-12', paymentMethod: 'เงินสด',
      docNo: 'BK2611-001', checkInDocNo: 'RC2611-001', keyDepositCollected: true,
    };
    await assert.rejects(commit([create('staff-forged-money', { ...staffWalkIn, totalPrice: 1 })], 'anonymous-staff'),
      error => error.name === 'BookingForbiddenError', 'staff cannot submit a custom total');
    await assert.rejects(commit([create('staff-forged-receipt', { ...staffWalkIn, billPhotoUrl: 'https://example.com/receipt' })], 'anonymous-staff'),
      error => error.name === 'BookingInputError', 'staff receipt URL must use storage');
    await commit([create('staff-walk-in', staffWalkIn)], 'anonymous-staff');
    const staffSaved = (await bookings.doc('staff-walk-in').get()).data();
    assert.equal(staffSaved.roomPrice, 500);
    assert.equal(staffSaved.totalPrice, 1000);
    assert.equal(staffSaved.totalPaid, 1000);
    assert.equal(staffSaved.keyDeposit, 100);
    assert.equal(staffSaved.deposit, 0);
    await commit([create('staff-temp', {
      roomId: '5', status: 'temporary', guestName: 'Temporary guest',
      checkInDate: bangkokDate(new Date()), checkOutDate: bangkokDate(new Date(Date.now() + 3 * 3600000)), durationHours: 3,
      paymentMethod: 'เงินสด', docNo: 'TM2611-001', keyDepositCollected: false,
    })], 'anonymous-staff');
    assert.equal((await bookings.doc('staff-temp').get()).data().totalPrice, 500);
    const staffTemp = (await bookings.doc('staff-temp').get()).data();
    await assert.rejects(commit([update('staff-temp', staffTemp, { status: 'checked-out', keyDepositReturned: true, checkOutDate: '2020-01-01' })], 'anonymous-staff'),
      error => error.name === 'BookingForbiddenError', 'staff cannot forge checkout date');
    await commit([update('staff-temp', staffTemp, { status: 'checked-out', keyDepositReturned: true })], 'anonymous-staff');
    assert.equal((await bookings.doc('staff-temp').get()).data().checkOutDate, bangkokDate(new Date()));

    await commit([create('reserved-for-staff', booking('4', '2026-11-20', '2026-11-22'))]);
    const reserved = (await bookings.doc('reserved-for-staff').get()).data();
    await assert.rejects(commit([update('reserved-for-staff', reserved, { status: 'occupied', totalPaid: 1 })], 'anonymous-staff'),
      error => error.name === 'BookingForbiddenError', 'staff cannot submit a custom payment total');
    await assert.rejects(commit([update('reserved-for-staff', reserved, { status: 'occupied', paymentMethod: 'เงินสด', checkInTimeStr: '01:00' })], 'anonymous-staff'),
      error => error.name === 'BookingForbiddenError', 'staff cannot forge check-in time');
    await commit([update('reserved-for-staff', reserved, {
      status: 'occupied', keyDepositCollected: true, paymentMethod: 'เงินสด', checkInDocNo: 'RC2611-002',
    })], 'anonymous-staff');
    const checkedIn = (await bookings.doc('reserved-for-staff').get()).data();
    assert.equal(checkedIn.totalPaid, 1100);
    assert.equal(checkedIn.keyDeposit, 100);
    await assert.rejects(commit([update('reserved-for-staff', checkedIn, {
      status: 'checked-out', keyDepositReturned: true, checkOutTime: new Date('2020-01-01'),
    })], 'anonymous-staff'), error => error.name === 'BookingForbiddenError');
    const attempts = await Promise.allSettled([
      commit([create('concurrent-a', booking('1', '2026-10-01', '2026-10-03'))]),
      commit([create('concurrent-b', booking('1', '2026-10-02', '2026-10-04'))]),
    ]);
    assert.equal(attempts.filter(x => x.status === 'fulfilled').length, 1, 'one concurrent writer wins');
    assert.ok(attempts.some(x => x.reason instanceof BookingConflictError), 'other writer gets conflict');
    const winner = attempts[0].status === 'fulfilled' ? 'concurrent-a' : 'concurrent-b';
    const loser = winner === 'concurrent-a' ? 'concurrent-b' : 'concurrent-a';
    assert.equal((await bookings.doc(loser).get()).exists, false, 'failed writer creates no document');

    await assert.rejects(setDoc(doc(clientDb, 'artifacts', appId, 'public', 'data', 'bookings', 'direct'),
      booking('1', '2026-10-02', '2026-10-04')), error => error.code === 'permission-denied');

    const current = (await bookings.doc(winner).get()).data();
    await assert.rejects(commit([update(winner, current, { status: 'cancelled' })], 'anonymous-staff'),
      error => error.name === 'BookingForbiddenError', 'staff cannot cancel');
    await assert.rejects(commit([create('no-room', booking('999', '2026-10-02', '2026-10-04'))]),
      error => error.name === 'BookingInputError', 'bookings need a real room');
    await assert.rejects(commit([create('spoofed-id', { ...booking('4', '2026-10-02', '2026-10-04'), id: 'another' })]),
      error => error.name === 'BookingInputError', 'client cannot spoof a booking document ID');
    await commit([update(winner, current, { status: 'checked-out' })]);
    await commit([update(winner, (await bookings.doc(winner).get()).data(), { status: 'cancelled' })]);
    await assert.rejects(commit([update(winner, (await bookings.doc(winner).get()).data(), { note: 'tamper' })], 'anonymous-staff'),
      error => error.name === 'BookingForbiddenError', 'staff cannot change cancelled audit record');
    await commit([create(loser, booking('1', '2026-10-02', '2026-10-04'))]);

    await bookings.doc('legacy').set(booking('6', '2026-10-10', '2026-10-13'));
    await assert.rejects(commit([create('legacy-overlap', booking('6', '2026-10-12', '2026-10-14'))]),
      BookingConflictError, 'legacy booking blocks a new booking');
    await bookings.doc('orphan').set(booking('removed-room', '2026-10-10', '2026-10-13'));
    await commit([update('orphan', (await bookings.doc('orphan').get()).data(), { status: 'cancelled' })]);

    await assert.rejects(commit([
      create('group-free', booking('2', '2026-10-02', '2026-10-04')),
      create('group-conflict', booking('1', '2026-10-03', '2026-10-05')),
    ]), BookingConflictError, 'group conflict aborts all rooms');
    assert.equal((await bookings.doc('group-free').get()).exists, false);

    await commit([create('move', booking('2', '2026-10-02', '2026-10-04'))]);
    const oldMove = (await bookings.doc('move').get()).data();
    await commit([update('move', oldMove, { roomId: '3' })]);
    await assert.rejects(commit([update('move', oldMove, { roomId: '4' })]),
      BookingConflictError, 'stale room swap is rejected');
    await commit([create('reuse', booking('2', '2026-10-02', '2026-10-04'))]);

    await commit([create('temporary', booking('5', '2026-10-02', '2026-10-02', 'temporary'))]);
    await assert.rejects(commit([create('temp-conflict', booking('5', '2026-10-02', '2026-10-03'))]),
      BookingConflictError);
    const temp = (await bookings.doc('temporary').get()).data();
    await commit([update('temporary', temp, { status: 'checked-out' })]);
    await commit([create('temp-reuse', booking('5', '2026-10-02', '2026-10-03'))]);

    await commit([create('overnight-temp', booking('6', '2026-12-01', '2026-12-02', 'temporary'))]);
    await assert.rejects(commit([create('overnight-overlap', booking('6', '2026-12-02', '2026-12-03'))]),
      BookingConflictError, 'temporary guest blocks scheduled checkout day');

    const token = await auth.currentUser.getIdToken();
    const unauthorized = await POST(new Request('http://localhost/api/bookings', { method: 'POST' }));
    assert.equal(unauthorized.status, 401);
    const apiResponse = await POST(new Request('http://localhost/api/bookings', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mutations: [create('api-create', {
        ...staffWalkIn, roomId: '7', checkInDate: '2026-10-02', checkOutDate: '2026-10-03',
      })] }),
    }));
    assert.equal(apiResponse.status, 200, await apiResponse.text());
    assert.equal((await bookings.doc('api-create').get()).exists, true);
    const apiConflict = await POST(new Request('http://localhost/api/bookings', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ mutations: [create('api-overlap', {
        ...staffWalkIn, roomId: '7', checkInDate: '2026-10-02', checkOutDate: '2026-10-04',
      })] }),
    }));
    assert.equal(apiConflict.status, 409);
    process.stdout.write('PASS concurrent writers, rules, legacy conflicts, groups, stale swap, reuse, temporary, API auth\n');
  } finally {
    await deleteApp(app);
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
