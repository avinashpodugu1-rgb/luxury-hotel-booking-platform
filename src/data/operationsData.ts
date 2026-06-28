import { rooms } from "./hotelData";

export type PMSRoomType = "Single" | "Double" | "Deluxe" | "Suite" | "Executive Suite";
export type PMSRoomStatus = "available" | "booked" | "reserved" | "maintenance" | "out-of-service";
export type Priority = "Low" | "Medium" | "High";
export type MaintenanceStatus = "Active" | "In Progress" | "Completed";
export type BookingStatus = "Pending" | "Confirmed" | "Checked-In" | "Checked-Out" | "Cancelled";
export type TaskStatus = "Pending" | "Assigned" | "In Progress" | "Inspection Pending" | "Completed" | "Cancelled";
export type RoomServiceStatus = "Received" | "Accepted" | "Preparing" | "Ready" | "Out for Delivery" | "Delivered" | "Cancelled";

export type PMSRoom = {
  id: string;
  roomNumber: string;
  roomType: PMSRoomType;
  floor: string;
  capacity: number;
  price: number;
  status: PMSRoomStatus;
};

export type MaintenanceBlock = {
  id: string;
  roomNumber: string;
  startDate: string;
  endDate: string;
  reason: string;
  description: string;
  priority: Priority;
  assignedStaff: string;
  expectedCompletionDate: string;
  status: MaintenanceStatus;
};

export type BookingRecord = {
  id: string;
  guestName: string;
  phone: string;
  email: string;
  idProof: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  maxOccupancy?: number;
  guestDetails?: Array<{ name: string; age: string; gender: string; idProof: string }>;
  roomType: PMSRoomType;
  assignedRoom: string;
  status: BookingStatus;
  amount: number;
};

export type GuestRecord = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  address: string;
  identityNumber: string;
  loyaltyPoints: number;
  bookingHistory: string[];
  stayHistory: string[];
};

export type CorporateBooking = {
  id: string;
  companyName: string;
  coordinator: string;
  numberOfRooms: number;
  stayDates: string;
  specialRequests: string;
  status: "Pending" | "Approved" | "Rejected" | "Priority";
};

export type SelfCheckIn = {
  id: string;
  guestName: string;
  guestVerification: "Pending" | "Verified";
  idVerification: "Pending" | "Verified";
  checkInTime: string;
  roomAssignment: string;
  status: "Pending" | "Ready" | "Completed";
};

export type HousekeepingTask = {
  id: string;
  roomNumber: string;
  roomType: string;
  floor: string;
  task: "Room Cleaning" | "Deep Cleaning" | "Linen Change" | "Bathroom Cleaning" | "Room Inspection" | "Mini Bar Refill" | "Guest Requested Cleaning" | "Maintenance Follow-up" | "Sanitization" | "VIP Room Preparation" | "Maintenance Support";
  priority: "Low" | "Medium" | "High" | "Urgent";
  assignedStaff: string;
  assignedTime: string;
  startTime: string;
  completionTime: string;
  estimatedDuration: string;
  status: TaskStatus;
  remarks: string;
};

export type ServiceRequest = {
  id: string;
  bookingId: string;
  guestName: string;
  roomNumber: string;
  requestType: "Food Orders" | "Laundry" | "Water Bottles" | "Extra Towels" | "Amenities" | "Spa" | "Taxi";
  items: string;
  quantity: number;
  specialInstructions: string;
  requestTime: string;
  assignedStaff: string;
  estimatedDeliveryTime: string;
  deliveryTime: string;
  paymentStatus: "Paid" | "Pending" | "Billed to Room";
  status: RoomServiceStatus;
  totalAmount: number;
};

export type ComplaintRecord = {
  id: string;
  guestName: string;
  roomNumber: string;
  description: string;
  priority: Priority;
  status: "Open" | "Under Review" | "Resolved";
};

export type FeedbackRecord = {
  id: string;
  guestName: string;
  rating: number;
  feedback: string;
};

