import { useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, LayoutList, Moon } from 'lucide-react';
import { formatThaiDate } from '../lib/utils';

const DAY_MS = 86_400_000;
const DAYS_VISIBLE = 14;
const statusLabels = {
  booked: 'จองแล้ว',
  occupied: 'กำลังพัก',
  'checked-out': 'คืนห้องแล้ว',
  temporary: 'พักชั่วคราว',
};
const dayNumber = date => Date.parse(date + 'T00:00:00Z') / DAY_MS;
const dateAt = day => new Date(day * DAY_MS).toISOString().slice(0, 10);

function layoutBookings(bookings, firstDay, today) {
  const lastDay = firstDay + DAYS_VISIBLE;
  const rooms = new Map();

  for (const booking of bookings) {
    if (!Object.hasOwn(statusLabels, booking.status)) continue;
    const arrival = dayNumber(booking.checkInDate);
    const departure = dayNumber(booking.checkOutDate);
    if (!Number.isFinite(arrival) || !Number.isFinite(departure) || departure < arrival) continue;

    const start = arrival + 0.5;
    let end = departure + 0.5;
    if (booking.status === 'occupied' && departure <= today) end = today + 1;
    if (booking.status === 'temporary' && departure < today) end = today + 1;
    end = Math.max(end, start + 0.5);
    if (end <= firstDay || start >= lastDay) continue;

    if (!rooms.has(booking.roomId)) rooms.set(booking.roomId, []);
    rooms.get(booking.roomId).push({ booking, start, end, nights: Math.max(1, departure - arrival) });
  }

  for (const spans of rooms.values()) {
    spans.sort((a, b) => a.start - b.start || a.end - b.end);
    const laneEnds = [];
    for (const span of spans) {
      const freeLane = laneEnds.findIndex(end => end <= span.start);
      span.lane = freeLane < 0 ? laneEnds.length : freeLane;
      laneEnds[span.lane] = span.end;
    }
  }

  return rooms;
}

export function BookingTimeline({ rooms, bookings, startDate, today, onStartDateChange, onBookingClick }) {
  const scrollRef = useRef(null);
  const firstDay = dayNumber(startDate);
  const todayNumber = dayNumber(today);
  const days = Array.from({ length: DAYS_VISIBLE }, (_, index) => dateAt(firstDay + index));
  const spansByRoom = useMemo(() => layoutBookings(bookings, firstDay, todayNumber), [bookings, firstDay, todayNumber]);

  const changeDate = date => {
    if (!date || !Number.isFinite(dayNumber(date))) return;
    onStartDateChange(date);
    scrollRef.current?.scrollTo({ left: 0 });
  };

  return (
    <section className="min-w-0 space-y-3 animate-fade-in" aria-labelledby="booking-timeline-heading">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <h2 id="booking-timeline-heading" className="flex items-center gap-2 text-lg font-bold text-slate-800 sm:text-xl">
          <LayoutList size={20} className="text-emerald-600" /> ปฏิทินจองห้อง
        </h2>
        <div className="flex max-w-full items-center gap-1.5">
          <button type="button" aria-label="ย้อน 7 วัน" onClick={() => changeDate(dateAt(firstDay - 7))}
            className="grid h-10 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100">
            <ChevronLeft size={18} />
          </button>
          <input type="date" aria-label="วันเริ่มต้นไทม์ไลน์" value={startDate} onChange={event => changeDate(event.target.value)}
            className="h-10 min-w-0 rounded-lg border border-slate-200 px-2 text-sm font-semibold text-slate-700" />
          <button type="button" aria-label="ถัดไป 7 วัน" onClick={() => changeDate(dateAt(firstDay + 7))}
            className="grid h-10 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100">
            <ChevronRight size={18} />
          </button>
          <button type="button" onClick={() => changeDate(today)}
            className="h-10 shrink-0 rounded-lg bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
            วันนี้
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 px-1 text-xs font-medium text-slate-600">
        {Object.entries(statusLabels).map(([status, label]) => (
          <span key={status} className="flex items-center gap-1.5">
            <span aria-hidden="true" data-booking-status={status} className="timeline-status size-3.5 rounded border" />
            {label}
          </span>
        ))}
      </div>

      <div ref={scrollRef} tabIndex={0} role="region" aria-label="ไทม์ไลน์การจอง เลื่อนซ้ายขวาเพื่อดูวันอื่น"
        className="booking-timeline custom-scrollbar overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="timeline-calendar" style={{ '--timeline-days': DAYS_VISIBLE }}>
          <div className="timeline-row border-b border-slate-200">
            <div className="timeline-room flex items-center px-2.5 text-xs font-semibold text-slate-500">ห้องพัก</div>
            <div className="timeline-dates">
              {days.map(date => {
                const weekday = new Date(date + 'T00:00:00Z').getUTCDay();
                const isWeekend = weekday === 0 || weekday === 6;
                return (
                  <time key={date} dateTime={date} aria-current={date === today ? 'date' : undefined}
                    className={`flex flex-col items-center border-l border-slate-200 px-1 py-1.5 text-xs ${date === today ? 'bg-emerald-50 font-semibold text-emerald-800' : isWeekend ? 'text-red-600' : 'text-slate-500'}`}>
                    <span>{formatThaiDate(date, 'dayAbbr')}</span>
                    <span className="font-semibold">{formatThaiDate(date, 'dayNum')} {formatThaiDate(date, 'monthAbbr')}</span>
                  </time>
                );
              })}
            </div>
          </div>
          {rooms.map(room => {
            const spans = spansByRoom.get(room.id) ?? [];
            const laneCount = spans.reduce((count, span) => Math.max(count, span.lane + 1), 1);
            return (
              <div key={room.id} className="timeline-row border-b border-slate-200 last:border-b-0">
                <div className="timeline-room flex items-center px-2.5 text-xs font-semibold leading-tight text-slate-700">
                  {room.name}
                </div>
                <div className="relative" style={{ height: laneCount * 50 + 4 }}>
                  <div className="timeline-dates pointer-events-none absolute inset-0" aria-hidden="true">
                    {days.map(date => <div key={date} className={`border-l border-slate-200 ${date === today ? 'bg-emerald-50/60' : ''}`} />)}
                  </div>
                  {spans.map(({ booking, start, end, nights, lane }) => {
                    const left = Math.max(start - firstDay, 0);
                    const width = Math.min(end - firstDay, DAYS_VISIBLE) - left;
                    const guest = booking.guestName || 'ลูกค้า';
                    const stay = booking.status === 'temporary'
                      ? (booking.durationHours ? `${booking.durationHours} ชม.` : 'ชั่วคราว')
                      : `${nights} คืน`;
                    const description = `${guest} · ${room.name} · ${statusLabels[booking.status]} · ${stay}`;
                    return (
                      <button key={booking.id} type="button" title={description} aria-label={description}
                        data-booking-status={booking.status}
                        onClick={() => onBookingClick(room, booking)}
                        className="timeline-status timeline-booking absolute flex h-11 flex-col justify-center rounded-md border px-1.5 text-left leading-tight text-slate-900 hover:brightness-95 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
                        style={{ left: `calc(var(--timeline-day) * ${left} + 2px)`, width: `calc(var(--timeline-day) * ${width} - 4px)`, top: lane * 50 + 5 }}>
                        <span className="w-full truncate text-xs font-semibold">{guest}</span>
                        <span className="flex max-w-full items-center gap-0.5 text-[10px]">
                          {booking.status !== 'temporary' && <Moon size={10} aria-hidden="true" className="shrink-0" />}
                          <span className="truncate">{stay}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
