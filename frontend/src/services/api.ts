import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// 请求拦截器：注入JWT
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：401时尝试刷新token
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post('/api/auth/refresh', { refresh_token: refreshToken });
          localStorage.setItem('access_token', data.data.access_token);
          localStorage.setItem('refresh_token', data.data.refresh_token);
          error.config.headers.Authorization = `Bearer ${data.data.access_token}`;
          return api(error.config);
        } catch {}
      }
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
    }
    return Promise.reject(error);
  }
);

// 提取 data：兼容两套并存信封（切勿统一 unwrap）
//  - auth 接口返回裸包 {access_token, refresh_token}
//  - cases / jobs 返回 {code, data, meta} 信封
// 此处 res 为 axios 响应对象，res.data 是解析后的响应体
function unwrap<T>(res: any): T {
  const body = res && res.data;
  if (body && typeof body === 'object' && 'code' in body && 'data' in body) {
    return body.data as T; // {code,data,meta} 信封
  }
  return body as T; // 裸包（auth / refresh 等）
}

// --- Auth ---
export const authService = {
  register: (username: string, password: string) =>
    api.post('/auth/register', { username, password }).then(unwrap),
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }).then(unwrap),
  refresh: (refresh_token: string) =>
    api.post('/auth/refresh', { refresh_token }).then(unwrap),
};

// --- Case ---
export const caseService = {
  createCase: (input: Record<string, any>) =>
    api.post('/cases', input).then(unwrap),
  paipan: (caseId: string) =>
    api.post(`/cases/${caseId}/paipan`).then(unwrap),
  duanQianChen: (caseId: string) =>
    api.post(`/cases/${caseId}/duan-qian-chen`).then(unwrap),
  calibrate: (caseId: string, feedback: any[]) =>
    api.post(`/cases/${caseId}/calibration`, { feedback }).then(unwrap),
  predict: (caseId: string) =>
    api.post(`/cases/${caseId}/predict`).then(unwrap),
  revise: (caseId: string, message: string) =>
    api.post(`/cases/${caseId}/revise`, { message }).then(unwrap),
  getArchive: (caseId: string) =>
    api.get(`/cases/${caseId}/archive`).then(unwrap),
  getJob: (jobId: string) =>
    api.get(`/jobs/${jobId}`).then(unwrap),
};

export default api;