export type PaymentRecord = {
  id: string;
  invoiceNumber: string;
  guestName: string;
  amount: number;
  gstAmount: number;
  method: "Cash" | "UPI" | "Credit Card" | "Debit Card";
  status: "Paid" | "Pending";
};

export type ActionHistoryRecord = {
  id: string;
  createdBy: string;
  updatedBy: string;
  actionType: string;
  timestamp: string;
  statusChanges: string;
};

export type CalendarStatus = PMSRoomStatus;

export const pmsRoomTypes: PMSRoomType[] = ["Single", "Double", "Deluxe", "Suite", "Executive Suite"];

export const roomBlockReasons = [
  "Maintenance",
  "AC Repair",
  "Plumbing Issue",
  "Electrical Issue",
  "Painting",
  "Deep Cleaning",
  "Furniture Replacement",
  "Pest Control",
  "VIP Hold",
  "Staff Usage",
  "Other",
];

export const isoDateAfter = (offset: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

export const formatShortDate = (date: string) =>
  new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });

const statusCycle: PMSRoomStatus[] = [
  "available",
  "booked",
  "reserved",
  "available",
  "maintenance",
  "available",
  "booked",
  "out-of-service",
];

const typeByCategory = (category: string): PMSRoomType => {
  if (category.includes("Deluxe")) return "Deluxe";
  if (category.includes("Executive")) return "Executive Suite";
  if (category.includes("Family")) return "Double";
  if (category.includes("Suite")) return "Suite";
  return "Single";
};

export const pmsRooms: PMSRoom[] = rooms.map((room, index) => ({
  id: `pms-room-${room.number}`,
  roomNumber: room.number,
  roomType: typeByCategory(room.category),
  floor: `Floor ${room.number.charAt(0)}`,
  capacity: room.guests,
  price: room.price,
  status: statusCycle[index % statusCycle.length],
}));

export const maintenanceBlocks: MaintenanceBlock[] = [
  {
    id: "MNT-1001",
    roomNumber: "104",
    startDate: isoDateAfter(0),
    endDate: isoDateAfter(2),
    reason: "AC Repair",
    description: "Compressor noise and cooling delay reported by housekeeping inspection.",
    priority: "High",
    assignedStaff: "Ravi Kumar",
    expectedCompletionDate: isoDateAfter(2),
    status: "In Progress",
  },
  {
    id: "MNT-1002",
    roomNumber: "205",
    startDate: isoDateAfter(3),
    endDate: isoDateAfter(5),
    reason: "Deep Cleaning",
    description: "Post long-stay deep cleaning and upholstery refresh.",
    priority: "Medium",
    assignedStaff: "Meera Das",
    expectedCompletionDate: isoDateAfter(5),
    status: "Active",
  },
  {
    id: "MNT-1003",
    roomNumber: "404",
    startDate: isoDateAfter(1),
    endDate: isoDateAfter(4),
    reason: "Plumbing Issue",
    description: "Bathroom mixer and drainage repair in progress.",
    priority: "High",
    assignedStaff: "Imran Shaikh",
    expectedCompletionDate: isoDateAfter(4),
    status: "In Progress",
  },
  {
    id: "MNT-1004",
    roomNumber: "501",
    startDate: isoDateAfter(8),
    endDate: isoDateAfter(10),
    reason: "VIP Hold",
    description: "Presidential suite held for diplomatic arrival pending confirmation.",
    priority: "Low",
    assignedStaff: "Front Office",
    expectedCompletionDate: isoDateAfter(10),
    status: "Active",
  },
];

