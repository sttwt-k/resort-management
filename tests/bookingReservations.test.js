import test from 'node:test';
import assert from 'node:assert/strict';
import { reservedDates } from '../server/bookingCore.js';

test('reserves every occupied night but not checkout day', () => {
  assert.deepEqual(reservedDates({
    roomId: '1', status: 'booked', checkInDate: '2026-09-28', checkOutDate: '2026-10-01',
  }), ['2026-09-28', '2026-09-29', '2026-09-30']);
});

test('temporary same-day stay holds the room until checkout', () => {
  assert.deepEqual(reservedDates({
    roomId: '1', status: 'temporary', checkInDate: '2026-09-28', checkOutDate: '2026-09-28',
  }), ['2026-09-28']);
});

test('cancelled and checked-out bookings release their nights', () => {
  for (const status of ['cancelled', 'checked-out']) {
    assert.deepEqual(reservedDates({
      roomId: '1', status, checkInDate: '2026-09-28', checkOutDate: '2026-09-30',
    }), []);
  }
});
