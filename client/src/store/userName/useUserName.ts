import { create } from "zustand";
import type { useNameStoreTypes } from "../types/userNameTypes";

const useUserName = create<useNameStoreTypes>((set) => ({
  userName: "Stranger",
  setUserName: (newUserName) => set({ userName: newUserName }),
}));

export default useUserName;
