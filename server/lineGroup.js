/* global Buffer */
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const pairingHash = code => createHash('sha256').update(code).digest('hex');

export function verifyLineSignature(body, signature, secret) {
  if (!secret || typeof signature !== 'string') return false;
  const expected = createHmac('sha256', secret).update(body).digest();
  const received = Buffer.from(signature, 'base64');
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function validStaffUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.searchParams.get('staff') === '1' &&
      !url.username && !url.password && !url.hash;
  } catch { return false; }
}

export function bangkokDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const value = type => parts.find(part => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function buildGroupSummary({ rooms, bookings, date, staffUrl }) {
  if (!validStaffUrl(staffUrl) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('LINE staff URL or report date is invalid');
  }
  const ready = rooms.filter(room => room.cleaningStatus !== 'dirty' &&
    !bookings.some(booking => booking.roomId === room.id && booking.checkInDate <= date &&
      (booking.status === 'occupied' || booking.status === 'temporary' ||
        (booking.status === 'booked' && booking.checkOutDate > date))));
  const names = ready.map(room => String(room.name || room.id).replace(/\s+/g, ' ').trim().slice(0, 60))
    .sort((a, b) => a.localeCompare(b, 'th'));
  const [year, month, day] = date.split('-');
  const message = [
    `จันผารีสอร์ท · ห้องพร้อมรับ ${day}/${month}/${year}`,
    `พร้อมรับ ${ready.length} จาก ${rooms.length} ห้อง`,
    names.length ? names.join(', ') : 'ไม่มีห้องพร้อมรับ',
    `เปิดแอปพนักงาน: ${staffUrl}`,
  ].join('\n');
  if (message.length > 5000) throw new Error('LINE report is too long');
  return message;
}

export function pairingFromEvent(event) {
  if (event?.source?.type !== 'group' || typeof event.source.groupId !== 'string' ||
      event.message?.type !== 'text') return null;
  const match = event.message.text?.trim().match(/^\/เชื่อม\s+([0-9A-F]{8})$/i);
  return match ? { groupId: event.source.groupId, code: match[1].toUpperCase() } : null;
}

export async function pushGroupSummary({ token, groupId, message, fetcher = fetch }) {
  if (!token || !/^C[0-9a-f]{32}$/i.test(groupId) || typeof message !== 'string' ||
      !message || message.length > 5000) throw new Error('Invalid LINE send request');
  return fetcher('https://api.line.me/v2/bot/message/push', {
    method: 'POST', headers: {
      Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
      'X-Line-Retry-Key': randomUUID(),
    },
    body: JSON.stringify({ to: groupId, messages: [{ type: 'text', text: message }] }),
  });
}
