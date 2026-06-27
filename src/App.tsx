import { GoogleLogin, GoogleOAuthProvider, type CredentialResponse } from "@react-oauth/google";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { Invoice, downloadInvoice, shareInvoice, InvoiceModal, InvoiceView } from "./utils/invoiceHelper";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { HotelProvider, useHotel } from "./context/HotelContext";
import {
  categoryProfiles,
  categoryToSlug,
  dateStatus,
  findRoom,
  galleryImages,
  heroImage,
  rooms,
  slugToCategory,
  type Room,
  type RoomCategory,
  type RoomStatus,
} from "./data/hotelData";
import EnterpriseAdminPage from "./pages/EnterpriseAdminPage";
import ArenaInspiredHomePage from "./pages/ArenaInspiredHomePage";
import EnterpriseRecordDetailPage from "./pages/EnterpriseRecordDetailPage";
import { apiClient } from "./services/api";
import { cn } from "./utils/cn";

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
);

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || "demo-google-client-id.apps.googleusercontent.com";

const fieldClass =
  "w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text)] outline-none ring-0 placeholder:text-[var(--muted)]/70 focus:border-[var(--gold)] focus:shadow-[0_0_0_4px_rgba(184,137,69,0.14)]";

const iconPaths = {
  ac: <path d="M12 3v18M5 7l14 10M19 7 5 17M4 12h16" />,
  bell: <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />,
  calendar: <path d="M8 2v4M16 2v4M3 10h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />,
  chart: <path d="M4 19V5M4 19h16M8 16V9M12 16V6M16 16v-4" />,
  check: <path d="m5 12 4 4L19 6" />,
  desk: <path d="M4 9h16M6 9v10M18 9v10M9 13h6" />,
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />,
  home: <path d="m3 11 9-8 9 8v9a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" />,
  logout: <path d="M10 17 15 12 10 7M15 12H3M21 3v18h-7" />,
  mail: <path d="M4 4h16v16H4zM4 7l8 6 8-6" />,
  map: <path d="M12 21s7-5.2 7-12a7 7 0 0 0-14 0c0 6.8 7 12 7 12ZM12 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />,
  minibar: <path d="M8 2h8l-1 7a4 4 0 0 1-6 0ZM12 13v8M9 21h6" />,
  moon: <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8Z" />,
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.3 19.3 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.4 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />,
  search: <path d="m21 21-4.3-4.3M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z" />,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
  star: <path d="m12 2 3 6.2 6.8 1-4.9 4.8 1.2 6.8L12 17.6l-6.1 3.2 1.2-6.8-4.9-4.8 6.8-1Z" />,
  sun: <path d="M12 4V2M12 22v-2M4.9 4.9 3.5 3.5M20.5 20.5l-1.4-1.4M4 12H2M22 12h-2M4.9 19.1l-1.4 1.4M20.5 3.5l-1.4 1.4M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />,
  tv: <path d="M4 5h16v11H4zM8 21h8M12 16v5" />,
  user: <path d="M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />,
  wifi: <path d="M5 13a10 10 0 0 1 14 0M8.5 16.5a5 5 0 0 1 7 0M12 20h.01M2 9a15 15 0 0 1 20 0" />,
};

type IconName = keyof typeof iconPaths;
type PaymentMethod = "Razorpay" | "UPI" | "Card";

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: "INR";
  name: string;
  description: string;
  handler: () => void;
  prefill: { name: string; email: string };
  theme: { color: string };
};

type GoogleCredentialPayload = {
  email?: string;
  name?: string;
  given_name?: string;
};

const decodeGoogleCredential = (credential: string): GoogleCredentialPayload | null => {
  try {
    const payload = credential.split(".")[1];
    const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(normalizedPayload)
        .split("")
        .map((char) => `%${`00${char.charCodeAt(0).toString(16)}`.slice(-2)}`)
        .join(""),
    );
    return JSON.parse(json) as GoogleCredentialPayload;
  } catch {
    return null;
  }
};

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}

const money = (value: number) => `INR ${Math.round(value).toLocaleString("en-IN")}`;

const isoAfter = (offset = 0) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

type CustomerBooking = {
  id: string;
  roomId: string;
  roomNumber?: string;
  roomTitle: string;
  roomType: string;
  roomImage: string;
  customerEmail: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nights: number;
  total: number;
  status: "Confirmed" | "Completed" | "Cancelled";
  invoiceId: string;
  createdAt: string;
};

