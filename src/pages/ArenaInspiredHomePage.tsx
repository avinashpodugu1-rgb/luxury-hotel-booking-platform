import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useHotel } from "../context/HotelContext";
import { galleryImages, heroImage, rooms as luxuryRooms } from "../data/hotelData";
import {
  bookingRecords,
  formatShortDate,
  getBlockForRoomDate,
  getBookingForRoomDate,
  getCalendarStatus,
  hasRoomConflict,
  isoDateAfter,
  maintenanceBlocks,
  pmsRooms,
  pmsRoomTypes,
  type CalendarStatus,
  type PMSRoom,
  type PMSRoomType,
} from "../data/operationsData";
import { cn } from "../utils/cn";

type SelectedCell = {
  room: PMSRoom;
  date: string;
  status: CalendarStatus;
};

const money = (value: number) => `INR ${Math.round(value).toLocaleString("en-IN")}`;

const arenaInput =
  "w-full rounded-2xl border border-[var(--arena-border)] bg-[var(--arena-surface-soft)] px-4 py-3 text-sm font-semibold text-[var(--arena-text)] outline-none placeholder:text-[var(--arena-muted)] focus:border-[var(--arena-accent)]";

const statusStyles: Record<CalendarStatus, string> = {
  available: "border-emerald-500/20 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  booked: "border-red-500/20 bg-red-500/12 text-red-700 dark:text-red-200",
  reserved: "border-blue-500/20 bg-blue-500/12 text-blue-700 dark:text-blue-200",
  maintenance: "border-amber-500/25 bg-amber-400/18 text-amber-700 dark:text-amber-200",
  "out-of-service": "border-slate-500/20 bg-slate-500/12 text-slate-700 dark:text-slate-200",
};

const publicStatusLabels: Record<CalendarStatus, string> = {
  available: "Available",
  booked: "Booked",
  reserved: "Reserved",
  maintenance: "Unavailable",
  "out-of-service": "Closed",
};

