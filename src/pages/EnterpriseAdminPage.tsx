import { motion, AnimatePresence } from "framer-motion";
import { Invoice, InvoiceModal, downloadInvoice, shareInvoice, mapApiRecordToInvoice } from "../utils/invoiceHelper";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Bar, Doughnut, Line } from "react-chartjs-2";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useHotel } from "../context/HotelContext";
import { apiClient } from "../services/api";
import {
  actionHistoryRecords,
  aiRecommendations,
  buildKpis,
  complaintRecords,
  feedbackRecords,
  findOperationsRecord,
  formatShortDate,
  getBlockForRoomDate,
  getBookingForRoomDate,
  getCalendarStatus,
  guestRecords,
  hasRoomConflict,
  isoDateAfter,
  lightStatusColorClasses,
  notificationCenterItems,
  paymentRecords,
  pmsRooms,
  pmsRoomTypes,
  recentActivities,
  reportDefinitions,
  roomBlockReasons,
  selfCheckIns,
  statusColorClasses,
  statusLabels,
  type BookingRecord,
  type BookingStatus,
  type CalendarStatus,
  type ComplaintRecord,
  type CorporateBooking,
  type FeedbackRecord,
  type GuestRecord,
  type HousekeepingTask,
  type MaintenanceBlock,
  type PaymentRecord,
  type PMSRoom,
  type PMSRoomStatus,
  type PMSRoomType,
  type Priority,
  type ServiceRequest,
  type TaskStatus,
} from "../data/operationsData";
import { cn } from "../utils/cn";

type AdminModule =
  | "overview"
  | "calendar"
  | "rooms"
  | "bookings"
  | "guests"
  | "corporate"
  | "self-check-in"
  | "housekeeping"
  | "room-service"
  | "complaints"
  | "feedback"
  | "payments"
  | "invoices"
  | "revenue"
  | "ai"
  | "notifications"
  | "history"
  | "reports"
  | "maintenance"
  | "profile"
  | "automation";

type SelectedCell = {
  room: PMSRoom;
  date: string;
  status: CalendarStatus;
  block?: MaintenanceBlock;
};

type AdminGuestDetail = { name: string; age: string; gender: string; idProof: string };

const emptyAdminGuest = (index: number): AdminGuestDetail => ({ name: index === 0 ? "Primary Guest" : "", age: "", gender: "", idProof: "" });

type AdminNotification = {
  id: string;
  bookingId?: string;
  phoneNumber?: string;
  notificationType?: string;
  scheduledTime?: string;
  sentTime?: string;
  status: "Pending" | "Sent" | "Cancelled" | "Failed";
  retryCount?: number;
  message: string;
};

type NotificationLog = {
  id: string;
  bookingId?: string;
  phoneNumber?: string;
  messageType?: string;
  sentAt?: string;
  deliveryStatus?: string;
  providerResponse?: Record<string, unknown>;
};

type AdminInvoice = {
  id: string;
  invoiceNumber: string;
  bookingId: string;
  guestName: string;
  guestEmail: string;
  roomNumber: string;
  totalAmount: number;
  gstAmount: number;
  paymentStatus: string;
  invoiceStatus: string;
  createdAt?: string;
  rawRecord?: any;
};

const adminModules: Array<{ key: AdminModule; label: string; group: string }> = [
  { key: "overview", label: "Overview", group: "Command" },
  { key: "calendar", label: "Availability Calendar", group: "Command" },
  { key: "rooms", label: "Room Management", group: "Operations" },
  { key: "bookings", label: "Booking Management", group: "Operations" },
  { key: "guests", label: "Guest Management", group: "Operations" },
  { key: "corporate", label: "Corporate Bookings", group: "Operations" },
  { key: "self-check-in", label: "Self Check-in", group: "Operations" },
  { key: "housekeeping", label: "Housekeeping", group: "Services" },
  { key: "room-service", label: "Room Service", group: "Services" },
  { key: "complaints", label: "Complaints", group: "Guest Care" },
  { key: "feedback", label: "Feedback", group: "Guest Care" },
  { key: "payments", label: "Payments & GST", group: "Finance" },
  { key: "invoices", label: "Invoices", group: "Finance" },
  { key: "revenue", label: "Revenue Analytics", group: "Finance" },
  { key: "ai", label: "AI Center", group: "Intelligence" },
  { key: "notifications", label: "Notifications", group: "Intelligence" },
  { key: "history", label: "Action History", group: "Intelligence" },
  { key: "automation", label: "Automation Engine", group: "Intelligence" },
  { key: "reports", label: "Reports", group: "Exports" },
  { key: "maintenance", label: "Maintenance", group: "Exports" },
  { key: "profile", label: "Profile Settings", group: "Account" },
];

const panelClass = "rounded-[1.6rem] border border-white/10 bg-white/[0.07] p-5 shadow-2xl backdrop-blur-2xl";
const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-white/35 focus:border-[#d2aa6a]";

const currency = (value: number) => `INR ${Math.round(value).toLocaleString("en-IN")}`;

const normalize = (value: unknown) => String(value ?? "").toLowerCase();

const activeModuleFromParam = (module: string | undefined): AdminModule => {
  const candidate = module as AdminModule | undefined;
  return candidate && adminModules.some((item) => item.key === candidate) ? candidate : "overview";
};

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: "#f8ead2" } } },
  scales: {
    x: { ticks: { color: "#c8b8a3" }, grid: { color: "rgba(255,255,255,0.08)" } },
    y: { ticks: { color: "#c8b8a3" }, grid: { color: "rgba(255,255,255,0.08)" } },
  },
};

type PreviewCustomerBooking = {
  id: string;
  roomId: string;
  roomNumber?: string;
  roomTitle: string;
  roomType: PMSRoomType;
  customerEmail: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  total: number;
  status: "Confirmed" | "Completed" | "Cancelled";
  invoiceId: string;
};

const readPreviewBookings = (): BookingRecord[] => {
  try {
    const bookings = JSON.parse(localStorage.getItem("nirvana-all-customer-bookings") || "[]") as PreviewCustomerBooking[];
    return bookings.map((booking) => {
      const roomNumber = booking.roomNumber || booking.roomId.split("-").at(-1) || booking.roomId;
      const room = pmsRooms.find((item) => item.roomNumber === roomNumber);
      return {
        id: booking.id,
        guestName: booking.customerEmail.split("@")[0].replace(/[._-]+/g, " "),
        phone: "Stored in customer profile",
        email: booking.customerEmail,
        idProof: "Stored in customer profile",
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        guests: booking.guests,
        maxOccupancy: room?.capacity ?? booking.guests,
        roomType: booking.roomType,
        assignedRoom: roomNumber,
        status: booking.status === "Completed" ? "Checked-Out" : booking.status,
        amount: booking.total,
      } satisfies BookingRecord;
    });
  } catch {
    return [];
  }
};

const mergeBookings = (apiBookings: BookingRecord[], previewBookings: BookingRecord[]) => {
  const seen = new Set<string>();
  return [...previewBookings, ...apiBookings].filter((booking) => {
    if (seen.has(booking.id)) return false;
    seen.add(booking.id);
    return true;
  });
};

type ApiRecord = Record<string, unknown>;

const asString = (value: unknown, fallback = "") => (value == null || value === "" ? fallback : String(value));
const asNumber = (value: unknown, fallback = 0) => Number(value ?? fallback) || fallback;

const mapApiRoom = (row: ApiRecord): PMSRoom => ({
  id: asString(row.id, asString(row.roomNumber)),
  roomNumber: asString(row.roomNumber || row.room_number || row.id),
  roomType: asString(row.roomType || row.room_type || row.category, "Deluxe") as PMSRoomType,
  floor: asString(row.floor, "Floor 1"),
  capacity: asNumber(row.capacity, 2),
  price: asNumber(row.price, 0),
  status: asString(row.status, "available") as PMSRoomStatus,
});

const mapApiBooking = (row: ApiRecord): BookingRecord => ({
  id: asString(row.id),
  guestName: asString(row.guestName || row.guest_name, "Guest"),
  phone: asString(row.phone),
  email: asString(row.email),
  idProof: asString(row.idProof || row.id_proof, "Stored in profile"),
  checkIn: asString(row.checkIn || row.check_in),
  checkOut: asString(row.checkOut || row.check_out),
  guests: asNumber(row.guests, 1),
  maxOccupancy: asNumber(row.maxOccupancy || row.max_occupancy, 1),
  guestDetails: (row.guestDetails || row.guest_details || []) as BookingRecord["guestDetails"],
  roomType: asString(row.roomType || row.room_type, "Deluxe") as PMSRoomType,
  assignedRoom: asString(row.assignedRoom || row.room_number || row.room_id),
  status: asString(row.status, "Confirmed") as BookingStatus,
  amount: asNumber(row.amount || row.total_amount, 0),
});

const mapApiCorporate = (row: ApiRecord): CorporateBooking => ({
  id: asString(row.id),
  companyName: asString(row.companyName || row.company_name, "Company"),
  coordinator: asString(row.coordinator || row.contact_person, "Coordinator"),
  numberOfRooms: asNumber(row.numberOfRooms || row.room_count, 1),
  stayDates: `${asString(row.check_in)} to ${asString(row.check_out)}`,
  specialRequests: asString(row.specialRequests || row.notes),
  status: asString(row.status, "Pending") as CorporateBooking["status"],
});

const mapApiHousekeeping = (row: ApiRecord): HousekeepingTask => ({
  id: asString(row.id),
  roomNumber: asString(row.roomNumber || row.room_id),
  task: asString(row.task || row.task_type, "Cleaning") as HousekeepingTask["task"],
  assignedStaff: asString(row.assignedStaff || row.assigned_to, "Unassigned"),
  status: asString(row.status, "Pending") as HousekeepingTask["status"],
  remarks: asString(row.remarks || row.notes),
});

const mapApiService = (row: ApiRecord): ServiceRequest => ({
  id: asString(row.id),
  guestName: asString(row.guestName || row.guest_name, "Guest"),
  roomNumber: asString(row.roomNumber || row.room_id),
  requestType: asString(row.requestType || row.item, "Amenities") as ServiceRequest["requestType"],
  requestTime: asString(row.requestTime || row.created_at, "Now"),
  status: asString(row.status, "Pending") as ServiceRequest["status"],
});

const mapApiComplaint = (row: ApiRecord): ComplaintRecord => ({
  id: asString(row.id),
  guestName: asString(row.guestName || row.user_id, "Guest"),
  roomNumber: asString(row.roomNumber || row.room_id),
  description: asString(row.description),
  priority: asString(row.priority, "Medium") as ComplaintRecord["priority"],
  status: asString(row.status, "Open") as ComplaintRecord["status"],
});

const mapApiFeedback = (row: ApiRecord): FeedbackRecord => ({
  id: asString(row.id),
  guestName: asString(row.guestName || row.user_id, "Guest"),
  rating: asNumber(row.rating, 5),
  feedback: asString(row.feedback || row.comment),
});

const mapApiPayment = (row: ApiRecord): PaymentRecord => ({
  id: asString(row.id),
  invoiceNumber: asString(row.invoiceNumber || row.invoice_number),
  guestName: asString(row.guestName || row.booking_id, "Guest"),
  amount: asNumber(row.amount || row.taxable_amount, 0),
  gstAmount: asNumber(row.gstAmount || row.total_tax, 0),
  method: asString(row.method || row.payment_method, "UPI") as PaymentRecord["method"],
  status: asString(row.status, "Pending") as PaymentRecord["status"],
});

const mapApiBlock = (row: ApiRecord): MaintenanceBlock => ({
  id: asString(row.id),
  roomNumber: asString(row.roomNumber || row.room_id),
  startDate: asString(row.startDate || row.start_date),
  endDate: asString(row.endDate || row.end_date),
  reason: asString(row.reason, "Maintenance"),
  description: asString(row.description || row.notes),
  priority: asString(row.priority, "Medium") as MaintenanceBlock["priority"],
  assignedStaff: asString(row.assignedStaff || row.created_by, "Operations"),
  expectedCompletionDate: asString(row.expectedCompletionDate || row.end_date),
  status: asString(row.status, "Active") as MaintenanceBlock["status"],
});

const mapApiNotification = (row: ApiRecord): AdminNotification => ({
  id: asString(row.id || row.notificationId),
  bookingId: asString(row.bookingId),
  phoneNumber: asString(row.phoneNumber),
  notificationType: asString(row.notificationType),
  scheduledTime: asString(row.scheduledTime),
  sentTime: asString(row.sentTime),
  status: asString(row.status, "Pending") as AdminNotification["status"],
  retryCount: asNumber(row.retryCount, 0),
  message: asString(row.message),
});

const mapApiNotificationLog = (row: ApiRecord): NotificationLog => ({
  id: asString(row.id),
  bookingId: asString(row.bookingId),
  phoneNumber: asString(row.phoneNumber),
  messageType: asString(row.messageType),
  sentAt: asString(row.sentAt),
  deliveryStatus: asString(row.deliveryStatus),
  providerResponse: (row.providerResponse || {}) as Record<string, unknown>,
});

const mapApiInvoice = (row: ApiRecord): AdminInvoice => {
  const booking = (row.booking || {}) as ApiRecord;
  const guest = (row.guest || {}) as ApiRecord;
  const room = (row.room || {}) as ApiRecord;
  const payment = (row.payment || {}) as ApiRecord;
  return {
    id: asString(row.id || row.invoiceId),
    invoiceNumber: asString(row.invoiceNumber),
    bookingId: asString(row.bookingId),
    guestName: asString(booking.guest_name || guest.full_name, "Guest"),
    guestEmail: asString(booking.email || guest.email),
    roomNumber: asString(booking.room_number || room.room_number || row.roomId),
    totalAmount: asNumber(row.totalAmount, 0),
    gstAmount: asNumber(row.gstAmount, 0),
    paymentStatus: asString(payment.status, "paid"),
    invoiceStatus: asString(row.invoiceStatus, "Issued"),
    createdAt: asString(row.createdAt),
    rawRecord: row,
  };
};

