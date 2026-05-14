import axios from 'axios';

export const api = axios.create({
  baseURL: '',
  withCredentials: true,
  timeout: 30_000,
});

export interface Category {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
  description: string | null;
  path: string;
  depth: number;
  sort_order: number;
}
export interface CategoryNode extends Category {
  children: CategoryNode[];
}
export interface Channel {
  id: number;
  key: string;
  label: string;
  color: string;
  description: string | null;
  sort_order: number;
}
export interface Tag {
  id: number;
  name: string;
  color: string;
  description: string | null;
}
export interface Firmware {
  id: number;
  title: string;
  version: string;
  patch_suffix: string | null;
  channel_id: number;
  changelog: string;
  file_sha256: string;
  file_size: number;
  original_filename: string;
  download_count: number;
  is_yanked: number;
  uploaded_at: number;
  uploaded_by: string | null;
  channel: { id: number; key: string; label: string; color: string } | null;
  categories: { id: number; name: string; path: string; depth: number }[];
  tags: { id: number; name: string; color: string }[];
}

export interface FirmwareListResp {
  total: number;
  items: Firmware[];
  page: number;
  pageSize: number;
}

export const Apis = {
  categories: () => api.get<{ flat: Category[]; tree: CategoryNode[] }>('/api/categories').then((r) => r.data),
  channels: () => api.get<Channel[]>('/api/channels').then((r) => r.data),
  tags: () => api.get<Tag[]>('/api/tags').then((r) => r.data),
  firmwares: (params: Record<string, any>) =>
    api.get<FirmwareListResp>('/api/firmwares', { params }).then((r) => r.data),
  firmware: (id: number) => api.get<Firmware>(`/api/firmwares/${id}`).then((r) => r.data),
  downloadUrl: (id: number) => `/api/firmwares/${id}/download`,

  login: (username: string, password: string) =>
    api.post('/api/admin/login', { username, password }).then((r) => r.data),
  logout: () => api.post('/api/admin/logout').then((r) => r.data),
  me: () => api.get('/api/admin/me').then((r) => r.data),

  createCategory: (body: any) => api.post('/api/admin/categories', body).then((r) => r.data),
  updateCategory: (id: number, body: any) =>
    api.patch(`/api/admin/categories/${id}`, body).then((r) => r.data),
  deleteCategory: (id: number) => api.delete(`/api/admin/categories/${id}`).then((r) => r.data),

  createChannel: (body: any) => api.post('/api/admin/channels', body).then((r) => r.data),
  updateChannel: (id: number, body: any) =>
    api.patch(`/api/admin/channels/${id}`, body).then((r) => r.data),
  deleteChannel: (id: number) => api.delete(`/api/admin/channels/${id}`).then((r) => r.data),

  createTag: (body: any) => api.post('/api/admin/tags', body).then((r) => r.data),
  updateTag: (id: number, body: any) => api.patch(`/api/admin/tags/${id}`, body).then((r) => r.data),
  deleteTag: (id: number) => api.delete(`/api/admin/tags/${id}`).then((r) => r.data),

  updateFirmware: (id: number, body: any) =>
    api.patch(`/api/admin/firmwares/${id}`, body).then((r) => r.data),
  deleteFirmware: (id: number) => api.delete(`/api/admin/firmwares/${id}`).then((r) => r.data),

  uploadFirmware: (formData: FormData, onProgress?: (p: number) => void) =>
    api
      .post<Firmware>('/api/v1/firmwares', formData, {
        onUploadProgress: (e) => {
          if (e.total && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
        },
      })
      .then((r) => r.data),

  tokens: () => api.get('/api/admin/tokens').then((r) => r.data),
  createToken: (name: string, scope: 'read' | 'write' = 'write') =>
    api.post('/api/admin/tokens', { name, scope }).then((r) => r.data),
  revokeToken: (id: number) => api.delete(`/api/admin/tokens/${id}`).then((r) => r.data),
};

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatTime(unix: number): string {
  return new Date(unix * 1000).toLocaleString('zh-CN', { hour12: false });
}