type PreviewNotification = {
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

type PreviewNotificationLog = {
  id: string;
  bookingId?: string;
  phoneNumber?: string;
  messageType?: string;
  sentAt?: string;
  deliveryStatus?: string;
  providerResponse?: Record<string, unknown>;
};

type GuestDetail = {
  name: string;
  age: string;
  gender: string;
  idProofType: string;
  idNumber: string;
};

const emptyGuestDetail = (index: number): GuestDetail => ({
  name: index === 0 ? "" : "",
  age: "",
  gender: "",
  idProofType: "",
  idNumber: "",
});


const customerBookingsKey = (email: string) => `nirvana-customer-bookings-${email.trim().toLowerCase()}`;
const allCustomerBookingsKey = "nirvana-all-customer-bookings";
const previewNotificationsKey = "nirvana-preview-notifications";
const previewNotificationLogsKey = "nirvana-preview-notification-logs";

const readCustomerBookings = (email: string): CustomerBooking[] => {
  try {
    return JSON.parse(localStorage.getItem(customerBookingsKey(email)) || "[]") as CustomerBooking[];
  } catch {
    return [];
  }
};

const saveCustomerBooking = (booking: CustomerBooking) => {
  const bookings = readCustomerBookings(booking.customerEmail);
  const nextBookings = [booking, ...bookings.filter((item) => item.id !== booking.id)];
  localStorage.setItem(customerBookingsKey(booking.customerEmail), JSON.stringify(nextBookings));
  try {
    const allBookings = JSON.parse(localStorage.getItem(allCustomerBookingsKey) || "[]") as CustomerBooking[];
    const nextAllBookings = [booking, ...allBookings.filter((item) => item.id !== booking.id)];
    localStorage.setItem(allCustomerBookingsKey, JSON.stringify(nextAllBookings));
  } catch {
    localStorage.setItem(allCustomerBookingsKey, JSON.stringify([booking]));
  }
};

const isUpcomingStay = (booking: CustomerBooking) => booking.status === "Confirmed" && booking.checkOut >= isoAfter(0);

const readPreviewNotifications = (): PreviewNotification[] => {
  try {
    return JSON.parse(localStorage.getItem(previewNotificationsKey) || "[]") as PreviewNotification[];
  } catch {
    return [];
  }
};

const readPreviewNotificationLogs = (): PreviewNotificationLog[] => {
  try {
    return JSON.parse(localStorage.getItem(previewNotificationLogsKey) || "[]") as PreviewNotificationLog[];
  } catch {
    return [];
  }
};

const savePreviewNotification = (notification: PreviewNotification) => {
  const notifications = readPreviewNotifications();
  localStorage.setItem(previewNotificationsKey, JSON.stringify([notification, ...notifications.filter((item) => item.id !== notification.id)]));
};

const savePreviewNotificationLog = (log: PreviewNotificationLog) => {
  const logs = readPreviewNotificationLogs();
  localStorage.setItem(previewNotificationLogsKey, JSON.stringify([log, ...logs.filter((item) => item.id !== log.id)]));
};

const createPreviewWhatsAppAutomation = (invoice: Invoice) => {
  const now = new Date().toISOString();
  const phoneNumber = invoice.customerPhone || "Not provided";
  const confirmationMessage = `🏨 SRI NIRVANA PLAZA\n\nHello ${invoice.customerName ?? "Guest"},\n\nYour booking has been confirmed successfully.\n\nBooking ID : ${invoice.bookingId ?? "N/A"}\n\nRoom Number : ${invoice.roomNumber ?? "Assigned"}\n\nRoom Type : ${invoice.roomType}\n\nCheck-In : ${invoice.checkIn}\n\nCheck-Out : ${invoice.checkOut}\n\nGuests : ${invoice.guests}\n\nAmount Paid : ₹${Math.round(invoice.total).toLocaleString("en-IN")}\n\nThank you for choosing SRI NIRVANA PLAZA.\n\nWe look forward to welcoming you.`;
  const paymentMessage = `Payment Successful\n\nThank you.\n\nYour payment has been received.\n\nBooking Confirmed.\n\nInvoice Number:\n${invoice.invoiceId}`;
  const checkInDate = new Date(invoice.checkIn);
  const checkOutDate = new Date(invoice.checkOut);
  const checkInReminder = new Date(checkInDate);
  checkInReminder.setDate(checkInReminder.getDate() - 1);
  checkInReminder.setHours(9, 0, 0, 0);
  const sameDayCheckIn = new Date(checkInDate);
  sameDayCheckIn.setHours(9, 0, 0, 0);
  const checkOutReminder = new Date(checkOutDate);
  checkOutReminder.setDate(checkOutReminder.getDate() - 1);
  checkOutReminder.setHours(9, 0, 0, 0);

  const notifications: PreviewNotification[] = [
    { id: `${invoice.bookingId}:booking_confirmation`, bookingId: invoice.bookingId, phoneNumber, notificationType: "booking_confirmation", scheduledTime: now, sentTime: now, status: "Sent", retryCount: 0, message: confirmationMessage },
    { id: `${invoice.bookingId}:payment_success`, bookingId: invoice.bookingId, phoneNumber, notificationType: "payment_success", scheduledTime: now, sentTime: now, status: "Sent", retryCount: 0, message: paymentMessage },
    { id: `${invoice.bookingId}:checkin_24h`, bookingId: invoice.bookingId, phoneNumber, notificationType: "checkin_24h", scheduledTime: checkInReminder.toISOString(), status: "Pending", retryCount: 0, message: `Reminder\n\nYour stay begins tomorrow.\n\nHotel:\nSRI NIRVANA PLAZA\n\nCheck-In:\n${invoice.checkIn}\n\nRoom:\n${invoice.roomNumber ?? "Assigned"}\n\nPlease carry a valid Government ID.` },
    { id: `${invoice.bookingId}:checkin_same_day`, bookingId: invoice.bookingId, phoneNumber, notificationType: "checkin_same_day", scheduledTime: sameDayCheckIn.toISOString(), status: "Pending", retryCount: 0, message: `Good Morning\n\nToday is your check-in day.\n\nWe are ready to welcome you.\n\nRoom:\n${invoice.roomNumber ?? "Assigned"}\n\nCheck-In Time:\n2:00 PM` },
    { id: `${invoice.bookingId}:checkout_24h`, bookingId: invoice.bookingId, phoneNumber, notificationType: "checkout_24h", scheduledTime: checkOutReminder.toISOString(), status: "Pending", retryCount: 0, message: "Reminder\n\nYour check-out is scheduled for tomorrow.\n\nPlease contact reception if you wish to extend your stay." },
  ];

  notifications.forEach(savePreviewNotification);
  notifications.filter((item) => item.status === "Sent").forEach((item) => savePreviewNotificationLog({
    id: `${item.id}:log`,
    bookingId: item.bookingId,
    phoneNumber: item.phoneNumber,
    messageType: item.notificationType,
    sentAt: item.sentTime,
    deliveryStatus: "dry_run",
    providerResponse: { provider: "preview", message: item.message },
  }));
};

function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHeading({ eyebrow, title, copy }: { eyebrow?: string; title: string; copy?: string }) {
  return (
    <div className="mx-auto mb-10 max-w-3xl text-center">
      {eyebrow ? <p className="mb-3 text-xs font-bold uppercase tracking-[0.35em] text-[var(--gold)]">{eyebrow}</p> : null}
      <h2 className="text-3xl font-semibold tracking-tight text-[var(--text)] md:text-5xl">{title}</h2>
      {copy ? <p className="mt-4 text-base leading-7 text-[var(--muted)] md:text-lg">{copy}</p> : null}
    </div>
  );
}

function AppRouter() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

function AppShell() {
  return (
    <div className="min-h-screen bg-[var(--page)] text-[var(--text)]">
      <Navbar />
      <AnimatedRoutes />
      <Footer />
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<ArenaInspiredHomePage />} />
        <Route path="/legacy-home" element={<HomePage />} />
        <Route path="/rooms" element={<RoomsPage />} />
        <Route path="/rooms/:categorySlug" element={<RoomsPage />} />
        <Route path="/room/:roomId" element={<RoomDetailPage />} />
        <Route path="/experiences" element={<ExperiencesPage />} />
        <Route path="/gallery" element={<GalleryPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/dashboard" element={<UserDashboardPage />} />
        <Route path="/admin/detail/:recordType/:recordId" element={<EnterpriseRecordDetailPage />} />
        <Route path="/admin" element={<AdminDashboardPage />} />
        <Route path="/admin/:module" element={<AdminDashboardPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/login" element={<AuthPage defaultRole="customer" />} />
        <Route path="/customer-login" element={<AuthPage defaultRole="customer" />} />
        <Route path="/admin-login" element={<AuthPage defaultRole="admin" />} />
        <Route path="/payment-success" element={<PaymentSuccessPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AnimatePresence>
  );
}

function Navbar() {
  const { theme, toggleTheme, user, wishlist, notifications } = useHotel();
  const navItems = [
    ["Home", "/"],
    ["Rooms", "/rooms"],
    ["Experiences", "/experiences"],
    ["Gallery", "/gallery"],
    ["Contact", "/contact"],
    ["About", "/about"],
    ["Dashboard", user?.role === "admin" ? "/admin" : "/dashboard"],
    ["Profile", "/profile"],
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-[var(--nav)] backdrop-blur-2xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="group flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#2a1d12] to-[#b88945] text-white shadow-xl shadow-black/10">
            <Icon name="home" className="h-5 w-5" />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-black uppercase tracking-[0.22em] text-[var(--text)]">SRI NIRVANA</span>
            <span className="block text-xs font-semibold uppercase tracking-[0.28em] text-[var(--gold)]">Plaza</span>
          </span>
        </Link>

        <div className="hidden items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)]/70 p-1 shadow-sm lg:flex">
          {navItems.map(([label, href]) => (
            <NavLink
              key={href}
              to={href}
              className={({ isActive }) =>
                cn(
                  "rounded-full px-4 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)]",
                  isActive && "bg-[var(--surface-soft)] text-[var(--text)] shadow-sm",
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            to="/wishlist"
            className="relative grid h-11 w-11 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-sm hover:-translate-y-0.5 hover:shadow-lg"
            aria-label="Wishlist"
          >
            <Icon name="heart" className="h-5 w-5" />
            {wishlist.length ? (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[#ff385c] px-1 text-[10px] font-bold text-white">
                {wishlist.length}
              </span>
            ) : null}
          </Link>
          <Link
            to="/dashboard"
            className="relative grid h-11 w-11 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-sm hover:-translate-y-0.5 hover:shadow-lg"
            aria-label="Notifications"
          >
            <Icon name="bell" className="h-5 w-5" />
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--gold)] px-1 text-[10px] font-bold text-white">
              {notifications.length}
            </span>
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className="grid h-11 w-11 place-items-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-sm hover:-translate-y-0.5 hover:shadow-lg"
            aria-label="Toggle theme"
          >
            <Icon name={theme === "light" ? "moon" : "sun"} className="h-5 w-5" />
          </button>
          <Link
            to={user ? "/profile" : "/login"}
            className="hidden items-center gap-3 rounded-full border border-[var(--border)] bg-[var(--surface)] py-1 pl-2 pr-4 shadow-sm hover:-translate-y-0.5 hover:shadow-lg sm:flex"
          >
            <img
              src={user?.avatar || "https://api.dicebear.com/8.x/initials/svg?seed=Nirvana"}
              alt="Profile"
              className="h-9 w-9 rounded-full object-cover"
            />
            <span className="text-sm font-bold text-[var(--text)]">{user ? user.name.split(" ")[0] : "Sign in"}</span>
          </Link>
        </div>
      </nav>

      <div className="premium-scrollbar flex gap-2 overflow-x-auto border-t border-[var(--border)] px-4 py-2 lg:hidden">
        {navItems.map(([label, href]) => (
          <NavLink
            key={href}
            to={href}
            className={({ isActive }) =>
              cn(
                "whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold text-[var(--muted)]",
                isActive && "bg-[var(--surface-soft)] text-[var(--text)]",
              )
            }
          >
            {label}
          </NavLink>
        ))}
      </div>
    </header>
  );
}

function HomePage() {
  return (
    <Page>
      <Hero />
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Room Availability Calendar"
          title="Choose a room category, then see every room and date clearly."
          copy="Every listing includes a dedicated availability calendar with blocked, booked, and available dates before you reserve."
        />
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-5">
          {categoryProfiles.map((category, index) => (
            <motion.div
              key={category.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ delay: index * 0.06, duration: 0.5 }}
              className="group rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_18px_60px_rgba(38,28,18,0.08)]"
            >
              <Link to={`/rooms/${category.slug}`} className="block space-y-5">
                <div className="aspect-[4/3] overflow-hidden rounded-[1.5rem] bg-[var(--surface-soft)]">
                  <img
                    src={rooms.find((room) => room.category === category.name)?.images[0]}
                    alt={category.name}
                    className="h-full w-full object-cover transition duration-700 group-hover:scale-110"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--text)]">{category.name}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{category.tagline}</p>
                  <p className="mt-4 text-sm font-black uppercase tracking-[0.18em] text-[var(--gold)]">{category.rate}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
      <section className="border-y border-[var(--border)] bg-[var(--surface)]/60 py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:px-8">
          <motion.div
            initial={{ opacity: 0, x: -28 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65 }}
          >
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-[var(--gold)]">Signature hospitality</p>
            <h2 className="mt-4 text-4xl font-semibold tracking-tight text-[var(--text)] md:text-6xl">
              Luxury that feels personal from search to checkout.
            </h2>
            <p className="mt-6 text-lg leading-8 text-[var(--muted)]">
              SRI NIRVANA PLAZA combines airbnb-style discovery, hotel-grade reliability, secure payments, and concierge-level dashboards for guests and administrators.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/rooms" className="rounded-full bg-[var(--text)] px-6 py-3 text-sm font-bold text-[var(--page)] shadow-xl hover:-translate-y-0.5">
                Explore rooms
              </Link>
              <Link to="/gallery" className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-sm font-bold text-[var(--text)] hover:-translate-y-0.5">
                View gallery
              </Link>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65 }}
            className="grid grid-cols-2 gap-4"
          >
            {galleryImages.slice(0, 4).map((image, index) => (
              <div key={image.label} className={cn("overflow-hidden rounded-[2rem]", index === 0 && "row-span-2")}>
                <img src={image.src} alt={image.label} className="h-full min-h-56 w-full object-cover" />
              </div>
            ))}
          </motion.div>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Recommended today"
          title="Rooms guests keep saving."
          copy="A curated preview of rooms with different photography, pricing, ratings, and live status signals."
        />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rooms.slice(5, 8).map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      </section>
    </Page>
  );
}

function Hero() {
  const navigate = useNavigate();
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 700], [0, 150]);
  const [checkIn, setCheckIn] = useState(isoAfter(1));
  const [checkOut, setCheckOut] = useState(isoAfter(3));
  const [guests, setGuests] = useState(2);
  const [category, setCategory] = useState<RoomCategory>("Executive Rooms");

  const handleSearch = () => {
    navigate(`/rooms/${categoryToSlug(category)}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`);
  };

  return (
    <section className="relative min-h-[calc(100vh-76px)] overflow-hidden">
      <motion.div
        style={{ y, backgroundImage: `url(${heroImage})` }}
        className="absolute inset-0 scale-110 bg-cover bg-center"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-black/70" />
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-76px)] max-w-7xl flex-col justify-center px-4 py-20 text-white sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-5xl"
        >
          <p className="mb-4 text-sm font-black uppercase tracking-[0.45em] text-[#f0c989]">Room Availability Calendar</p>
          <h1 className="text-5xl font-black uppercase leading-[0.95] tracking-[-0.05em] md:text-8xl lg:text-9xl">
            SRI NIRVANA PLAZA
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/86 md:text-2xl">
            Reserve luxury rooms with real availability, polished booking flow, secure payments, and a guest experience worthy of a five-star landmark.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.7 }}
          className="mt-10 rounded-[2rem] border border-white/25 bg-white/88 p-3 text-[#1d1712] shadow-[0_30px_100px_rgba(0,0,0,0.32)] backdrop-blur-2xl"
        >
          <div className="grid gap-2 lg:grid-cols-[1fr_1fr_0.75fr_1fr_auto]">
            <SearchField label="Check in" value={checkIn} type="date" onChange={setCheckIn} />
            <SearchField label="Check out" value={checkOut} type="date" onChange={setCheckOut} />
            <div className="rounded-[1.35rem] bg-[#f7f1e8] px-4 py-3">
              <label className="text-xs font-black uppercase tracking-[0.2em] text-[#7b4f22]">Guests</label>
              <div className="mt-2 flex items-center justify-between gap-3">
                <button type="button" onClick={() => setGuests((current) => Math.max(1, current - 1))} className="grid h-9 w-9 place-items-center rounded-full bg-white text-lg font-black shadow-sm">
                  -
                </button>
                <span className="text-lg font-black">{guests}</span>
                <button type="button" onClick={() => setGuests((current) => current + 1)} className="grid h-9 w-9 place-items-center rounded-full bg-white text-lg font-black shadow-sm">
                  +
                </button>
              </div>
            </div>
            <div className="rounded-[1.35rem] bg-[#f7f1e8] px-4 py-3">
              <label className="text-xs font-black uppercase tracking-[0.2em] text-[#7b4f22]">Room category</label>
              <select value={category} onChange={(event) => setCategory(event.target.value as RoomCategory)} className="mt-2 w-full bg-transparent text-sm font-black outline-none">
                {categoryProfiles.map((profile) => (
                  <option key={profile.name} value={profile.name}>
                    {profile.name}
                  </option>
                ))}
              </select>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              type="button"
              onClick={handleSearch}
              className="rounded-[1.35rem] bg-[#ff385c] px-8 py-4 text-sm font-black uppercase tracking-[0.2em] text-white shadow-xl shadow-[#ff385c]/25"
            >
              <span className="flex items-center justify-center gap-2">
                <Icon name="search" className="h-5 w-5" /> Search
              </span>
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function SearchField({ label, type, value, onChange }: { label: string; type: "date" | "text"; value: string; onChange: (value: string) => void }) {
  return (
    <div className="rounded-[1.35rem] bg-[#f7f1e8] px-4 py-3">
      <label className="text-xs font-black uppercase tracking-[0.2em] text-[#7b4f22]">{label}</label>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full bg-transparent text-sm font-black outline-none" />
    </div>
  );
}

function RoomsPage() {
  const location = useLocation();
  const params = useParams();
  const queryCategory = new URLSearchParams(location.search).get("category") ?? undefined;
  const routeCategory = slugToCategory(params.categorySlug) ?? slugToCategory(queryCategory);
  const [activeCategory, setActiveCategory] = useState<RoomCategory | "All">(routeCategory ?? "All");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setActiveCategory(routeCategory ?? "All");
  }, [routeCategory]);

  useEffect(() => {
    setLoading(true);
    const timer = window.setTimeout(() => setLoading(false), 420);
    return () => window.clearTimeout(timer);
  }, [activeCategory]);

  const visibleRooms = activeCategory === "All" ? rooms : rooms.filter((room) => room.category === activeCategory);

  return (
    <Page className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-10 grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[var(--gold)]">Rooms</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--text)] md:text-6xl">All room categories, every room visible.</h1>
        </div>
        <p className="text-lg leading-8 text-[var(--muted)]">
          Select Deluxe, Executive, Family, Suite, or Presidential categories to instantly reveal rooms 101 through 505 with unique imagery and date status.
        </p>
      </div>

      <div className="premium-scrollbar mb-8 flex gap-3 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => setActiveCategory("All")}
          className={cn(
            "whitespace-nowrap rounded-full border border-[var(--border)] px-5 py-3 text-sm font-bold",
            activeCategory === "All" ? "bg-[var(--text)] text-[var(--page)]" : "bg-[var(--surface)] text-[var(--text)]",
          )}
        >
          All rooms
        </button>
        {categoryProfiles.map((profile) => (
          <button
            key={profile.name}
            type="button"
            onClick={() => setActiveCategory(profile.name)}
            className={cn(
              "whitespace-nowrap rounded-full border border-[var(--border)] px-5 py-3 text-sm font-bold",
              activeCategory === profile.name ? "bg-[var(--text)] text-[var(--page)]" : "bg-[var(--surface)] text-[var(--text)]",
            )}
          >
            {profile.name}
          </button>
        ))}
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-3 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm font-semibold text-[var(--muted)]">
        <LegendDot status="available" label="Available" />
        <LegendDot status="booked" label="Booked" />
        <LegendDot status="blocked" label="Blocked by admin" />
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="animate-pulse rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="h-64 rounded-[1.5rem] bg-[var(--surface-soft)]" />
              <div className="mt-5 h-5 w-2/3 rounded bg-[var(--surface-soft)]" />
              <div className="mt-3 h-4 w-1/2 rounded bg-[var(--surface-soft)]" />
            </div>
          ))}
        </div>
      ) : (
        <motion.div layout className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {visibleRooms.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </motion.div>
      )}
    </Page>
  );
}

