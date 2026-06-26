export type RoomStatus = "available" | "booked" | "blocked";

export type RoomCategory =
  | "Deluxe Rooms"
  | "Executive Rooms"
  | "Family Rooms"
  | "Suite Rooms"
  | "Presidential Suites";

export type Room = {
  id: string;
  category: RoomCategory;
  number: string;
  title: string;
  subtitle: string;
  description: string;
  price: number;
  guests: number;
  beds: number;
  size: string;
  floor: string;
  rating: number;
  reviews: number;
  images: string[];
  amenities: string[];
  blockedDates: string[];
  bookedDates: string[];
};

export const heroImage =
  "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=2400&q=88";

export const categoryProfiles: Array<{
  name: RoomCategory;
  slug: string;
  tagline: string;
  rate: string;
}> = [
  {
    name: "Deluxe Rooms",
    slug: "deluxe-rooms",
    tagline: "Warm luxury for restorative city stays",
    rate: "from INR 7,500",
  },
  {
    name: "Executive Rooms",
    slug: "executive-rooms",
    tagline: "Business class comfort with calm workspace",
    rate: "from INR 10,500",
  },
  {
    name: "Family Rooms",
    slug: "family-rooms",
    tagline: "Generous layouts made for shared memories",
    rate: "from INR 13,500",
  },
  {
    name: "Suite Rooms",
    slug: "suite-rooms",
    tagline: "Separate living rooms with private balconies",
    rate: "from INR 18,500",
  },
  {
    name: "Presidential Suites",
    slug: "presidential-suites",
    tagline: "A landmark private residence in the sky",
    rate: "from INR 36,000",
  },
];

const roomNumbers: Record<RoomCategory, string[]> = {
  "Deluxe Rooms": ["101", "102", "103", "104", "105"],
  "Executive Rooms": ["201", "202", "203", "204", "205"],
  "Family Rooms": ["301", "302", "303", "304", "305"],
  "Suite Rooms": ["401", "402", "403", "404", "405"],
  "Presidential Suites": ["501", "502", "503", "504", "505"],
};

const roomMeta: Record<
  RoomCategory,
  {
    price: number;
    guests: number;
    beds: number;
    size: string;
    floor: string;
    subtitle: string;
    description: string;
  }
> = {
  "Deluxe Rooms": {
    price: 7500,
    guests: 2,
    beds: 1,
    size: "410 sq ft",
    floor: "Garden wing",
    subtitle: "Soft neutrals, king bedding, rainfall shower",
    description:
      "A serene retreat with hand-finished timber, warm brass details, blackout drapery, and a quiet corner for morning coffee.",
  },
  "Executive Rooms": {
    price: 10500,
    guests: 2,
    beds: 1,
    size: "520 sq ft",
    floor: "Business wing",
    subtitle: "Balcony, ergonomic workspace, skyline view",
    description:
      "Designed for productive travel with a generous desk, fast WiFi, a stocked mini bar, and layered lighting for late evenings.",
  },
  "Family Rooms": {
    price: 13500,
    guests: 4,
    beds: 2,
    size: "680 sq ft",
    floor: "Courtyard wing",
    subtitle: "Two queen beds, sofa lounge, child-friendly layout",
    description:
      "A spacious room for families with a lounge zone, extra storage, acoustic privacy, and direct access to the courtyard level.",
  },
  "Suite Rooms": {
    price: 18500,
    guests: 3,
    beds: 1,
    size: "860 sq ft",
    floor: "Club wing",
    subtitle: "Living area, deep soaking bath, club privileges",
    description:
      "An elegant suite with separate living and sleeping spaces, a marble bath, butler-ready pantry, and soft sunset views.",
  },
  "Presidential Suites": {
    price: 36000,
    guests: 5,
    beds: 2,
    size: "1,520 sq ft",
    floor: "Signature wing",
    subtitle: "Private dining, terrace, butler service",
    description:
      "The most exclusive address at SRI NIRVANA PLAZA, pairing private entertaining spaces with panoramic views and dedicated service.",
  },
};

const amenityPool = [
  "High-speed WiFi",
  "Smart TV",
  "Dedicated workspace",
  "Premium mini bar",
  "Climate control AC",
  "Rainfall shower",
  "Private balcony",
  "Luxury linens",
  "In-room dining",
  "Daily housekeeping",
];