function AdminClock() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = time.getHours();
  let greeting = "Good Evening";
  if (hours < 12) greeting = "Good Morning";
  else if (hours < 17) greeting = "Good Afternoon";

  // Format: HH : MM : SS
  const timeString = time.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).replace(/:/g, " : ");

  const formattedDate = time.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col items-end rounded-2xl border border-[#d2aa6a]/20 bg-[#16120e] px-4 py-2 text-[#fff6e8] shadow-md min-w-[190px]">
      <div className="flex items-center gap-1.5 font-mono text-sm font-black text-white leading-none">
        <span className="text-[#d2aa6a] text-xs">🕒</span>
        <span>{timeString}</span>
      </div>
      <p className="text-[9px] font-bold text-[#c8b8a3] mt-1 tracking-tight leading-none text-right">
        {formattedDate}
      </p>
      <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[#d2aa6a] mt-1 leading-none text-right">
        {greeting}, Admin
      </p>
    </div>
  );
}

export default function EnterpriseAdminPage() {
  const { module } = useParams();
  const navigate = useNavigate();
  const { theme, toggleTheme, user, logout } = useHotel();
  const activeModule = activeModuleFromParam(module);
  const [search, setSearch] = useState("");
  const [showNotifications, setShowNotifications] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedCell, setSelectedCell] = useState<SelectedCell | null>(null);
  const [roomsState, setRoomsState] = useState<PMSRoom[]>(pmsRooms);
  const [bookingsState, setBookingsState] = useState<BookingRecord[]>(() => readPreviewBookings());
  const [blocksState, setBlocksState] = useState<MaintenanceBlock[]>([]);
  const [housekeepingState, setHousekeepingState] = useState<HousekeepingTask[]>([]);
  const [serviceState, setServiceState] = useState<ServiceRequest[]>([]);
  const [corporateState, setCorporateState] = useState<CorporateBooking[]>([]);
  const [complaintsState, setComplaintsState] = useState<ComplaintRecord[]>(complaintRecords.slice(0, 0));
  const [feedbackState, setFeedbackState] = useState<FeedbackRecord[]>(feedbackRecords.slice(0, 0));
  const [paymentsState, setPaymentsState] = useState<PaymentRecord[]>(paymentRecords.slice(0, 0));
  const [notificationRows, setNotificationRows] = useState<AdminNotification[]>([]);
  const [notificationLogs, setNotificationLogs] = useState<NotificationLog[]>([]);
  const [invoiceRows, setInvoiceRows] = useState<AdminInvoice[]>([]);

  const kpis = useMemo(() => buildKpis(roomsState, bookingsState, blocksState), [roomsState, bookingsState, blocksState]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      try {
        const [roomsRes, bookingsRes, corporateRes, housekeepingRes, serviceRes, complaintsRes, feedbackRes, gstRes, blocksRes, notificationsRes, logsRes, invoicesRes] = await Promise.all([
          apiClient.get("/rooms"),
          apiClient.get("/bookings"),
          apiClient.get("/corporate_bookings"),
          apiClient.get("/housekeeping_tasks"),
          apiClient.get("/room_service_orders"),
          apiClient.get("/complaints"),
          apiClient.get("/feedback"),
          apiClient.get("/gst_entries"),
          apiClient.get("/maintenance_blocks"),
          apiClient.get("/notifications"),
          apiClient.get("/notification_logs"),
          apiClient.get("/invoices"),
        ]);
        if (!mounted) return;
        const apiRooms = (roomsRes.data.rooms ?? []).map(mapApiRoom);
        const apiBookings = (bookingsRes.data.bookings ?? []).map(mapApiBooking);
        const previewBookings = readPreviewBookings();
        setRoomsState(apiRooms.length ? apiRooms : pmsRooms);
        setBookingsState(mergeBookings(apiBookings, previewBookings));
        setCorporateState((corporateRes.data.corporate_bookings ?? []).map(mapApiCorporate));
        setHousekeepingState((housekeepingRes.data.housekeeping_tasks ?? []).map(mapApiHousekeeping));
        setServiceState((serviceRes.data.room_service_orders ?? []).map(mapApiService));
        setComplaintsState((complaintsRes.data.complaints ?? []).map(mapApiComplaint));
        setFeedbackState((feedbackRes.data.feedback ?? []).map(mapApiFeedback));
        setPaymentsState((gstRes.data.gst_entries ?? []).map(mapApiPayment));
        setBlocksState((blocksRes.data.maintenance_blocks ?? []).map(mapApiBlock));
        setNotificationRows((notificationsRes.data.notifications ?? []).map(mapApiNotification));
        setNotificationLogs((logsRes.data.notification_logs ?? []).map(mapApiNotificationLog));
        setInvoiceRows((invoicesRes.data.invoices ?? []).map(mapApiInvoice));
      } catch {
        if (!mounted) return;
        setRoomsState(pmsRooms);
        setBookingsState(readPreviewBookings());
        setCorporateState([]);
        setHousekeepingState([]);
        setServiceState([]);
        setComplaintsState([]);
        setFeedbackState([]);
        setPaymentsState([]);
        setBlocksState([]);
        setNotificationRows([]);
        setNotificationLogs([]);
        setInvoiceRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/admin-login");
  };

  const moduleContent = {
    overview: <OverviewModule kpis={kpis} bookings={bookingsState} rooms={roomsState} blocks={blocksState} />,
    calendar: (
      <CalendarModule
        rooms={roomsState}
        bookings={bookingsState}
        blocks={blocksState}
        onSelectCell={setSelectedCell}
      />
    ),
    rooms: <RoomsModule rooms={roomsState} setRooms={setRoomsState} blocks={blocksState} setBlocks={setBlocksState} notify={notify} search={search} />,
    bookings: <BookingsModule rooms={roomsState} bookings={bookingsState} setBookings={setBookingsState} blocks={blocksState} notify={notify} search={search} />,
    guests: <GuestsModule search={search} bookings={bookingsState} />,
    corporate: <CorporateModule rows={corporateState} setRows={setCorporateState} search={search} notify={notify} />,
    "self-check-in": <SelfCheckInModule search={search} />,
    housekeeping: <HousekeepingModule rows={housekeepingState} setRows={setHousekeepingState} search={search} notify={notify} />,
    "room-service": <RoomServiceModule rows={serviceState} setRows={setServiceState} search={search} notify={notify} />,
    complaints: <ComplaintsModule rows={complaintsState} setRows={setComplaintsState} search={search} notify={notify} />,
    feedback: <FeedbackModule rows={feedbackState} />,
    payments: <PaymentsModule rows={paymentsState} search={search} />,
    invoices: <InvoicesModule rows={invoiceRows} search={search} notify={notify} />,
    revenue: <RevenueModule />,
    ai: <AiModule />,
    notifications: <NotificationsModule rows={notificationRows} logs={notificationLogs} search={search} notify={notify} setRows={setNotificationRows} />,
    history: <HistoryModule search={search} />,
    reports: <ReportsModule notify={notify} />,
    maintenance: <MaintenanceModule rooms={roomsState} setRooms={setRoomsState} blocks={blocksState} setBlocks={setBlocksState} notify={notify} search={search} />,
    profile: <ProfileSettingsModule userName={user?.name ?? "Nirvana Admin"} email={user?.email ?? "admin@nirvanaplaza.com"} onLogout={handleLogout} />,
    automation: <AutomationModule notify={notify} />,
  } satisfies Record<AdminModule, ReactNode>;

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen bg-[#080705] text-[#fff6e8]"
    >
      <div className="grid min-h-screen lg:grid-cols-[290px_1fr]">
        <aside className="border-b border-white/10 bg-[#0f0c08]/95 p-4 backdrop-blur-2xl lg:sticky lg:top-[73px] lg:h-[calc(100vh-73px)] lg:border-b-0 lg:border-r">
          <div className="rounded-[1.5rem] border border-[#d2aa6a]/25 bg-[#d2aa6a]/10 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-[#d2aa6a]">Enterprise PMS</p>
            <h1 className="mt-2 text-xl font-black leading-tight">SRI NIRVANA PLAZA</h1>
            <p className="mt-2 text-xs font-semibold leading-5 text-[#c8b8a3]">Room Availability Calendar & Hotel Operations Management System</p>
          </div>
          <div className="premium-scrollbar mt-4 flex gap-2 overflow-x-auto pb-1 lg:block lg:max-h-[calc(100vh-245px)] lg:space-y-5 lg:overflow-y-auto">
            {Array.from(new Set(adminModules.map((item) => item.group))).map((group) => (
              <div key={group} className="min-w-max lg:min-w-0">
                <p className="mb-2 hidden px-3 text-[10px] font-black uppercase tracking-[0.28em] text-[#d2aa6a]/70 lg:block">{group}</p>
                <div className="flex gap-2 lg:block lg:space-y-1">
                  {adminModules.filter((item) => item.group === group).map((item) => (
                    <Link
                      key={item.key}
                      to={item.key === "overview" ? "/admin" : `/admin/${item.key}`}
                      className={cn(
                        "block whitespace-nowrap rounded-2xl px-3 py-2.5 text-sm font-bold text-[#c8b8a3] hover:bg-white/10 hover:text-white",
                        activeModule === item.key && "bg-[#d2aa6a] text-[#080705] hover:bg-[#d2aa6a] hover:text-[#080705]",
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </aside>

        <section className="min-w-0 p-4 sm:p-6 lg:p-8">
          <div className="sticky top-[73px] z-30 -mx-4 mb-6 border-b border-white/10 bg-[#080705]/85 px-4 py-3 backdrop-blur-2xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.35em] text-[#d2aa6a]">Admin Portal</p>
                <h2 className="mt-1 text-2xl font-black md:text-4xl">{adminModules.find((item) => item.key === activeModule)?.label}</h2>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <AdminClock />
                <div className="relative min-w-0 sm:w-80">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search room, guest, booking ID"
                    className="w-full rounded-full border border-white/10 bg-white/8 py-3 pl-5 pr-10 text-sm font-semibold text-white outline-none placeholder:text-white/35"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/45">⌕</span>
                </div>
                <button type="button" onClick={() => setShowNotifications((value) => !value)} className="rounded-full border border-white/10 bg-white/8 px-4 py-3 text-sm font-black text-white">
                  Notifications {notificationCenterItems.length}
                </button>
                <button type="button" onClick={toggleTheme} className="rounded-full border border-white/10 bg-white/8 px-4 py-3 text-sm font-black text-white">
                  {theme === "dark" ? "Light" : "Dark"} Mode
                </button>
                <button type="button" onClick={handleLogout} className="rounded-full bg-rose-500 px-4 py-3 text-sm font-black text-white">
                  Logout
                </button>
              </div>
            </div>
            <AnimatePresence>
              {showNotifications ? (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="absolute right-4 top-[calc(100%+8px)] w-[min(420px,calc(100vw-32px))] rounded-[1.5rem] border border-white/10 bg-[#11100d] p-4 shadow-2xl">
                  <p className="text-sm font-black text-white">Notification Center</p>
                  <div className="mt-3 space-y-2">
                    {notificationCenterItems.map((item) => (
                      <div key={item.id} className="rounded-2xl bg-white/8 p-3">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#d2aa6a]">{item.type}</p>
                        <p className="mt-1 text-sm font-bold text-white">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-[#c8b8a3]">{item.message}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {moduleContent[activeModule]}
          {loading ? <div className="mt-6 rounded-2xl border border-white/10 bg-white/8 p-4 text-sm font-bold text-[#c8b8a3]">Loading live Firestore data...</div> : null}
        </section>
      </div>

      <AnimatePresence>
        {selectedCell ? (
          <CalendarActionModal
            cell={selectedCell}
            onClose={() => setSelectedCell(null)}
            rooms={roomsState}
            bookings={bookingsState}
            blocks={blocksState}
            setRooms={setRoomsState}
            setBookings={setBookingsState}
            setBlocks={setBlocksState}
            notify={notify}
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {toast ? (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-6 right-6 z-50 max-w-sm rounded-2xl border border-[#d2aa6a]/30 bg-[#11100d] px-5 py-4 text-sm font-bold text-white shadow-2xl">
            {toast}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.main>
  );
}

function OverviewModule({ kpis, bookings, rooms, blocks }: { kpis: Array<{ label: string; value: string | number }>; bookings: BookingRecord[]; rooms: PMSRoom[]; blocks: MaintenanceBlock[] }) {
  const occupancyTrend = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [{ label: "Occupancy", data: [62, 68, 71, 76, 82, 88, 84], borderColor: "#d2aa6a", backgroundColor: "rgba(210,170,106,0.16)", fill: true, tension: 0.42 }],
  };
  const revenueChart = {
    labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
    datasets: [{ label: "Revenue", data: [820000, 990000, 1120000, 1260000], backgroundColor: "rgba(210,170,106,0.78)", borderRadius: 14 }],
  };
  const statusCounts = ["available", "booked", "reserved", "maintenance", "out-of-service"].map(
    (status) => rooms.filter((room) => room.status === status).length,
  );
  const roomStatusPie = {
    labels: ["Available", "Booked", "Reserved", "Maintenance", "Out Of Service"],
    datasets: [{ data: statusCounts, backgroundColor: ["#10b981", "#ef4444", "#3b82f6", "#facc15", "#71717a"], borderWidth: 0 }],
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi, index) => <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} index={index} />)}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_1fr_0.8fr]">
        <ChartPanel title="Occupancy Trend Chart"><Line data={occupancyTrend} options={chartOptions} /></ChartPanel>
        <ChartPanel title="Revenue Chart"><Bar data={revenueChart} options={chartOptions} /></ChartPanel>
        <ChartPanel title="Room Status Pie Chart"><Doughnut data={roomStatusPie} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: "#f8ead2" } } } }} /></ChartPanel>
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <AdminPanel title="Room Occupancy Snapshot">
          <div className="grid gap-3 sm:grid-cols-2">
            {rooms.slice(0, 6).map((room) => {
              const booking = bookings.find((item) => item.assignedRoom === room.roomNumber && item.status !== "Cancelled");
              const occupiedGuests = booking?.guests ?? 0;
              return (
                <div key={room.id} className="rounded-2xl bg-white/8 p-3">
                  <p className="font-black text-white">Room {room.roomNumber}</p>
                  <p className="mt-1 text-xs font-semibold text-[#c8b8a3]">Occupancy: {occupiedGuests} / {room.capacity} Guests</p>
                  <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-[#d2aa6a]">Status: {booking ? "Booked" : statusLabels[room.status]}</p>
                </div>
              );
            })}
          </div>
        </AdminPanel>
        <AdminPanel title="Available Rooms In Hotel">
          <CompactList
            items={rooms
              .filter((room) => room.status === "available" && !bookings.some((booking) => booking.assignedRoom === room.roomNumber && booking.status !== "Cancelled"))
              .slice(0, 8)
              .map((room) => `Room ${room.roomNumber} - ${room.roomType} - Max ${room.capacity} guests - ${currency(room.price)}`)}
          />
        </AdminPanel>
        <AdminPanel title="Customer Bookings From Portal">
          <CompactList
            items={bookings
              .slice(0, 8)
              .map((booking) => `${booking.guestName} booked Room ${booking.assignedRoom} - ${booking.checkIn} to ${booking.checkOut} - ${currency(booking.amount)}`)}
          />
        </AdminPanel>
        <AdminPanel title="Upcoming Arrivals">
          <CompactList items={bookings.filter((booking) => booking.status !== "Cancelled").slice(0, 4).map((booking) => `${booking.guestName} - Room ${booking.assignedRoom} - ${formatShortDate(booking.checkIn)}`)} />
        </AdminPanel>
        <AdminPanel title="Recent Bookings">
          <CompactList items={bookings.slice(0, 4).map((booking) => `${booking.id} - ${booking.status} - ${currency(booking.amount)}`)} />
        </AdminPanel>
        <AdminPanel title="Priority Alerts">
          <CompactList items={blocks.filter((block) => block.priority === "High").map((block) => `Room ${block.roomNumber} - ${block.reason} - ${block.status}`)} />
        </AdminPanel>
        <AdminPanel title="Recent Activities"><CompactList items={recentActivities} /></AdminPanel>
        <AdminPanel title="Notifications"><CompactList items={notificationCenterItems.map((item) => item.message)} /></AdminPanel>
        <AdminPanel title="Management Focus"><CompactList items={["Prevent double bookings before assigning rooms.", "Complete maintenance blocks to release inventory.", "Review pending complaints before evening audit."]} /></AdminPanel>
      </div>
    </div>
  );
}

function CalendarModule({ rooms, bookings, blocks, onSelectCell }: { rooms: PMSRoom[]; bookings: BookingRecord[]; blocks: MaintenanceBlock[]; onSelectCell: (cell: SelectedCell) => void }) {
  const [view, setView] = useState<"7" | "week" | "month">("7");
  const [startOffset, setStartOffset] = useState(0);
  const dayCount = view === "month" ? 30 : view === "week" ? 14 : 7;
  const dates = useMemo(() => Array.from({ length: dayCount }, (_, index) => isoDateAfter(startOffset + index)), [dayCount, startOffset]);

  return (
    <div className="space-y-5">
      <AdminPanel title="Hotel-style Room Timeline Calendar" action={<CalendarLegend />}>
        <div className="flex flex-wrap items-center gap-2">
          {(["7", "week", "month"] as const).map((item) => (
            <button key={item} type="button" onClick={() => setView(item)} className={cn("rounded-full px-4 py-2 text-xs font-black", view === item ? "bg-[#d2aa6a] text-[#080705]" : "bg-white/10 text-white")}>{item === "7" ? "7 Day View" : item === "week" ? "Weekly View" : "Monthly View"}</button>
          ))}
          <button type="button" onClick={() => setStartOffset((value) => value - dayCount)} className="rounded-full bg-white/10 px-4 py-2 text-xs font-black">Previous</button>
          <button type="button" onClick={() => setStartOffset(0)} className="rounded-full bg-white/10 px-4 py-2 text-xs font-black">Today</button>
          <button type="button" onClick={() => setStartOffset((value) => value + dayCount)} className="rounded-full bg-white/10 px-4 py-2 text-xs font-black">Next</button>
        </div>
      </AdminPanel>
      <div className="premium-scrollbar overflow-auto rounded-[1.6rem] border border-white/10 bg-white/[0.05]">
        <div className="min-w-[980px]">
          <div className="grid border-b border-white/10 bg-[#11100d]" style={{ gridTemplateColumns: `260px repeat(${dates.length}, minmax(112px, 1fr))` }}>
            <div className="p-4 text-xs font-black uppercase tracking-[0.2em] text-[#d2aa6a]">Rooms</div>
            {dates.map((date) => (
              <div key={date} className="border-l border-white/10 p-4 text-center">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#d2aa6a]">{new Date(date).toLocaleDateString("en-IN", { weekday: "short" })}</p>
                <p className="mt-1 text-sm font-black text-white">{formatShortDate(date)}</p>
              </div>
            ))}
          </div>
          {rooms.map((room) => (
            <div key={room.id} className="grid border-b border-white/10 last:border-b-0" style={{ gridTemplateColumns: `260px repeat(${dates.length}, minmax(112px, 1fr))` }}>
              <Link to={`/admin/detail/rooms/${room.id}`} className="p-4 hover:bg-white/5">
                <p className="text-lg font-black text-white">Room {room.roomNumber}</p>
                <p className="mt-1 text-xs font-semibold text-[#c8b8a3]">{room.roomType} - {room.floor} - Max Occupancy: {room.capacity} guests</p>
                <p className="mt-1 text-xs font-black text-[#d2aa6a]">{currency(room.price)}</p>
              </Link>
              {dates.map((date) => {
                const status = getCalendarStatus(room, date, bookings, blocks);
                const block = getBlockForRoomDate(room.roomNumber, date, blocks);
                const booking = getBookingForRoomDate(room.roomNumber, date, bookings);
                const guestsBooked = booking?.guests ?? 0;
                const availableCapacity = Math.max(0, room.capacity - guestsBooked);
                const tooltip = [
                  `Room: ${room.roomNumber}`,
                  `Type: ${room.roomType}`,
                  `Maximum Occupancy: ${room.capacity}`,
                  booking ? `Guests Booked: ${guestsBooked}` : "Guests Booked: 0",
                  booking ? `Available Capacity: ${availableCapacity}` : `Available Capacity: ${room.capacity}`,
                  `Booking Status: ${booking?.status ?? statusLabels[status]}`,
                  `Date: ${date}`,
                  `Price: ${currency(room.price)}`,
                  block ? `Block Reason: ${block.reason}` : "",
                  block ? `Assigned Staff: ${block.assignedStaff}` : "",
                  block ? `Expected Completion: ${block.expectedCompletionDate}` : "",
                  booking ? `Guest: ${booking.guestName}` : "",
                ].filter(Boolean).join("\n");
                return (
                  <button
                    key={`${room.id}-${date}`}
                    type="button"
                    title={tooltip}
                    onClick={() => onSelectCell({ room, date, status, block })}
                    className={cn("m-2 rounded-2xl border px-3 py-4 text-center text-xs font-black transition hover:scale-[1.02]", statusColorClasses[status])}
                  >
                    {statusLabels[status]}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CalendarActionModal({ cell, onClose, rooms, bookings, blocks, setRooms, setBookings, setBlocks, notify }: { cell: SelectedCell; onClose: () => void; rooms: PMSRoom[]; bookings: BookingRecord[]; blocks: MaintenanceBlock[]; setRooms: React.Dispatch<React.SetStateAction<PMSRoom[]>>; setBookings: React.Dispatch<React.SetStateAction<BookingRecord[]>>; setBlocks: React.Dispatch<React.SetStateAction<MaintenanceBlock[]>>; notify: (message: string) => void }) {
  const [reason, setReason] = useState("Maintenance");
  const [staff, setStaff] = useState("Engineering Team");

  const setRoomStatus = (status: PMSRoomStatus) => {
    setRooms((current) => current.map((room) => room.roomNumber === cell.room.roomNumber ? { ...room, status } : room));
  };

  const createBooking = (status: BookingStatus) => {
    if (hasRoomConflict(cell.room.roomNumber, cell.date, cell.date, bookings, blocks, rooms)) {
      notify("This room is unavailable for the selected dates.");
      return;
    }
    const nextBooking: BookingRecord = {
      id: `BKG-${Date.now().toString().slice(-5)}`,
      guestName: status === "Pending" ? "Reserved Guest" : "Walk-in Guest",
      phone: "9876500000",
      email: "frontoffice@nirvanaplaza.com",
      idProof: "Pending verification",
      checkIn: cell.date,
      checkOut: isoDateAfter(1),
      guests: 1,
      roomType: cell.room.roomType,
      assignedRoom: cell.room.roomNumber,
      status,
      amount: cell.room.price,
    };
    setBookings((current) => [nextBooking, ...current]);
    setRoomStatus(status === "Pending" ? "reserved" : "booked");
    notify(status === "Pending" ? "Room reserved successfully." : "Booking created successfully.");
    onClose();
  };

  const blockRoom = () => {
    const block: MaintenanceBlock = {
      id: `MNT-${Date.now().toString().slice(-5)}`,
      roomNumber: cell.room.roomNumber,
      startDate: cell.date,
      endDate: cell.date,
      reason,
      description: `${reason} created from calendar cell action.`,
      priority: "Medium",
      assignedStaff: staff,
      expectedCompletionDate: cell.date,
      status: "Active",
    };
    setBlocks((current) => [block, ...current]);
    setRoomStatus("maintenance");
    notify("Room blocked for maintenance.");
    onClose();
  };

  const markAvailable = () => {
    setRoomStatus("available");
    setBlocks((current) => current.map((block) => block.roomNumber === cell.room.roomNumber ? { ...block, status: "Completed" } : block));
    notify("Room marked available. Completed blocks were released automatically.");
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <motion.div initial={{ y: 20, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 20, scale: 0.98 }} className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-[#11100d] p-6 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-[#d2aa6a]">Calendar Action Modal</p>
            <h2 className="mt-2 text-2xl font-black">Room {cell.room.roomNumber} on {formatShortDate(cell.date)}</h2>
            <p className="mt-2 text-sm text-[#c8b8a3]">{cell.room.roomType} - {currency(cell.room.price)} - {statusLabels[cell.status]}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/10 px-4 py-2 text-sm font-black">Close</button>
        </div>
        {cell.block ? (
          <div className="mt-5 rounded-2xl border border-yellow-300/25 bg-yellow-400/10 p-4 text-sm text-yellow-50">
            <p className="font-black">Blocked: {cell.block.reason}</p>
            <p className="mt-1">Assigned staff: {cell.block.assignedStaff}. Expected completion: {cell.block.expectedCompletionDate}</p>
          </div>
        ) : null}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={markAvailable} className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white">Mark Available</button>
          <button type="button" onClick={() => createBooking("Confirmed")} className="rounded-2xl bg-red-500 px-4 py-3 text-sm font-black text-white">Create Booking</button>
          <button type="button" onClick={() => createBooking("Pending")} className="rounded-2xl bg-blue-500 px-4 py-3 text-sm font-black text-white">Reserve Room</button>
          <button type="button" onClick={() => { setRoomStatus("out-of-service"); notify("Room marked out of service."); onClose(); }} className="rounded-2xl bg-zinc-600 px-4 py-3 text-sm font-black text-white">Mark Out Of Service</button>
        </div>
        <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-sm font-black">Block Room</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <select value={reason} onChange={(event) => setReason(event.target.value)} className={inputClass}>{roomBlockReasons.map((item) => <option key={item} value={item}>{item}</option>)}</select>
            <input value={staff} onChange={(event) => setStaff(event.target.value)} className={inputClass} placeholder="Assigned staff" />
          </div>
          <button type="button" onClick={blockRoom} className="mt-3 w-full rounded-2xl bg-yellow-400 px-4 py-3 text-sm font-black text-black">Block Room</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function RoomsModule({ rooms, setRooms, blocks, setBlocks, notify, search }: { rooms: PMSRoom[]; setRooms: React.Dispatch<React.SetStateAction<PMSRoom[]>>; blocks: MaintenanceBlock[]; setBlocks: React.Dispatch<React.SetStateAction<MaintenanceBlock[]>>; notify: (message: string) => void; search: string }) {
  const [form, setForm] = useState({ roomNumber: "606", roomType: "Deluxe" as PMSRoomType, floor: "Floor 6", capacity: 2, price: 12500, status: "available" as PMSRoomStatus });
  const [selectedRoom, setSelectedRoom] = useState<PMSRoom | null>(null);
  const [editingRoom, setEditingRoom] = useState<PMSRoom | null>(null);
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [floorFilter, setFloorFilter] = useState("All");
  const filteredRooms = rooms.filter((room) => {
    const matchesSearch = [room.roomNumber, room.roomType, room.floor].some((value) => normalize(value).includes(normalize(search)));
    return matchesSearch && (statusFilter === "All" || room.status === statusFilter) && (typeFilter === "All" || room.roomType === typeFilter) && (floorFilter === "All" || room.floor === floorFilter);
  });

  const addRoom = () => {
    if (rooms.some((room) => room.roomNumber === form.roomNumber)) {
      notify("Room number already exists.");
      return;
    }
    setRooms((current) => [{ id: `pms-room-${form.roomNumber}`, ...form }, ...current]);
    notify("Room added successfully.");
  };

  const changeStatus = (roomNumber: string, status: PMSRoomStatus) => {
    setRooms((current) => current.map((room) => room.roomNumber === roomNumber ? { ...room, status } : room));
    notify(`Room ${roomNumber} status changed to ${statusLabels[status]}.`);
  };

  const blockRoom = (room: PMSRoom) => {
    const block: MaintenanceBlock = {
      id: `MNT-${Date.now().toString().slice(-5)}`,
      roomNumber: room.roomNumber,
      startDate: isoDateAfter(0),
      endDate: isoDateAfter(1),
      reason: "Maintenance",
      description: "Manual room block from room management.",
      priority: "Medium",
      assignedStaff: "Engineering Team",
      expectedCompletionDate: isoDateAfter(1),
      status: "Active",
    };
    setBlocks((current) => [block, ...current]);
    changeStatus(room.roomNumber, "maintenance");
  };

  const saveEditedRoom = () => {
    if (!editingRoom) return;
    if (!editingRoom.roomNumber || editingRoom.capacity < 1 || editingRoom.price < 0) {
      notify("Room Number, Maximum Occupancy, and Price are required.");
      return;
    }
    setRooms((current) => current.map((room) => room.id === editingRoom.id ? editingRoom : room));
    setSelectedRoom(editingRoom);
    setEditingRoom(null);
    notify(`Room ${editingRoom.roomNumber} updated successfully.`);
  };

  const roomKpis = [
    ["Total Rooms", rooms.length],
    ["Available", rooms.filter((room) => room.status === "available").length],
    ["Booked", rooms.filter((room) => room.status === "booked").length],
    ["Reserved", rooms.filter((room) => room.status === "reserved").length],
    ["Maintenance", rooms.filter((room) => room.status === "maintenance").length],
    ["Out Of Service", rooms.filter((room) => room.status === "out-of-service").length],
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        {roomKpis.map(([label, value], index) => <KpiCard key={label} label={String(label)} value={value} index={index} />)}
      </div>

      <AdminPanel title="Add Room">
        <div className="grid gap-3 md:grid-cols-7">
          <input value={form.roomNumber} onChange={(event) => setForm({ ...form, roomNumber: event.target.value })} className={inputClass} placeholder="Room Number" />
          <select value={form.roomType} onChange={(event) => setForm({ ...form, roomType: event.target.value as PMSRoomType })} className={inputClass}>{pmsRoomTypes.map((item) => <option key={item}>{item}</option>)}</select>
          <input value={form.floor} onChange={(event) => setForm({ ...form, floor: event.target.value })} className={inputClass} placeholder="Floor" />
          <input type="number" min={1} required value={form.capacity} onChange={(event) => setForm({ ...form, capacity: Math.max(1, Number(event.target.value)) })} className={inputClass} placeholder="Maximum Occupancy" />
          <input type="number" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} className={inputClass} placeholder="Price" />
          <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as PMSRoomStatus })} className={inputClass}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          <button type="button" onClick={addRoom} className="rounded-2xl bg-[#d2aa6a] px-4 py-3 text-sm font-black text-black">Add Room</button>
        </div>
      </AdminPanel>

      {editingRoom ? (
        <AdminPanel title={`Edit Room ${editingRoom.roomNumber}`} action={<button type="button" onClick={() => setEditingRoom(null)} className="rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white">Cancel</button>}>
          <div className="grid gap-3 md:grid-cols-6">
            <input value={editingRoom.roomNumber} onChange={(event) => setEditingRoom({ ...editingRoom, roomNumber: event.target.value })} className={inputClass} placeholder="Room Number" />
            <select value={editingRoom.roomType} onChange={(event) => setEditingRoom({ ...editingRoom, roomType: event.target.value as PMSRoomType })} className={inputClass}>{pmsRoomTypes.map((item) => <option key={item}>{item}</option>)}</select>
            <input value={editingRoom.floor} onChange={(event) => setEditingRoom({ ...editingRoom, floor: event.target.value })} className={inputClass} placeholder="Floor" />
            <input type="number" min={1} value={editingRoom.capacity} onChange={(event) => setEditingRoom({ ...editingRoom, capacity: Math.max(1, Number(event.target.value)) })} className={inputClass} placeholder="Maximum Occupancy" />
            <input type="number" value={editingRoom.price} onChange={(event) => setEditingRoom({ ...editingRoom, price: Math.max(0, Number(event.target.value)) })} className={inputClass} placeholder="Price" />
            <select value={editingRoom.status} onChange={(event) => setEditingRoom({ ...editingRoom, status: event.target.value as PMSRoomStatus })} className={inputClass}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
          </div>
          <button type="button" onClick={saveEditedRoom} className="mt-4 rounded-full bg-[#d2aa6a] px-5 py-3 text-sm font-black text-black">Save Room</button>
        </AdminPanel>
      ) : null}

      {selectedRoom ? (
        <AdminPanel title={`Room ${selectedRoom.roomNumber} Profile`} action={<button type="button" onClick={() => setSelectedRoom(null)} className="rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white">Close</button>}>
          <div className="grid gap-4 md:grid-cols-4">
            <DetailMetric label="Room Type" value={selectedRoom.roomType} />
            <DetailMetric label="Floor" value={selectedRoom.floor} />
            <DetailMetric label="Maximum Occupancy" value={`${selectedRoom.capacity} guests`} />
            <DetailMetric label="Price" value={currency(selectedRoom.price)} />
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <ActionButton onClick={() => setEditingRoom(selectedRoom)}>Edit Details</ActionButton>
            <ActionButton onClick={() => changeStatus(selectedRoom.roomNumber, "available")}>Mark Available</ActionButton>
            <ActionButton onClick={() => blockRoom(selectedRoom)}>Block Maintenance</ActionButton>
            <ActionButton onClick={() => changeStatus(selectedRoom.roomNumber, "out-of-service")}>Out Of Service</ActionButton>
          </div>
        </AdminPanel>
      ) : null}

      <AdminPanel title="Room Management" action={<FilterBar statusFilter={statusFilter} setStatusFilter={setStatusFilter} typeFilter={typeFilter} setTypeFilter={setTypeFilter} floorFilter={floorFilter} setFloorFilter={setFloorFilter} rooms={rooms} />}>
        <DataTable
          recordType="rooms"
          rows={filteredRooms}
          columns={[
            { header: "Room Number", render: (room) => <span className="font-black">{room.roomNumber}</span> },
            { header: "Room Type", render: (room) => room.roomType },
            { header: "Floor", render: (room) => room.floor },
            { header: "Maximum Occupancy", render: (room) => `${room.capacity} guests` },
            { header: "Price", render: (room) => currency(room.price) },
            { header: "Status", render: (room) => <StatusBadge status={room.status} /> },
            { header: "Actions", render: (room) => <div className="flex flex-wrap gap-2"><ActionButton onClick={() => setSelectedRoom(room)}>View</ActionButton><ActionButton onClick={() => setEditingRoom(room)}>Edit</ActionButton><ActionButton onClick={() => changeStatus(room.roomNumber, "available")}>Unblock</ActionButton><ActionButton onClick={() => blockRoom(room)}>Block</ActionButton><ActionButton onClick={() => changeStatus(room.roomNumber, "out-of-service")}>Out</ActionButton><ActionButton onClick={() => setRooms((current) => current.filter((item) => item.id !== room.id))}>Delete</ActionButton></div> },
          ]}
        />
      </AdminPanel>
      <RoomBlockingForm rooms={rooms} blocks={blocks} setBlocks={setBlocks} setRooms={setRooms} notify={notify} />
    </div>
  );
}

function BookingsModule({ rooms, bookings, setBookings, blocks, notify, search }: { rooms: PMSRoom[]; bookings: BookingRecord[]; setBookings: React.Dispatch<React.SetStateAction<BookingRecord[]>>; blocks: MaintenanceBlock[]; notify: (message: string) => void; search: string }) {
  const [warning, setWarning] = useState("");
  const [form, setForm] = useState({ guestName: "New Guest", phone: "9876507788", email: "guest@example.com", idProof: "AADHAAR **** 0000", checkIn: isoDateAfter(2), checkOut: isoDateAfter(4), guests: 2, roomType: "Deluxe" as PMSRoomType, assignedRoom: rooms[0]?.roomNumber ?? "101", status: "Pending" as BookingStatus });
  const selectedRoom = rooms.find((room) => room.roomNumber === form.assignedRoom);
  const maxOccupancy = selectedRoom?.capacity ?? 1;
  const [guestDetails, setGuestDetails] = useState<AdminGuestDetail[]>(() => Array.from({ length: Math.min(2, maxOccupancy) }, (_, index) => emptyAdminGuest(index)));
  const filteredBookings = bookings.filter((booking) => [booking.id, booking.guestName, booking.assignedRoom, booking.status].some((value) => normalize(value).includes(normalize(search))));

  useEffect(() => {
    setForm((current) => ({ ...current, guests: Math.min(current.guests, maxOccupancy) }));
    setGuestDetails((current) => {
      const target = Math.min(form.guests, maxOccupancy);
      if (current.length > target) return current.slice(0, target);
      if (current.length < target) return [...current, ...Array.from({ length: target - current.length }, (_, index) => emptyAdminGuest(current.length + index))];
      return current;
    });
  }, [form.assignedRoom, form.guests, maxOccupancy]);

  const updateGuestDetail = (index: number, field: keyof AdminGuestDetail, value: string) => {
    setGuestDetails((current) => current.map((guest, guestIndex) => guestIndex === index ? { ...guest, [field]: value } : guest));
  };

  const addGuest = () => {
    if (guestDetails.length >= maxOccupancy) {
      setWarning(`Maximum occupancy reached. This room can accommodate only ${maxOccupancy} guests. Please choose another room or reduce the number of guests.`);
      return;
    }
    setForm((current) => ({ ...current, guests: current.guests + 1 }));
  };

  const createBooking = () => {
    if (form.guests > maxOccupancy || guestDetails.length > maxOccupancy) {
      setWarning(`Maximum occupancy reached. This room can accommodate only ${maxOccupancy} guests. Please choose another room or reduce the number of guests.`);
      return;
    }
    if (hasRoomConflict(form.assignedRoom, form.checkIn, form.checkOut, bookings, blocks, rooms)) {
      setWarning("This room is unavailable for the selected dates.");
      notify("This room is unavailable for the selected dates.");
      return;
    }
    const room = rooms.find((item) => item.roomNumber === form.assignedRoom);
    const nights = Math.max(1, Math.ceil((new Date(form.checkOut).getTime() - new Date(form.checkIn).getTime()) / 86400000));
    setBookings((current) => [{ id: `BKG-${Date.now().toString().slice(-5)}`, ...form, maxOccupancy, guestDetails: guestDetails.slice(0, form.guests), amount: (room?.price ?? 9000) * nights }, ...current]);
    setWarning("");
    notify("Booking created without conflicts.");
  };

  const updateStatus = (id: string, status: BookingStatus) => {
    setBookings((current) => current.map((booking) => booking.id === id ? { ...booking, status } : booking));
    notify(`Booking ${id} updated to ${status}.`);
  };

  return (
    <div className="space-y-6">
      <AdminPanel title="Create Booking">
        <div className="grid gap-3 md:grid-cols-4">
          <input value={form.guestName} onChange={(event) => setForm({ ...form, guestName: event.target.value })} className={inputClass} placeholder="Guest Name" />
          <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className={inputClass} placeholder="Phone Number" />
          <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={inputClass} placeholder="Email" />
          <input value={form.idProof} onChange={(event) => setForm({ ...form, idProof: event.target.value })} className={inputClass} placeholder="ID Proof" />
          <input type="date" value={form.checkIn} onChange={(event) => setForm({ ...form, checkIn: event.target.value })} className={inputClass} />
          <input type="date" value={form.checkOut} onChange={(event) => setForm({ ...form, checkOut: event.target.value })} className={inputClass} />
          <input type="number" min={1} max={maxOccupancy} value={form.guests} onChange={(event) => setForm({ ...form, guests: Math.min(maxOccupancy, Math.max(1, Number(event.target.value))) })} className={inputClass} placeholder="Number Of Guests" />
          <select value={form.roomType} onChange={(event) => setForm({ ...form, roomType: event.target.value as PMSRoomType })} className={inputClass}>{pmsRoomTypes.map((item) => <option key={item}>{item}</option>)}</select>
          <select value={form.assignedRoom} onChange={(event) => setForm({ ...form, assignedRoom: event.target.value })} className={inputClass}>{rooms.map((room) => <option key={room.id} value={room.roomNumber}>{room.roomNumber} - {room.roomType}</option>)}</select>
          <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as BookingStatus })} className={inputClass}>{["Pending", "Confirmed", "Checked-In", "Checked-Out", "Cancelled"].map((item) => <option key={item}>{item}</option>)}</select>
          <button type="button" onClick={createBooking} className="rounded-2xl bg-[#d2aa6a] px-4 py-3 text-sm font-black text-black md:col-span-2">Create Booking</button>
        </div>
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-black text-white">Maximum Occupancy: {maxOccupancy} Guests</p>
            <button type="button" onClick={addGuest} disabled={guestDetails.length >= maxOccupancy} className="rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-40">Add Guest</button>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {guestDetails.map((guest, index) => (
              <div key={index} className="rounded-2xl bg-black/20 p-3">
                <p className="mb-3 text-sm font-black text-[#d2aa6a]">Guest {index + 1}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input value={guest.name} onChange={(event) => updateGuestDetail(index, "name", event.target.value)} className={inputClass} placeholder="Name" />
                  <input value={guest.age} onChange={(event) => updateGuestDetail(index, "age", event.target.value)} className={inputClass} placeholder="Age" />
                  <select value={guest.gender} onChange={(event) => updateGuestDetail(index, "gender", event.target.value)} className={inputClass}><option value="">Gender</option><option>Female</option><option>Male</option><option>Other</option></select>
                  <input value={guest.idProof} onChange={(event) => updateGuestDetail(index, "idProof", event.target.value)} className={inputClass} placeholder="ID Proof" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {warning ? <p className="mt-3 rounded-2xl bg-red-500/15 px-4 py-3 text-sm font-black text-red-100">{warning}</p> : null}
      </AdminPanel>
      <AdminPanel title="Booking Management">
        <DataTable
          recordType="bookings"
          rows={filteredBookings}
          columns={[
            { header: "Booking ID", render: (booking) => <span className="font-black">{booking.id}</span> },
            { header: "Guest", render: (booking) => booking.guestName },
            { header: "Phone", render: (booking) => booking.phone },
            { header: "Dates", render: (booking) => `${booking.checkIn} to ${booking.checkOut}` },
            { header: "Guests", render: (booking) => booking.guests },
            { header: "Occupancy", render: (booking) => `${booking.guests} / ${booking.maxOccupancy ?? rooms.find((room) => room.roomNumber === booking.assignedRoom)?.capacity ?? booking.guests} Guests` },
            { header: "Room", render: (booking) => booking.assignedRoom },
            { header: "Status", render: (booking) => <TextBadge text={booking.status} /> },
            { header: "Actions", render: (booking) => <div className="flex flex-wrap gap-2"><ActionButton onClick={() => updateStatus(booking.id, "Confirmed")}>Approve</ActionButton><ActionButton onClick={() => updateStatus(booking.id, "Cancelled")}>Cancel</ActionButton><ActionButton onClick={() => updateStatus(booking.id, "Checked-In")}>Check In</ActionButton></div> },
          ]}
        />
      </AdminPanel>
    </div>
  );
}

function GuestsModule({ search, bookings }: { search: string; bookings: BookingRecord[] }) {
  const generatedGuests = bookings
    .filter((booking) => booking.email)
    .map((booking) => ({
      id: `GST-${booking.id}`,
      fullName: booking.guestName,
      phone: booking.phone,
      email: booking.email,
      address: "Captured at check-in",
      identityNumber: booking.idProof,
      loyaltyPoints: 1200,
      bookingHistory: [booking.id],
      stayHistory: [`Room ${booking.assignedRoom}`],
    }));
  const [rows, setRows] = useState(() => [...generatedGuests, ...guestRecords]);
  const [selectedGuest, setSelectedGuest] = useState<GuestRecord | null>(null);
  const [editingGuest, setEditingGuest] = useState<GuestRecord | null>(null);
  const [newGuest, setNewGuest] = useState<GuestRecord>({
    id: `GST-${Date.now().toString().slice(-5)}`,
    fullName: "",
    phone: "",
    email: "",
    address: "",
    identityNumber: "",
    loyaltyPoints: 0,
    bookingHistory: [],
    stayHistory: [],
  });

  useEffect(() => {
    setRows((current) => {
      const existingIds = new Set(current.map((guest) => guest.id));
      return [...generatedGuests.filter((guest) => !existingIds.has(guest.id)), ...current];
    });
  }, [bookings.length]);

  const filteredRows = rows.filter((guest) => [guest.id, guest.fullName, guest.phone, guest.email, guest.identityNumber].some((value) => normalize(value).includes(normalize(search))));
  const activeGuest = editingGuest ?? newGuest;
  const setActiveGuest = (guest: GuestRecord) => editingGuest ? setEditingGuest(guest) : setNewGuest(guest);

  const saveGuest = () => {
    if (!activeGuest.fullName || !activeGuest.phone || !activeGuest.email || !activeGuest.identityNumber) return;
    if (editingGuest) {
      setRows((current) => current.map((guest) => guest.id === editingGuest.id ? activeGuest : guest));
      setSelectedGuest(activeGuest);
      setEditingGuest(null);
      return;
    }
    setRows((current) => [{ ...newGuest, id: `GST-${Date.now().toString().slice(-5)}` }, ...current]);
    setNewGuest({ id: `GST-${Date.now().toString().slice(-5)}`, fullName: "", phone: "", email: "", address: "", identityNumber: "", loyaltyPoints: 0, bookingHistory: [], stayHistory: [] });
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Total Guests" value={rows.length} index={0} />
        <KpiCard label="Guests With Bookings" value={rows.filter((guest) => guest.bookingHistory.length).length} index={1} />
        <KpiCard label="Loyalty Points" value={rows.reduce((sum, guest) => sum + guest.loyaltyPoints, 0).toLocaleString("en-IN")} index={2} />
        <KpiCard label="VIP Ready" value={rows.filter((guest) => guest.loyaltyPoints >= 10000).length} index={3} />
      </div>

      <AdminPanel title={editingGuest ? `Edit ${editingGuest.fullName}` : "Add Guest Profile"} action={editingGuest ? <button type="button" onClick={() => setEditingGuest(null)} className="rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white">Cancel Edit</button> : null}>
        <div className="grid gap-3 md:grid-cols-4">
          <input value={activeGuest.fullName} onChange={(event) => setActiveGuest({ ...activeGuest, fullName: event.target.value })} className={inputClass} placeholder="Full Name" />
          <input value={activeGuest.phone} onChange={(event) => setActiveGuest({ ...activeGuest, phone: event.target.value })} className={inputClass} placeholder="Phone" />
          <input value={activeGuest.email} onChange={(event) => setActiveGuest({ ...activeGuest, email: event.target.value })} className={inputClass} placeholder="Email" />
          <input value={activeGuest.identityNumber} onChange={(event) => setActiveGuest({ ...activeGuest, identityNumber: event.target.value })} className={inputClass} placeholder="Aadhaar / Passport" />
          <input value={activeGuest.address} onChange={(event) => setActiveGuest({ ...activeGuest, address: event.target.value })} className={inputClass} placeholder="Address" />
          <input type="number" value={activeGuest.loyaltyPoints} onChange={(event) => setActiveGuest({ ...activeGuest, loyaltyPoints: Math.max(0, Number(event.target.value)) })} className={inputClass} placeholder="Loyalty Points" />
          <input value={activeGuest.bookingHistory.join(", ")} onChange={(event) => setActiveGuest({ ...activeGuest, bookingHistory: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} className={inputClass} placeholder="Booking History IDs" />
          <button type="button" onClick={saveGuest} className="rounded-2xl bg-[#d2aa6a] px-4 py-3 text-sm font-black text-black">{editingGuest ? "Save Guest" : "Add Guest"}</button>
        </div>
      </AdminPanel>

      {selectedGuest ? (
        <AdminPanel title={`${selectedGuest.fullName} Profile`} action={<button type="button" onClick={() => setSelectedGuest(null)} className="rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white">Close</button>}>
          <div className="grid gap-4 md:grid-cols-4">
            <DetailMetric label="Guest ID" value={selectedGuest.id} />
            <DetailMetric label="Phone" value={selectedGuest.phone} />
            <DetailMetric label="Loyalty Points" value={selectedGuest.loyaltyPoints.toLocaleString("en-IN")} />
            <DetailMetric label="Identity" value={selectedGuest.identityNumber} />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <CompactList items={selectedGuest.bookingHistory.length ? selectedGuest.bookingHistory.map((item) => `Booking: ${item}`) : ["No booking history yet"]} />
            <CompactList items={selectedGuest.stayHistory.length ? selectedGuest.stayHistory.map((item) => `Stay: ${item}`) : ["No stay history yet"]} />
          </div>
        </AdminPanel>
      ) : null}

      <AdminPanel title="Guest Management">
        <DataTable
          recordType="guests"
          rows={filteredRows}
          columns={[
            { header: "Guest ID", render: (guest) => <span className="font-black">{guest.id}</span> },
            { header: "Full Name", render: (guest) => guest.fullName },
            { header: "Phone", render: (guest) => guest.phone },
            { header: "Email", render: (guest) => guest.email },
            { header: "Aadhaar / Passport", render: (guest) => guest.identityNumber },
            { header: "Loyalty", render: (guest) => guest.loyaltyPoints.toLocaleString("en-IN") },
            { header: "Actions", render: (guest) => <div className="flex flex-wrap gap-2"><ActionButton onClick={() => setSelectedGuest(guest)}>View Profile</ActionButton><ActionButton onClick={() => setEditingGuest(guest)}>Edit</ActionButton></div> },
          ]}
        />
      </AdminPanel>
    </div>
  );
}

function CorporateModule({ rows, setRows, search, notify }: { rows: CorporateBooking[]; setRows: React.Dispatch<React.SetStateAction<CorporateBooking[]>>; search: string; notify: (message: string) => void }) {
  const filtered = rows.filter((row) => [row.id, row.companyName, row.coordinator].some((value) => normalize(value).includes(normalize(search))));
  const setStatus = (id: string, status: CorporateBooking["status"]) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, status } : row));
    notify(`Corporate booking ${id} marked ${status}.`);
  };
  return (
    <AdminPanel title="Corporate Bookings">
      <DataTable
        recordType="corporate"
        rows={filtered}
        columns={[
          { header: "Company", render: (row) => <span className="font-black">{row.companyName}</span> },
          { header: "Coordinator", render: (row) => row.coordinator },
          { header: "Rooms", render: (row) => row.numberOfRooms },
          { header: "Stay Dates", render: (row) => row.stayDates },
          { header: "Special Requests", render: (row) => row.specialRequests },
          { header: "Status", render: (row) => <TextBadge text={row.status} /> },
          { header: "Actions", render: (row) => <div className="flex flex-wrap gap-2"><ActionButton onClick={() => setStatus(row.id, "Approved")}>Approve</ActionButton><ActionButton onClick={() => setStatus(row.id, "Rejected")}>Reject</ActionButton><ActionButton onClick={() => setStatus(row.id, "Priority")}>Priority</ActionButton></div> },
        ]}
      />
    </AdminPanel>
  );
}

function SelfCheckInModule({ search }: { search: string }) {
  const rows = selfCheckIns.filter((row) => [row.id, row.guestName, row.roomAssignment].some((value) => normalize(value).includes(normalize(search))));
  return (
    <AdminPanel title="Self Check-in Management">
      <DataTable recordType="self-check-in" rows={rows} columns={[
        { header: "Guest", render: (row) => <span className="font-black">{row.guestName}</span> },
        { header: "Guest Verification", render: (row) => <TextBadge text={row.guestVerification} /> },
        { header: "ID Verification", render: (row) => <TextBadge text={row.idVerification} /> },
        { header: "Check-in Time", render: (row) => row.checkInTime },
        { header: "Room Assignment", render: (row) => row.roomAssignment },
        { header: "Status", render: (row) => <TextBadge text={row.status} /> },
      ]} />
    </AdminPanel>
  );
}

function HousekeepingModule({ rows, setRows, search, notify }: { rows: HousekeepingTask[]; setRows: React.Dispatch<React.SetStateAction<HousekeepingTask[]>>; search: string; notify: (message: string) => void }) {
  const filtered = rows.filter((row) => [row.id, row.roomNumber, row.task, row.assignedStaff].some((value) => normalize(value).includes(normalize(search))));
  const updateStatus = (id: string, status: TaskStatus) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, status, remarks: `${row.remarks} Status updated to ${status}.` } : row));
    notify(`Housekeeping task ${id} updated.`);
  };
  return (
    <AdminPanel title="Housekeeping Management">
      <DataTable recordType="housekeeping" rows={filtered} columns={[
        { header: "Room", render: (row) => <span className="font-black">{row.roomNumber}</span> },
        { header: "Task", render: (row) => row.task },
        { header: "Assigned Staff", render: (row) => row.assignedStaff },
        { header: "Status", render: (row) => <TextBadge text={row.status} /> },
        { header: "Remarks", render: (row) => row.remarks },
        { header: "Actions", render: (row) => <div className="flex flex-wrap gap-2"><ActionButton onClick={() => updateStatus(row.id, "In Progress")}>Start</ActionButton><ActionButton onClick={() => updateStatus(row.id, "Completed")}>Complete</ActionButton></div> },
      ]} />
    </AdminPanel>
  );
}

function RoomServiceModule({ rows, setRows, search, notify }: { rows: ServiceRequest[]; setRows: React.Dispatch<React.SetStateAction<ServiceRequest[]>>; search: string; notify: (message: string) => void }) {
  const filtered = rows.filter((row) => [row.id, row.guestName, row.roomNumber, row.requestType].some((value) => normalize(value).includes(normalize(search))));
  const updateStatus = (id: string, status: TaskStatus) => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, status } : row));
    notify(`Room service request ${id} updated.`);
  };
  return (
    <AdminPanel title="Room Service Management">
      <DataTable recordType="room-service" rows={filtered} columns={[
        { header: "Guest", render: (row) => <span className="font-black">{row.guestName}</span> },
        { header: "Room", render: (row) => row.roomNumber },
        { header: "Request Type", render: (row) => row.requestType },
        { header: "Request Time", render: (row) => row.requestTime },
        { header: "Status", render: (row) => <TextBadge text={row.status} /> },
        { header: "Actions", render: (row) => <div className="flex flex-wrap gap-2"><ActionButton onClick={() => updateStatus(row.id, "In Progress")}>Assign</ActionButton><ActionButton onClick={() => updateStatus(row.id, "Completed")}>Complete</ActionButton></div> },
      ]} />
    </AdminPanel>
  );
}

function ComplaintsModule({ rows, setRows, search, notify }: { rows: ComplaintRecord[]; setRows: React.Dispatch<React.SetStateAction<ComplaintRecord[]>>; search: string; notify: (message: string) => void }) {
  const filtered = rows.filter((row) => [row.id, row.guestName, row.roomNumber, row.description].some((value) => normalize(value).includes(normalize(search))));
  const setStatus = (id: string, status: "Open" | "Under Review" | "Resolved") => {
    setRows((current) => current.map((row) => row.id === id ? { ...row, status } : row));
    notify(`Complaint ${id} updated to ${status}.`);
  };
  return (
    <AdminPanel title="Complaint Management">
      <DataTable recordType="complaints" rows={filtered} columns={[
        { header: "Complaint ID", render: (row) => <span className="font-black">{row.id}</span> },
        { header: "Guest", render: (row) => row.guestName },
        { header: "Room", render: (row) => row.roomNumber },
        { header: "Description", render: (row) => row.description },
        { header: "Priority", render: (row) => <PriorityBadge priority={row.priority} /> },
        { header: "Status", render: (row) => <TextBadge text={row.status} /> },
        { header: "Actions", render: (row) => <div className="flex flex-wrap gap-2"><ActionButton onClick={() => setStatus(row.id, "Under Review")}>Review</ActionButton><ActionButton onClick={() => setStatus(row.id, "Resolved")}>Resolve</ActionButton></div> },
      ]} />
    </AdminPanel>
  );
}

function FeedbackModule({ rows }: { rows: FeedbackRecord[] }) {
  const average = rows.length ? rows.reduce((sum, item) => sum + item.rating, 0) / rows.length : 0;
  const positive = rows.filter((item) => item.rating >= 4).length;
  const negative = rows.filter((item) => item.rating <= 3).length;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard label="Average Rating" value={average.toFixed(1)} index={0} />
        <KpiCard label="Positive Reviews" value={positive} index={1} />
        <KpiCard label="Negative Reviews" value={negative} index={2} />
      </div>
      <AdminPanel title="Feedback Management">
        <DataTable recordType="feedback" rows={rows} columns={[
          { header: "Guest", render: (row) => <span className="font-black">{row.guestName}</span> },
          { header: "Rating", render: (row) => `${row.rating}/5` },
          { header: "Feedback", render: (row) => row.feedback },
        ]} />
      </AdminPanel>
    </div>
  );
}

function PaymentsModule({ rows, search }: { rows: PaymentRecord[]; search: string }) {
  const filteredRows = rows.filter((row) => [row.id, row.invoiceNumber, row.guestName, row.method, row.status].some((value) => normalize(value).includes(normalize(search))));
  return (
    <AdminPanel title="Payments & GST">
      <DataTable recordType="payments" rows={filteredRows} columns={[
        { header: "Invoice Number", render: (row) => <span className="font-black">{row.invoiceNumber}</span> },
        { header: "Guest", render: (row) => row.guestName },
        { header: "Amount", render: (row) => currency(row.amount) },
        { header: "GST Amount", render: (row) => currency(row.gstAmount) },
        { header: "Method", render: (row) => row.method },
        { header: "Status", render: (row) => <TextBadge text={row.status} /> },
      ]} />
    </AdminPanel>
  );
}

function InvoicesModule({ rows, search, notify }: { rows: AdminInvoice[]; search: string; notify: (message: string) => void }) {
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [guestFilter, setGuestFilter] = useState("");

  const [selectedGstRow, setSelectedGstRow] = useState<AdminInvoice | null>(null);
  const [selectedPaymentRow, setSelectedPaymentRow] = useState<AdminInvoice | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const filteredRows = rows.filter((row) => {
    const matchesSearch = [row.invoiceNumber, row.bookingId, row.guestName, row.guestEmail, row.roomNumber].some((value) => normalize(value).includes(normalize(search)));
    const matchesPayment = paymentFilter === "All" || row.paymentStatus.toLowerCase() === paymentFilter.toLowerCase();
    
    // Guest filter
    const matchesGuest = !guestFilter || normalize(row.guestName).includes(normalize(guestFilter)) || normalize(row.guestEmail).includes(normalize(guestFilter));
    
    // Date filter
    let matchesDate = true;
    if (row.createdAt) {
      const rowDate = row.createdAt.slice(0, 10); // "YYYY-MM-DD"
      if (startDate && rowDate < startDate) matchesDate = false;
      if (endDate && rowDate > endDate) matchesDate = false;
    } else if (startDate || endDate) {
      matchesDate = false;
    }

    return matchesSearch && matchesPayment && matchesGuest && matchesDate;
  });

  const handleDownload = (row: AdminInvoice) => {
    try {
      const invoice = mapApiRecordToInvoice(row.rawRecord);
      downloadInvoice(invoice);
      notify(`Invoice ${row.invoiceNumber} PDF download started.`);
    } catch {
      notify("Failed to generate and download invoice PDF.");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEmail = (row: AdminInvoice) => {
    notify(`Invoice ${row.invoiceNumber} tax breakdown email queued for ${row.guestEmail || "guest"}.`);
  };

  const handleRegenerate = async (bookingId: string) => {
    try {
      notify("Regenerating invoice in Firestore...");
      const response = await apiClient.post(`/bookings/${bookingId}/invoice?force=true`, {});
      notify("Invoice successfully recalculated and updated in Firestore.");
      window.setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      notify("Failed to regenerate invoice: " + (err.response?.data?.message || err.message));
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard label="Total Invoices" value={rows.length} index={0} />
        <KpiCard label="Paid" value={rows.filter((row) => row.paymentStatus.toLowerCase() === "paid").length} index={1} />
        <KpiCard label="GST Collected" value={currency(rows.reduce((sum, row) => sum + row.gstAmount, 0))} index={2} />
        <KpiCard label="Invoice Revenue" value={currency(rows.reduce((sum, row) => sum + row.totalAmount, 0))} index={3} />
      </div>

      {/* Date & Guest Filter Row */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 bg-white/5 p-4 rounded-[1.6rem] border border-white/10">
        <div>
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d2aa6a]">Guest Name / Email</label>
          <input
            type="text"
            value={guestFilter}
            onChange={(e) => setGuestFilter(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-2 mt-1 text-xs font-semibold text-white outline-none placeholder:text-white/35 focus:border-[#d2aa6a]"
            placeholder="Filter by guest..."
          />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d2aa6a]">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-2 mt-1 text-xs font-semibold text-white outline-none focus:border-[#d2aa6a]"
          />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d2aa6a]">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-2 mt-1 text-xs font-semibold text-white outline-none focus:border-[#d2aa6a]"
          />
        </div>
        <div>
          <label className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d2aa6a]">Payment Status</label>
          <select
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-2 mt-1 text-xs font-semibold text-white outline-none focus:border-[#d2aa6a]"
          >
            <option>All</option>
            <option>Paid</option>
            <option>Pending</option>
            <option>Failed</option>
          </select>
        </div>
      </div>

      <AdminPanel title="Invoices Module">
        <DataTable
          recordType="invoices"
          rows={filteredRows}
          columns={[
            { header: "Invoice", render: (row) => <button type="button" onClick={() => setSelectedInvoice(mapApiRecordToInvoice(row.rawRecord))} className="font-black text-left hover:text-[#d2aa6a] underline">{row.invoiceNumber || row.id}</button> },
            { header: "Guest", render: (row) => row.guestName },
            { header: "Booking", render: (row) => row.bookingId },
            { header: "Room", render: (row) => row.roomNumber },
            { header: "GST", render: (row) => currency(row.gstAmount) },
            { header: "Total", render: (row) => currency(row.totalAmount) },
            { header: "Status", render: (row) => <TextBadge text={`${row.paymentStatus} / ${row.invoiceStatus}`} /> },
            { header: "Actions", render: (row) => <div className="flex flex-wrap gap-2">
              <ActionButton onClick={() => setSelectedInvoice(mapApiRecordToInvoice(row.rawRecord))}>View</ActionButton>
              <ActionButton onClick={() => handleDownload(row)}>Download</ActionButton>
              <ActionButton onClick={handlePrint}>Print</ActionButton>
              <ActionButton onClick={() => handleEmail(row)}>Email</ActionButton>
              <ActionButton onClick={() => setSelectedGstRow(row)}>GST Details</ActionButton>
              <ActionButton onClick={() => setSelectedPaymentRow(row)}>Payment Details</ActionButton>
              <ActionButton onClick={() => handleRegenerate(row.bookingId)}>Regenerate</ActionButton>
            </div> },
          ]}
        />
      </AdminPanel>

      {/* GST Details Modal */}
      {selectedGstRow && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#1d1712] text-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-[#d2aa6a] mb-4">GST Tax Details</h3>
            <div className="space-y-3 text-sm">
              <p><span className="text-white/60 font-bold">Invoice Number:</span> {selectedGstRow.invoiceNumber}</p>
              <p><span className="text-white/60 font-bold">Booking ID:</span> {selectedGstRow.bookingId}</p>
              <p><span className="text-white/60 font-bold">Guest Name:</span> {selectedGstRow.guestName}</p>
              <hr className="border-white/10" />
              <p><span className="text-white/60 font-bold">Taxable Amount:</span> {currency(selectedGstRow.totalAmount - selectedGstRow.gstAmount)}</p>
              <p><span className="text-white/60 font-bold">CGST (6%):</span> {currency(selectedGstRow.gstAmount / 2)}</p>
              <p><span className="text-white/60 font-bold">SGST (6%):</span> {currency(selectedGstRow.gstAmount / 2)}</p>
              <p className="text-base font-black text-[#d2aa6a]"><span className="text-white/60 font-bold">Total GST (12%):</span> {currency(selectedGstRow.gstAmount)}</p>
              <hr className="border-white/10" />
              <p><span className="text-white/60 font-bold">GSTIN:</span> 29ABCDE1234F1Z5</p>
              <p><span className="text-white/60 font-bold">HSN/SAC Code:</span> 996311</p>
            </div>
            <button type="button" onClick={() => setSelectedGstRow(null)} className="mt-6 w-full rounded-full bg-[#d2aa6a] py-2 text-xs font-black text-black">Close</button>
          </div>
        </div>
      )}

      {/* Payment Details Modal */}
      {selectedPaymentRow && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#1d1712] text-white p-6 shadow-2xl">
            <h3 className="text-lg font-black text-[#d2aa6a] mb-4">Payment Details</h3>
            <div className="space-y-3 text-sm">
              <p><span className="text-white/60 font-bold">Invoice Number:</span> {selectedPaymentRow.invoiceNumber}</p>
              <p><span className="text-white/60 font-bold">Booking ID:</span> {selectedPaymentRow.bookingId}</p>
              <p><span className="text-white/60 font-bold">Guest Name:</span> {selectedPaymentRow.guestName}</p>
              <hr className="border-white/10" />
              <p><span className="text-white/60 font-bold">Payment Method:</span> {selectedPaymentRow.rawRecord?.payment?.provider || selectedPaymentRow.rawRecord?.booking?.payment_method || "UPI"}</p>
              <p><span className="text-white/60 font-bold">Transaction ID:</span> {selectedPaymentRow.rawRecord?.payment?.provider_payment_id || selectedPaymentRow.rawRecord?.paymentId || "N/A"}</p>
              <p><span className="text-white/60 font-bold">Payment Status:</span> {selectedPaymentRow.paymentStatus}</p>
              <p><span className="text-white/60 font-bold">Grand Total Amount:</span> {currency(selectedPaymentRow.totalAmount)}</p>
              <p><span className="text-white/60 font-bold">Issued At:</span> {selectedPaymentRow.createdAt ? new Date(selectedPaymentRow.createdAt).toLocaleString("en-IN") : "N/A"}</p>
            </div>
            <button type="button" onClick={() => setSelectedPaymentRow(null)} className="mt-6 w-full rounded-full bg-[#d2aa6a] py-2 text-xs font-black text-black">Close</button>
          </div>
        </div>
      )}

      {/* Full Invoice Modal */}
      {selectedInvoice && (
        <InvoiceModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onRegenerate={() => handleRegenerate(selectedInvoice.bookingId || "")}
        />
      )}
    </div>
  );
}

function RevenueModule() {
  const dailyRevenue = { labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], datasets: [{ label: "Daily Revenue", data: [118000, 142000, 137000, 165000, 188000, 226000, 214000], borderColor: "#d2aa6a", backgroundColor: "rgba(210,170,106,0.18)", fill: true, tension: 0.45 }] };
  const monthlyRevenue = { labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"], datasets: [{ label: "Monthly Revenue", data: [2800000, 3100000, 3520000, 3890000, 4200000, 4580000], backgroundColor: "rgba(210,170,106,0.78)", borderRadius: 14 }] };
  const roomPerformance = { labels: pmsRoomTypes, datasets: [{ label: "Room Type Performance", data: [64, 72, 81, 88, 92], backgroundColor: ["#10b981", "#3b82f6", "#d2aa6a", "#fb7185", "#a855f7"], borderWidth: 0 }] };
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <ChartPanel title="Daily Revenue"><Line data={dailyRevenue} options={chartOptions} /></ChartPanel>
      <ChartPanel title="Weekly / Monthly Revenue"><Bar data={monthlyRevenue} options={chartOptions} /></ChartPanel>
      <ChartPanel title="Occupancy Rate"><Line data={{ labels: ["W1", "W2", "W3", "W4"], datasets: [{ label: "Occupancy Rate", data: [71, 78, 82, 86], borderColor: "#10b981", backgroundColor: "rgba(16,185,129,0.16)", fill: true, tension: 0.45 }] }} options={chartOptions} /></ChartPanel>
      <ChartPanel title="Room Type Performance"><Doughnut data={roomPerformance} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: "#f8ead2" } } } }} /></ChartPanel>
      <AdminPanel title="Revenue Forecast"><CompactList items={["Next 7 days forecast: INR 14.8L", "Executive Suite ADR can rise by 9 percent this weekend.", "Corporate demand is likely to absorb 18 rooms in mid-month window."]} /></AdminPanel>
    </div>
  );
}

function AiModule() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {aiRecommendations.map((item, index) => (
        <motion.div key={item} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }} className={panelClass}>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-[#d2aa6a]">AI Recommendation</p>
          <p className="mt-3 text-lg font-bold leading-7 text-white">{item}</p>
        </motion.div>
      ))}
    </div>
  );
}