function LegendDot({ status, label }: { status: RoomStatus; label: string }) {
  const colors: Record<RoomStatus, string> = {
    available: "bg-emerald-500",
    booked: "bg-amber-500",
    blocked: "bg-rose-500",
  };
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cn("h-3 w-3 rounded-full", colors[status])} /> {label}
    </span>
  );
}

function RoomCard({ room }: { room: Room }) {
  const { toggleWishlist, isWishlisted } = useHotel();
  const status = dateStatus(room, isoAfter(2));
  const statusText: Record<RoomStatus, string> = {
    available: "Available",
    booked: "Booked",
    blocked: "Blocked",
  };
  const statusClass: Record<RoomStatus, string> = {
    available: "bg-emerald-500/12 text-emerald-700",
    booked: "bg-amber-500/14 text-amber-700",
    blocked: "bg-rose-500/12 text-rose-700",
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.35 }}
      className="group overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[0_18px_60px_rgba(38,28,18,0.08)]"
    >
      <div className="relative overflow-hidden rounded-[1.55rem]">
        <Link to={`/room/${room.id}`}>
          <img src={room.images[0]} alt={room.title} className="h-72 w-full object-cover transition duration-700 group-hover:scale-110" />
        </Link>
        <button
          type="button"
          onClick={() => toggleWishlist(room.id)}
          className={cn(
            "absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/88 text-[#1d1712] shadow-xl backdrop-blur-md",
            isWishlisted(room.id) && "text-[#ff385c]",
          )}
          aria-label="Save room"
        >
          <Icon name="heart" className={cn("h-5 w-5", isWishlisted(room.id) && "fill-current")} />
        </button>
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-4">
          <Link to={`/room/${room.id}`} className="min-w-0">
            <h3 className="truncate text-xl font-bold text-[var(--text)]">{room.title}</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{room.subtitle}</p>
            <p className="mt-2 text-xs font-black uppercase tracking-[0.18em] text-[var(--gold)]">Occupancy: {status === "booked" ? room.guests : 0} / {room.guests} Guests</p>
          </Link>
          <span className="flex shrink-0 items-center gap-1 text-sm font-bold text-[var(--text)]">
            <Icon name="star" className="h-4 w-4 fill-[var(--gold)] text-[var(--gold)]" /> {room.rating}
          </span>
        </div>
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="text-sm text-[var(--muted)]">
            <span className="font-black text-[var(--text)]">{money(room.price)}</span> / night
          </p>
          <span className={cn("rounded-full px-3 py-1 text-xs font-black", statusClass[status])}>{statusText[status]}</span>
        </div>
      </div>
    </motion.article>
  );
}

function RoomDetailPage() {
  const params = useParams();
  const room = findRoom(params.roomId);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [reviews, setReviews] = useState([
    { name: "Aarav Mehta", rating: 5, comment: "Beautifully designed room, fast check-in, and the availability calendar was accurate." },
    { name: "Neha Kapoor", rating: 5, comment: "The balcony, linens, and service felt truly premium. I saved this room for my next visit." },
  ]);

  const averageRating = useMemo(() => {
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    return (total / reviews.length).toFixed(1);
  }, [reviews]);

  if (!room) {
    return <NotFoundPage />;
  }

  const addReview = () => {
    if (!comment.trim()) return;
    setReviews((current) => [{ name: "Verified guest", rating, comment: comment.trim() }, ...current]);
    setComment("");
    setPhotoName("");
  };

  return (
    <Page className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.35em] text-[var(--gold)]">{room.category}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--text)] md:text-6xl">{room.title}</h1>
          <p className="mt-3 flex flex-wrap items-center gap-3 text-sm font-semibold text-[var(--muted)]">
            <span className="flex items-center gap-1 text-[var(--text)]"><Icon name="star" className="h-4 w-4 fill-[var(--gold)] text-[var(--gold)]" /> {room.rating}</span>
            <span>{room.reviews} reviews</span>
            <span>{room.floor}</span>
          </p>
        </div>
        <Link to="/rooms" className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-bold text-[var(--text)] hover:-translate-y-0.5">
          Back to rooms
        </Link>
      </div>

      <AirbnbGallery room={room} />

      <div className="mt-12 grid gap-10 lg:grid-cols-[1fr_410px] lg:items-start">
        <div className="space-y-12">
          <section className="border-b border-[var(--border)] pb-10">
            <h2 className="text-2xl font-bold text-[var(--text)]">A luxury stay designed around comfort and certainty.</h2>
            <p className="mt-4 text-lg leading-8 text-[var(--muted)]">{room.description}</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <DetailPill label="Maximum occupancy" value={`${room.guests} guests`} />
              <DetailPill label="Beds" value={`${room.beds} premium bed${room.beds > 1 ? "s" : ""}`} />
              <DetailPill label="Room size" value={room.size} />
            </div>
          </section>

          <section className="border-b border-[var(--border)] pb-10">
            <h2 className="text-2xl font-bold text-[var(--text)]">Amenities</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {room.amenities.map((amenity) => (
                <div key={amenity} className="flex items-center gap-3 text-[var(--text)]">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-soft)] text-[var(--gold)]">
                    <Icon name={amenityIcon(amenity)} className="h-5 w-5" />
                  </span>
                  <span className="font-semibold">{amenity}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="border-b border-[var(--border)] pb-10">
            <AvailabilityCalendar room={room} />
          </section>

          <section>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-2xl font-bold text-[var(--text)]">Reviews and ratings</h2>
              <span className="flex items-center gap-2 rounded-full bg-[var(--surface-soft)] px-4 py-2 text-sm font-black text-[var(--text)]">
                <Icon name="star" className="h-4 w-4 fill-[var(--gold)] text-[var(--gold)]" /> {averageRating} average
              </span>
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {reviews.map((review, index) => (
                <div key={`${review.name}-${index}`} className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-bold text-[var(--text)]">{review.name}</p>
                    <p className="flex items-center gap-1 text-sm font-bold"><Icon name="star" className="h-4 w-4 fill-[var(--gold)] text-[var(--gold)]" /> {review.rating}</p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{review.comment}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-5">
              <h3 className="text-lg font-bold text-[var(--text)]">Write a review</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-[160px_1fr]">
                <select value={rating} onChange={(event) => setRating(Number(event.target.value))} className={fieldClass}>
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>{value} stars</option>
                  ))}
                </select>
                <input type="file" accept="image/*" onChange={(event) => setPhotoName(event.target.files?.[0]?.name ?? "")} className={fieldClass} />
              </div>
              <textarea value={comment} onChange={(event) => setComment(event.target.value)} rows={4} placeholder="Share your stay experience" className={cn(fieldClass, "mt-4 resize-none")} />
              {photoName ? <p className="mt-2 text-xs font-semibold text-[var(--muted)]">Photo ready to upload: {photoName}</p> : null}
              <button type="button" onClick={addReview} className="mt-4 rounded-full bg-[var(--text)] px-6 py-3 text-sm font-bold text-[var(--page)]">
                Submit review
              </button>
            </div>
          </section>
        </div>
        <BookingPanel room={room} />
      </div>
    </Page>
  );
}

function amenityIcon(amenity: string): IconName {
  if (amenity.includes("WiFi")) return "wifi";
  if (amenity.includes("TV")) return "tv";
  if (amenity.includes("workspace")) return "desk";
  if (amenity.includes("mini")) return "minibar";
  if (amenity.includes("AC") || amenity.includes("Climate")) return "ac";
  return "check";
}

