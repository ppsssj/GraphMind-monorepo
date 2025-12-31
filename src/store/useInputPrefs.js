// store/useInputPrefs.js (Zustand 예시)
import { create } from "zustand";

export const useInputPrefs = create((set) => ({
  handControlEnabled: false,
  setHandControlEnabled: (v) => set({ handControlEnabled: v }),
}));
