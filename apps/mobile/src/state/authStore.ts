import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { UserProfile } from "@rideforge/shared";

interface AuthState {
  accessToken?: string;
  refreshToken?: string;
  user?: UserProfile;
  setSession: (payload: { accessToken: string; refreshToken: string; user: UserProfile }) => void;
  setUser: (user: UserProfile) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: undefined,
      refreshToken: undefined,
      user: undefined,
      setSession: ({ accessToken, refreshToken, user }) => set({ accessToken, refreshToken, user }),
      setUser: (user) => set({ user }),
      clearSession: () => set({ accessToken: undefined, refreshToken: undefined, user: undefined }),
    }),
    {
      name: "rideforge-auth",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
