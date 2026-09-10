import { create } from 'zustand';

interface AuthState {
  isLoggedIn: boolean;
  username: string | null;
  login: (username: string, accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isLoggedIn: !!localStorage.getItem('access_token'),
  username: localStorage.getItem('username'),
  login: (username, accessToken, refreshToken) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('username', username);
    set({ isLoggedIn: true, username });
  },
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('username');
    set({ isLoggedIn: false, username: null });
  },
}));