function NotificationsModule({ rows, logs, search, notify, setRows }: { rows: AdminNotification[]; logs: NotificationLog[]; search: string; notify: (message: string) => void; setRows: React.Dispatch<React.SetStateAction<AdminNotification[]>> }) {
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedNotification, setSelectedNotification] = useState<AdminNotification | null>(null);
  const filteredRows = rows.filter((row) => {
    const matchesStatus = statusFilter === "All" || row.status === statusFilter;
    const matchesSearch = [row.id, row.bookingId, row.phoneNumber, row.notificationType, row.message].some((value) => normalize(value).includes(normalize(search)));
    return matchesStatus && matchesSearch;
  });
  const counts = [
    ["Pending Notifications", rows.filter((row) => row.status === "Pending").length],
    ["Sent Notifications", rows.filter((row) => row.status === "Sent").length],
    ["Failed Notifications", rows.filter((row) => row.status === "Failed").length],
    ["Cancelled Notifications", rows.filter((row) => row.status === "Cancelled").length],
  ];

  const resend = (notification: AdminNotification) => {
    void apiClient.post(`/notifications/${notification.id}/resend`).catch(() => undefined);
    setRows((current) => current.map((row) => row.id === notification.id ? { ...row, status: "Pending", retryCount: 0 } : row));
    notify(`Notification ${notification.id} queued for resend.`);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        {counts.map(([label, value], index) => <KpiCard key={label} label={String(label)} value={value} index={index} />)}
      </div>
      <AdminPanel title="WhatsApp Notification Dashboard" action={<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold text-white"><option>All</option><option>Pending</option><option>Sent</option><option>Failed</option><option>Cancelled</option></select>}>
        <DataTable
          recordType="notifications"
          rows={filteredRows}
          columns={[
            { header: "Type", render: (row) => <span className="font-black">{row.notificationType}</span> },
            { header: "Booking", render: (row) => row.bookingId || "Admin" },
            { header: "Phone", render: (row) => row.phoneNumber || "Not set" },
            { header: "Status", render: (row) => <TextBadge text={row.status} /> },
            { header: "Retries", render: (row) => row.retryCount ?? 0 },
            { header: "Actions", render: (row) => <div className="flex flex-wrap gap-2"><ActionButton onClick={() => setSelectedNotification(row)}>View Details</ActionButton><ActionButton onClick={() => resend(row)}>Resend</ActionButton></div> },
          ]}
        />
      </AdminPanel>
      {selectedNotification ? (
        <AdminPanel title="Notification Details" action={<button type="button" onClick={() => setSelectedNotification(null)} className="rounded-full bg-white/10 px-4 py-2 text-xs font-black text-white">Close</button>}>
          <div className="grid gap-4 md:grid-cols-3">
            <DetailMetric label="Notification ID" value={selectedNotification.id} />
            <DetailMetric label="Booking ID" value={selectedNotification.bookingId || "Admin"} />
            <DetailMetric label="Status" value={selectedNotification.status} />
          </div>
          <p className="mt-5 whitespace-pre-wrap rounded-2xl bg-white/8 p-4 text-sm font-semibold leading-6 text-[#c8b8a3]">{selectedNotification.message}</p>
        </AdminPanel>
      ) : null}
      <AdminPanel title="Notification Logs">
        <DataTable
          recordType="notification_logs"
          rows={logs}
          columns={[
            { header: "Type", render: (row) => row.messageType || "Notification" },
            { header: "Booking", render: (row) => row.bookingId || "Admin" },
            { header: "Phone", render: (row) => row.phoneNumber || "Not set" },
            { header: "Delivery", render: (row) => <TextBadge text={row.deliveryStatus || "logged"} /> },
          ]}
        />
      </AdminPanel>
    </div>
  );
}