function AirbnbGallery({ room }: { room: Room }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = room.images[activeIndex];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % room.images.length);
    }, 4200);
    return () => window.clearInterval(timer);
  }, [room.images.length]);

  const goTo = (direction: "previous" | "next") => {
    setActiveIndex((current) => {
      if (direction === "previous") return current === 0 ? room.images.length - 1 : current - 1;
      return (current + 1) % room.images.length;
    });
  };

  return (
    <div className="overflow-hidden rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] shadow-[0_28px_90px_rgba(38,28,18,0.12)]">
      <div className="relative h-[420px] overflow-hidden bg-[var(--surface-soft)] sm:h-[520px] lg:h-[620px]">
        <AnimatePresence mode="wait">
          <motion.img
            key={activeImage}
            src={activeImage}
            alt={`${room.title} slide ${activeIndex + 1}`}
            initial={{ opacity: 0, scale: 1.06, x: 42 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 1.02, x: -42 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute bottom-5 left-5 right-5 flex flex-wrap items-end justify-between gap-4 text-white"
        >
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-[#f1c18a]">Photo tour</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight md:text-5xl">{room.title}</h2>
            <p className="mt-2 max-w-xl text-sm font-semibold text-white/78">Slide {activeIndex + 1} of {room.images.length}. Front view, bed area, balcony, bathroom, living area, and outside view.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => goTo("previous")} className="grid h-12 w-12 place-items-center rounded-full bg-white/18 text-2xl font-black backdrop-blur-2xl hover:bg-white/28" aria-label="Previous room photo">
              &lt;
            </button>
            <button type="button" onClick={() => goTo("next")} className="grid h-12 w-12 place-items-center rounded-full bg-white/18 text-2xl font-black backdrop-blur-2xl hover:bg-white/28" aria-label="Next room photo">
              &gt;
            </button>
          </div>
        </motion.div>
      </div>
      <div className="premium-scrollbar flex gap-3 overflow-x-auto p-3">
        {room.images.map((image, index) => (
          <button
            key={image}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={cn(
              "relative h-20 w-28 shrink-0 overflow-hidden rounded-2xl border transition sm:h-24 sm:w-36",
              activeIndex === index ? "border-[var(--gold)] shadow-lg shadow-[rgba(184,137,69,0.18)]" : "border-[var(--border)] opacity-70 hover:opacity-100",
            )}
            aria-label={`Show room photo ${index + 1}`}
          >
            <img src={image} alt={`${room.title} thumbnail ${index + 1}`} className="h-full w-full object-cover" />
            {activeIndex === index ? <span className="absolute inset-x-3 bottom-2 h-1 rounded-full bg-[var(--gold)]" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function DetailPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)] p-5">
      <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--gold)]">{label}</p>
      <p className="mt-2 text-lg font-bold text-[var(--text)]">{value}</p>
    </div>
  );
}

function AvailabilityCalendar({ room }: { room: Room }) {
  const dates = useMemo(() => Array.from({ length: 35 }, (_, index) => isoAfter(index)), [room.id]);
  const statusClass: Record<RoomStatus, string> = {
    available: "border-emerald-500/20 bg-emerald-500/12 text-emerald-700",
    booked: "border-amber-500/20 bg-amber-500/14 text-amber-700",
    blocked: "border-rose-500/20 bg-rose-500/12 text-rose-700",
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.32em] text-[var(--gold)]">Availability calendar</p>
          <h2 className="mt-2 text-2xl font-bold text-[var(--text)]">Blocked, booked, and available dates</h2>
        </div>
        <div className="flex flex-wrap gap-3 text-xs font-bold text-[var(--muted)]">
          <LegendDot status="available" label="Available" />
          <LegendDot status="booked" label="Booked" />
          <LegendDot status="blocked" label="Blocked" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5 lg:grid-cols-7">
        {dates.map((date) => {
          const status = dateStatus(room, date);
          return (
            <div key={date} className={cn("rounded-2xl border p-3 text-center", statusClass[status])}>
              <p className="text-xs font-bold uppercase tracking-[0.18em]">{new Date(date).toLocaleDateString("en-IN", { weekday: "short" })}</p>
              <p className="mt-1 text-lg font-black">{new Date(date).getDate()}</p>
              <p className="mt-1 text-[11px] font-black capitalize">{status}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BookingPanel({ room }: { room: Room }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useHotel();
  const pendingBooking = useMemo(() => {
    try {
      const value = sessionStorage.getItem("nirvana-pending-booking");
      const pending = value ? (JSON.parse(value) as { roomId?: string; checkIn?: string; checkOut?: string; guests?: number; roomType?: RoomCategory; paymentMethod?: PaymentMethod }) : null;
      return pending?.roomId === room.id ? pending : null;
    } catch {
      return null;
    }
  }, [room.id]);
  const [checkIn, setCheckIn] = useState(pendingBooking?.checkIn ?? isoAfter(1));
  const [checkOut, setCheckOut] = useState(pendingBooking?.checkOut ?? isoAfter(3));
  const [guests, setGuests] = useState(pendingBooking?.guests ?? 1);
  const [roomType, setRoomType] = useState<RoomCategory>(pendingBooking?.roomType ?? room.category);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(pendingBooking?.paymentMethod ?? "Razorpay");
  const [guestDetails, setGuestDetails] = useState<GuestDetail[]>(() =>
    Array.from({ length: Math.min(pendingBooking?.guests ?? 1, room.guests) }, (_, index) => emptyGuestDetail(index)),
  );
  const [authNotice, setAuthNotice] = useState("");
  const [bookingError, setBookingError] = useState("");
  const maxOccupancy = room.guests;

  useEffect(() => {
    setGuestDetails((current) => {
      const targetCount = Math.min(guests, maxOccupancy);
      if (current.length === targetCount) return current;
      if (current.length > targetCount) return current.slice(0, targetCount);
      return [...current, ...Array.from({ length: targetCount - current.length }, (_, index) => emptyGuestDetail(current.length + index))];
    });
  }, [guests, maxOccupancy]);

  const updateGuestDetail = (index: number, field: keyof GuestDetail, value: string) => {
    setGuestDetails((current) => current.map((guest, guestIndex) => (guestIndex === index ? { ...guest, [field]: value } : guest)));
  };

  const addGuest = () => {
    if (guestDetails.length >= maxOccupancy) {
      setBookingError(`Maximum occupancy reached. This room can accommodate only ${maxOccupancy} guests. Please choose another room or reduce the number of guests.`);
      return;
    }
    setGuests((current) => Math.min(maxOccupancy, current + 1));
  };

  const nights = useMemo(() => {
    const start = new Date(checkIn).getTime();
    const end = new Date(checkOut).getTime();
    return Math.max(1, Math.ceil((end - start) / 86_400_000));
  }, [checkIn, checkOut]);

  const subtotal = nights * room.price;
  const taxes = Math.round(subtotal * 0.12);
  const serviceCharge = Math.round(subtotal * 0.08);
  const total = subtotal + taxes + serviceCharge;

  const handleReserve = async () => {
    setBookingError("");
    if (!user) {
      sessionStorage.setItem(
        "nirvana-pending-booking",
        JSON.stringify({ roomId: room.id, checkIn, checkOut, guests, roomType, paymentMethod }),
      );
      setAuthNotice("Please sign in before booking. Your selected dates are saved.");
      navigate(`/login?redirect=${encodeURIComponent(location.pathname + location.search)}&reason=booking`);
      return;
    }

    // Validate guest details
    for (let i = 0; i < guests; i++) {
      const g = guestDetails[i];
      if (!g || !g.name.trim() || !g.age.trim() || !g.gender || !g.idProofType || !g.idNumber.trim()) {
        setBookingError(`Please fill in all details (Name, Age, Gender, ID Proof Type, and ID Number) for Guest ${i + 1}.`);
        return;
      }
      if (isNaN(parseInt(g.age))) {
        setBookingError(`Please enter a valid age (number) for Guest ${i + 1}.`);
        return;
      }
    }

    if (guests > maxOccupancy || guestDetails.length > maxOccupancy) {
      setBookingError(`Maximum occupancy reached. This room can accommodate only ${maxOccupancy} guests. Please choose another room or reduce the number of guests.`);
      return;
    }
    let createdBooking: { id?: string; subtotal?: number; taxes?: number; service_charge?: number; total_amount?: number } | null = null;
    try {

      const response = await apiClient.post<{ booking: { id?: string; subtotal?: number; taxes?: number; service_charge?: number; total_amount?: number } }>("/bookings", {
        roomId: room.number,
        guestName: user.name,
        phone: user.phone,
        email: user.email,
        checkIn,
        checkOut,
        guests,
        guestDetails: guestDetails.slice(0, guests),
        paymentMethod,
      });
      createdBooking = response.data.booking;
    } catch (error) {
      const status = (error as { response?: { status?: number } }).response?.status;
      if (status === 409) {
        setBookingError("These dates are no longer available. Please choose different dates.");
        return;
      }
      createdBooking = {
        id: `LOCAL-${Date.now()}`,
        subtotal,
        taxes,
        service_charge: serviceCharge,
        total_amount: total,
      };
      console.warn("Booking API unavailable. Confirming booking in preview mode.");
    }
    const invoiceId = `SNP-${Date.now()}`;
    const confirmedBookingId = createdBooking?.id ?? `LOCAL-${Date.now()}`;
    const summary = {
      invoiceId,
      bookingId: confirmedBookingId,
      customerName: user.name,
      customerEmail: user.email,
      customerPhone: user.phone ?? "Not provided",
      room: room.title,
      roomNumber: room.number,
      floor: room.floor,
      maxOccupancy,
      roomType,
      checkIn,
      checkOut,
      guests,
      guestDetails: guestDetails.slice(0, guests),
      nights,
      subtotal: createdBooking?.subtotal ?? subtotal,
      taxes: createdBooking?.taxes ?? taxes,
      serviceCharge: createdBooking?.service_charge ?? serviceCharge,
      total: createdBooking?.total_amount ?? total,
      paymentMethod,
      transactionId: confirmedBookingId,
      gateway: paymentMethod === "Razorpay" ? "Razorpay" : paymentMethod,
      paymentStatus: "Paid",
      invoiceStatus: "Issued",
      bookingSource: "Website",
      customerType: "Individual",
      issuedAt: new Date().toISOString(),
    };
    saveCustomerBooking({
      id: confirmedBookingId,
      roomId: room.id,
      roomNumber: room.number,
      roomTitle: room.title,
      roomType,
      roomImage: room.images[0],
      customerEmail: user.email,
      checkIn,
      checkOut,
      guests,
      nights,
      total: summary.total,
      status: "Confirmed",
      invoiceId,
      createdAt: new Date().toISOString(),
    });
    sessionStorage.setItem("nirvana-invoice", JSON.stringify(summary));
    sessionStorage.removeItem("nirvana-pending-booking");
    void apiClient.post("/payments/create-order", summary).catch(() => undefined);

    const Razorpay = (window as unknown as { Razorpay?: new (options: RazorpayOptions) => { open: () => void } }).Razorpay;
    if (paymentMethod === "Razorpay" && Razorpay) {
      new Razorpay({
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_demo",
        amount: summary.total * 100,
        currency: "INR",
        name: "SRI NIRVANA PLAZA",
        description: `Reservation for ${room.title}`,
        handler: () => navigate("/payment-success"),
        prefill: { name: user?.name ?? "Nirvana Guest", email: user?.email ?? "guest@nirvanaplaza.com" },
        theme: { color: "#b88945" },
      }).open();
      return;
    }
    navigate("/payment-success");
  };

  return (
    <motion.aside
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.45 }}
      className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[0_28px_90px_rgba(38,28,18,0.14)] lg:sticky lg:top-28"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-2xl font-black text-[var(--text)]">{money(room.price)}</p>
          <p className="text-sm text-[var(--muted)]">per night before taxes</p>
        </div>
        <p className="flex items-center gap-1 text-sm font-bold text-[var(--text)]"><Icon name="star" className="h-4 w-4 fill-[var(--gold)] text-[var(--gold)]" /> {room.rating}</p>
      </div>

      <div className="mt-5 grid gap-3">
        <label className="text-xs font-black uppercase tracking-[0.2em] text-[var(--gold)]">Check in</label>
        <input type="date" value={checkIn} min={isoAfter()} onChange={(event) => setCheckIn(event.target.value)} className={fieldClass} />
        <label className="text-xs font-black uppercase tracking-[0.2em] text-[var(--gold)]">Check out</label>
        <input type="date" value={checkOut} min={checkIn} onChange={(event) => setCheckOut(event.target.value)} className={fieldClass} />
        <label className="text-xs font-black uppercase tracking-[0.2em] text-[var(--gold)]">Room type</label>
        <select value={roomType} onChange={(event) => setRoomType(event.target.value as RoomCategory)} className={fieldClass}>
          {categoryProfiles.map((profile) => (
            <option key={profile.name} value={profile.name}>{profile.name}</option>
          ))}
        </select>
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--border)] p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--gold)]">Guests</p>
          <span className="rounded-full bg-[var(--surface-soft)] px-3 py-1 text-[11px] font-black text-[var(--text)]">Max occupancy: {maxOccupancy}</span>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <button type="button" onClick={() => setGuests((current) => Math.max(1, current - 1))} className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-soft)] text-xl font-black">
            -
          </button>
          <span className="text-xl font-black text-[var(--text)]">{guests}</span>
          <button type="button" onClick={addGuest} disabled={guestDetails.length >= maxOccupancy} className="grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-soft)] text-xl font-black disabled:cursor-not-allowed disabled:opacity-40">
            +
          </button>
        </div>
        {guestDetails.length >= maxOccupancy ? <p className="mt-3 text-xs font-bold text-[var(--muted)]">Maximum occupancy reached for this room.</p> : null}
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--border)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[var(--gold)]">Guest details</p>
            <p className="mt-1 text-xs font-semibold text-[var(--muted)]">Add guest records up to the room maximum occupancy.</p>
          </div>
          <button type="button" onClick={addGuest} disabled={guestDetails.length >= maxOccupancy} className="rounded-full bg-[var(--text)] px-4 py-2 text-xs font-black text-[var(--page)] disabled:cursor-not-allowed disabled:opacity-40">
            Add Guest
          </button>
        </div>
        <div className="mt-4 space-y-4">
          {guestDetails.map((guest, index) => (
            <div key={index} className="rounded-2xl bg-[var(--surface-soft)] p-3">
              <p className="mb-3 text-sm font-black text-[var(--text)]">Guest {index + 1}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <input value={guest.name} onChange={(event) => updateGuestDetail(index, "name", event.target.value)} className={fieldClass} placeholder="Full Name (Mandatory)" />
                <input value={guest.age} onChange={(event) => updateGuestDetail(index, "age", event.target.value)} className={fieldClass} placeholder="Age (Mandatory)" inputMode="numeric" />
                <select value={guest.gender} onChange={(event) => updateGuestDetail(index, "gender", event.target.value)} className={fieldClass}>
                  <option value="">Select Gender (Mandatory)</option>
                  <option>Female</option>
                  <option>Male</option>
                  <option>Other</option>
                </select>
                <select value={guest.idProofType} onChange={(event) => updateGuestDetail(index, "idProofType", event.target.value)} className={fieldClass}>
                  <option value="">Select ID Proof (Mandatory)</option>
                  <option value="Aadhar Card">Aadhar Card</option>
                  <option value="Voter ID">Voter ID</option>
                  <option value="Driving License">Driving License</option>
                  <option value="Passport">Passport</option>
                </select>
                <input value={guest.idNumber} onChange={(event) => updateGuestDetail(index, "idNumber", event.target.value)} className={`${fieldClass} sm:col-span-2`} placeholder="ID Number (Mandatory)" />
              </div>
            </div>
          ))}
        </div>

      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {(["Razorpay", "UPI", "Card"] as PaymentMethod[]).map((method) => (
          <button
            key={method}
            type="button"
            onClick={() => setPaymentMethod(method)}
            className={cn(
              "rounded-2xl border px-3 py-3 text-xs font-black",
              paymentMethod === method ? "border-[var(--gold)] bg-[var(--gold)] text-white" : "border-[var(--border)] bg-[var(--surface-soft)] text-[var(--text)]",
            )}
          >
            {method}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3 text-sm text-[var(--muted)]">
        <PriceRow label={`${money(room.price)} x ${nights} night${nights > 1 ? "s" : ""}`} value={money(subtotal)} />
        <PriceRow label="Taxes" value={money(taxes)} />
        <PriceRow label="Service charge" value={money(serviceCharge)} />
        <div className="border-t border-[var(--border)] pt-3">
          <PriceRow label="Final amount" value={money(total)} strong />
        </div>
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        type="button"
        onClick={handleReserve}
        className="mt-6 w-full rounded-full bg-[#ff385c] px-6 py-4 text-sm font-black uppercase tracking-[0.22em] text-white shadow-xl shadow-[#ff385c]/20"
      >
        {user ? "Reserve" : "Sign in to reserve"}
      </motion.button>
      {authNotice ? <p className="mt-3 rounded-2xl bg-[var(--surface-soft)] px-4 py-3 text-center text-xs font-black text-[var(--gold)]">{authNotice}</p> : null}
      {bookingError ? <p className="mt-3 rounded-2xl bg-rose-500/10 px-4 py-3 text-center text-xs font-black text-rose-500">{bookingError}</p> : null}
      <p className="mt-3 text-center text-xs font-semibold text-[var(--muted)]">Payment supports Razorpay, UPI, credit card, and debit card flows.</p>
    </motion.aside>
  );
}

function PriceRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3", strong && "text-base font-black text-[var(--text)]")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function AuthPage({ defaultRole }: { defaultRole: "customer" | "admin" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, loginWithGoogle, theme } = useHotel();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [role, setRole] = useState<"customer" | "admin">(defaultRole);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const authQuery = new URLSearchParams(location.search);
  const redirectParam = authQuery.get("redirect");
  const bookingRequired = authQuery.get("reason") === "booking";
  const customerRedirect = redirectParam?.startsWith("/") ? redirectParam : "/dashboard";

  useEffect(() => setRole(defaultRole), [defaultRole]);

  const emailValid = email.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneValid = phone.length === 0 || /^[6-9]\d{9}$/.test(phone);
  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword;

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    const labels = ["Very weak", "Weak", "Good", "Strong", "Excellent"];
    return { score, label: labels[score], width: `${Math.max(12, score * 25)}%` };
  }, [password]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    if (!emailValid || !email) {
      setError("Enter a valid email address.");
      return;
    }
    if (mode === "register") {
      if (!name.trim() || !phoneValid || !phone || passwordStrength.score < 3 || !passwordsMatch) {
        setError("Complete all registration fields with valid phone and strong matching passwords.");
        return;
      }
      try {
        await register({ name: name.trim(), email, phone, password, role: "customer" });
        navigate(customerRedirect);
      } catch {
        setError("Registration failed. Please check your details and try again.");
      }
      return;
    }
    if (!password) {
      setError("Enter your password.");
      return;
    }
    if (remember) localStorage.setItem("nirvana-remember", email);
    try {
      await login(email, role, role === "admin" ? "Nirvana Admin" : name.trim() || undefined, password);
      navigate(role === "admin" ? "/admin" : customerRedirect);
    } catch (err: any) {
      const serverMessage = err.response?.data?.message;
      setError(serverMessage || "Login failed. Please verify your email, password, and portal type.");
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    const googleProfile = credentialResponse.credential ? decodeGoogleCredential(credentialResponse.credential) : null;
    try {
      if (credentialResponse.credential) {
        await apiClient.post("/auth/google", { credential: credentialResponse.credential });
      }
      await loginWithGoogle(googleProfile?.email, googleProfile?.name || googleProfile?.given_name, credentialResponse.credential);
      navigate(customerRedirect);
    } catch (err: any) {
      const serverMessage = err.response?.data?.message;
      setError(serverMessage || "Google sign-in failed. Please register first.");
    }
  };


  return (
    <Page className="relative overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
      <div className="absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(circle_at_top,rgba(184,137,69,0.28),transparent_60%)]" />
      <div className="mx-auto grid max-w-6xl overflow-hidden rounded-[2.5rem] border border-[var(--border)] bg-[var(--surface)] shadow-[0_30px_100px_rgba(38,28,18,0.16)] lg:grid-cols-[0.95fr_1.05fr]">
        <div className="relative hidden min-h-[720px] overflow-hidden lg:block">
          <img src={heroImage} alt="SRI NIRVANA PLAZA lobby" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-10 left-10 right-10 text-white">
            <p className="text-xs font-black uppercase tracking-[0.35em] text-[#f0c989]">Secure access</p>
            <h1 className="mt-4 text-5xl font-black tracking-tight">Customer and admin login for a luxury booking platform.</h1>
            <p className="mt-5 text-lg leading-8 text-white/78">Use customer login for bookings and profile features. Use admin login for room blocking, analytics, users, and revenue operations.</p>
          </div>
        </div>

        <div className="p-6 sm:p-10">
          <div className="mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-[var(--gold)]">SRI NIRVANA PLAZA</p>
            <h2 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--text)]">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
            {bookingRequired ? (
              <p className="mt-4 rounded-2xl bg-[var(--surface-soft)] px-4 py-3 text-sm font-bold text-[var(--gold)]">
                Sign in is required before booking a room. Your selected room and dates are saved.
              </p>
            ) : null}
          </div>

          <div className="mb-5 grid grid-cols-2 gap-2 rounded-full bg-[var(--surface-soft)] p-1">
            {(["customer", "admin"] as const).map((item) => (
              <button key={item} type="button" onClick={() => setRole(item)} className={cn("rounded-full px-4 py-3 text-sm font-black capitalize", role === item ? "bg-[var(--surface)] text-[var(--text)] shadow" : "text-[var(--muted)]")}>{item} login</button>
            ))}
          </div>

          <div className="mb-6 grid grid-cols-2 gap-2 rounded-full bg-[var(--surface-soft)] p-1">
            <button type="button" onClick={() => setMode("login")} className={cn("rounded-full px-4 py-3 text-sm font-black", mode === "login" ? "bg-[var(--text)] text-[var(--page)]" : "text-[var(--muted)]")}>Login</button>
            <button type="button" onClick={() => setMode("register")} className={cn("rounded-full px-4 py-3 text-sm font-black", mode === "register" ? "bg-[var(--text)] text-[var(--page)]" : "text-[var(--muted)]")}>Register</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" ? (
              <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} placeholder="Full Name" />
            ) : null}
            {mode === "login" && role === "customer" ? (
              <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} placeholder="Full Name" />
            ) : null}
            <div>
              <input value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} placeholder="Email" type="email" />
              {!emailValid ? <p className="mt-2 text-xs font-bold text-rose-500">Please enter a valid email.</p> : null}
            </div>
            {mode === "register" ? (
              <div>
                <input value={phone} onChange={(event) => setPhone(event.target.value)} className={fieldClass} placeholder="Phone Number" inputMode="numeric" />
                {!phoneValid ? <p className="mt-2 text-xs font-bold text-rose-500">Enter a valid 10 digit Indian mobile number.</p> : null}
              </div>
            ) : null}
            <div className="relative">
              <input value={password} onChange={(event) => setPassword(event.target.value)} className={cn(fieldClass, "pr-20")} placeholder="Password" type={showPassword ? "text" : "password"} />
              <button type="button" onClick={() => setShowPassword((current) => !current)} className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-[var(--gold)]">
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {mode === "register" ? (
              <>
                <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-soft)]">
                  <div className="h-full rounded-full bg-[var(--gold)] transition-all" style={{ width: passwordStrength.width }} />
                </div>
                <p className="text-xs font-bold text-[var(--muted)]">Password strength: {passwordStrength.label}</p>
                <input value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className={fieldClass} placeholder="Confirm Password" type={showPassword ? "text" : "password"} />
                {!passwordsMatch ? <p className="text-xs font-bold text-rose-500">Passwords do not match.</p> : null}
              </>
            ) : null}

            {mode === "login" ? (
              <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-semibold text-[var(--muted)]">
                <label className="flex items-center gap-2"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /> Remember me</label>
                <button type="button" className="font-black text-[var(--gold)]">Forgot password?</button>
              </div>
            ) : null}

            {error ? <p className="rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-500">{error}</p> : null}

            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }} type="submit" className="w-full rounded-full bg-[#ff385c] px-6 py-4 text-sm font-black uppercase tracking-[0.22em] text-white shadow-xl shadow-[#ff385c]/20">
              {mode === "login" ? `Login as ${role}` : "Create customer account"}
            </motion.button>
          </form>

          <div className="my-6 flex items-center gap-4 text-xs font-bold uppercase tracking-[0.25em] text-[var(--muted)]">
            <span className="h-px flex-1 bg-[var(--border)]" /> Google OAuth <span className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <div className="overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface)] p-1">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError("Google sign-in could not start. Configure VITE_GOOGLE_CLIENT_ID or use demo Google login.")}
              shape="pill"
              theme={theme === "dark" ? "filled_black" : "outline"}
              text="continue_with"
              width="420"
            />
          </div>
          <button type="button" onClick={() => { void loginWithGoogle().then(() => navigate(customerRedirect)); }} className="mt-3 w-full rounded-full border border-[var(--border)] bg-[var(--surface-soft)] px-6 py-4 text-sm font-black text-[var(--text)]">
            Continue with Google demo
          </button>
        </div>
      </div>
    </Page>
  );
}

