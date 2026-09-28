import { getAuth } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';

export class BookingConflictError extends Error {
  constructor() {
    super('Room or booking changed before the write completed');
    this.name = 'BookingConflictError';
  }
}

function serialize(value) {
  if (value instanceof Timestamp) return { __timestampMillis: value.toMillis() };
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, serialize(entry)]));
  }
  return value;
}

export async function commitBookingMutations(_db, _appId, mutations) {
  if (!mutations.length) return;
  const user = getAuth().currentUser;
  if (!user) throw new Error('Sign in before changing a booking');
  const token = await user.getIdToken();
  const response = await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ mutations: mutations.map(({ mode, ref, data, expected }) => ({
      mode, id: ref.id, data: serialize(data), expected: serialize(expected),
    })) }),
  });
  if (response.ok) return;
  const result = await response.json().catch(() => ({}));
  if (response.status === 409) throw new BookingConflictError();
  throw new Error(result.error || `Booking service failed (${response.status})`);
}