function HistoryModule({ search }: { search: string }) {
  const rows = actionHistoryRecords.filter((row) => [row.id, row.createdBy, row.updatedBy, row.actionType].some((value) => normalize(value).includes(normalize(search))));
  return (
    <AdminPanel title="Action History">
      <DataTable recordType="history" rows={rows} columns={[
        { header: "Created By", render: (row) => row.createdBy },
        { header: "Updated By", render: (row) => row.updatedBy },
        { header: "Action Type", render: (row) => <span className="font-black">{row.actionType}</span> },
        { header: "Timestamp", render: (row) => row.timestamp },
        { header: "Status Changes", render: (row) => row.statusChanges },
      ]} />
    </AdminPanel>
  );
}

function ReportsModule({ notify }: { notify: (message: string) => void }) {
  const exportReport = (name: string, format: "PDF" | "CSV" | "Excel") => notify(`${name} export queued as ${format}.`);
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {reportDefinitions.map((report) => (
        <div key={report} className={panelClass}>
          <p className="text-xl font-black text-white">{report}</p>
          <p className="mt-2 text-sm leading-6 text-[#c8b8a3]">Generate and export operational reports for audit, management meetings, and revenue review.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <ActionButton onClick={() => exportReport(report, "PDF")}>PDF</ActionButton>
            <ActionButton onClick={() => exportReport(report, "CSV")}>CSV</ActionButton>
            <ActionButton onClick={() => exportReport(report, "Excel")}>Excel</ActionButton>
          </div>
        </div>
      ))}
    </div>
  );
}

