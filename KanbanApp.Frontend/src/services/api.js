import axios from 'axios';

const normalizeBaseUrl = url => url ? url.replace(/\/+$/, '') : undefined;

export const BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_URL)
    ?? (import.meta.env.PROD
        ? 'https://shellty-kanban.onrender.com'
        : 'http://localhost:5067');

export const assetUrl = url => url && !/^https?:\/\//i.test(url) ? `${BASE_URL}${url}` : url;

const api = axios.create({
    baseURL: BASE_URL,
});

let refreshPromise;

function refreshSession() {
    if (!refreshPromise) {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) return Promise.reject(new Error('No refresh token'));

        refreshPromise = axios.post(`${BASE_URL}/api/auth/refresh`, { refreshToken })
            .then(({ data }) => {
                localStorage.setItem('token', data.accessToken);
                localStorage.setItem('refreshToken', data.refreshToken);
                return data;
            })
            .finally(() => { refreshPromise = null; });
    }

    return refreshPromise;
}

api.interceptors.request.use(config => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

api.interceptors.response.use(
    response => response,
    async error => {
        const original = error.config;

        if (error.response?.status === 401 && original && !original._retry && !['/login', '/register'].includes(original.url)) {
            original._retry = true;

            try {
                const session = await refreshSession();
                original.headers.Authorization = `Bearer ${session.accessToken}`;
                if (original.url === '/api/auth/logout') {
                    original.data = JSON.stringify({ refreshToken: session.refreshToken });
                }
                return api(original);
            } catch {
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                window.location.href = '/login';
            }
        }

        return Promise.reject(error);
    }
);

export default api;
