import { jsPDF } from "jspdf";
import React, { useMemo } from "react";

export type GuestDetail = {
  name: string;
  age: string;
  gender: string;
  idProof: string;
};

export type Invoice = {
  invoiceId: string;
  bookingId?: string;
  roomNumber?: string;
  floor?: string;
  maxOccupancy?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  nationality?: string;
  governmentIdType?: string;
  governmentIdNumber?: string;
  bookingSource?: string;
  customerType?: string;
  room: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  adults?: number;
  children?: number;
  extraBeds?: number;
  guestDetails?: GuestDetail[];
  nights: number;
  subtotal: number;
  additionalCharges?: number;
  discount?: number;
  taxes: number;
  serviceCharge: number;
  total: number;
  paymentMethod: string;
  transactionId?: string;
  gateway?: string;
  paymentStatus?: string;
  invoiceStatus?: string;
  issuedAt?: string;
};

export const money = (value: number) => `INR ${Math.round(value).toLocaleString("en-IN")}`;

export const mapApiRecordToInvoice = (row: any): Invoice => {
  const booking = row.booking || {};
  const guest = row.guest || {};
  const room = row.room || {};
  const payment = row.payment || {};
  
  // Calculate nights
  const checkInDate = new Date(booking.check_in || row.checkIn || new Date());
  const checkOutDate = new Date(booking.check_out || row.checkOut || new Date());
  const nights = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / 86400000));

  const total = row.totalAmount || booking.total_amount || 0;

  return {
    invoiceId: row.invoiceNumber || row.invoiceId || row.id || "SNP-DEMO",
    bookingId: row.bookingId || booking.id || "N/A",
    roomNumber: booking.room_number || room.room_number || room.number || "Assigned",
    floor: room.floor || "Hotel Wing",
    maxOccupancy: room.capacity || booking.max_occupancy || 2,
    customerName: booking.guest_name || guest.full_name || row.customerName || "Guest",
    customerEmail: booking.email || guest.email || row.customerEmail,
    customerPhone: booking.phone || guest.phone || row.customerPhone || "Not provided",
    customerAddress: guest.address || row.customerAddress || "Captured at check-in",
    nationality: guest.nationality || row.nationality || "Indian",
    governmentIdType: guest.government_id_type || booking.id_proof_type || row.governmentIdType || "ID",
    governmentIdNumber: guest.government_id_number || booking.id_proof || row.governmentIdNumber || "Stored in profile",
    bookingSource: booking.booking_source || row.bookingSource || "Website",
    customerType: guest.customer_type || row.customerType || "Individual",
    room: room.title || booking.room_type || row.room || "Executive Room",
    roomType: booking.room_type || room.category || row.roomType || "Executive Rooms",
    checkIn: booking.check_in || row.checkIn,
    checkOut: booking.check_out || row.checkOut,
    guests: booking.guests || row.guests || 1,
    adults: row.adults || booking.adults || 1,
    children: row.children || booking.children || 0,
    extraBeds: row.extraBeds || booking.extra_beds || 0,
    guestDetails: booking.guest_details || row.guestDetails || [],
    nights: nights,
    subtotal: booking.subtotal || row.subtotal || Math.round(total / 1.2),
    additionalCharges: row.additionalCharges || 0,
    discount: row.discount || 0,
    taxes: booking.taxes || row.taxes || Math.round((total / 1.2) * 0.12),
    serviceCharge: booking.service_charge || row.serviceCharge || Math.round((total / 1.2) * 0.08),
    total: total,
    paymentMethod: payment.provider || booking.payment_method || row.paymentMethod || "UPI",
    transactionId: payment.provider_payment_id || row.paymentId || row.transactionId || "N/A",
    gateway: payment.provider || booking.payment_method || row.gateway || "Razorpay",
    paymentStatus: payment.status || booking.payment_status || row.paymentStatus || "Paid",
    invoiceStatus: row.invoiceStatus || "Issued",
    issuedAt: row.createdAt || row.issuedAt || new Date().toISOString(),
  };
};