function MaintenanceModule({ rooms, setRooms, blocks, setBlocks, notify, search }: { rooms: PMSRoom[]; setRooms: React.Dispatch<React.SetStateAction<PMSRoom[]>>; blocks: MaintenanceBlock[]; setBlocks: React.Dispatch<React.SetStateAction<MaintenanceBlock[]>>; notify: (message: string) => void; search: string }) {
  const maintenanceKpis = [
    { label: "Total Rooms", value: rooms.length },
    { label: "Available Rooms", value: rooms.filter((room) => room.status === "available").length },
    { label: "Booked Rooms", value: rooms.filter((room) => room.status === "booked").length },
    { label: "Blocked Rooms", value: blocks.filter((block) => block.status !== "Completed").length },
    { label: "Under Maintenance", value: rooms.filter((room) => room.status === "maintenance").length },
    { label: "Out Of Service", value: rooms.filter((room) => room.status === "out-of-service").length },
  ];
  const rows = blocks.filter((block) => [block.id, block.roomNumber, block.reason, block.assignedStaff, block.status].some((value) => normalize(value).includes(normalize(search))));
  const updateBlock = (id: string, status: MaintenanceBlock["status"]) => {
    const block = blocks.find((item) => item.id === id);
    setBlocks((current) => current.map((item) => item.id === id ? { ...item, status } : item));
    if (status === "Completed" && block) {
      setRooms((current) => current.map((room) => room.roomNumber === block.roomNumber ? { ...room, status: "available" } : room));
    }
    notify(status === "Completed" ? "Maintenance completed. Room released to Available." : `Maintenance ${id} updated.`);
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">{maintenanceKpis.map((kpi, index) => <KpiCard key={kpi.label} label={kpi.label} value={kpi.value} index={index} />)}</div>
      <RoomBlockingForm rooms={rooms} blocks={blocks} setBlocks={setBlocks} setRooms={setRooms} notify={notify} />
      <AdminPanel title="Maintenance Table">
        <DataTable recordType="maintenance" rows={rows} columns={[
          { header: "Room Number", render: (row) => <span className="font-black">{row.roomNumber}</span> },
          { header: "Issue Type", render: (row) => row.reason },
          { header: "Description", render: (row) => row.description },
          { header: "Assigned Staff", render: (row) => row.assignedStaff },
          { header: "Start Date", render: (row) => row.startDate },
          { header: "End Date", render: (row) => row.endDate },
          { header: "Priority", render: (row) => <PriorityBadge priority={row.priority} /> },
          { header: "Status", render: (row) => <TextBadge text={row.status} /> },
          { header: "Actions", render: (row) => <div className="flex flex-wrap gap-2"><ActionButton onClick={() => updateBlock(row.id, "In Progress")}>Edit</ActionButton><ActionButton onClick={() => updateBlock(row.id, "Completed")}>Complete</ActionButton><ActionButton onClick={() => updateBlock(row.id, "Active")}>Reopen</ActionButton></div> },
        ]} />
      </AdminPanel>
    </div>
  );
}