export const bookingRecords: BookingRecord[] = [
  {
    id: "BKG-24091",
    guestName: "Aarav Mehta",
    phone: "9876501122",
    email: "aarav.mehta@example.com",
    idProof: "AADHAAR **** 4381",
    checkIn: isoDateAfter(0),
    checkOut: isoDateAfter(2),
    guests: 2,
    roomType: "Executive Suite",
    assignedRoom: "201",
    status: "Checked-In",
    amount: 25200,
  },
  {
    id: "BKG-24092",
    guestName: "Neha Kapoor",
    phone: "9876502233",
    email: "neha.kapoor@example.com",
    idProof: "PASSPORT K8492218",
    checkIn: isoDateAfter(1),
    checkOut: isoDateAfter(4),
    guests: 3,
    roomType: "Suite",
    assignedRoom: "401",
    status: "Confirmed",
    amount: 66600,
  },
  {
    id: "BKG-24093",
    guestName: "Rohan Iyer",
    phone: "9876503344",
    email: "rohan.iyer@example.com",
    idProof: "AADHAAR **** 9012",
    checkIn: isoDateAfter(2),
    checkOut: isoDateAfter(3),
    guests: 1,
    roomType: "Single",
    assignedRoom: "101",
    status: "Pending",
    amount: 9000,
  },
  {
    id: "BKG-24094",
    guestName: "Isha Reddy",
    phone: "9876504455",
    email: "isha.reddy@example.com",
    idProof: "AADHAAR **** 6678",
    checkIn: isoDateAfter(5),
    checkOut: isoDateAfter(8),
    guests: 4,
    roomType: "Double",
    assignedRoom: "303",
    status: "Confirmed",
    amount: 53280,
  },
  {
    id: "BKG-24095",
    guestName: "Kabir Sethi",
    phone: "9876505566",
    email: "kabir.sethi@example.com",
    idProof: "PASSPORT N9221091",
    checkIn: isoDateAfter(7),
    checkOut: isoDateAfter(10),
    guests: 5,
    roomType: "Executive Suite",
    assignedRoom: "502",
    status: "Confirmed",
    amount: 131940,
  },
];

export const guestRecords: GuestRecord[] = [
  {
    id: "GST-5011",
    fullName: "Aarav Mehta",
    phone: "9876501122",
    email: "aarav.mehta@example.com",
    address: "Indiranagar, Bengaluru",
    identityNumber: "AADHAAR **** 4381",
    loyaltyPoints: 18450,
    bookingHistory: ["BKG-24091", "BKG-23988"],
    stayHistory: ["Executive Room 201", "Suite Room 402"],
  },
  {
    id: "GST-5012",
    fullName: "Neha Kapoor",
    phone: "9876502233",
    email: "neha.kapoor@example.com",
    address: "Bandra West, Mumbai",
    identityNumber: "PASSPORT K8492218",
    loyaltyPoints: 9600,
    bookingHistory: ["BKG-24092"],
    stayHistory: ["Suite Room 401"],
  },
  {
    id: "GST-5013",
    fullName: "Rohan Iyer",
    phone: "9876503344",
    email: "rohan.iyer@example.com",
    address: "Alwarpet, Chennai",
    identityNumber: "AADHAAR **** 9012",
    loyaltyPoints: 4200,
    bookingHistory: ["BKG-24093"],
    stayHistory: ["Deluxe Room 101"],
  },
  {
    id: "GST-5014",
    fullName: "Isha Reddy",
    phone: "9876504455",
    email: "isha.reddy@example.com",
    address: "Jubilee Hills, Hyderabad",
    identityNumber: "AADHAAR **** 6678",
    loyaltyPoints: 7350,
    bookingHistory: ["BKG-24094"],
    stayHistory: ["Family Room 303"],
  },
];

export const corporateBookings: CorporateBooking[] = [
  {
    id: "CORP-3301",
    companyName: "Tetrabyte Systems",
    coordinator: "Priya Menon",
    numberOfRooms: 12,
    stayDates: `${isoDateAfter(6)} to ${isoDateAfter(9)}`,
    specialRequests: "Airport transfers, conference lunch, quiet floors",
    status: "Pending",
  },
  {
    id: "CORP-3302",
    companyName: "Aster Capital",
    coordinator: "Vikram Jain",
    numberOfRooms: 8,
    stayDates: `${isoDateAfter(11)} to ${isoDateAfter(14)}`,
    specialRequests: "Executive suites, late checkout, GST invoice",
    status: "Approved",
  },
  {
    id: "CORP-3303",
    companyName: "Meridian Pharma",
    coordinator: "Ananya Rao",
    numberOfRooms: 18,
    stayDates: `${isoDateAfter(16)} to ${isoDateAfter(19)}`,
    specialRequests: "Priority allocation near banquet hall",
    status: "Priority",
  },
];

