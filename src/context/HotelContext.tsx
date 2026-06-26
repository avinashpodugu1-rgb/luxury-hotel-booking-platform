import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiClient, setAuthToken } from "../services/api";

type Theme = "light" | "dark";
type Role = "customer" | "admin";

export type HotelUser = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: Role;
  avatar: string;
};

type RegisterPayload = {
  name: string;
  email: string;
  phone: string;
  role?: Role;
};

type StoredCustomerProfile = {
  name: string;
  phone?: string;
};

type HotelContextValue = {
  theme: Theme;
  user: HotelUser | null;
  wishlist: string[];
  notifications: string[];
  toggleTheme: () => void;
  login: (email: string, role: Role, name?: string, password?: string) => Promise<HotelUser>;
  register: (payload: RegisterPayload & { password?: string }) => Promise<HotelUser>;
  loginWithGoogle: (email?: string, name?: string, credential?: string) => Promise<HotelUser>;
  updateProfile: (payload: { name?: string; phone?: string; avatar?: string }) => Promise<HotelUser>;
  logout: () => void;
  toggleWishlist: (roomId: string) => void;
  isWishlisted: (roomId: string) => boolean;
};

const HotelContext = createContext<HotelContextValue | undefined>(undefined);

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

const avatarFor = (name: string) =>
  `https://api.dicebear.com/8.x/initials/svg?seed=${encodeURIComponent(name)}&backgroundColor=8b5e34,c9a66b,111827`;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const displayNameFromEmail = (email: string) => {
  const localPart = normalizeEmail(email).split("@")[0] || "guest";
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

const cleanDisplayName = (name: string | undefined, email: string) => {
  const trimmedName = (name || "").trim();
  if (!trimmedName || trimmedName.includes("@")) return displayNameFromEmail(email);
  return trimmedName;
};

const getStoredProfile = (email: string) => {
  const profiles = readJson<Record<string, StoredCustomerProfile>>("nirvana-customer-profiles", {});
  return profiles[normalizeEmail(email)];
};

const saveStoredProfile = (email: string, profile: StoredCustomerProfile) => {
  const profiles = readJson<Record<string, StoredCustomerProfile>>("nirvana-customer-profiles", {});
  profiles[normalizeEmail(email)] = profile;
  localStorage.setItem("nirvana-customer-profiles", JSON.stringify(profiles));
};

const isApiUnreachable = (error: unknown) =>
  !(error as { response?: unknown })?.response;

export function HotelProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => readJson<Theme>("nirvana-theme", "light"));
  const [user, setUser] = useState<HotelUser | null>(() => readJson<HotelUser | null>("nirvana-user", null));
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("nirvana-token"));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("nirvana-theme", JSON.stringify(theme));
  }, [theme]);

  useEffect(() => setAuthToken(token), [token]);

  useEffect(() => {
    if (user && !token) {
      const restoredToken = localStorage.getItem("nirvana-token") || "demo-preview-token";
      setToken(restoredToken);
      localStorage.setItem("nirvana-token", restoredToken);
      setAuthToken(restoredToken);
    }
  }, [user, token]);

  useEffect(() => {
    if (!user || !token) {
      setWishlist([]);
      return;
    }
    void apiClient
      .get<{ wishlist: Array<{ room_id?: string; roomId?: string }> }>("/wishlist")
      .then((response) => setWishlist(response.data.wishlist.map((item) => item.room_id || item.roomId || "").filter(Boolean)))
      .catch(() => setWishlist([]));
  }, [user, token]);

  const persistUser = (nextUser: HotelUser, nextToken?: string) => {
    const cleanUser = { ...nextUser, name: cleanDisplayName(nextUser.name, nextUser.email) };
    setUser(cleanUser);
    if (nextToken) {
      setToken(nextToken);
      localStorage.setItem("nirvana-token", nextToken);
      setAuthToken(nextToken);
    }
    localStorage.setItem("nirvana-user", JSON.stringify(cleanUser));
    return cleanUser;
  };

  const userFromApi = (apiUser: Partial<HotelUser> & { avatar?: string }, role: Role, fallbackEmail: string, fallbackName: string): HotelUser => ({
    id: String(apiUser.id ?? `${role}-${Date.now()}`),
    name: cleanDisplayName(apiUser.name || fallbackName, apiUser.email || fallbackEmail),
    email: apiUser.email || fallbackEmail,
    phone: apiUser.phone,
    role: (apiUser.role as Role) || role,
    avatar: apiUser.avatar || avatarFor(apiUser.name || fallbackName),
  });

  const login = async (email: string, role: Role, name?: string, password?: string) => {
    const normalizedEmail = normalizeEmail(email);
    const storedProfile = role === "customer" ? getStoredProfile(normalizedEmail) : undefined;
    const resolvedName = role === "admin" ? "Nirvana Admin" : cleanDisplayName(name || storedProfile?.name, normalizedEmail);
    try {
      const response = await apiClient.post<{ token: string; user: HotelUser }>("/auth/login", {
        email: normalizedEmail,
        password: password || "",
        role,
      });
      const nextUser = userFromApi(response.data.user, role, normalizedEmail, resolvedName);
      if (role === "customer") saveStoredProfile(normalizedEmail, { name: nextUser.name, phone: nextUser.phone || storedProfile?.phone });
      return persistUser(nextUser, response.data.token);
    } catch (error) {
      if (!isApiUnreachable(error)) throw error;
      return persistUser(
        {
          id: `${role}-${Date.now()}`,
          name: resolvedName,
          email: normalizedEmail,
          phone: storedProfile?.phone,
          role,
          avatar: avatarFor(resolvedName),
        },
        "demo-preview-token",
      );
    }
  };

  const register = async (payload: RegisterPayload & { password?: string }) => {
    const normalizedEmail = normalizeEmail(payload.email);
    const resolvedName = cleanDisplayName(payload.name, normalizedEmail);
    try {
      const response = await apiClient.post<{ token: string; user: HotelUser }>("/auth/register", {
        fullName: resolvedName,
        email: normalizedEmail,
        phone: payload.phone,
        password: payload.password || "",
        role: payload.role ?? "customer",
      });
      saveStoredProfile(normalizedEmail, { name: resolvedName, phone: payload.phone });
      return persistUser(userFromApi(response.data.user, payload.role ?? "customer", normalizedEmail, resolvedName), response.data.token);
    } catch (error) {
      if (!isApiUnreachable(error)) throw error;
      saveStoredProfile(normalizedEmail, { name: resolvedName, phone: payload.phone });
      return persistUser(
        {
          id: `customer-${Date.now()}`,
          name: resolvedName,
          email: normalizedEmail,
          phone: payload.phone,
          role: payload.role ?? "customer",
          avatar: avatarFor(resolvedName),
        },
        "demo-preview-token",
      );
    }
  };

  const loginWithGoogle = async (email = "google.guest@nirvanaplaza.com", name = "Google Guest", credential?: string) => {
    const normalizedEmail = normalizeEmail(email);
    const resolvedName = cleanDisplayName(name || getStoredProfile(normalizedEmail)?.name, normalizedEmail);
    if (credential) {
      try {
        const response = await apiClient.post<{ token: string; user: HotelUser }>("/auth/google", { credential });
        const nextUser = userFromApi(response.data.user, "customer", normalizedEmail, resolvedName);
        saveStoredProfile(nextUser.email, { name: nextUser.name, phone: nextUser.phone });
        return persistUser(nextUser, response.data.token);
      } catch (error) {
        if (!isApiUnreachable(error)) throw error;
      }
    }
    saveStoredProfile(normalizedEmail, { name: resolvedName, phone: getStoredProfile(normalizedEmail)?.phone });
    return persistUser({
      id: `google-${Date.now()}`,
      name: resolvedName,
      email: normalizedEmail,
      phone: getStoredProfile(normalizedEmail)?.phone,
      role: "customer",
      avatar: avatarFor(resolvedName),
    }, "demo-preview-token");
  };

  const updateProfile = async (payload: { name?: string; phone?: string; avatar?: string }) => {
    if (!user) throw new Error("Login required");
    const updatedUser: HotelUser = {
      ...user,
      name: cleanDisplayName(payload.name || user.name, user.email),
      phone: payload.phone ?? user.phone,
      avatar: payload.avatar || user.avatar,
    };
    try {
      await apiClient.put("/auth/profile", {
        fullName: updatedUser.name,
        phone: updatedUser.phone,
        avatarUrl: updatedUser.avatar,
      });
    } catch (error) {
      if (!isApiUnreachable(error)) throw error;
    }
    saveStoredProfile(updatedUser.email, { name: updatedUser.name, phone: updatedUser.phone });
    return persistUser(updatedUser, token || "demo-preview-token");
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("nirvana-user");
    localStorage.removeItem("nirvana-token");
    setAuthToken(null);
  };

  const toggleWishlist = (roomId: string) => {
    if (!user || !token) return;
    void apiClient.post<{ saved: boolean }>(`/wishlist/${roomId}`).catch(() => undefined);
    setWishlist((current) =>
      current.includes(roomId) ? current.filter((id) => id !== roomId) : [...current, roomId],
    );
  };

  const value = useMemo<HotelContextValue>(
    () => ({
      theme,
      user,
      wishlist,
      notifications: [
        "Executive Room 201 is available this weekend.",
        "Your loyalty tier received a 2,500 point upgrade.",
        "Spa and rooftop dining slots opened for tonight.",
      ],
      toggleTheme: () => setTheme((current) => (current === "light" ? "dark" : "light")),
      login,
      register,
      loginWithGoogle,
      updateProfile,
      logout,
      toggleWishlist,
      isWishlisted: (roomId: string) => wishlist.includes(roomId),
    }),
    [theme, user, wishlist],
  );

  return <HotelContext.Provider value={value}>{children}</HotelContext.Provider>;
}

export function useHotel() {
  const context = useContext(HotelContext);
  if (!context) {
    throw new Error("useHotel must be used inside HotelProvider");
  }
  return context;
}