function ProfileSettingsModule({ userName, email, onLogout }: { userName: string; email: string; onLogout: () => void }) {
  return (
    <AdminPanel title="Profile Settings">
      <div className="grid gap-4 md:grid-cols-2">
        <input defaultValue={userName} className={inputClass} placeholder="Full name" />
        <input defaultValue={email} className={inputClass} placeholder="Email" />
        <input defaultValue="General Manager" className={inputClass} placeholder="Role" />
        <input defaultValue="SRI NIRVANA PLAZA" className={inputClass} placeholder="Property" />
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className="rounded-full bg-[#d2aa6a] px-5 py-3 text-sm font-black text-black">Save Settings</button>
        <button type="button" onClick={onLogout} className="rounded-full bg-rose-500 px-5 py-3 text-sm font-black text-white">Logout</button>
      </div>
    </AdminPanel>
  );
}

function RoomBlockingForm({ rooms, setRooms, blocks, setBlocks, notify }: { rooms: PMSRoom[]; setRooms: React.Dispatch<React.SetStateAction<PMSRoom[]>>; blocks: MaintenanceBlock[]; setBlocks: React.Dispatch<React.SetStateAction<MaintenanceBlock[]>>; notify: (message: string) => void }) {
  const [form, setForm] = useState({ roomNumber: rooms[0]?.roomNumber ?? "101", startDate: isoDateAfter(0), endDate: isoDateAfter(1), reason: "Maintenance", description: "Scheduled operational block", priority: "Medium" as Priority, assignedStaff: "Engineering Team", expectedCompletionDate: isoDateAfter(1), status: "Active" as MaintenanceBlock["status"] });

  const submit = () => {
    const block: MaintenanceBlock = { id: `MNT-${Date.now().toString().slice(-5)}`, ...form };
    setBlocks([block, ...blocks]);
    setRooms((current) => current.map((room) => room.roomNumber === form.roomNumber ? { ...room, status: "maintenance" } : room));
    notify("Room block created. Room status changed to Maintenance / Blocked.");
  };

  return (
    <AdminPanel title="Room Blocking System">
      <div className="grid gap-3 md:grid-cols-4">
        <select value={form.roomNumber} onChange={(event) => setForm({ ...form, roomNumber: event.target.value })} className={inputClass}>{rooms.map((room) => <option key={room.id} value={room.roomNumber}>{room.roomNumber} - {room.roomType}</option>)}</select>
        <input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} className={inputClass} />
        <input type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} className={inputClass} />
        <select value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} className={inputClass}>{roomBlockReasons.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })} className={inputClass}>{["Low", "Medium", "High"].map((item) => <option key={item}>{item}</option>)}</select>
        <input value={form.assignedStaff} onChange={(event) => setForm({ ...form, assignedStaff: event.target.value })} className={inputClass} placeholder="Assigned Staff" />
        <input type="date" value={form.expectedCompletionDate} onChange={(event) => setForm({ ...form, expectedCompletionDate: event.target.value })} className={inputClass} />
        <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as MaintenanceBlock["status"] })} className={inputClass}>{["Active", "In Progress", "Completed"].map((item) => <option key={item}>{item}</option>)}</select>
        <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className={cn(inputClass, "md:col-span-3")} placeholder="Description" />
        <button type="button" onClick={submit} className="rounded-2xl bg-yellow-400 px-4 py-3 text-sm font-black text-black">Block Room</button>
      </div>
    </AdminPanel>
  );
}