export const selfCheckIns: SelfCheckIn[] = [
  { id: "SCI-7101", guestName: "Neha Kapoor", guestVerification: "Verified", idVerification: "Verified", checkInTime: "13:20", roomAssignment: "401", status: "Ready" },
  { id: "SCI-7102", guestName: "Rohan Iyer", guestVerification: "Pending", idVerification: "Pending", checkInTime: "15:00", roomAssignment: "101", status: "Pending" },
  { id: "SCI-7103", guestName: "Kabir Sethi", guestVerification: "Verified", idVerification: "Verified", checkInTime: "18:10", roomAssignment: "502", status: "Completed" },
];

export const housekeepingTasks: HousekeepingTask[] = [
  { id: "HK-9001", roomNumber: "101", roomType: "Single", floor: "Floor 1", task: "Room Cleaning", priority: "Medium", assignedStaff: "Latha P", assignedTime: "10:00", startTime: "", completionTime: "", estimatedDuration: "30 mins", status: "Pending", remarks: "Arrival clean required by 13:30" },
  { id: "HK-9002", roomNumber: "201", roomType: "Double", floor: "Floor 2", task: "Linen Change", priority: "Low", assignedStaff: "Suresh N", assignedTime: "09:00", startTime: "09:15", completionTime: "", estimatedDuration: "15 mins", status: "In Progress", remarks: "VIP linen and pillow menu" },
  { id: "HK-9003", roomNumber: "303", roomType: "Deluxe", floor: "Floor 3", task: "Deep Cleaning", priority: "Low", assignedStaff: "Kavya S", assignedTime: "08:00", startTime: "08:15", completionTime: "09:00", estimatedDuration: "45 mins", status: "Completed", remarks: "Family amenity kit placed" },
  { id: "HK-9004", roomNumber: "404", roomType: "Suite", floor: "Floor 4", task: "Maintenance Support", priority: "High", assignedStaff: "Ravi Kumar", assignedTime: "11:00", startTime: "11:10", completionTime: "", estimatedDuration: "60 mins", status: "In Progress", remarks: "Support plumbing inspection" },
  { id: "HK-9005", roomNumber: "502", roomType: "Executive Suite", floor: "Floor 5", task: "Linen Change", priority: "High", assignedStaff: "Meera Das", assignedTime: "12:00", startTime: "", completionTime: "", estimatedDuration: "20 mins", status: "Pending", remarks: "Presidential setup" },
];

export const serviceRequests: ServiceRequest[] = [
  { id: "SRV-8101", bookingId: "BKG-24091", guestName: "Aarav Mehta", roomNumber: "201", requestType: "Food Orders", items: "1x Club Sandwich, 2x Cola", quantity: 2, specialInstructions: "No onions", requestTime: "09:15", assignedStaff: "Rahul", estimatedDeliveryTime: "09:45", deliveryTime: "09:40", paymentStatus: "Paid", totalAmount: 450, status: "Delivered" },
  { id: "SRV-8102", bookingId: "BKG-24092", guestName: "Neha Kapoor", roomNumber: "401", requestType: "Extra Towels", items: "2x Towels", quantity: 2, specialInstructions: "", requestTime: "10:05", assignedStaff: "Latha P", estimatedDeliveryTime: "10:15", deliveryTime: "", paymentStatus: "Billed to Room", totalAmount: 0, status: "Out for Delivery" },
  { id: "SRV-8103", bookingId: "BKG-24093", guestName: "Isha Reddy", roomNumber: "303", requestType: "Amenities", items: "1x Dental Kit", quantity: 1, specialInstructions: "", requestTime: "11:40", assignedStaff: "Suresh N", estimatedDeliveryTime: "12:00", deliveryTime: "", paymentStatus: "Billed to Room", totalAmount: 0, status: "Received" },
  { id: "SRV-8104", bookingId: "BKG-24094", guestName: "Kabir Sethi", roomNumber: "502", requestType: "Laundry", items: "3x Shirts, 1x Trousers", quantity: 4, specialInstructions: "Express delivery", requestTime: "12:05", assignedStaff: "Meera Das", estimatedDeliveryTime: "18:00", deliveryTime: "", paymentStatus: "Pending", totalAmount: 800, status: "Accepted" },
];

