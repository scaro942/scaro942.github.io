import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
});

// Auth
export const fetchMe = () => api.get("/auth/me").then((r) => r.data);
export const exchangeSession = (session_id) =>
  api.post("/auth/session", { session_id }).then((r) => r.data);
export const logoutApi = () => api.post("/auth/logout").then((r) => r.data);
export const updateMe = (data) => api.patch("/auth/me", data).then((r) => r.data);

// Slots
export const listSlots = (kind) =>
  api.get(`/slots`, { params: { kind } }).then((r) => r.data);
export const slotCapacity = () => api.get(`/slots/capacity`).then((r) => r.data);
export const createSlot = (data) => api.post(`/slots`, data).then((r) => r.data);
export const updateSlot = (id, data) => api.patch(`/slots/${id}`, data).then((r) => r.data);
export const deleteSlot = (id) => api.delete(`/slots/${id}`).then((r) => r.data);
export const unlockSlot = (slot_index) =>
  api.post(`/slots/unlock`, { slot_index }).then((r) => r.data);
export const exportSlots = (kind) =>
  api.get(`/slots/export`, { params: { kind } }).then((r) => r.data);
export const importSlots = (payload) =>
  api.post(`/slots/import`, payload).then((r) => r.data);