function DataTable<T extends { id: string }>({ recordType, rows, columns }: { recordType: string; rows: T[]; columns: Array<{ header: string; render: (row: T) => ReactNode }> }) {
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const visibleRows = rows.slice((page - 1) * pageSize, page * pageSize);

  if (!rows.length) {
    return <EmptyState message="No matching records found. Adjust search or filters." />;
  }

  return (
    <div>
      <div className="premium-scrollbar overflow-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-[#11100d] text-xs uppercase tracking-[0.18em] text-[#d2aa6a]">
            <tr>
              {columns.map((column) => <th key={column.header} className="px-4 py-4">{column.header}</th>)}
              <th className="px-4 py-4">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {visibleRows.map((row) => (
              <tr key={row.id} className="text-[#f8ead2] hover:bg-white/[0.04]">
                {columns.map((column) => <td key={column.header} className="px-4 py-4 align-top">{column.render(row)}</td>)}
                <td className="px-4 py-4"><Link to={`/admin/detail/${recordType}/${row.id}`} className="rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-[#c8b8a3]">
        <span>Page {page} of {pages}</span>
        <div className="flex gap-2">
          <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-full bg-white/10 px-4 py-2 font-black text-white">Previous</button>
          <button type="button" onClick={() => setPage((value) => Math.min(pages, value + 1))} className="rounded-full bg-white/10 px-4 py-2 font-black text-white">Next</button>
        </div>
      </div>
    </div>
  );
}

function AdminPanel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className={panelClass}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-xl font-black text-white">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function ChartPanel({ title, children }: { title: string; children: ReactNode }) {
  return <AdminPanel title={title}><div className="h-80">{children}</div></AdminPanel>;
}

function KpiCard({ label, value, index }: { label: string; value: string | number; index: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.025 }} className="rounded-[1.4rem] border border-white/10 bg-white/[0.07] p-4 shadow-2xl backdrop-blur-2xl">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#d2aa6a]">{label}</p>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
    </motion.div>
  );
}

function DetailMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#d2aa6a]">{label}</p>
      <p className="mt-2 text-sm font-black text-white">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: PMSRoomStatus }) {
  return <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-black", lightStatusColorClasses[status])}>{statusLabels[status]}</span>;
}

function TextBadge({ text }: { text: string }) {
  return <span className="inline-flex rounded-full border border-[#d2aa6a]/25 bg-[#d2aa6a]/12 px-3 py-1 text-xs font-black text-[#f8ead2]">{text}</span>;
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const classes: Record<Priority, string> = {
    Low: "border-emerald-400/30 bg-emerald-500/12 text-emerald-100",
    Medium: "border-yellow-300/30 bg-yellow-400/15 text-yellow-100",
    High: "border-red-400/30 bg-red-500/15 text-red-100",
  };
  return <span className={cn("inline-flex rounded-full border px-3 py-1 text-xs font-black", classes[priority])}>{priority}</span>;
}

function ActionButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-full bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-[#d2aa6a] hover:text-black">{children}</button>;
}

