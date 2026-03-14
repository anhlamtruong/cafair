/**
 * Package Form Store — Zustand store for the packet build view.
 *
 * Tracks:
 *  - Active tab (section)
 *  - isDirty flag (unsaved changes)
 *
 * No persistence needed — the form fetches fresh from server each load.
 */

import { create } from "zustand";
import type { SectionTabKey } from "@/components/dashboard/package/build/section-tabs";

interface PackageFormState {
  /** Currently active section tab */
  activeTab: SectionTabKey;
  /** Whether any section has been modified since last save */
  isDirty: boolean;

  setActiveTab: (tab: SectionTabKey) => void;
  markDirty: () => void;
  markClean: () => void;
  reset: () => void;
}

export const usePackageFormStore = create<PackageFormState>()((set) => ({
  activeTab: "experience",
  isDirty: false,

  setActiveTab: (tab) => set({ activeTab: tab }),
  markDirty: () => set({ isDirty: true }),
  markClean: () => set({ isDirty: false }),
  reset: () => set({ activeTab: "experience", isDirty: false }),
}));
