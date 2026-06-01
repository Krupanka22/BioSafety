import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

/**
 * Authentication Store - Manages user authentication and session state
 * Uses Zustand for state management with persistence
 */
export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,

      /**
       * Login user with email and password
       * @param {string} email - User email
       * @param {string} password - User password
       */
      login: async (email, password) => {
        try {
          const response = await api.post('/auth/login', { email, password });
          const { token, user } = response.data;

          set({ token, user, isAuthenticated: true });
          localStorage.setItem('token', token);

          return { success: true };
        } catch (error) {
          return { success: false, error: error.response?.data?.error || 'Login failed' };
        }
      },

      /**
       * Register new user
       * @param {Object} userData - User registration data
       */
      register: async (userData) => {
        try {
          const response = await api.post('/auth/register', userData);
          const { token, user } = response.data;

          set({ token, user, isAuthenticated: true });
          localStorage.setItem('token', token);

          return { success: true };
        } catch (error) {
          return { success: false, error: error.response?.data?.error || 'Registration failed' };
        }
      },

      /**
       * Check authentication status and restore session
       */
      checkAuth: async () => {
        try {
          const token = localStorage.getItem('token');

          if (!token) {
            set({ isLoading: false });
            return;
          }

          const response = await api.get('/auth/me');
          set({ user: response.data, token, isAuthenticated: true, isLoading: false });
        } catch (error) {
          localStorage.removeItem('token');
          set({ isAuthenticated: false, token: null, user: null, isLoading: false });
        }
      },

      /**
       * Logout user
       */
      logout: () => {
        localStorage.removeItem('token');
        set({ user: null, token: null, isAuthenticated: false });
      },

      /**
       * Update user profile
       * @param {Object} profileData - Updated profile information
       */
      updateProfile: async (profileData) => {
        try {
          const response = await api.put('/auth/profile', profileData);
          set({ user: response.data });
          return { success: true };
        } catch (error) {
          return { success: false, error: error.response?.data?.message || 'Update failed' };
        }
      },
    }),
    {
      name: 'auth-store',
    }
  )
);
