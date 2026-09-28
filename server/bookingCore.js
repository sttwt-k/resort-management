/* global process */
const ACTIVE_STATUSES = new Set(['booked', 'occupied', 'temporary']);
const MAX_NIGHTS = 365;
const STAFF_CREATE_FIELDS = new Set([
  'roomId', 'status', 'guestName', 'phone', 'checkInDate', 'checkOutDate', 'paymentMethod',
  'docNo', 'checkInDocNo', 'keyDepositCollected', 'isReceiptRequested', 'billPhotoUrl',
  'durationHours',
]);
const STAFF_CHECKIN_FIELDS = new Set([
  'status', 'checkInDocNo', 'keyDepositCollected',
  'paymentMethod', 'isReceiptRequested', 'billPhotoUrl',
]);
const STAFF_CHECKOUT_FIELDS = new Set(['status', 'keyDepositReturned']);
const STAFF_PAYMENT_METHODS = new Set(['เงินสด', 'เงินโอน']);
const bangkokParts = date => Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
}).formatToParts(date).map(part => [part.type, part.value]));
const bangkokDate = date => {
  const parts = bangkokParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const bangkokTime = date => {
  const parts = bangkokParts(date);
  return `${parts.hour}:${parts.minute}`;
};
const validReceiptUrl = value => value == null || (typeof value === 'string' && value.length <= 2048 &&
  (value.startsWith('https://firebasestorage.googleapis.com/v0/b/') ||
    (process.env.FIRESTORE_EMULATOR_HOST && /^http:\/\/127\.0\.0\.1:9199\/v0\/b\//.test(value))));
const validReceiptFields = value =>
  (value.checkInDocNo === undefined || (typeof value.checkInDocNo === 'string' && /^RC\d{4}-\d{3}$/.test(value.checkInDocNo))) &&
  (value.isReceiptRequested === undefined || typeof value.isReceiptRequested === 'boolean') &&
  validReceiptUrl(value.billPhotoUrl);

export class BookingConflictError extends Error {
  constructor() { super('Room or booking changed before the write completed'); this.name = 'BookingConflictError'; }
}
export class BookingInputError extends Error {
  constructor(message) { super(message); this.name = 'BookingInputError'; }
}
export class BookingForbiddenError extends Error {
  constructor() { super('This account cannot make that booking change'); this.name = 'BookingForbiddenError'; }
}

export function reservedDates(booking) {
  if (!booking?.roomId || !ACTIVE_STATUSES.has(booking.status)) return [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(booking.checkInDate) || !/^\d{4}-\d{2}-\d{2}$/.test(booking.checkOutDate)) {
    throw new BookingInputError('Invalid booking dates');
  }
  const start = Date.parse(`${booking.checkInDate}T00:00:00Z`);
  const end = Date.parse(`${booking.checkOutDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start ||
      new Date(start).toISOString().slice(0, 10) !== booking.checkInDate ||
      new Date(end).toISOString().slice(0, 10) !== booking.checkOutDate) {
    throw new BookingInputError('Invalid booking dates');
  }
  // A temporary guest still occupies the room on the scheduled checkout day.
  const days = Math.max(1, Math.ceil((end - start) / 86400000) + (booking.status === 'temporary' && end > start ? 1 : 0));
  if (days > MAX_NIGHTS) throw new BookingInputError('Stay is too long');
  return Array.from({ length: days }, (_, index) => new Date(start + index * 86400000).toISOString().slice(0, 10));
}

export function hydrate(value, Timestamp) {
  if (Array.isArray(value)) return value.map(item => hydrate(item, Timestamp));
  if (value && typeof value === 'object') {
    if (Object.keys(value).length === 1 && Number.isFinite(value.__timestampMillis)) {
      return Timestamp.fromMillis(value.__timestampMillis);
    }
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, hydrate(entry, Timestamp)]));
  }
  return value;
}

const timestampMillis = value => value && typeof value.toMillis === 'function' ? value.toMillis() : null;
const matchesExpected = (before, expected) => expected &&
  ['status', 'roomId', 'checkInDate', 'checkOutDate'].every(key => before[key] === expected[key]) &&
  timestampMillis(before.updatedAt) === expected.updatedAt;

function overlaps(first, second) {
  if (first.roomId !== second.roomId) return false;
  const dates = new Set(reservedDates(first));
  return reservedDates(second).some(date => dates.has(date));
}

function hasOnlyFields(value, allowed) {
  return Object.keys(value).every(key => allowed.has(key));
}

function staffUpdate(before, patch, uid) {
  if (before.status === 'booked' && patch.status === 'occupied' && hasOnlyFields(patch, STAFF_CHECKIN_FIELDS)) {
    const keyDeposit = patch.keyDepositCollected === true ? 100 : 0;
    const totalPrice = Number(before.totalPrice);
    const deposit = Number(before.deposit || 0);
    if (!Number.isFinite(totalPrice) || totalPrice < 0 || !Number.isFinite(deposit) ||
        deposit < 0 || deposit > totalPrice || !STAFF_PAYMENT_METHODS.has(patch.paymentMethod) ||
        !validReceiptFields(patch)) {
      throw new BookingInputError('Invalid booked-room payment');
    }
    const operational = { ...patch };
    delete operational.keyDepositCollected;
    const now = new Date();
    return { ...operational, keyDeposit, totalPaid: totalPrice - deposit + keyDeposit,
      checkInTime: now, checkInTimeStr: bangkokTime(now), updatedAt: now, updatedBy: uid };
  }
  if (['occupied', 'temporary'].includes(before.status) && patch.status === 'checked-out' &&
      patch.keyDepositReturned === true && hasOnlyFields(patch, STAFF_CHECKOUT_FIELDS)) {
    const now = new Date();
    return { ...patch, checkOutTime: now, checkOutTimeStr: bangkokTime(now),
      checkOutDate: bangkokDate(now), updatedAt: now, updatedBy: uid };
  }
  throw new BookingForbiddenError();
}

function staffCreate(input, room, uid) {
  if (!hasOnlyFields(input, STAFF_CREATE_FIELDS) || !['occupied', 'temporary'].includes(input.status) ||
      !STAFF_PAYMENT_METHODS.has(input.paymentMethod) || typeof input.guestName !== 'string' || !input.guestName.trim() ||
      (input.status === 'occupied' && (typeof input.phone !== 'string' || !input.phone.trim()))) {
    throw new BookingForbiddenError();
  }
  const roomPrice = Number(room.price);
  const nights = reservedDates(input).length;
  const now = new Date();
  const scheduledOut = new Date(now.getTime() + input.durationHours * 3600000);
  if (!Number.isFinite(roomPrice) || roomPrice < 0 || nights < 1 ||
      (input.status === 'temporary' && (![2, 3, 4, 6, 8].includes(input.durationHours) ||
        input.checkInDate !== bangkokDate(now) || input.checkOutDate !== bangkokDate(scheduledOut)))) {
    throw new BookingInputError('Invalid room price or stay');
  }
  if (typeof input.docNo !== 'string' || !/^(BK|TM)\d{4}-\d{3}$/.test(input.docNo) ||
      (input.status === 'temporary' && !input.docNo.startsWith('TM')) ||
      (input.status === 'occupied' && !input.docNo.startsWith('BK')) ||
      !validReceiptFields(input)) {
    throw new BookingInputError('Invalid booking document or receipt');
  }
  const totalPrice = input.status === 'temporary' ? roomPrice : roomPrice * nights;
  const { keyDepositCollected, ...operational } = input;
  return {
    ...operational, guestName: input.guestName.trim(), phone: input.phone?.trim() || '',
    roomName: room.name, roomPrice, nights: input.status === 'temporary' ? 0 : nights,
    totalPrice, totalPaid: totalPrice, deposit: 0, extraBedPrice: 0,
    keyDeposit: keyDepositCollected === true ? 100 : 0,
    checkInTime: now, checkInTimeStr: bangkokTime(now),
    ...(input.status === 'temporary' ? { scheduledCheckOutTimeStr: bangkokTime(scheduledOut) } : {}),
    createdAt: now, updatedAt: now, updatedBy: uid,
  };
}

export async function applyBookingMutations({ db, uid, ownerUid, appId, mutations }) {
  if (!uid) throw new BookingForbiddenError();
  if (!Array.isArray(mutations) || mutations.length < 1 || mutations.length > 20) {
    throw new BookingInputError('Expected 1 to 20 booking changes');
  }
  const ids = new Set();
  for (const mutation of mutations) {
    if (!mutation || !['create', 'update'].includes(mutation.mode) || !/^[A-Za-z0-9_-]{1,128}$/.test(mutation.id || '') ||
        !mutation.data || typeof mutation.data !== 'object' || Array.isArray(mutation.data) ||
        Object.hasOwn(mutation.data, 'id') || ids.has(mutation.id)) {
      throw new BookingInputError('Invalid booking change');
    }
    ids.add(mutation.id);
  }

  const data = db.collection('artifacts').doc(appId).collection('public').doc('data');
  const bookings = data.collection('bookings');
  const versions = data.collection('roomBookingVersions');
  return db.runTransaction(async transaction => {
    const changes = [];
    for (const mutation of mutations) {
      const ref = bookings.doc(mutation.id);
      const snapshot = await transaction.get(ref);
      if (mutation.mode === 'create' && snapshot.exists) throw new BookingConflictError();
      if (mutation.mode === 'update' && !snapshot.exists) throw new BookingConflictError();
      const before = snapshot.exists ? snapshot.data() : null;
      if (mutation.mode === 'update' && !matchesExpected(before, mutation.expected)) throw new BookingConflictError();
      let data = uid !== ownerUid && mutation.mode === 'update'
        ? staffUpdate(before, mutation.data, uid)
        : { ...mutation.data, updatedAt: new Date() };
      const after = { ...(before || {}), ...data };
      if (uid !== ownerUid && mutation.mode === 'create' &&
          (!hasOnlyFields(mutation.data, STAFF_CREATE_FIELDS) || !['occupied', 'temporary'].includes(after.status))) {
        throw new BookingForbiddenError();
      }
      if (mutation.mode === 'create' && !ACTIVE_STATUSES.has(after.status)) throw new BookingInputError('Invalid new booking status');
      if (typeof after.roomId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(after.roomId) ||
          !ACTIVE_STATUSES.has(after.status) && !['cancelled', 'checked-out'].includes(after.status)) {
        throw new BookingInputError('Invalid room or booking status');
      }
      reservedDates(after);
      changes.push({ mutation, ref, before, after, data });
    }

    const affectedRooms = [...new Set(changes.flatMap(change =>
      [change.before?.roomId, change.after.roomId].filter(Boolean)))].sort();
    const rooms = new Map();
    for (const roomId of new Set(changes.filter(change => ACTIVE_STATUSES.has(change.after.status)).map(change => change.after.roomId))) {
      const room = await transaction.get(data.collection('rooms').doc(roomId));
      if (!room.exists) {
        throw new BookingInputError('Room does not exist');
      }
      rooms.set(roomId, room.data());
    }
    for (const change of changes) {
      if (uid !== ownerUid && change.mutation.mode === 'create') {
        change.data = staffCreate(change.mutation.data, rooms.get(change.after.roomId), uid);
        change.after = change.data;
      }
    }
    const versionSnapshots = [];
    for (const roomId of affectedRooms) versionSnapshots.push(await transaction.get(versions.doc(roomId)));
    const existingByRoom = new Map();
    for (const roomId of affectedRooms) {
      const snapshot = await transaction.get(bookings.where('roomId', '==', roomId));
      existingByRoom.set(roomId, snapshot.docs.map(docSnapshot => ({ ...docSnapshot.data(), id: docSnapshot.id })));
    }

    for (const change of changes) {
      if (!ACTIVE_STATUSES.has(change.after.status)) continue;
      for (const other of existingByRoom.get(change.after.roomId) || []) {
        if (!ids.has(other.id) && overlaps(change.after, other)) throw new BookingConflictError();
      }
      for (const other of changes) {
        if (other === change || !ACTIVE_STATUSES.has(other.after.status)) continue;
        if (overlaps(change.after, other.after)) throw new BookingConflictError();
      }
    }

    changes.forEach(({ mutation, ref, data }) => {
      if (mutation.mode === 'create') transaction.create(ref, data);
      else transaction.update(ref, data);
    });
    affectedRooms.forEach((roomId, index) => {
      const snapshot = versionSnapshots[index];
      transaction.set(versions.doc(roomId), { version: (snapshot.data()?.version || 0) + 1 });
    });
    return changes.map(change => change.mutation.id);
  });
}
