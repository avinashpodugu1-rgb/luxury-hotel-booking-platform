import { motion } from "framer-motion";
import { Link, useParams } from "react-router-dom";
import {
  actionHistoryRecords,
  bookingRecords,
  findOperationsRecord,
  notificationCenterItems,
} from "../data/operationsData";

const prettyLabel = (value: string) =>
  value
    .replace(/([A-Z])/g, " $1")
    .replace(/-/g, " ")
    .replace(/^./, (char) => char.toUpperCase());

const stringify = (value: unknown) => {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object" && value !== null) return JSON.stringify(value, null, 2);
  return String(value ?? "Not available");
};

export default function EnterpriseRecordDetailPage() {
  const { recordType, recordId } = useParams();
  const record =
    recordType === "notifications"
      ? notificationCenterItems.find((item) => item.id === recordId) ?? null
      : findOperationsRecord(recordType, recordId);

  if (!record) {
    return (
      <main className="min-h-screen bg-[#080705] px-4 py-16 text-[#fff6e8] sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/[0.07] p-8 text-center">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-[#d2aa6a]">Detail Page</p>
          <h1 className="mt-3 text-4xl font-black">Record not found</h1>
          <Link to="/admin" className="mt-6 inline-flex rounded-full bg-[#d2aa6a] px-5 py-3 text-sm font-black text-black">Back to admin</Link>
        </div>
      </main>
    );
  }

  const entries = Object.entries(record).filter(([key]) => key !== "id");
  const relatedBookings = bookingRecords.filter((booking) => stringify(record).includes(booking.assignedRoom) || stringify(record).includes(booking.guestName));

  return (
    <motion.main initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="min-h-screen bg-[#080705] px-4 py-12 text-[#fff6e8] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-[#d2aa6a]">Full Information</p>
            <h1 className="mt-3 text-4xl font-black md:text-6xl">{recordId}</h1>
            <p className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-[#c8b8a3]">{prettyLabel(recordType ?? "record")}</p>
          </div>
          <Link to={recordType ? `/admin/${recordType}` : "/admin"} className="rounded-full border border-white/10 bg-white/10 px-5 py-3 text-sm font-black text-white">Back to module</Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-2xl">
            <h2 className="text-2xl font-black">Record Details</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {entries.map(([key, value]) => (
                <div key={key} className="rounded-2xl border border-white/10 bg-white/[0.05] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#d2aa6a]">{prettyLabel(key)}</p>
                  <p className="mt-2 whitespace-pre-wrap text-sm font-bold leading-6 text-white">{stringify(value)}</p>
                </div>
              ))}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-2xl">
              <h2 className="text-2xl font-black">Notes</h2>
              <p className="mt-4 rounded-2xl bg-white/8 p-4 text-sm font-semibold leading-6 text-[#c8b8a3]">
                Operations notes, guest preferences, incident comments, and manager remarks can be attached here when the backend is connected.
              </p>
            </section>

            <section className="rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-2xl">
              <h2 className="text-2xl font-black">Timeline</h2>
              <div className="mt-4 space-y-3">
                {actionHistoryRecords.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-white/8 p-4">
                    <p className="text-sm font-black text-white">{item.actionType}</p>
                    <p className="mt-1 text-xs font-semibold text-[#c8b8a3]">{item.timestamp} - {item.statusChanges}</p>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-2xl">
          <h2 className="text-2xl font-black">Related Records</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {(relatedBookings.length ? relatedBookings : bookingRecords.slice(0, 3)).map((booking) => (
              <Link key={booking.id} to={`/admin/detail/bookings/${booking.id}`} className="rounded-2xl border border-white/10 bg-white/8 p-4 hover:bg-white/12">
                <p className="text-sm font-black text-white">{booking.id}</p>
                <p className="mt-1 text-xs font-semibold text-[#c8b8a3]">{booking.guestName} - Room {booking.assignedRoom}</p>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </motion.main>
  );
}