export const shareInvoice = async (invoice: Invoice) => {
  const text = `SRI NIRVANA PLAZA Invoice ${invoice.invoiceId} for booking ${invoice.bookingId}. Amount: ${money(invoice.total)}.`;
  
  // Copy to clipboard immediately
  try {
    await navigator.clipboard.writeText(text);
  } catch (err) {
    console.error("Clipboard copy failed", err);
  }
  
  // Non-blocking trigger of native share if available
  if (navigator.share) {
    navigator.share({ title: `Invoice ${invoice.invoiceId}`, text }).catch((err) => {
      console.warn("navigator.share cancelled or failed", err);
    });
  }
};

const drawQrCode = (doc: jsPDF, payload: string, x: number, y: number, size: number) => {
  let hash = 0;
  for (let index = 0; index < payload.length; index += 1) {
    hash = (hash * 31 + payload.charCodeAt(index)) >>> 0;
  }
  const cells = 21;
  const cellSize = size / cells;
  doc.setFillColor(255, 255, 255);
  doc.rect(x, y, size, size, "F");
  doc.setFillColor(29, 23, 18);
  for (let row = 0; row < cells; row += 1) {
    for (let col = 0; col < cells; col += 1) {
      const finder = (row < 7 && col < 7) || (row < 7 && col > 13) || (row > 13 && col < 7);
      const value = finder ? row === 0 || col === 0 || row === 6 || col === 6 || (row > 1 && row < 5 && col > 1 && col < 5) : ((hash + row * 17 + col * 31 + row * col) % 5) < 2;
      if (value) doc.rect(x + col * cellSize, y + row * cellSize, cellSize, cellSize, "F");
    }
  }
};

