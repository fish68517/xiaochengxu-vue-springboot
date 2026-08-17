import axios from 'axios';
export const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    timeout: 10000,
    headers: { 'X-Dev-User': 'admin_01' },
});
api.interceptors.response.use((response) => response.data.data);
const get = (url) => api.get(url);
const post = (url, data) => api.post(url, data);
export const getDashboard = () => get('/admin/dashboard');
export const getBills = () => get('/admin/bills');
export const getFeeItems = () => get('/admin/fee-items');
export const getNotices = () => get('/notices');
export const parseImport = (file) => {
    const body = new FormData();
    body.append('file', file);
    return post('/admin/billing-imports/parse', body);
};
export const commitImport = (batchId) => post(`/admin/billing-imports/${batchId}/commit`);