function CompactList({ items }: { items: string[] }) {
  return <div className="space-y-3">{items.length ? items.map((item) => <p key={item} className="rounded-2xl bg-white/8 p-3 text-sm font-semibold leading-6 text-[#c8b8a3]">{item}</p>) : <EmptyState message="No items require attention." />}</div>;
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-8 text-center text-sm font-bold text-[#c8b8a3]">{message}</div>;
}

function CalendarLegend() {
  return (
    <div className="flex flex-wrap gap-2 text-xs font-black">
      {Object.entries(statusLabels).map(([status, label]) => (
        <span key={status} className={cn("rounded-full border px-3 py-1", statusColorClasses[status as PMSRoomStatus])}>{label}</span>
      ))}
    </div>
  );
}

function FilterBar({ statusFilter, setStatusFilter, typeFilter, setTypeFilter, floorFilter, setFloorFilter, rooms }: { statusFilter: string; setStatusFilter: (value: string) => void; typeFilter: string; setTypeFilter: (value: string) => void; floorFilter: string; setFloorFilter: (value: string) => void; rooms: PMSRoom[] }) {
  const floors = Array.from(new Set(rooms.map((room) => room.floor)));
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold text-white">
        {['All', 'available', 'booked', 'reserved', 'maintenance', 'out-of-service'].map((item) => <option key={item} value={item}>{item === 'All' ? 'All Statuses' : statusLabels[item as PMSRoomStatus]}</option>)}
      </select>
      <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold text-white">
        {['All', ...pmsRoomTypes].map((item) => <option key={item}>{item}</option>)}
      </select>
      <select value={floorFilter} onChange={(event) => setFloorFilter(event.target.value)} className="rounded-full border border-white/10 bg-black/25 px-3 py-2 text-xs font-bold text-white">
        {['All', ...floors].map((item) => <option key={item}>{item}</option>)}
      </select>
    </div>
  );
}

export function getDetailRecord(recordType: string | undefined, recordId: string | undefined) {
  if (recordType === "notifications") {
    return notificationCenterItems.find((item) => item.id === recordId) ?? null;
  }
  return findOperationsRecord(recordType, recordId);
}

interface AutomationSettings {
  reminder_timings: number[];
  booking_expiry_hours: number;
  whatsapp_enabled: boolean;
  whatsapp_provider: string;
  whatsapp_access_token: string;
  whatsapp_phone_number_id: string;
  whatsapp_api_version: string;
  email_enabled: boolean;
  invoice_generation: boolean;
  max_retries: number;
  business_hours_start: string;
  business_hours_end: string;
}

interface AutomationStats {
  pending: number;
  completed: number;
  failed: number;
  cancelled: number;
  total_runs: number;
}

interface ScheduledTask {
  id: string;
  bookingId: string;
  guestId: string;
  phoneNumber: string;
  taskType: string;
  scheduled_time: string;
  status: "Pending" | "Running" | "Completed" | "Failed" | "Cancelled";
  retry_count: number;
  last_error?: string;
  created_at: string;
}

interface AutomationLog {
  id: string;
  automationId: string;
  eventName: string;
  bookingId: string;
  guestId: string;
  executionTime: string;
  status: string;
  durationMs: number;
  retryCount: number;
  errorDetails?: string;
}

function AutomationModule({ notify }: { notify: (msg: string) => void }) {
  const [stats, setStats] = useState<AutomationStats>({ pending: 0, completed: 0, failed: 0, cancelled: 0, total_runs: 0 });
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [settings, setSettings] = useState<AutomationSettings>({
    reminder_timings: [10, 60, 1440],
    booking_expiry_hours: 24,
    whatsapp_enabled: false,
    whatsapp_provider: "dry_run",
    whatsapp_access_token: "",
    whatsapp_phone_number_id: "",
    whatsapp_api_version: "v20.0",
    email_enabled: true,
    invoice_generation: true,
    max_retries: 3,
    business_hours_start: "08:00",
    business_hours_end: "22:00",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reminderStr, setReminderStr] = useState("10, 60, 1440");

  const loadData = async () => {
    try {
      const [dashRes, settingsRes] = await Promise.all([
        apiClient.get("/automation/dashboard"),
        apiClient.get("/automation/settings"),
      ]);
      setStats(dashRes.data.stats);
      setTasks(dashRes.data.tasks);
      setLogs(dashRes.data.logs);
      setSettings(settingsRes.data);
      setReminderStr(settingsRes.data.reminder_timings.join(", "));
    } catch (err) {
      console.error(err);
      notify("Failed to load automation data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const timings = reminderStr.split(",").map(s => parseInt(s.trim())).filter(n => !isNaN(n));
      const payload = {
        ...settings,
        reminder_timings: timings
      };
      await apiClient.post("/automation/settings", payload);
      setSettings(payload);
      notify("Automation settings updated successfully.");
    } catch (err) {
      console.error(err);
      notify("Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleRunTask = async (taskId: string) => {
    try {
      const res = await apiClient.post(`/automation/tasks/${taskId}/run`);
      if (res.data.success) {
        notify("Task completed manual execution.");
      } else {
        notify("Task execution failed.");
      }
      loadData();
    } catch (err) {
      console.error(err);
      notify("Error executing task.");
    }
  };

  const handleCancelTask = async (taskId: string) => {
    try {
      await apiClient.post(`/automation/tasks/${taskId}/cancel`);
      notify("Task cancelled.");
      loadData();
    } catch (err) {
      console.error(err);
      notify("Error cancelling task.");
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-[#c8b8a3]">Loading automation service data...</div>;
  }

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Pending Tasks" value={stats.pending} index={0} />
        <KpiCard label="Completed Tasks" value={stats.completed} index={1} />
        <KpiCard label="Failed Tasks" value={stats.failed} index={2} />
        <KpiCard label="Cancelled Tasks" value={stats.cancelled} index={3} />
        <KpiCard label="Total Logged Runs" value={stats.total_runs} index={4} />
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Settings Panel */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSaveSettings} className={`${panelClass} space-y-4 h-full`}>
            <div className="mb-4">
              <h3 className="text-xl font-black text-white">Automation Configuration</h3>
              <p className="text-xs text-[#c8b8a3] mt-1">Configure intervals and notifications channels</p>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-[#d2aa6a]">Payment Reminders (Minutes)</label>
              <input
                type="text"
                value={reminderStr}
                onChange={e => setReminderStr(e.target.value)}
                placeholder="10, 60, 1440"
                className={`${inputClass} mt-1`}
              />
              <span className="text-[10px] text-[#c8b8a3]">Comma separated list. (e.g. 10 mins, 1 hour, 24 hours)</span>
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-[#d2aa6a]">Booking Expiry Window (Hours)</label>
              <input
                type="number"
                value={settings.booking_expiry_hours}
                onChange={e => setSettings({ ...settings, booking_expiry_hours: parseInt(e.target.value) || 24 })}
                className={`${inputClass} mt-1`}
              />
            </div>

            <div>
              <label className="text-xs font-black uppercase tracking-wider text-[#d2aa6a]">Max Job Retries</label>
              <input
                type="number"
                value={settings.max_retries}
                onChange={e => setSettings({ ...settings, max_retries: parseInt(e.target.value) || 3 })}
                className={`${inputClass} mt-1`}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-[#d2aa6a]">Business Hours Start</label>
                <input
                  type="text"
                  value={settings.business_hours_start}
                  onChange={e => setSettings({ ...settings, business_hours_start: e.target.value })}
                  placeholder="08:00"
                  className={`${inputClass} mt-1`}
                />
              </div>
              <div>
                <label className="text-xs font-black uppercase tracking-wider text-[#d2aa6a]">Business Hours End</label>
                <input
                  type="text"
                  value={settings.business_hours_end}
                  onChange={e => setSettings({ ...settings, business_hours_end: e.target.value })}
                  placeholder="22:00"
                  className={`${inputClass} mt-1`}
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-white/10">
              <label className="text-xs font-black uppercase tracking-wider text-[#d2aa6a] block">Channels & Integrations</label>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm font-semibold text-white">WhatsApp Notifications</span>
                <input
                  type="checkbox"
                  checked={settings.whatsapp_enabled}
                  onChange={e => setSettings({ ...settings, whatsapp_enabled: e.target.checked })}
                  className="w-4 h-4 accent-[#d2aa6a]"
                />
              </div>

              {settings.whatsapp_enabled && (
                <div className="pl-4 border-l-2 border-[#d2aa6a]/40 space-y-3 py-2 animate-fadeIn">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-[#d2aa6a]">WhatsApp Provider</label>
                    <select
                      value={settings.whatsapp_provider}
                      onChange={e => setSettings({ ...settings, whatsapp_provider: e.target.value })}
                      className={`${inputClass} mt-1 text-xs`}
                    >
                      <option value="dry_run">Dry Run (Console Log)</option>
                      <option value="meta">Meta Cloud API (Official)</option>
                    </select>
                  </div>

                  {settings.whatsapp_provider === "meta" && (
                    <>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-[#d2aa6a]">Phone Number ID</label>
                        <input
                          type="text"
                          value={settings.whatsapp_phone_number_id || ""}
                          onChange={e => setSettings({ ...settings, whatsapp_phone_number_id: e.target.value })}
                          placeholder="e.g. 1092837465928"
                          className={`${inputClass} mt-1 text-xs`}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-[#d2aa6a]">Access Token</label>
                        <input
                          type="password"
                          value={settings.whatsapp_access_token || ""}
                          onChange={e => setSettings({ ...settings, whatsapp_access_token: e.target.value })}
                          placeholder="EAABw..."
                          className={`${inputClass} mt-1 text-xs`}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-[#d2aa6a]">API Version</label>
                        <input
                          type="text"
                          value={settings.whatsapp_api_version || "v20.0"}
                          onChange={e => setSettings({ ...settings, whatsapp_api_version: e.target.value })}
                          placeholder="v20.0"
                          className={`${inputClass} mt-1 text-xs`}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between py-1">
                <span className="text-sm font-semibold text-white">Email Integration</span>
                <input
                  type="checkbox"
                  checked={settings.email_enabled}
                  onChange={e => setSettings({ ...settings, email_enabled: e.target.checked })}
                  className="w-4 h-4 accent-[#d2aa6a]"
                />
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-sm font-semibold text-white">Auto Invoice Generation</span>
                <input
                  type="checkbox"
                  checked={settings.invoice_generation}
                  onChange={e => setSettings({ ...settings, invoice_generation: e.target.checked })}
                  className="w-4 h-4 accent-[#d2aa6a]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-2xl bg-[#d2aa6a] py-3 text-sm font-black text-black hover:bg-[#d2aa6a]/90 transition-all disabled:opacity-40"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </form>
        </div>

        {/* Task Queue list */}
        <div className="lg:col-span-2">
          <div className={`${panelClass} h-full`}>
            <div className="mb-4">
              <h3 className="text-xl font-black text-white">Active Automation Queue</h3>
              <p className="text-xs text-[#c8b8a3] mt-1">Pending and running scheduled background actions</p>
            </div>
            
            <div className="premium-scrollbar overflow-auto max-h-[500px] border border-white/10 rounded-2xl">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#11100d] text-[10px] uppercase tracking-wider text-[#d2aa6a]">
                  <tr>
                    <th className="px-4 py-3">Task ID</th>
                    <th className="px-4 py-3">Workflow</th>
                    <th className="px-4 py-3">Scheduled Time</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-[#f8ead2]">
                  {tasks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-sm text-[#c8b8a3]">No tasks currently in queue.</td>
                    </tr>
                  ) : (
                    tasks.map(task => (
                      <tr key={task.id} className="hover:bg-white/[0.04]">
                        <td className="px-4 py-3 font-mono text-xs max-w-[80px] truncate" title={task.id}>{task.id}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-white block">{task.taskType}</span>
                          <span className="text-[10px] text-[#c8b8a3]">Booking: {task.bookingId || "N/A"}</span>
                        </td>
                        <td className="px-4 py-3 text-xs">{new Date(task.scheduled_time).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={cn(
                            "inline-block rounded-full px-2 py-0.5 text-[10px] font-bold border",
                            task.status === "Pending" && "border-blue-400/30 bg-blue-500/10 text-blue-300",
                            task.status === "Running" && "border-yellow-400/30 bg-yellow-500/10 text-yellow-300",
                            task.status === "Completed" && "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
                            task.status === "Failed" && "border-red-400/30 bg-red-500/10 text-red-300",
                            task.status === "Cancelled" && "border-zinc-400/30 bg-zinc-500/10 text-zinc-300"
                          )}>
                            {task.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {task.status === "Pending" && (
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleRunTask(task.id)}
                                className="bg-[#d2aa6a]/20 border border-[#d2aa6a]/30 text-[#d2aa6a] hover:bg-[#d2aa6a] hover:text-black rounded-lg px-2.5 py-1 text-xs font-bold"
                              >
                                Run
                              </button>
                              <button
                                type="button"
                                onClick={() => handleCancelTask(task.id)}
                                className="bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500 hover:text-white rounded-lg px-2.5 py-1 text-xs font-bold"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                          {task.status === "Failed" && (
                            <button
                              type="button"
                              onClick={() => handleRunTask(task.id)}
                              className="bg-yellow-500/15 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500 hover:text-black rounded-lg px-2.5 py-1 text-xs font-bold"
                            >
                              Retry Now
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <AdminPanel title="Automation Execution Audit Trail">
        <DataTable
          recordType="automation_logs"
          rows={logs}
          columns={[
            { header: "Execution Time", render: (log) => <span className="text-xs">{new Date(log.executionTime).toLocaleString()}</span> },
            { header: "Workflow Event", render: (log) => <span className="font-bold text-white">{log.eventName}</span> },
            { header: "Context IDs", render: (log) => (
              <div className="text-xs">
                <span className="block text-[#c8b8a3]">Booking: {log.bookingId || "N/A"}</span>
                <span className="block text-[#c8b8a3]">Guest: {log.guestId || "N/A"}</span>
              </div>
            )},
            { header: "Duration", render: (log) => `${log.durationMs}ms` },
            { header: "Retries", render: (log) => log.retryCount || 0 },
            { header: "Status", render: (log) => (
              <span className={cn(
                "inline-block rounded-full px-2 py-0.5 text-[10px] font-bold border",
                log.status === "Completed" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-300" : "border-red-400/30 bg-red-500/10 text-red-300"
              )}>
                {log.status}
              </span>
            ) },
            { header: "Execution Details", render: (log) => (
              <span className="text-xs block max-w-sm truncate text-[#c8b8a3]" title={log.errorDetails || "Successful Execution"}>
                {log.errorDetails || <span className="text-emerald-400 font-semibold">Success</span>}
              </span>
            ) }
          ]}
        />
      </AdminPanel>
    </div>
  );
}