export const complaintRecords: ComplaintRecord[] = [
  { id: "CMP-6101", guestName: "Rohan Iyer", roomNumber: "101", description: "WiFi intermittent during video call.", priority: "Medium", status: "Under Review" },
  { id: "CMP-6102", guestName: "Neha Kapoor", roomNumber: "401", description: "Mini bar invoice clarification requested.", priority: "Low", status: "Open" },
  { id: "CMP-6103", guestName: "Aarav Mehta", roomNumber: "201", description: "Late night corridor noise reported.", priority: "High", status: "Resolved" },
];

export const feedbackRecords: FeedbackRecord[] = [
  { id: "FDB-7001", guestName: "Aarav Mehta", rating: 5, feedback: "Excellent service and accurate availability calendar." },
  { id: "FDB-7002", guestName: "Neha Kapoor", rating: 5, feedback: "Suite was beautiful, self check-in was smooth." },
  { id: "FDB-7003", guestName: "Rohan Iyer", rating: 3, feedback: "Room was good but WiFi needs improvement." },
  { id: "FDB-7004", guestName: "Isha Reddy", rating: 4, feedback: "Family setup was thoughtful and clean." },
  { id: "FDB-7005", guestName: "Kabir Sethi", rating: 5, feedback: "Presidential service was outstanding." },
];

export const paymentRecords: PaymentRecord[] = [
  { id: "PAY-12001", invoiceNumber: "INV-SNP-24091", guestName: "Aarav Mehta", amount: 25200, gstAmount: 4536, method: "UPI", status: "Paid" },
  { id: "PAY-12002", invoiceNumber: "INV-SNP-24092", guestName: "Neha Kapoor", amount: 66600, gstAmount: 11988, method: "Credit Card", status: "Pending" },
  { id: "PAY-12003", invoiceNumber: "INV-SNP-24093", guestName: "Rohan Iyer", amount: 9000, gstAmount: 1620, method: "Cash", status: "Pending" },
  { id: "PAY-12004", invoiceNumber: "INV-SNP-24094", guestName: "Isha Reddy", amount: 53280, gstAmount: 9590, method: "Debit Card", status: "Paid" },
];

export const actionHistoryRecords: ActionHistoryRecord[] = [
  { id: "ACT-90001", createdBy: "Nirvana Admin", updatedBy: "Front Office", actionType: "Booking Approved", timestamp: `${isoDateAfter(0)} 09:10`, statusChanges: "Pending to Confirmed" },
  { id: "ACT-90002", createdBy: "Maintenance", updatedBy: "Chief Engineer", actionType: "Room Blocked", timestamp: `${isoDateAfter(0)} 10:25`, statusChanges: "Available to Maintenance" },
  { id: "ACT-90003", createdBy: "Housekeeping", updatedBy: "Floor Supervisor", actionType: "Task Completed", timestamp: `${isoDateAfter(0)} 11:45`, statusChanges: "In Progress to Completed" },
  { id: "ACT-90004", createdBy: "Guest Relations", updatedBy: "Duty Manager", actionType: "Complaint Resolved", timestamp: `${isoDateAfter(0)} 12:30`, statusChanges: "Under Review to Resolved" },
];