export default function ArenaInspiredHomePage() {
  const { theme, toggleTheme, user } = useHotel();
  const rooms = pmsRooms;
  const bookings = bookingRecords;
  const blocks = maintenanceBlocks;
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [checkIn, setCheckIn] = useState(isoDateAfter(1));
  const [checkOut, setCheckOut] = useState(isoDateAfter(3));
  const [guests, setGuests] = useState(2);
  const [roomType, setRoomType] = useState<PMSRoomType>("Deluxe");
  const [statusFilter, setStatusFilter] = useState<CalendarStatus | "All">("All");
  const [search, setSearch] = useState("");

  const dates = useMemo(() => Array.from({ length: 7 }, (_, index) => isoDateAfter(index)), []);

  const filteredRooms = rooms.filter((room) => {
    const status = getCalendarStatus(room, dates[0], bookings, blocks);
    const matchesSearch = [room.roomNumber, room.roomType, room.floor]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase());
    return matchesSearch && room.roomType === roomType && (statusFilter === "All" || status === statusFilter);
  });

  const kpis = useMemo(() => {
    const total = rooms.length;
    const booked = rooms.filter((room) => room.status === "booked").length;
    const reserved = rooms.filter((room) => room.status === "reserved").length;
    const blocked = blocks.filter((block) => block.status !== "Completed").length;
    const out = rooms.filter((room) => room.status === "out-of-service").length;
    return [
      ["Total Rooms", total],
      ["Available", Math.max(0, total - booked - reserved - blocked - out)],
      ["Booked", booked],
      ["Reserved", reserved],
      ["Unavailable", blocked],
      ["Closed", out],
    ];
  }, [rooms, blocks]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const findFirstAvailableRoom = () => {
    const room = rooms.find(
      (item) => item.roomType === roomType && !hasRoomConflict(item.roomNumber, checkIn, checkOut, bookings, blocks, rooms),
    );
    showToast(room ? `Room ${room.roomNumber} is available for your dates.` : "This room type is unavailable for the selected dates.");
  };

  return (
    <main className="arena-page min-h-screen text-[var(--arena-text)]">
      <section className="arena-hero-grid relative overflow-hidden px-4 py-10 text-white sm:px-6 lg:px-8">
        <motion.img
          src={heroImage}
          alt="SRI NIRVANA PLAZA luxury hotel exterior"
          initial={{ scale: 1.08 }}
          animate={{ scale: 1.02 }}
          transition={{ duration: 2.2, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/38 to-black/72" />
        <motion.div
          aria-hidden="true"
          animate={{ y: [0, -14, 0], opacity: [0.38, 0.52, 0.38] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
          className="absolute right-8 top-24 hidden h-48 w-48 rounded-full bg-[var(--arena-accent)]/30 blur-3xl lg:block"
        />
        <div className="relative z-10 mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <motion.p initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }} className="text-xs font-black uppercase tracking-[0.36em] text-[#f1c18a]">Room Availability Calendar</motion.p>
              <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.65 }} className="mt-3 text-4xl font-black tracking-tight text-balance sm:text-6xl xl:text-7xl">
                SRI NIRVANA PLAZA
              </motion.h1>
              <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.65 }} className="mt-4 max-w-3xl text-base leading-7 text-white/78 sm:text-lg">
                A premium public room availability experience where guests can check dates first, then sign in as a customer or admin from one secure entry point.
              </motion.p>
            </div>
            <div className="flex w-full flex-wrap gap-3 sm:w-auto">
              <button type="button" onClick={toggleTheme} className="min-w-0 flex-1 rounded-full border border-white/20 bg-white/15 px-5 py-3 text-sm font-black text-white backdrop-blur-2xl sm:flex-none">
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </button>
              <div className="relative min-w-0 flex-1 sm:flex-none">
                {user ? (
                  <Link to="/profile" className="block rounded-full bg-[var(--arena-accent)] px-5 py-3 text-center text-sm font-black text-white shadow-xl shadow-[rgba(173,124,79,0.24)]">
                    Profile
                  </Link>
                ) : (
                  <button type="button" onClick={() => setSignInOpen((current) => !current)} className="w-full rounded-full bg-[var(--arena-accent)] px-5 py-3 text-sm font-black text-white shadow-xl shadow-[rgba(173,124,79,0.24)]">
                    Sign in
                  </button>
                )}
                <AnimatePresence>
                  {signInOpen && !user ? (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.98 }}
                      className="absolute right-0 top-[calc(100%+10px)] z-30 w-[min(16rem,calc(100vw-2rem))] rounded-[1.5rem] border border-white/20 bg-white/92 p-3 text-slate-950 shadow-2xl backdrop-blur-2xl"
                    >
                      <Link to="/customer-login" className="block rounded-2xl px-4 py-3 text-sm font-black hover:bg-slate-950/5">Customer login</Link>
                      <Link to="/admin-login" className="mt-1 block rounded-2xl px-4 py-3 text-sm font-black hover:bg-slate-950/5">Admin login</Link>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55 }}
            className="mt-10 rounded-[2rem] border border-white/20 bg-white/88 p-3 text-slate-950 shadow-[0_30px_100px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-5"
          >
            <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_0.8fr_auto] lg:items-end">
              <Field label="Check-in"><input type="date" value={checkIn} onChange={(event) => setCheckIn(event.target.value)} className={arenaInput} /></Field>
              <Field label="Check-out"><input type="date" value={checkOut} min={checkIn} onChange={(event) => setCheckOut(event.target.value)} className={arenaInput} /></Field>
              <Field label="Room Type"><select value={roomType} onChange={(event) => setRoomType(event.target.value as PMSRoomType)} className={arenaInput}>{pmsRoomTypes.map((type) => <option key={type}>{type}</option>)}</select></Field>
              <Field label="Guests">
                <div className="flex items-center justify-between rounded-2xl border border-[var(--arena-border)] bg-[var(--arena-surface-soft)] p-2">
                  <button type="button" onClick={() => setGuests((value) => Math.max(1, value - 1))} className="grid h-10 w-10 place-items-center rounded-full bg-[var(--arena-surface-strong)] text-lg font-black">-</button>
                  <span className="text-lg font-black">{guests}</span>
                  <button type="button" onClick={() => setGuests((value) => value + 1)} className="grid h-10 w-10 place-items-center rounded-full bg-[var(--arena-surface-strong)] text-lg font-black">+</button>
                </div>
              </Field>
              <button type="button" onClick={findFirstAvailableRoom} className="rounded-2xl bg-[var(--arena-accent)] px-6 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-[rgba(173,124,79,0.24)]">
                Check Availability
              </button>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 22 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.65 }} className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {kpis.map(([label, value]) => (
              <motion.div key={label} whileHover={{ y: -4, scale: 1.01 }} className="rounded-[1.6rem] border border-white/16 bg-white/14 p-5 shadow-xl backdrop-blur-2xl">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#f1c18a]">{label}</p>
                <p className="mt-3 text-3xl font-black">{value}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[1fr_0.8fr_0.8fr]">
          {[galleryImages[1], galleryImages[3], { label: luxuryRooms[7].title, src: luxuryRooms[7].images[0] }].map((image, index) => (
            <motion.figure
              key={image.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.08, duration: 0.55 }}
              className="group relative h-72 overflow-hidden rounded-[2rem] shadow-[var(--arena-shadow)] lg:first:h-96"
            >
              <img src={image.src} alt={image.label} className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <figcaption className="absolute bottom-5 left-5 text-xl font-black text-white">{image.label}</figcaption>
            </motion.figure>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[1.45fr_0.85fr] lg:px-8">
        <div className="space-y-6">
          <div className="arena-glass rounded-[2rem] p-5">
            <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr_1fr_1fr]">
              <input value={search} onChange={(event) => setSearch(event.target.value)} className={arenaInput} placeholder="Search room number, floor, room type" />
              <select value={roomType} onChange={(event) => setRoomType(event.target.value as PMSRoomType)} className={arenaInput}>{pmsRoomTypes.map((type) => <option key={type}>{type}</option>)}</select>
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as CalendarStatus | "All")} className={arenaInput}>
                <option value="All">All Status</option>
                {Object.entries(publicStatusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
              <Link to="/rooms" className="rounded-2xl border border-[var(--arena-border)] bg-[var(--arena-surface-soft)] px-5 py-3 text-center text-sm font-black">
                Browse Rooms
              </Link>
            </div>
          </div>

          <div className="arena-glass overflow-hidden rounded-[2rem]">
            <div className="border-b border-[var(--arena-border)] p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.32em] text-[var(--arena-accent-strong)]">7 Day Room Timeline</p>
                  <h2 className="mt-2 text-2xl font-black sm:text-3xl">Date-wise room availability</h2>
                </div>
                <StatusLegend />
              </div>
            </div>
            <div className="space-y-4 p-4 lg:hidden">
              {filteredRooms.length ? filteredRooms.map((room) => (
                <motion.article key={room.id} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="rounded-[1.5rem] border border-[var(--arena-border)] bg-[var(--arena-surface-soft)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black">Room {room.roomNumber}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--arena-muted)]">{room.roomType} - {room.floor} - Maximum Occupancy: {room.capacity} guests</p>
                    </div>
                    <p className="rounded-full bg-[var(--arena-surface-strong)] px-3 py-1 text-xs font-black text-[var(--arena-accent-strong)]">{money(room.price)}</p>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {dates.map((date) => {
                      const status = getCalendarStatus(room, date, bookings, blocks);
                      return (
                        <button
                          key={`${room.id}-mobile-${date}`}
                          type="button"
                          onClick={() => setSelectedCell({ room, date, status })}
                          className={cn("rounded-2xl border px-3 py-3 text-left text-[11px] font-black", statusStyles[status])}
                        >
                          <span className="block uppercase tracking-[0.16em]">{new Date(date).toLocaleDateString("en-IN", { weekday: "short" })}</span>
                          <span className="mt-1 block text-sm">{formatShortDate(date)}</span>
                          <span className="mt-1 block">{publicStatusLabels[status]}</span>
                        </button>
                      );
                    })}
                  </div>
                </motion.article>
              )) : <div className="rounded-2xl bg-[var(--arena-surface-soft)] p-8 text-center text-sm font-bold text-[var(--arena-muted)]">No rooms match the selected filters.</div>}
            </div>
            <div className="premium-scrollbar hidden overflow-auto lg:block">
              <div className="min-w-[980px]">
                <div className="grid bg-[var(--arena-surface-soft)]" style={{ gridTemplateColumns: `240px repeat(${dates.length}, minmax(105px, 1fr))` }}>
                  <div className="p-4 text-xs font-black uppercase tracking-[0.2em] text-[var(--arena-muted)]">Room</div>
                  {dates.map((date) => (
                    <div key={date} className="border-l border-[var(--arena-border)] p-4 text-center">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[var(--arena-accent-strong)]">{new Date(date).toLocaleDateString("en-IN", { weekday: "short" })}</p>
                      <p className="mt-1 text-sm font-black">{formatShortDate(date)}</p>
                    </div>
                  ))}
                </div>
                {filteredRooms.length ? filteredRooms.map((room) => (
                  <div key={room.id} className="grid border-t border-[var(--arena-border)]" style={{ gridTemplateColumns: `240px repeat(${dates.length}, minmax(105px, 1fr))` }}>
                    <div className="p-4">
                      <p className="text-lg font-black">Room {room.roomNumber}</p>
                      <p className="mt-1 text-xs font-semibold text-[var(--arena-muted)]">{room.roomType} - {room.floor} - Maximum Occupancy: {room.capacity} guests</p>
                      <p className="mt-1 text-xs font-black text-[var(--arena-accent-strong)]">{money(room.price)}</p>
                    </div>
                    {dates.map((date) => {
                      const status = getCalendarStatus(room, date, bookings, blocks);
                      const block = getBlockForRoomDate(room.roomNumber, date, blocks);
                      const booking = getBookingForRoomDate(room.roomNumber, date, bookings);
                      const guestsBooked = booking?.guests ?? 0;
                      const tooltip = [
                        `Room Number: ${room.roomNumber}`,
                        `Date: ${date}`,
                        `Room Type: ${room.roomType}`,
                        `Maximum Occupancy: ${room.capacity}`,
                        booking ? `Guests Booked: ${guestsBooked}` : "Guests Booked: 0",
                        booking ? `Available Capacity: ${Math.max(0, room.capacity - guestsBooked)}` : `Available Capacity: ${room.capacity}`,
                        `Booking Status: ${booking?.status ?? publicStatusLabels[status]}`,
                        `Price: ${money(room.price)}`,
                        `Status: ${publicStatusLabels[status]}`,
                        block ? "Note: Unavailable for public booking" : "",
                        booking ? `Guest: ${booking.guestName}` : "",
                      ].filter(Boolean).join("\n");
                      return (
                        <button
                          key={`${room.id}-${date}`}
                          type="button"
                          title={tooltip}
                          onClick={() => setSelectedCell({ room, date, status })}
                          className={cn("m-2 rounded-2xl border px-2 py-4 text-center text-[11px] font-black transition hover:scale-105", statusStyles[status])}
                        >
                          {publicStatusLabels[status]}
                        </button>
                      );
                    })}
                  </div>
                )) : <div className="p-10 text-center text-sm font-bold text-[var(--arena-muted)]">No rooms match the selected filters.</div>}
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <PublicInfoPanel title="How booking works" items={["Check date-wise room availability first.", "Sign in as a customer before reserving a room.", "Complete payment and download your invoice PDF instantly."]} />
          <PublicInfoPanel title="Guest access" items={["Customer login is for room booking, wishlist, profile, and invoices.", "Admin login is only for hotel operations inside the admin portal.", "Operational actions are hidden from the public availability page."]} />
          <div className="arena-glass rounded-[2rem] p-5">
            <h2 className="text-xl font-black">Ready to reserve?</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-[var(--arena-muted)]">Choose a room from the availability calendar, then sign in to continue with the secure booking flow.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <Link to="/customer-login" className="rounded-2xl bg-[var(--arena-accent)] px-5 py-3 text-center text-sm font-black text-white">Customer login</Link>
              <Link to="/admin-login" className="rounded-2xl border border-[var(--arena-border)] bg-[var(--arena-surface-soft)] px-5 py-3 text-center text-sm font-black">Admin login</Link>
            </div>
          </div>
        </aside>
      </section>

      <AnimatePresence>
        {selectedCell ? (
          <ArenaCellModal
            cell={selectedCell}
            bookings={bookings}
            blocks={blocks}
            onClose={() => setSelectedCell(null)}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {toast ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border border-[var(--arena-border)] bg-[var(--arena-surface-strong)] px-5 py-4 text-sm font-black text-[var(--arena-text)] shadow-xl">
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.24em] text-[var(--arena-accent-strong)]">{label}</span>
      {children}
    </label>
  );
}

function StatusLegend() {
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(publicStatusLabels).map(([status, label]) => (
        <span key={status} className={cn("rounded-full border px-3 py-1 text-[10px] font-black", statusStyles[status as CalendarStatus])}>{label}</span>
      ))}
    </div>
  );
}

function PublicInfoPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="arena-glass rounded-[2rem] p-5">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-4 space-y-3">
        {items.map((item) => <p key={item} className="rounded-2xl bg-[var(--arena-surface-soft)] p-4 text-sm font-semibold leading-6 text-[var(--arena-muted)]">{item}</p>)}
      </div>
    </div>
  );
}

function ArenaCellModal({ cell, bookings, blocks, onClose }: { cell: SelectedCell; bookings: typeof bookingRecords; blocks: typeof maintenanceBlocks; onClose: () => void }) {
  const block = getBlockForRoomDate(cell.room.roomNumber, cell.date, blocks);
  const booking = getBookingForRoomDate(cell.room.roomNumber, cell.date, bookings);
  const publicRoom = luxuryRooms.find((room) => room.number === cell.room.roomNumber);
  const roomLink = publicRoom ? `/room/${publicRoom.id}` : "/rooms";
  const canBook = cell.status === "available";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <motion.div initial={{ y: 24, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: 0.98 }} className="arena-glass w-full max-w-xl rounded-[2rem] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.32em] text-[var(--arena-accent-strong)]">Room availability</p>
            <h2 className="mt-2 text-2xl font-black">Room {cell.room.roomNumber} - {formatShortDate(cell.date)}</h2>
            <p className="mt-2 text-sm font-semibold text-[var(--arena-muted)]">{cell.room.roomType} - {money(cell.room.price)} - {publicStatusLabels[cell.status]}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-[var(--arena-surface-soft)] px-4 py-2 text-sm font-black">Close</button>
        </div>
        {block ? (
          <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-400/15 p-4 text-sm font-semibold text-amber-700 dark:text-amber-200">
            <p className="font-black">Unavailable on this date</p>
            <p className="mt-1">Please select another date or room type for booking.</p>
          </div>
        ) : null}
        {booking ? (
          <div className="mt-5 rounded-2xl border border-blue-500/25 bg-blue-500/10 p-4 text-sm font-semibold text-blue-700 dark:text-blue-200">
            This date is already reserved or booked. Please choose another available date or room type.
          </div>
        ) : null}
        <div className="mt-5 rounded-2xl border border-[var(--arena-border)] bg-[var(--arena-surface-soft)] p-4 text-sm font-semibold leading-6 text-[var(--arena-muted)]">
          {canBook
            ? "This room is available for the selected date. Sign in as a customer to continue with booking."
            : "This room is not available for public booking on the selected date."}
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link to={roomLink} className="rounded-2xl bg-[var(--arena-accent)] px-4 py-3 text-center text-sm font-black text-white">
            View room details
          </Link>
          <Link to={`/customer-login?redirect=${encodeURIComponent(roomLink)}&reason=booking`} className="rounded-2xl border border-[var(--arena-border)] bg-[var(--arena-surface-soft)] px-4 py-3 text-center text-sm font-black">
            Sign in to book
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}