function UserDashboardPage() {
  const { user, notifications, wishlist } = useHotel();
  const savedRooms = rooms.filter((room) => wishlist.includes(room.id));
  const visibleSavedRooms = savedRooms.length ? savedRooms : rooms.slice(0, 2);
  const customerBookings = useMemo(() => (user ? readCustomerBookings(user.email) : []), [user]);
  const upcomingBookings = customerBookings.filter(isUpcomingStay);
  const completedBookings = customerBookings.filter((booking) => booking.checkOut < isoAfter(0));
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const metrics = [
    ["My Bookings", String(customerBookings.length)],
    ["Upcoming Stays", String(upcomingBookings.length)],
    ["Completed Stays", String(completedBookings.length)],
    ["Loyalty Points", "18,450"],
    ["Wishlist", String(wishlist.length)],
  ];

  if (!user) {
    return (
      <Page className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h1 className="text-4xl font-semibold text-[var(--text)]">Login required</h1>
        <p className="mt-4 text-[var(--muted)]">Create an account or login to see bookings, recommendations, reviews, notifications, and saved rooms.</p>
        <Link to="/login" className="mt-8 inline-flex rounded-full bg-[var(--text)] px-6 py-3 text-sm font-bold text-[var(--page)]">Go to login</Link>
      </Page>
    );
  }

  return (
    <Page className="bg-[#fff8ef] px-4 py-12 text-[#24180d] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.35em] text-[#9b6a33]">Customer dashboard</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight md:text-6xl">Welcome, {user.name}.</h1>
          </div>
          <p className="text-lg leading-8 text-[#7c6651]">A guest-first dashboard for profile, booking history, AI recommendations, saved rooms, notifications, loyalty, and reviews.</p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {metrics.map(([label, value], index) => (
            <motion.div key={label} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }} className="rounded-[1.75rem] bg-white p-5 shadow-[0_18px_50px_rgba(99,62,23,0.08)]">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-[#9b6a33]">{label}</p>
              <p className="mt-3 text-3xl font-black">{value}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <div className="space-y-6">
            <div className="rounded-[2rem] bg-white p-6 shadow-[0_18px_50px_rgba(99,62,23,0.08)]">
              <div className="flex items-center gap-4">
                <img src={user.avatar} alt={user.name} className="h-16 w-16 rounded-full" />
                <div>
                  <h2 className="text-xl font-black">Profile</h2>
                  <p className="text-sm font-semibold text-[#7c6651]">{user.email}</p>
                </div>
              </div>
              <Link to="/profile" className="mt-5 inline-flex rounded-full bg-[#24180d] px-5 py-3 text-sm font-bold text-white">Manage profile</Link>
            </div>

            <div className="rounded-[2rem] bg-white p-6 shadow-[0_18px_50px_rgba(99,62,23,0.08)]">
              <h2 className="text-xl font-black">Notifications</h2>
              <div className="mt-4 space-y-3">
                {notifications.map((item) => (
                  <p key={item} className="rounded-2xl bg-[#f8efe3] p-4 text-sm font-semibold text-[#7c6651]">{item}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[2rem] bg-white p-6 shadow-[0_18px_50px_rgba(99,62,23,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-black">My booked rooms</h2>
                <span className="text-sm font-black text-[#9b6a33]">{customerBookings.length} total</span>
              </div>
              {customerBookings.length ? (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {customerBookings.map((booking) => {
                    const invoice = { ...invoiceFromCustomerBooking(booking), customerName: user.name, customerPhone: user.phone ?? "Not provided" };
                    return (
                      <div key={booking.id} className="rounded-2xl bg-[#f8efe3] p-3 transition hover:-translate-y-1 hover:shadow-xl">
                        <Link to={`/room/${booking.roomId}`} className="group flex gap-4">
                          <img src={booking.roomImage} alt={booking.roomTitle} className="h-24 w-28 rounded-xl object-cover" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-black">{booking.roomTitle}</p>
                            <p className="mt-1 text-sm font-semibold text-[#7c6651]">{booking.checkIn} to {booking.checkOut}</p>
                            <p className="mt-1 text-xs font-black uppercase tracking-[0.18em] text-[#9b6a33]">{booking.status} - {money(booking.total)}</p>
                            <p className="mt-2 text-xs font-bold text-[#24180d] group-hover:text-[#9b6a33]">View room details</p>
                          </div>
                        </Link>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" onClick={() => setSelectedInvoice(invoice)} className="rounded-full bg-[#24180d] px-3 py-2 text-xs font-black text-white">View Invoice</button>
                          <button type="button" onClick={() => downloadInvoice(invoice)} className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#24180d]">Download PDF</button>
                          <button type="button" onClick={() => window.print()} className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#24180d]">Print</button>
                          <button type="button" onClick={() => void shareInvoice(invoice)} className="rounded-full bg-white px-3 py-2 text-xs font-black text-[#24180d]">Share</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl bg-[#f8efe3] p-6 text-center">
                  <p className="font-black">No booked rooms yet.</p>
                  <p className="mt-2 text-sm font-semibold text-[#7c6651]">After you reserve a room, it will appear here with a link to the room page.</p>
                  <Link to="/rooms" className="mt-4 inline-flex rounded-full bg-[#24180d] px-5 py-3 text-sm font-bold text-white">Explore rooms</Link>
                </div>
              )}
            </div>

            <div className="rounded-[2rem] bg-white p-6 shadow-[0_18px_50px_rgba(99,62,23,0.08)]">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-black">Upcoming stays</h2>
                <span className="text-sm font-black text-[#9b6a33]">Redirect to booked room</span>
              </div>
              {upcomingBookings.length ? (
                <div className="mt-5 divide-y divide-[#eadfce]">
                  {upcomingBookings.map((booking) => (
                    <Link key={booking.id} to={`/room/${booking.roomId}`} className="flex items-center justify-between gap-4 py-4 text-sm transition hover:px-2">
                      <div>
                        <p className="font-black">{booking.roomTitle}</p>
                        <p className="text-[#7c6651]">Check-in {booking.checkIn} - {booking.guests} guest{booking.guests > 1 ? "s" : ""}</p>
                      </div>
                      <span className="rounded-full bg-[#f8efe3] px-3 py-2 text-xs font-black text-[#9b6a33]">View</span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-5 rounded-2xl bg-[#f8efe3] p-4 text-sm font-semibold text-[#7c6651]">No upcoming stays yet.</p>
              )}
            </div>

            <div className="rounded-[2rem] bg-white p-6 shadow-[0_18px_50px_rgba(99,62,23,0.08)]">
              <div className="flex items-center justify-between gap-4">
                <h2 className="text-xl font-black">Booking history</h2>
                <span className="text-sm font-black text-[#9b6a33]">Invoice ready</span>
              </div>
              <div className="mt-5 divide-y divide-[#eadfce]">
                {(customerBookings.length ? customerBookings : []).map((booking) => {
                  const invoice = { ...invoiceFromCustomerBooking(booking), customerName: user.name, customerPhone: user.phone ?? "Not provided" };
                  return (
                    <div key={booking.id} className="flex flex-wrap items-center justify-between gap-4 py-4 text-sm">
                      <Link to={`/room/${booking.roomId}`}>
                        <p className="font-black">{booking.roomTitle}</p>
                        <p className="text-[#7c6651]">{isUpcomingStay(booking) ? "Upcoming" : "Completed"} stay - Invoice {booking.invoiceId}</p>
                      </Link>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-black">{money(booking.total)}</span>
                        <button type="button" onClick={() => setSelectedInvoice(invoice)} className="rounded-full bg-[#f8efe3] px-3 py-2 text-xs font-black text-[#9b6a33]">View Invoice</button>
                        <button type="button" onClick={() => downloadInvoice(invoice)} className="rounded-full bg-[#f8efe3] px-3 py-2 text-xs font-black text-[#9b6a33]">Download Again</button>
                        <button type="button" onClick={() => void shareInvoice(invoice)} className="rounded-full bg-[#f8efe3] px-3 py-2 text-xs font-black text-[#9b6a33]">Share</button>
                      </div>
                    </div>
                  );
                })}
                {!customerBookings.length ? <p className="py-4 text-sm font-semibold text-[#7c6651]">Your booking history is empty.</p> : null}
              </div>
            </div>

            <div className="rounded-[2rem] bg-white p-6 shadow-[0_18px_50px_rgba(99,62,23,0.08)]">
              <h2 className="text-xl font-black">AI recommendations</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {rooms.slice(10, 13).map((room) => (
                  <Link key={room.id} to={`/room/${room.id}`} className="group">
                    <img src={room.images[0]} alt={room.title} className="h-36 w-full rounded-2xl object-cover transition group-hover:scale-[1.02]" />
                    <p className="mt-3 text-sm font-black">{room.title}</p>
                    <p className="text-xs font-semibold text-[#7c6651]">Based on your saved stays</p>
                  </Link>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] bg-white p-6 shadow-[0_18px_50px_rgba(99,62,23,0.08)]">
              <h2 className="text-xl font-black">Saved rooms and reviews</h2>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {visibleSavedRooms.map((room) => (
                  <Link key={room.id} to={`/room/${room.id}`} className="flex gap-4 rounded-2xl bg-[#f8efe3] p-3">
                    <img src={room.images[0]} alt={room.title} className="h-20 w-24 rounded-xl object-cover" />
                    <div>
                      <p className="font-black">{room.title}</p>
                      <p className="text-sm text-[#7c6651]">{room.rating} rating - review invited</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {selectedInvoice && <InvoiceModal invoice={selectedInvoice} onClose={() => setSelectedInvoice(null)} />}
    </Page>
  );
}

function AdminDashboardPage() {
  return <EnterpriseAdminPage />;
}

function GalleryPage() {
  return (
    <Page className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading eyebrow="Gallery" title="Every space is designed to feel cinematic." copy="Exterior, lobby, reception, swimming pool, restaurant, gym, spa, and sky lounge imagery with smooth hover zoom." />
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
        {galleryImages.map((image, index) => (
          <motion.figure key={image.label} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.04 }} className={cn("group overflow-hidden rounded-[2rem]", index === 0 && "md:col-span-2 md:row-span-2")}>
            <img src={image.src} alt={image.label} className="h-full min-h-72 w-full object-cover transition duration-700 group-hover:scale-110" />
            <figcaption className="-mt-16 p-5 text-lg font-black text-white drop-shadow">{image.label}</figcaption>
          </motion.figure>
        ))}
      </div>
    </Page>
  );
}

function ExperiencesPage() {
  const experiences = [
    ["Rooftop tasting menu", "A private chef table under the city skyline."],
    ["Nirvana spa circuit", "Steam, aroma therapy, and deep tissue rituals."],
    ["Heritage city drive", "A chauffeur-led cultural evening curated by concierge."],
  ];
  return (
    <Page className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading eyebrow="Experiences" title="Beyond rooms, book moments worth returning for." copy="Premium guest experiences can be attached to reservations and managed by the concierge team." />
      <div className="grid gap-6 md:grid-cols-3">
        {experiences.map(([title, copy], index) => (
          <motion.div key={title} whileHover={{ y: -8 }} className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[0_18px_60px_rgba(38,28,18,0.08)]">
            <img src={galleryImages[index + 4].src} alt={title} className="h-56 w-full rounded-[1.5rem] object-cover" />
            <h2 className="mt-5 text-2xl font-black text-[var(--text)]">{title}</h2>
            <p className="mt-3 leading-7 text-[var(--muted)]">{copy}</p>
          </motion.div>
        ))}
      </div>
    </Page>
  );
}

function AboutPage() {
  return (
    <Page className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 lg:px-8">
      <p className="text-xs font-black uppercase tracking-[0.35em] text-[var(--gold)]">About us</p>
      <h1 className="mt-4 text-5xl font-black uppercase tracking-[-0.04em] text-[var(--text)] md:text-7xl">SRI NIRVANA PLAZA</h1>
      <p className="mt-6 text-xl leading-9 text-[var(--muted)]">A luxury hotel booking platform and operating system built around exact room availability, premium guest journeys, secure payments, and admin-grade inventory controls.</p>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {["Five-star service", "Real-time calendar", "Secure payments"].map((item) => (
          <div key={item} className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6">
            <Icon name="shield" className="mx-auto h-8 w-8 text-[var(--gold)]" />
            <p className="mt-4 font-black text-[var(--text)]">{item}</p>
          </div>
        ))}
      </div>
    </Page>
  );
}

function ContactPage() {
  return (
    <Page className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading eyebrow="Contact" title="Concierge support from search to stay." copy="Reach the reservation desk, guest relations team, or corporate booking desk." />
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6">
          <InfoLine icon="phone" label="Phone" value="+91 98765 43210" />
          <InfoLine icon="mail" label="Email" value="reservations@nirvanaplaza.com" />
          <InfoLine icon="map" label="Address" value="SRI NIRVANA PLAZA, MG Road, Bengaluru" />
        </div>
        <form className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <input className={fieldClass} placeholder="Full name" />
            <input className={fieldClass} placeholder="Email address" />
          </div>
          <textarea className={cn(fieldClass, "mt-4 min-h-40 resize-none")} placeholder="How can we help?" />
          <button type="button" className="mt-4 rounded-full bg-[var(--text)] px-6 py-3 text-sm font-bold text-[var(--page)]">Send message</button>
        </form>
      </div>
    </Page>
  );
}

function InfoLine({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <div className="flex gap-4 border-b border-[var(--border)] py-5 last:border-b-0">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--surface-soft)] text-[var(--gold)]"><Icon name={icon} className="h-5 w-5" /></span>
      <div>
        <p className="text-xs font-black uppercase tracking-[0.22em] text-[var(--gold)]">{label}</p>
        <p className="mt-1 font-bold text-[var(--text)]">{value}</p>
      </div>
    </div>
  );
}

function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, updateProfile } = useHotel();
  const [isEditing, setIsEditing] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: user?.name ?? "", phone: user?.phone ?? "", avatar: user?.avatar ?? "" });
  const [profileMessage, setProfileMessage] = useState("");
  const [loyalty, setLoyalty] = useState<{ points: number; tier: string; tierColor: string; perks: string[]; nextTier: string | null; pointsToNextTier: number; progressPercent: number } | null>(null);
  const [guestBookings, setGuestBookings] = useState<Record<string, unknown>[]>([]);
  const [stats, setStats] = useState<{ totalBookings: number; totalSpent: number; totalNights: number } | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "loyalty" | "bookings">("profile");

  useEffect(() => {
    if (user) {
      setProfileForm({ name: user.name, phone: user.phone ?? "", avatar: user.avatar });
      // Fetch loyalty + bookings from backend
      const userId = (user as Record<string, unknown>).id as string | undefined;
      if (userId) {
        apiClient.get(`/guests/${userId}/profile`).then((res) => {
          const data = res.data as { loyalty?: typeof loyalty; stats?: typeof stats };
          if (data.loyalty) setLoyalty(data.loyalty);
          if (data.stats) setStats(data.stats);
        }).catch(() => {});
        apiClient.get(`/guests/${userId}/bookings`).then((res) => {
          const data = res.data as { bookings?: Record<string, unknown>[] };
          if (data.bookings) setGuestBookings(data.bookings);
        }).catch(() => {});
      }
    }
  }, [user]);

  if (!user) {
    return (
      <Page className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
        <h1 className="text-4xl font-semibold text-[var(--text)]">Profile unavailable</h1>
        <p className="mt-4 text-[var(--muted)]">Please login to manage your profile.</p>
        <Link to="/login" className="mt-8 inline-flex rounded-full bg-[var(--text)] px-6 py-3 text-sm font-bold text-[var(--page)]">Login</Link>
      </Page>
    );
  }

  const handleLogout = () => { logout(); navigate("/login"); };
  const handleAvatarUpload = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setProfileForm((c) => ({ ...c, avatar: String(reader.result) }));
    reader.readAsDataURL(file);
  };
  const handleSaveProfile = async () => {
    try { await updateProfile(profileForm); setIsEditing(false); setProfileMessage("Profile updated successfully."); }
    catch { setProfileMessage("Unable to update profile. Please try again."); }
  };

  const downloadPDF = async (bookingId: string) => {
    try {
      const res = await apiClient.get(`/bookings/${bookingId}/invoice/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data as BlobPart], { type: "application/pdf" }));
      const a = document.createElement("a"); a.href = url; a.download = `invoice-${bookingId}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch { alert("Invoice PDF not available yet. Please complete payment first."); }
  };

  const tierGradient: Record<string, string> = {
    Platinum: "from-[#B8860B] to-[#FFD700]",
    Gold: "from-[#DAA520] to-[#FFD700]",
    Silver: "from-[#A8A8A8] to-[#D0D0D0]",
    Bronze: "from-[#8B4513] to-[#CD7F32]",
  };

  return (
    <Page className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header card */}
      <div className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--surface)] p-8 shadow-[0_24px_80px_rgba(38,28,18,0.12)]">
        <div className="flex flex-wrap items-center gap-5">
          <img src={profileForm.avatar || user.avatar} alt={user.name} className="h-24 w-24 rounded-full object-cover ring-4 ring-[var(--gold)]/30" />
          <div className="flex-1">
            <p className="text-xs font-black uppercase tracking-[0.32em] text-[var(--gold)]">Guest Profile</p>
            <h1 className="mt-2 text-4xl font-black text-[var(--text)]">{user.name}</h1>
            <p className="mt-1 font-semibold text-[var(--muted)]">{user.email}</p>
            {loyalty && (
              <span className={`mt-2 inline-flex items-center gap-2 rounded-full bg-gradient-to-r px-3 py-1 text-xs font-black text-white ${tierGradient[loyalty.tier] ?? "from-[#888] to-[#aaa]"}`}>
                ⭐ {loyalty.tier} Member · {loyalty.points.toLocaleString()} pts
              </span>
            )}
          </div>
        </div>

        {/* Stats row */}
        {stats && (
          <div className="mt-6 grid grid-cols-3 gap-3">
            {[
              { label: "Total Bookings", value: stats.totalBookings },
              { label: "Nights Stayed", value: stats.totalNights },
              { label: "Total Spent", value: `₹${stats.totalSpent.toLocaleString("en-IN")}` },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-[var(--surface-soft)] px-4 py-3 text-center">
                <p className="text-xl font-black text-[var(--gold)]">{s.value}</p>
                <p className="mt-1 text-xs font-bold text-[var(--muted)]">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="mt-6 flex gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-soft)] p-1">
          {(["profile", "loyalty", "bookings"] as const).map((tab) => (
            <button key={tab} type="button" onClick={() => setActiveTab(tab)}
              className={`flex-1 rounded-xl py-2 text-xs font-black uppercase tracking-wider transition ${activeTab === tab ? "bg-[var(--text)] text-[var(--page)] shadow" : "text-[var(--muted)]"}`}>
              {tab === "profile" ? "👤 Profile" : tab === "loyalty" ? "⭐ Loyalty" : "📋 Bookings"}
            </button>
          ))}
        </div>

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="mt-6">
            {isEditing ? (
              <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface-soft)] p-5">
                <h2 className="text-xl font-black text-[var(--text)]">Edit Profile</h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <input value={profileForm.name} onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })} className={fieldClass} placeholder="Full Name" />
                  <input value={profileForm.phone} onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })} className={fieldClass} placeholder="Phone Number" />
                  <input type="file" accept="image/*" onChange={(e) => handleAvatarUpload(e.target.files?.[0])} className={fieldClass} />
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" onClick={handleSaveProfile} className="rounded-full bg-[var(--text)] px-6 py-3 text-sm font-black text-[var(--page)]">Save</button>
                  <button type="button" onClick={() => setIsEditing(false)} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-sm font-black text-[var(--text)]">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <DetailPill label="Role" value={user.role} />
                <DetailPill label="Phone" value={user.phone || "Not added"} />
              </div>
            )}
            {profileMessage && <p className="mt-5 rounded-2xl bg-[var(--surface-soft)] px-4 py-3 text-sm font-bold text-[var(--gold)]">{profileMessage}</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={() => setIsEditing((c) => !c)} className="inline-flex items-center gap-2 rounded-full bg-[var(--text)] px-6 py-3 text-sm font-black text-[var(--page)] shadow-xl">
                <Icon name="user" className="h-5 w-5" /> Edit Profile
              </button>
              <button type="button" onClick={handleLogout} className="inline-flex items-center gap-2 rounded-full bg-rose-500 px-6 py-3 text-sm font-black text-white shadow-xl shadow-rose-500/20">
                <Icon name="logout" className="h-5 w-5" /> Logout
              </button>
            </div>
          </div>
        )}

        {/* Loyalty Tab */}
        {activeTab === "loyalty" && loyalty && (
          <div className="mt-6 space-y-4">
            <div className={`rounded-[2rem] bg-gradient-to-br ${tierGradient[loyalty.tier] ?? "from-[#888] to-[#aaa]"} p-6 text-white`}>
              <p className="text-xs font-black uppercase tracking-widest opacity-80">{loyalty.tier} Member</p>
              <p className="mt-2 text-4xl font-black">{loyalty.points.toLocaleString()} Points</p>
              {loyalty.nextTier && (
                <div className="mt-4">
                  <p className="text-xs font-bold opacity-80">{loyalty.pointsToNextTier} pts to {loyalty.nextTier}</p>
                  <div className="mt-2 h-2 w-full rounded-full bg-white/30">
                    <div className="h-2 rounded-full bg-white" style={{ width: `${loyalty.progressPercent}%` }} />
                  </div>
                </div>
              )}
            </div>
            <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <h3 className="text-sm font-black text-[var(--text)]">Your Perks</h3>
              <ul className="mt-3 space-y-2">
                {loyalty.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2 text-sm text-[var(--muted)]">
                    <span className="text-[var(--gold)]">✓</span> {perk}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
              <h3 className="text-sm font-black text-[var(--text)]">How to Earn Points</h3>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                {[{ label: "Per Stay", pts: "500 pts" }, { label: "Feedback", pts: "100 pts" }, { label: "Referral", pts: "200 pts" }].map((e) => (
                  <div key={e.label} className="rounded-xl bg-[var(--surface)] p-3">
                    <p className="text-sm font-black text-[var(--gold)]">{e.pts}</p>
                    <p className="text-xs text-[var(--muted)]">{e.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Bookings Tab */}
        {activeTab === "bookings" && (
          <div className="mt-6 space-y-4">
            {guestBookings.length === 0 ? (
              <p className="py-8 text-center text-[var(--muted)]">No bookings found.</p>
            ) : (
              guestBookings.map((b) => (
                <div key={b.id as string} className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface-soft)] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-black text-[var(--text)]">Room {b.room_number as string} — {b.room_type as string}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{b.check_in as string} → {b.check_out as string}</p>
                      <p className="mt-1 text-xs font-bold text-[var(--gold)]">₹{Number(b.total_amount ?? 0).toLocaleString("en-IN")}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-black ${
                        b.status === "confirmed" ? "bg-emerald-100 text-emerald-700" :
                        b.status === "cancelled" ? "bg-rose-100 text-rose-700" :
                        "bg-amber-100 text-amber-700"
                      }`}>{String(b.status)}</span>
                      {b.payment_status === "paid" && (
                        <button type="button" onClick={() => downloadPDF(b.id as string)}
                          className="inline-flex items-center gap-1 rounded-xl border border-[var(--gold)] px-3 py-1.5 text-xs font-black text-[var(--gold)] hover:bg-[var(--gold)] hover:text-white transition">
                          📄 Download PDF
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </Page>
  );
}

function WishlistPage() {

  const { wishlist } = useHotel();
  const savedRooms = rooms.filter((room) => wishlist.includes(room.id));
  return (
    <Page className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading eyebrow="Wishlist" title="Rooms you saved for later." copy="Tap the heart icon on any room to save or remove it, similar to Airbnb wishlists." />
      {savedRooms.length ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">{savedRooms.map((room) => <RoomCard key={room.id} room={room} />)}</div>
      ) : (
        <div className="rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-10 text-center">
          <p className="text-lg font-bold text-[var(--text)]">No rooms saved yet.</p>
          <Link to="/rooms" className="mt-5 inline-flex rounded-full bg-[var(--text)] px-6 py-3 text-sm font-bold text-[var(--page)]">Explore rooms</Link>
        </div>
      )}
    </Page>
  );
}

const invoiceFromCustomerBooking = (booking: CustomerBooking): Invoice => ({
  invoiceId: booking.invoiceId,
  bookingId: booking.id,
  roomNumber: booking.roomNumber,
  room: booking.roomTitle,
  roomType: booking.roomType,
  checkIn: booking.checkIn,
  checkOut: booking.checkOut,
  guests: booking.guests,
  nights: booking.nights,
  subtotal: Math.round(booking.total / 1.2),
  taxes: Math.round((booking.total / 1.2) * 0.12),
  serviceCharge: Math.round((booking.total / 1.2) * 0.08),
  total: booking.total,
  customerEmail: booking.customerEmail,
  paymentMethod: "UPI",
  paymentStatus: "Paid",
  invoiceStatus: "Issued",
  issuedAt: booking.createdAt,
});

function PaymentSuccessPage() {
  const [downloadMessage, setDownloadMessage] = useState("");
  const [notificationMessage, setNotificationMessage] = useState("");
  const [showModal, setShowModal] = useState(false);
  const invoice = useMemo<Invoice>(() => {
    const fallback: Invoice = {
      invoiceId: "SNP-DEMO",
      customerName: "Nirvana Guest",
      customerEmail: "guest@nirvanaplaza.com",
      customerPhone: "Not provided",
      room: "Executive Room 201",
      roomType: "Executive Rooms",
      checkIn: isoAfter(1),
      checkOut: isoAfter(3),
      guests: 1,
      nights: 2,
      subtotal: 21000,
      taxes: 2520,
      serviceCharge: 1680,
      total: 25200,
      paymentMethod: "UPI",
      paymentStatus: "Paid",
      issuedAt: new Date().toISOString(),
    };
    try {
      const value = sessionStorage.getItem("nirvana-invoice");
      return value ? (JSON.parse(value) as Invoice) : fallback;
    } catch {
      return fallback;
    }
  }, []);

  useEffect(() => {
    if (!invoice.bookingId) return;
    const key = `nirvana-payment-success-notified-${invoice.bookingId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "true");
    void apiClient
      .post("/payments/success", {
        bookingId: invoice.bookingId,
        invoiceId: invoice.invoiceId,
        total: invoice.total,
        paymentMethod: invoice.paymentMethod,
      })
      .then(() => setNotificationMessage("Payment success recorded. WhatsApp confirmation is scheduled automatically."))
      .catch(() => {
        createPreviewWhatsAppAutomation(invoice);
        setNotificationMessage("Preview WhatsApp automation recorded. Open Admin > Notifications to view dry-run messages. Real WhatsApp sends when backend and Meta credentials are connected.");
      });
  }, [invoice]);

  useEffect(() => {
    if (!invoice.bookingId) return;
    const downloadKey = `nirvana-invoice-downloaded-${invoice.bookingId}`;
    if (sessionStorage.getItem(downloadKey)) return;
    sessionStorage.setItem(downloadKey, "true");
    try {
      downloadInvoice(invoice);
      setDownloadMessage("PDF invoice download started automatically. Please check your Downloads folder.");
    } catch {
      setDownloadMessage("Auto-download blocked by browser or failed. Please click 'Download invoice PDF' manually.");
    }
  }, [invoice]);

  const handleDownloadInvoice = () => {
    try {
      downloadInvoice(invoice);
      setDownloadMessage("PDF invoice download started. Please check your Downloads folder. If Chrome blocks it, use Print or save PDF.");
    } catch {
      setDownloadMessage("Unable to download the PDF. Please allow downloads for this site and try again.");
    }
  };

  return (
    <Page className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-[2.5rem] border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-[0_24px_80px_rgba(38,28,18,0.12)]">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-white"><Icon name="check" className="h-8 w-8" /></span>
        <h1 className="mt-5 text-4xl font-black text-[var(--text)]">Booking confirmed</h1>
        <p className="mt-3 text-[var(--muted)]">Your payment is successful. The invoice has been generated and is ready to download.</p>
        <div className="mx-auto mt-8 max-w-4xl text-left shadow-lg">
          <InvoiceView invoice={invoice} />
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={() => setShowModal(true)} className="rounded-full bg-[#8a5f3c] px-6 py-3 text-sm font-bold text-white shadow-xl hover:-translate-y-0.5">
            View tax invoice
          </button>
          <button type="button" onClick={handleDownloadInvoice} className="rounded-full bg-[var(--text)] px-6 py-3 text-sm font-bold text-[var(--page)]">
            Download invoice PDF
          </button>
          <button type="button" onClick={() => window.print()} className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-sm font-bold text-[var(--text)]">
            Print or save PDF
          </button>
          <Link to="/dashboard" className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-6 py-3 text-sm font-bold text-[var(--text)]">Open dashboard</Link>
        </div>
        {downloadMessage ? <p className="mt-4 text-sm font-bold text-[var(--gold)]">{downloadMessage}</p> : null}
        {notificationMessage ? <p className="mt-3 text-sm font-bold text-[var(--muted)]">{notificationMessage}</p> : null}
      </div>
      {showModal && <InvoiceModal invoice={invoice} onClose={() => setShowModal(false)} />}
    </Page>
  );
}

function NotFoundPage() {
  return (
    <Page className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 lg:px-8">
      <h1 className="text-5xl font-black text-[var(--text)]">Page not found</h1>
      <p className="mt-4 text-[var(--muted)]">The room or page you requested does not exist.</p>
      <Link to="/" className="mt-8 inline-flex rounded-full bg-[var(--text)] px-6 py-3 text-sm font-bold text-[var(--page)]">Return home</Link>
    </Page>
  );
}

function Footer() {
  const columns = [
    ["Company", "About Us", "Careers", "News"],
    ["Support", "Help Center", "Contact", "FAQ"],
    ["Services", "Rooms", "Experiences", "Offers"],
    ["Social Media", "Instagram", "Facebook", "LinkedIn", "Twitter"],
  ];
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.1fr_1.4fr] lg:px-8">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.35em] text-[var(--gold)]">SRI NIRVANA PLAZA</p>
          <h2 className="mt-3 text-3xl font-black text-[var(--text)]">Room Availability Calendar</h2>
          <p className="mt-4 max-w-md leading-7 text-[var(--muted)]">Luxury hotel booking with customer dashboards, admin operations, Google OAuth, payments, reviews, wishlists, and real room calendars.</p>
          <div className="mt-6 flex max-w-md rounded-full border border-[var(--border)] bg-[var(--page)] p-1">
            <input className="min-w-0 flex-1 bg-transparent px-4 text-sm outline-none" placeholder="Newsletter email" />
            <button type="button" className="rounded-full bg-[var(--text)] px-5 py-3 text-sm font-bold text-[var(--page)]">Subscribe</button>
          </div>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map(([title, ...links]) => (
            <div key={title}>
              <h3 className="text-sm font-black text-[var(--text)]">{title}</h3>
              <div className="mt-4 space-y-3">
                {links.map((item) => <a key={item} className="block text-sm font-semibold text-[var(--muted)] hover:text-[var(--gold)]">{item}</a>)}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-[var(--border)] px-4 py-5 text-center text-sm font-semibold text-[var(--muted)]">
        Copyright 2026 SRI NIRVANA PLAZA. All rights reserved.
      </div>
    </footer>
  );
}

export default function App() {
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <HotelProvider>
        <AppRouter />
      </HotelProvider>
    </GoogleOAuthProvider>
  );
}