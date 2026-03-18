import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { RidePoint, RideSummary, RouteDefinition } from "@rideforge/shared";

interface RideDraft {
  points: RidePoint[];
  activeRideId?: string;
}

interface DataState {
  rideDraft: RideDraft;
  savedRoutes: RouteDefinition[];
  recentRides: RideSummary[];
  pushPoint: (point: RidePoint) => void;
  clearRideDraft: () => void;
  setActiveRideId: (id?: string) => void;
  setSavedRoutes: (routes: RouteDefinition[]) => void;
  setRecentRides: (rides: RideSummary[]) => void;
}

export const useDataStore = create<DataState>()(
  persist(
    (set) => ({
      rideDraft: { points: [] },
      savedRoutes: [],
      recentRides: [],
      pushPoint: (point) =>
        set((state) => ({
          rideDraft: {
            ...state.rideDraft,
            points: [...state.rideDraft.points, point],
          },
        })),
      clearRideDraft: () => set({ rideDraft: { points: [], activeRideId: undefined } }),
      setActiveRideId: (id) => set((state) => ({ rideDraft: { ...state.rideDraft, activeRideId: id } })),
      setSavedRoutes: (routes) => set({ savedRoutes: routes }),
      setRecentRides: (rides) => set({ recentRides: rides }),
    }),
    {
      name: "rideforge-data",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
