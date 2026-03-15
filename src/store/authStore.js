import { create } from 'zustand';
import { subscribeToAuth } from '../lib/auth';

export const useAuthStore = create((set) => ({
  user:    null,
  loading: true,

  init: () => {
    const unsubscribe = subscribeToAuth((user) => set({ user, loading: false }));
    return unsubscribe;
  },

  setUser:   (user) => set({ user }),
  clearUser: ()     => set({ user: null }),
}));