const photoIds = [
  "photo-1582719478250-c89cae4dc85b",
  "photo-1590490360182-c33d57733427",
  "photo-1618773928121-c32242e63f39",
  "photo-1595576508898-0ad5c879a061",
  "photo-1631049307264-da0ec9d70304",
  "photo-1611892440504-42a792e24d32",
  "photo-1578683010236-d716f9a3f461",
  "photo-1566665797739-1674de7a421a",
  "photo-1598928506311-c55ded91a20c",
  "photo-1600210492486-724fe5c67fb0",
  "photo-1616486338812-3dadae4b4ace",
  "photo-1600566753190-17f0baa2a6c3",
  "photo-1600607687939-ce8a6c25118c",
  "photo-1600585154340-be6161a56a0c",
  "photo-1600566752355-35792bedcfea",
  "photo-1600607687920-4e2a09cf159d",
  "photo-1600210491892-03d54c0aaf87",
  "photo-1551882547-ff40c63fe5fa",
  "photo-1445019980597-93fa8acb246c",
  "photo-1571896349842-33c89424de2d",
  "photo-1540541338287-41700207dee6",
  "photo-1520250497591-112f2f40a3f4",
  "photo-1564501049412-61c2a3083791",
  "photo-1512918728675-ed5a9ecdebfd",
  "photo-1513694203232-719a280e022f",
  "photo-1542314831-068cd1dbfeeb",
  "photo-1521783593447-5702b9bfd267",
  "photo-1517840901100-8179e982acb7",
  "photo-1549294413-26f195200c16",
  "photo-1595877244574-e90ce41ce089",
  "photo-1596394516093-501ba68a0ba6",
  "photo-1584132967334-10e028bd69f7",
  "photo-1551918120-9739cb430c6d",
  "photo-1618220179428-22790b461013",
  "photo-1554995207-c18c203602cb",
  "photo-1484154218962-a197022b5858",
  "photo-1615874694520-474822394e73",
  "photo-1560185127-6ed189bf02f4",
  "photo-1616137466211-f939a420be84",
  "photo-1595526114035-0d45ed16cfbf",
];

const galleryPhotoIds = [
  ["Hotel exterior", "photo-1566073771259-6a8506099945"],
  ["Lobby", "photo-1564501049412-61c2a3083791"],
  ["Reception", "photo-1551882547-ff40c63fe5fa"],
  ["Swimming pool", "photo-1571896349842-33c89424de2d"],
  ["Restaurant", "photo-1414235077428-338989a2e8c0"],
  ["Gym", "photo-1534438327276-14e5300c3a48"],
  ["Spa", "photo-1540555700478-4be289fbecef"],
  ["Sky lounge", "photo-1542314831-068cd1dbfeeb"],
] as const;

const imageFromId = (id: string, width = 1600, height = 1000) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&h=${height}&q=84`;

const dateAfter = (offset: number) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

const galleryForRoom = (seed: number) =>
  Array.from({ length: 6 }, (_, index) =>
    imageFromId(photoIds[(seed * 5 + index * 3) % photoIds.length], index === 0 ? 1800 : 1200, 900),
  );

const readableRoomName = (category: RoomCategory, number: string) => {
  if (category === "Presidential Suites") return `Presidential Suite ${number}`;
  if (category === "Suite Rooms") return `Suite Room ${number}`;
  return `${category.replace("s", "")} ${number}`;
};

export const rooms: Room[] = categoryProfiles.flatMap((profile, categoryIndex) =>
  roomNumbers[profile.name].map((number, numberIndex) => {
    const seed = categoryIndex * 5 + numberIndex;
    const meta = roomMeta[profile.name];
    return {
      id: `${profile.slug}-${number}`,
      category: profile.name,
      number,
      title: readableRoomName(profile.name, number),
      subtitle: meta.subtitle,
      description: meta.description,
      price: meta.price + numberIndex * 650,
      guests: meta.guests,
      beds: meta.beds,
      size: meta.size,
      floor: meta.floor,
      rating: Number((4.72 + (seed % 8) * 0.03).toFixed(2)),
      reviews: 118 + seed * 9,
      images: galleryForRoom(seed),
      amenities: amenityPool.slice(0, 6 + (seed % 4)),
      blockedDates: [dateAfter(3 + (seed % 5)), dateAfter(15 + (seed % 8)), dateAfter(25 + (seed % 4))],
      bookedDates: [dateAfter(1 + (seed % 6)), dateAfter(10 + (seed % 7)), dateAfter(20 + (seed % 6))],
    };
  }),
);

export const galleryImages = galleryPhotoIds.map(([label, id]) => ({
  label,
  src: imageFromId(id, 1400, 1000),
}));

export const categoryToSlug = (category: RoomCategory) =>
  categoryProfiles.find((profile) => profile.name === category)?.slug ?? "deluxe-rooms";

export const slugToCategory = (slug: string | undefined): RoomCategory | undefined =>
  categoryProfiles.find((profile) => profile.slug === slug)?.name;

export const findRoom = (roomId: string | undefined) => rooms.find((room) => room.id === roomId);

export const dateStatus = (room: Room, isoDate: string): RoomStatus => {
  if (room.blockedDates.includes(isoDate)) return "blocked";
  if (room.bookedDates.includes(isoDate)) return "booked";
  return "available";
};