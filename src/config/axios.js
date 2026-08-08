/* ============================================================
   Config: axios.js
   Description: Centralized Axios instance with auth token,
                base URL and interceptors
   ============================================================ */

import axios from 'axios';
import { getAuthToken, clearAuthData } from '../utils/authStorage';
import { getApiUrl } from './apiUrl';

const BASE_URL = getApiUrl('/api');

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// ── Request Interceptor: Attach Bearer Token ──────────────
api.interceptors.request.use(
  (config) => {
    try {
      const token = getAuthToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (err) {
      console.error('Failed to attach auth token:', err);
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor: Handle 401 ─────────────────────
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearAuthData();
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;

/* ============ END: axios.js ============ */