export const notificationCenterItems = [
  { id: "NOT-1", title: "Booking confirmation alert", message: "BKG-24092 requires pre-arrival confirmation call.", type: "Booking" },
  { id: "NOT-2", title: "Check-in alert", message: "3 self check-ins are waiting for ID verification.", type: "Check-in" },
  { id: "NOT-3", title: "Complaint alert", message: "CMP-6101 has been under review for 2 hours.", type: "Complaint" },
  { id: "NOT-4", title: "Maintenance alert", message: "Room 404 plumbing task is high priority.", type: "Maintenance" },
  { id: "NOT-5", title: "Housekeeping alert", message: "Room 101 arrival clean is due before 13:30.", type: "Housekeeping" },
];

export const aiRecommendations = [
  "Occupancy summary: Weekend occupancy is projected at 86 percent with suite demand leading.",
  "Room allocation: Assign BKG-24095 to 502 and keep 501 on VIP hold until 18:00.",
  "High occupancy alert: Executive Suite inventory will fall below 2 rooms on Friday.",
  "Maintenance warning: Room 404 must stay blocked until plumbing sign-off is completed.",
  "Revenue insight: Push Deluxe to Suite upgrade offers for arrivals staying 3 nights or more.",
  "Priority notification: Corporate block CORP-3303 needs floor-wise allocation review.",
];

export const reportDefinitions = [
  "Booking Report",
  "Occupancy Report",
  "Maintenance Report",
  "Revenue Report",
  "Complaint Report",
  "Housekeeping Report",
  "Blocked Room Report",
];

export const recentActivities = [
  "Room 104 blocked for AC repair by Engineering.",
  "BKG-24092 confirmed by Reservations.",
  "HK-9003 completed by floor supervisor.",
  "Payment PAY-12001 marked paid through UPI.",
  "Complaint CMP-6103 resolved by Duty Manager.",
];

export const statusLabels: Record<PMSRoomStatus, string> = {
  available: "Available",
  booked: "Booked",
  reserved: "Reserved",
  maintenance: "Maintenance / Blocked",
  "out-of-service": "Out Of Service",
};

export const statusColorClasses: Record<PMSRoomStatus, string> = {
  available: "bg-emerald-500/18 text-emerald-200 border-emerald-400/35",
  booked: "bg-red-500/20 text-red-100 border-red-400/35",
  reserved: "bg-blue-500/20 text-blue-100 border-blue-400/35",
  maintenance: "bg-yellow-400/20 text-yellow-100 border-yellow-300/35",
  "out-of-service": "bg-zinc-500/22 text-zinc-100 border-zinc-300/25",
};

export const lightStatusColorClasses: Record<PMSRoomStatus, string> = {
  available: "bg-emerald-500/12 text-emerald-700 border-emerald-500/25",
  booked: "bg-red-500/12 text-red-700 border-red-500/25",
  reserved: "bg-blue-500/12 text-blue-700 border-blue-500/25",
  maintenance: "bg-yellow-400/25 text-yellow-800 border-yellow-500/30",
  "out-of-service": "bg-zinc-500/12 text-zinc-700 border-zinc-500/25",
};

const isWithin = (date: string, start: string, end: string) => date >= start && date <= end;

export const getBlockForRoomDate = (roomNumber: string, date: string, blocks = maintenanceBlocks) =>
  blocks.find((block) => block.roomNumber === roomNumber && block.status !== "Completed" && isWithin(date, block.startDate, block.endDate));

export const getBookingForRoomDate = (roomNumber: string, date: string, bookings = bookingRecords) =>
  bookings.find(
    (booking) =>
      booking.assignedRoom === roomNumber &&
      booking.status !== "Cancelled" &&
      isWithin(date, booking.checkIn, booking.checkOut),
  );

export const getCalendarStatus = (
  room: PMSRoom,
  date: string,
  bookings = bookingRecords,
  blocks = maintenanceBlocks,
): CalendarStatus => {
  if (room.status === "out-of-service") return "out-of-service";
  if (getBlockForRoomDate(room.roomNumber, date, blocks) || room.status === "maintenance") return "maintenance";
  const booking = getBookingForRoomDate(room.roomNumber, date, bookings);
  if (booking?.status === "Pending") return "reserved";
  if (booking) return "booked";
  if (room.status === "reserved") return "reserved";
  if (room.status === "booked") return "booked";
  return "available";
};