export const downloadInvoice = (invoice: Invoice) => {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const right = pageWidth - margin;
  const safeAmount = (value: number | undefined) => money(Number.isFinite(value) ? Number(value) : 0);
  const issuedAt = invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleString("en-IN") : new Date().toLocaleString("en-IN");
  
  const qrPayload = JSON.stringify({
    bookingId: invoice.bookingId,
    invoiceNumber: invoice.invoiceId,
    guestName: invoice.customerName,
    hotelName: "SRI NIRVANA PLAZA",
    totalAmount: invoice.total,
    invoiceUrl: `/invoice/${invoice.invoiceId}`,
  });

  doc.setProperties({
    title: `${invoice.invoiceId} - SRI NIRVANA PLAZA Invoice`,
    subject: "Hotel booking invoice",
    author: "SRI NIRVANA PLAZA",
    creator: "Room Availability Calendar",
  });

  // Background and border styling
  doc.setFillColor(246, 241, 235);
  doc.rect(0, 0, pageWidth, pageHeight, "F");
  doc.setFillColor(255, 253, 248);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20, "F");
  doc.setDrawColor(234, 223, 206);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20, "S");

  // Subtle Watermark
  doc.saveGraphicsState();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(234, 223, 206);
  // Set opacity if supported, otherwise draw lightly
  doc.text("SRI NIRVANA PLAZA", pageWidth / 2, pageHeight / 2 - 40, { align: "center", angle: 30 });
  doc.text("OFFICIAL TAX INVOICE", pageWidth / 2, pageHeight / 2 + 10, { align: "center", angle: 30 });
  doc.restoreGraphicsState();

  // Hotel Logo Header (Text-based emblem)
  doc.setFont("helvetica", "bold");
  doc.setTextColor(138, 95, 60);
  doc.setFontSize(9);
  doc.text("SRI NIRVANA PLAZA", margin, 24);
  doc.setTextColor(29, 23, 18);
  doc.setFontSize(20);
  doc.text("Hotel Tax Invoice", margin, 36);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(119, 106, 93);
  doc.setFontSize(9);
  doc.text("MG Road, Bengaluru, Karnataka, India", margin, 44);
  doc.text("Phone: +91 98765 43210 | Email: reservations@nirvanaplaza.com | Website: srinirvanaplaza.example.com", margin, 50);
  doc.text("GSTIN: 29ABCDE1234F1Z5 | PAN: ABCDE1234F | HSN/SAC: 996311", margin, 56);

  // Metadata Card Top Right
  doc.setFont("helvetica", "bold");
  doc.setTextColor(29, 23, 18);
  doc.setFontSize(10);
  doc.text(`Invoice: ${invoice.invoiceId}`, right - 34, 25, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(119, 106, 93);
  doc.text(`Booking ID: ${invoice.bookingId}`, right - 34, 32, { align: "right" });
  doc.text(`Date: ${issuedAt}`, right - 34, 39, { align: "right" });
  doc.text(`Payment: ${invoice.paymentStatus ?? "Paid"} | Invoice: ${invoice.invoiceStatus ?? "Issued"}`, right - 34, 46, { align: "right" });
  drawQrCode(doc, qrPayload, right - 28, 20, 24);

  // Info Grid (Customer & Room Details side-by-side)
  const infoCards = [
    ["Customer Name", invoice.customerName ?? "Nirvana Guest"],
    ["Phone Number", invoice.customerPhone ?? "Not provided"],
    ["Email Address", invoice.customerEmail ?? "Not provided"],
    ["Guest Address", invoice.customerAddress ?? "Captured at check-in"],
    ["Nationality", invoice.nationality ?? "Indian"],
    ["Govt ID Stored", `${invoice.governmentIdType ?? "ID"}: ${invoice.governmentIdNumber ?? "Stored in profile"}`],
    ["Booking Source", invoice.bookingSource ?? "Website"],
    ["Customer Type", invoice.customerType ?? "Individual"],
    ["Assigned Room", `Room ${invoice.roomNumber || "Assigned"}`],
    ["Room Category", invoice.roomType],
    ["Wing / Floor", `Floor ${invoice.floor || "Hotel Wing"}`],
    ["Occupancy Limit", `${invoice.maxOccupancy ?? 2} Guests`],
    ["Checked-In Stay", `${invoice.checkIn} to ${invoice.checkOut}`],
    ["Nights Booked", `${invoice.nights} Night${invoice.nights > 1 ? "s" : ""}`],
    ["Occupants", `${invoice.adults || invoice.guests} Adult(s), ${invoice.children || 0} Child(ren)`],
    ["Extra Beds", `${invoice.extraBeds || 0}`],
    ["Occupants", `${invoice.adults || invoice.guests} Adult(s), ${invoice.children || 0} Child(ren)`],
    ["Extra Beds", `${invoice.extraBeds || 0}`],
  ];

  let y = 68;
  infoCards.forEach(([label, value], index) => {
    const x = index % 2 === 0 ? margin : 112;
    if (index > 0 && index % 2 === 0) y += 15;
    doc.setFillColor(245, 236, 223);
    doc.rect(x, y, 82, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(138, 95, 60);
    doc.text(String(label).toUpperCase(), x + 4, y + 4.5);
    doc.setTextColor(29, 23, 18);
    doc.setFontSize(7.5);
    doc.text(doc.splitTextToSize(String(value), 74), x + 4, y + 9.5);
  });

  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(138, 95, 60);
  doc.setFontSize(8);
  doc.text("GUEST DETAILS & OCCUPANCY", margin, y);
  y += 5;

  const guestRows = invoice.guestDetails?.length
    ? invoice.guestDetails
    : Array.from({ length: invoice.guests }, (_, idx) => ({
        name: idx === 0 ? invoice.customerName ?? "Primary Guest" : `Guest ${idx + 1}`,
        age: "N/A",
        gender: "N/A",
        idProof: "Stored in profile"
      }));

  guestRows.slice(0, Math.max(1, invoice.maxOccupancy ?? invoice.guests)).forEach((guest, index) => {
    doc.setTextColor(29, 23, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.text(`Guest ${index + 1}: ${guest.name || "Guest"} | Age: ${guest.age || "N/A"} | Gender: ${guest.gender || "N/A"} | ID Proof: ${guest.idProof || "Stored"}`, margin, y);
    y += 4.5;
  });

  // Premium Billing Table Layout
  y += 4;
  doc.setFillColor(29, 23, 18);
  doc.rect(margin, y, pageWidth - 32, 9, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 253, 248);
  
  // Headers
  doc.text("DESCRIPTION", margin + 3, y + 6);
  doc.text("QTY", margin + 82, y + 6, { align: "center" });
  doc.text("RATE", margin + 104, y + 6, { align: "right" });
  doc.text("DAYS", margin + 124, y + 6, { align: "center" });
  doc.text("AMOUNT", right - 3, y + 6, { align: "right" });

  const taxableBase = invoice.subtotal;

  const cgstVal = invoice.taxes / 2;
  const sgstVal = invoice.taxes / 2;

  // Billing rows definition
  const tableRows: Array<[string, number, number, number, number, boolean?]> = [
    ["Room Charges (" + invoice.roomType + ")", 1, Math.round(taxableBase / invoice.nights), invoice.nights, taxableBase]
  ];

  // Optional charges (only if > 0)
  const optionalCharges: Array<[string, number, number, number, number]> = [
    ["Room Service / Additional Charges", 1, invoice.additionalCharges || 0, 1, invoice.additionalCharges || 0],
    ["Discount / Promotional Coupons", 1, -(invoice.discount || 0), 1, -(invoice.discount || 0)]
  ];

  optionalCharges.forEach(([desc, qty, rate, days, amt]) => {
    if (amt > 0) {
      tableRows.push([desc, qty, rate, days, amt]);
    }
  });

  if (invoice.serviceCharge > 0) {
    tableRows.push(["Service Charges (8%)", 1, invoice.serviceCharge, 1, invoice.serviceCharge]);
  }

  tableRows.push(
    ["CGST (6%)", 1, Math.round(cgstVal), 1, Math.round(cgstVal)],
    ["SGST (6%)", 1, Math.round(sgstVal), 1, Math.round(sgstVal)],
    ["Grand Total (Incl. GST)", 1, invoice.total, 1, invoice.total, true],
    ["Amount Paid", 1, invoice.total, 1, invoice.total, true],
    ["Balance Amount Due", 1, 0, 1, 0, true]
  );

  y += 9;
  tableRows.forEach(([desc, qty, rate, days, amt, isBold]) => {
    doc.setDrawColor(234, 223, 206);
    doc.line(margin, y, right, y);
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(isBold ? 8.5 : 7.5);
    doc.setTextColor(29, 23, 18);
    
    doc.text(desc, margin + 3, y + 5.5);
    doc.text(qty > 0 || isBold ? String(qty) : "-", margin + 82, y + 5.5, { align: "center" });
    doc.text(rate > 0 || isBold ? safeAmount(rate) : "INR 0", margin + 104, y + 5.5, { align: "right" });
    doc.text(qty > 0 || isBold ? String(days) : "-", margin + 124, y + 5.5, { align: "center" });
    doc.text(safeAmount(amt), right - 3, y + 5.5, { align: "right" });
    
    y += isBold ? 8.5 : 6.8;
  });

  // GST Breakdown Section
  doc.setFillColor(245, 236, 223);
  doc.rect(margin, y + 2, pageWidth - 32, 14, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.setTextColor(138, 95, 60);
  doc.text("GST TAX SUMMARY BREAKDOWN", margin + 4, y + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(29, 23, 18);
  doc.text(`Taxable: ${safeAmount(invoice.subtotal)} | CGST 6%: ${safeAmount(cgstVal)} | SGST 6%: ${safeAmount(sgstVal)} | Total Tax: ${safeAmount(invoice.taxes)}`, margin + 4, y + 11.5);

  // Policies and signature footer
  y += 20;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(138, 95, 60);
  doc.setFontSize(8);
  doc.text("HOTEL POLICIES & TERMS OF STAY", margin, y);
  y += 4.5;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(119, 106, 93);
  doc.setFontSize(6.5);
  const policies = [
    "1. Check-in Time: 2:00 PM | Check-out Time: 11:00 AM. Guest verification is required upon arrival.",
    "2. Cancellation and refunds are governed by the specific rate-plan rules approved during checkout.",
    "3. No-smoking is enforced in rooms. Damage to any hotel structures or amenities will be billed to the guest profile.",
    "4. Visitors must register at front desk with a valid Government ID card prior to entering guest wings."
  ];
  policies.forEach((policy) => {
    doc.text(policy, margin, y);
    y += 3.8;
  });

  doc.setFillColor(245, 236, 223);
  doc.rect(margin, y + 4, pageWidth - 32, 20, "F");
  
  // Digitized Authorized Signatory
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(29, 23, 18);
  doc.text("SRI NIRVANA PLAZA front desk staff", margin + 4, y + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(119, 106, 93);
  doc.text("This document is a certified digital GST invoice generated directly upon payment confirmation.", margin + 4, y + 15);

  // Digital Sign emblem mockup
  doc.setFont("courier", "bolditalic");
  doc.setTextColor(138, 95, 60);
  doc.setFontSize(8);
  doc.text("[ Digital Sign Approved ]", right - 40, y + 10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(29, 23, 18);
  doc.setFontSize(7);
  doc.text("Authorized Representative", right - 40, y + 16);

  // Bottom margins and page counters
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(119, 106, 93);
  doc.text("Thank You For Staying With Us | Support: +91 98765 43210 | reservations@nirvanaplaza.com | Website: srinirvanaplaza.com", pageWidth / 2, pageHeight - 12, { align: "center" });
  doc.text("Page 1 of 1", right, pageHeight - 8, { align: "right" });

  const fileName = `SNP-${invoice.invoiceId}-invoice.pdf`;
  try {
    doc.save(fileName);
  } catch {
    const blob = doc.output("blob");
    if (!blob || blob.size === 0) throw new Error("PDF generation failed");
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    anchor.target = "_self";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
};

export function QrCode({ payload, size = 96 }: { payload: string; size?: number }) {
  const grid = useMemo(() => {
    let hash = 0;
    for (let index = 0; index < payload.length; index += 1) {
      hash = (hash * 31 + payload.charCodeAt(index)) >>> 0;
    }
    const cells = 21;
    const items: boolean[][] = [];
    for (let row = 0; row < cells; row += 1) {
      const rowData: boolean[] = [];
      for (let col = 0; col < cells; col += 1) {
        const finder = (row < 7 && col < 7) || (row < 7 && col > 13) || (row > 13 && col < 7);
        const value = finder ? row === 0 || col === 0 || row === 6 || col === 6 || (row > 1 && row < 5 && col > 1 && col < 5) : ((hash + row * 17 + col * 31 + row * col) % 5) < 2;
        rowData.push(value);
      }
      items.push(rowData);
    }
    return items;
  }, [payload]);

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "grid",
        gridTemplateColumns: "repeat(21, 1fr)",
        backgroundColor: "white",
        padding: "4px",
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
      }}
    >
      {grid.flatMap((row, rIdx) =>
        row.map((cell, cIdx) => (
          <div
            key={`${rIdx}-${cIdx}`}
            className={cell ? "bg-[#1d1712]" : "bg-white"}
          />
        ))
      )}
    </div>
  );
}

type InvoiceViewProps = {
  invoice: Invoice;
};

export function InvoiceView({ invoice }: InvoiceViewProps) {
  const taxableBase = invoice.subtotal;
  const cgstVal = invoice.taxes / 2;
  const sgstVal = invoice.taxes / 2;

  const guestRows = invoice.guestDetails?.length
    ? invoice.guestDetails
    : Array.from({ length: invoice.guests }, (_, idx) => ({
        name: idx === 0 ? invoice.customerName ?? "Primary Guest" : `Guest ${idx + 1}`,
        age: "N/A",
        gender: "N/A",
        idProof: "Stored in profile"
      }));

  const infoCards = [
    ["Customer Name", invoice.customerName ?? "Nirvana Guest"],
    ["Phone Number", invoice.customerPhone ?? "Not provided"],
    ["Email Address", invoice.customerEmail ?? "Not provided"],
    ["Guest Address", invoice.customerAddress ?? "Captured at check-in"],
    ["Nationality", invoice.nationality ?? "Indian"],
    ["Govt ID Stored", `${invoice.governmentIdType ?? "ID"}: ${invoice.governmentIdNumber ?? "Stored in profile"}`],
    ["Booking Source", invoice.bookingSource ?? "Website"],
    ["Customer Type", invoice.customerType ?? "Individual"],
    ["Assigned Room", `Room ${invoice.roomNumber || "Assigned"}`],
    ["Room Category", invoice.roomType],
    ["Wing / Floor", `Floor ${invoice.floor || "Hotel Wing"}`],
    ["Occupancy Limit", `${invoice.maxOccupancy ?? 2} Guests`],
    ["Checked-In Stay", `${invoice.checkIn} to ${invoice.checkOut}`],
    ["Nights Booked", `${invoice.nights} Night${invoice.nights > 1 ? "s" : ""}`],
    ["Occupants", `${invoice.adults || invoice.guests} Adult(s), ${invoice.children || 0} Child(ren)`],
    ["Extra Beds", `${invoice.extraBeds || 0}`],
    ["Occupants", `${invoice.adults || invoice.guests} Adult(s), ${invoice.children || 0} Child(ren)`],
    ["Extra Beds", `${invoice.extraBeds || 0}`],
  ];

  const tableRows = useMemo(() => {
    const list: Array<{
      desc: string;
      qty: string | number;
      rate: number;
      days: string | number;
      amount: number;
      isBold?: boolean;
      isMuted?: boolean;
    }> = [
      {
        desc: `Room Charges (${invoice.roomType})`,
        qty: 1,
        rate: Math.round(taxableBase / invoice.nights),
        days: invoice.nights,
        amount: taxableBase,
        isBold: true
      }
    ];

    const optional = [
      { desc: "Room Service / Additional Charges", amount: invoice.additionalCharges || 0 },
      { desc: "Discount / Promotional Coupons", amount: -(invoice.discount || 0) }
    ];

    optional.forEach((item) => {
      if (item.amount > 0) {
        list.push({
          desc: item.desc,
          qty: "-",
          rate: item.amount,
          days: "-",
          amount: item.amount,
          isMuted: true
        });
      }
    });

    if (invoice.serviceCharge > 0) {
      list.push({
        desc: "Service Charges (8%)",
        qty: 1,
        rate: invoice.serviceCharge,
        days: 1,
        amount: invoice.serviceCharge,
        isBold: true
      });
    }

    list.push(
      {
        desc: "CGST (6%)",
        qty: 1,
        rate: Math.round(cgstVal),
        days: 1,
        amount: Math.round(cgstVal),
        isBold: true
      },
      {
        desc: "SGST (6%)",
        qty: 1,
        rate: Math.round(sgstVal),
        days: 1,
        amount: Math.round(sgstVal),
        isBold: true
      }
    );

    return list;
  }, [invoice, taxableBase, cgstVal, sgstVal]);

  const qrPayload = JSON.stringify({
    bookingId: invoice.bookingId,
    invoiceNumber: invoice.invoiceId,
    guestName: invoice.customerName,
    hotelName: "SRI NIRVANA PLAZA",
    totalAmount: invoice.total,
    invoiceUrl: `/invoice/${invoice.invoiceId}`,
  });

  return (
    <div id="hotel-tax-invoice-view" className="space-y-6 bg-[#fffdfa] text-[#1d1712] p-6 rounded-[2rem] border border-[#ebdcb9]/40">
      {/* Header Row */}
      <div className="grid gap-6 md:grid-cols-2">
        <div>
          <p className="text-lg font-black text-[#8a5f3c]">SRI NIRVANA PLAZA</p>
          <p className="text-xs font-bold text-[#776a5d] mt-1">Luxury Landmark Residence</p>
          <p className="text-xs text-[#776a5d] leading-5 mt-2">
            MG Road, Bengaluru, Karnataka, India<br />
            Phone: +91 98765 43210 | Email: reservations@nirvanaplaza.com<br />
            Website: srinirvanaplaza.com<br />
            GSTIN: 29ABCDE1234F1Z5 | PAN: ABCDE1234F | HSN/SAC: 996311
          </p>
        </div>
        <div className="flex justify-between items-start md:justify-end gap-6 text-left md:text-right">
          <div>
            <p className="text-sm font-black text-[#1d1712]">Invoice: {invoice.invoiceId}</p>
            <p className="text-xs text-[#776a5d] mt-1">Booking ID: {invoice.bookingId}</p>
            <p className="text-xs text-[#776a5d] mt-1">Date: {new Date(invoice.issuedAt || "").toLocaleString("en-IN")}</p>
            <p className="text-xs text-[#776a5d] mt-1">
              Payment: <span className="font-bold text-emerald-600 uppercase">{invoice.paymentStatus}</span> | Invoice: {invoice.invoiceStatus}
            </p>
          </div>
          <div className="print:hidden">
            <QrCode payload={qrPayload} size={84} />
          </div>
        </div>
      </div>

      <hr className="border-[#ebdcb9]" />

      {/* Details Grid (Tan cards in 2 columns) */}
      <div className="grid gap-4 sm:grid-cols-2">
        {infoCards.map(([label, value]) => (
          <div key={label} className="bg-[#f5ece3] p-4 rounded-2xl border border-[#ebdcb9]/60">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8a5f3c]">{label}</p>
            <p className="mt-1 text-xs font-black text-[#1d1712]">{value}</p>
          </div>
        ))}
      </div>

      <hr className="border-[#ebdcb9]/40" />

      {/* Guest Lists (Text list format) */}
      <div className="text-xs space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#8a5f3c]">Guest Details & Occupancy</p>
        <div className="space-y-1.5 font-medium text-[#1d1712]">
          {guestRows.slice(0, Math.max(1, invoice.maxOccupancy ?? invoice.guests)).map((guest, idx) => (
            <p key={idx}>
              Guest {idx + 1}: {guest.name || "Guest"} | Age: {guest.age || "N/A"} | Gender: {guest.gender || "N/A"} | ID Proof: {guest.idProof || "Stored"}
            </p>
          ))}
        </div>
      </div>

      {/* Billing Table */}
      <div>
        <div className="overflow-x-auto rounded-3xl border border-[#eadfce] bg-white">
          <table className="min-w-full divide-y divide-[#eadfce] text-left text-xs">
            <thead className="bg-[#1d1712] text-white">
              <tr>
                <th className="px-5 py-3 font-black">DESCRIPTION</th>
                <th className="px-3 py-3 text-center font-black">QTY</th>
                <th className="px-3 py-3 text-right font-black">RATE</th>
                <th className="px-3 py-3 text-center font-black">DAYS</th>
                <th className="px-5 py-3 text-right font-black">AMOUNT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eadfce]">
              {tableRows.map((row, idx) => (
                <tr key={idx} className={row.isBold ? "font-semibold" : row.isMuted ? "text-[#776a5d]" : ""}>
                  <td className="px-5 py-3">{row.desc}</td>
                  <td className="px-3 py-3 text-center">{row.qty}</td>
                  <td className="px-3 py-3 text-right">{money(row.rate)}</td>
                  <td className="px-3 py-3 text-center">{row.days}</td>
                  <td className="px-5 py-3 text-right">{money(row.amount)}</td>
                </tr>
              ))}
              {/* Totals */}
              <tr className="bg-[#fcf8f2] font-black text-xs md:text-sm">
                <td className="px-5 py-3">Grand Total (Incl. GST)</td>
                <td className="px-3 py-3 text-center">1</td>
                <td className="px-3 py-3 text-right">{money(invoice.total)}</td>
                <td className="px-3 py-3 text-center">1</td>
                <td className="px-5 py-3 text-right text-[#8a5f3c]">{money(invoice.total)}</td>
              </tr>
              <tr className="bg-[#fcf8f2] font-black text-xs md:text-sm">
                <td className="px-5 py-3">Amount Paid</td>
                <td className="px-3 py-3 text-center">1</td>
                <td className="px-3 py-3 text-right">{money(invoice.total)}</td>
                <td className="px-3 py-3 text-center">1</td>
                <td className="px-5 py-3 text-right text-emerald-600">{money(invoice.total)}</td>
              </tr>
              <tr className="bg-[#fcf8f2] font-black text-xs md:text-sm">
                <td className="px-5 py-3">Balance Amount Due</td>
                <td className="px-3 py-3 text-center">1</td>
                <td className="px-3 py-3 text-right">{money(0)}</td>
                <td className="px-3 py-3 text-center">1</td>
                <td className="px-5 py-3 text-right">{money(0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* GST breakdown section card */}
      <div className="bg-[#f5ece3] p-4 rounded-2xl border border-[#ebdcb9]/60 text-xs">
        <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8a5f3c]">GST Tax Summary Breakdown</p>
        <p className="font-medium mt-1 text-[#1d1712]">
          Taxable: {money(invoice.subtotal)} | CGST 6%: {money(cgstVal)} | SGST 6%: {money(sgstVal)} | Total Tax: {money(invoice.taxes)}
        </p>
      </div>

      {/* Policy list */}
      <div className="text-[11px] text-[#776a5d] space-y-1">
        <p className="font-bold text-xs text-[#1d1712] uppercase tracking-[0.12em] text-[#8a5f3c]">Hotel Policies & Terms of Stay</p>
        <p>1. Check-in Time: 2:00 PM | Check-out Time: 11:00 AM. Guest verification is required upon arrival.</p>
        <p>2. Cancellation and refunds are governed by the specific rate-plan rules approved during checkout.</p>
        <p>3. No-smoking is enforced in rooms. Damage to any hotel structures or amenities will be billed to the guest profile.</p>
        <p>4. Visitors must register at front desk with a valid Government ID card prior to entering guest wings.</p>
      </div>

      {/* Footer signage */}
      <div className="flex flex-wrap items-end justify-between gap-6 border-t border-[#ebdcb9]/60 pt-5 text-xs">
        <div>
          <p className="font-black text-[#1d1712]">Thank You For Staying With Us</p>
          <p className="text-[10px] text-[#776a5d] mt-1">Sri Nirvana Plaza Support: +91 98765 43210 | reservations@nirvanaplaza.com | Website: srinirvanaplaza.com</p>
        </div>
        <div className="text-right bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-2xl">
          <p className="text-[9px] font-black text-emerald-800 italic">[ DIGITALLY SIGNED FRONT DESK ]</p>
          <p className="text-[8px] text-emerald-700 font-bold mt-0.5">Sri Nirvana Plaza Front Office Desk</p>
        </div>
      </div>
    </div>
  );
}

type InvoiceModalProps = {
  invoice: Invoice;
  onClose: () => void;
  onRegenerate?: () => void;
};

export function InvoiceModal({ invoice, onClose, onRegenerate }: InvoiceModalProps) {
  const [toast, setToast] = React.useState("");

  const handleDownload = () => downloadInvoice(invoice);
  const handlePrint = () => window.print();
  const handleShare = async () => {
    setToast("Invoice details copied to clipboard!");
    setTimeout(() => setToast(""), 3000);
    try {
      await shareInvoice(invoice);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto">
      {toast && (
        <div className="fixed bottom-6 right-6 z-[120] max-w-sm rounded-2xl border border-[#d2aa6a]/30 bg-[#11100d] px-5 py-4 text-sm font-bold text-white shadow-2xl transition-all duration-300">
          {toast}
        </div>
      )}
      <div className="relative w-full max-w-4xl rounded-[2.5rem] border border-white/10 bg-[#fffdfa] text-[#1d1712] shadow-2xl p-6 md:p-8 max-h-[90vh] overflow-y-auto font-sans">
        
        {/* Actions bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#ebdcb9] pb-5 mb-6">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8a5f3c]">Hotel Tax Invoice</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            {onRegenerate && (
              <button
                type="button"
                onClick={onRegenerate}
                className="rounded-full bg-[#8a5f3c] text-white px-4 py-2 text-xs font-black hover:bg-[#724e30]"
              >
                Regenerate
              </button>
            )}
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-full bg-[#1d1712] text-white px-4 py-2 text-xs font-black hover:bg-black"
            >
              Download PDF
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-full border border-[#ebdcb9] bg-white px-4 py-2 text-xs font-black hover:bg-[#fcf8f2]"
            >
              Print
            </button>
            <button
              type="button"
              onClick={handleShare}
              className="rounded-full border border-[#ebdcb9] bg-white px-4 py-2 text-xs font-black hover:bg-[#fcf8f2]"
            >
              Share
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-rose-500 text-white px-4 py-2 text-xs font-black hover:bg-rose-600"
            >
              Close
            </button>
          </div>
        </div>

        {/* Invoice View Area */}
        <InvoiceView invoice={invoice} />

      </div>
    </div>
  );
}