export const hasRoomConflict = (
  roomNumber: string,
  checkIn: string,
  checkOut: string,
  bookings = bookingRecords,
  blocks = maintenanceBlocks,
  roomsList = pmsRooms,
) => {
  const room = roomsList.find((item) => item.roomNumber === roomNumber);
  if (!room || room.status === "out-of-service") return true;
  const booked = bookings.some(
    (booking) =>
      booking.assignedRoom === roomNumber &&
      booking.status !== "Cancelled" &&
      checkIn <= booking.checkOut &&
      checkOut >= booking.checkIn,
  );
  const blocked = blocks.some(
    (block) =>
      block.roomNumber === roomNumber &&
      block.status !== "Completed" &&
      checkIn <= block.endDate &&
      checkOut >= block.startDate,
  );
  return booked || blocked;
};

export const buildKpis = (roomsList = pmsRooms, bookings = bookingRecords, blocks = maintenanceBlocks) => {
  const today = isoDateAfter(0);
  const totalRooms = roomsList.length;
  const bookedRooms = roomsList.filter((room) => room.status === "booked").length;
  const reservedRooms = roomsList.filter((room) => room.status === "reserved").length;
  const blockedRooms = blocks.filter((block) => block.status !== "Completed").length;
  const maintenanceRooms = roomsList.filter((room) => room.status === "maintenance").length;
  const outOfServiceRooms = roomsList.filter((room) => room.status === "out-of-service").length;
  const availableRooms = Math.max(0, totalRooms - bookedRooms - reservedRooms - maintenanceRooms - outOfServiceRooms);
  const todaysCheckIns = bookings.filter((booking) => booking.checkIn === today).length;
  const todaysCheckOuts = bookings.filter((booking) => booking.checkOut === today).length;
  const revenueToday = bookings.filter((booking) => booking.checkIn === today).reduce((sum, booking) => sum + booking.amount, 0);
  const revenueMonth = bookings.reduce((sum, booking) => sum + booking.amount, 0);
  const occupancyPercentage = totalRooms ? Math.round(((bookedRooms + reservedRooms) / totalRooms) * 100) : 0;

  return [
    { label: "Total Rooms", value: totalRooms },
    { label: "Available Rooms", value: availableRooms },
    { label: "Booked Rooms", value: bookedRooms },
    { label: "Reserved Rooms", value: reservedRooms },
    { label: "Blocked Rooms", value: blockedRooms },
    { label: "Rooms Under Maintenance", value: maintenanceRooms },
    { label: "Out Of Service Rooms", value: outOfServiceRooms },
    { label: "Today's Check-ins", value: todaysCheckIns },
    { label: "Today's Check-outs", value: todaysCheckOuts },
    { label: "Occupancy Percentage", value: `${occupancyPercentage}%` },
    { label: "Revenue Today", value: `INR ${revenueToday.toLocaleString("en-IN")}` },
    { label: "Revenue This Month", value: `INR ${revenueMonth.toLocaleString("en-IN")}` },
    { label: "Pending Complaints", value: complaintRecords.filter((item) => item.status !== "Resolved").length },
    { label: "Pending Housekeeping Tasks", value: housekeepingTasks.filter((item) => item.status !== "Completed").length },
  ];
};

export const findOperationsRecord = (recordType: string | undefined, recordId: string | undefined) => {
  const collections: Record<string, Array<Record<string, unknown>>> = {
    rooms: pmsRooms,
    bookings: bookingRecords,
    guests: guestRecords,
    corporate: corporateBookings,
    "self-check-in": selfCheckIns,
    housekeeping: housekeepingTasks,
    "room-service": serviceRequests,
    complaints: complaintRecords,
    feedback: feedbackRecords,
    payments: paymentRecords,
    maintenance: maintenanceBlocks,
    history: actionHistoryRecords,
    notifications: notificationCenterItems,
  };
  return collections[recordType ?? ""]?.find((record) => record.id === recordId) ?? null;
};