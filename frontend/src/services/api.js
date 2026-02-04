import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Create axios instance with auth header
const createAuthAxios = () => {
  const instance = axios.create({
    baseURL: API
  });
  
  instance.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
  
  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.response?.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/';
      }
      return Promise.reject(error);
    }
  );
  
  return instance;
};

export const api = createAuthAxios();

// Student APIs
export const studentAPI = {
  getProfile: () => api.get('/profile'),
  uploadProfilePicture: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/profile/picture', formData);
  }
};

// Items APIs
export const itemsAPI = {
  getPublicItems: () => axios.get(`${API}/items/public`),
  getMyItems: () => api.get('/items/my'),
  getItems: (params) => api.get('/items', { params }),
  getItem: (id) => api.get(`/items/${id}`),
  createItem: (formData) => api.post('/items', formData),
  deleteItem: (id, reason) => api.delete(`/items/${id}`, { data: { reason } }),
  getDeletedItems: () => api.get('/items/deleted/all'),
  restoreItem: (id) => api.post(`/items/${id}/restore`),
  permanentDeleteItem: (id) => api.delete(`/items/${id}/permanent`)
};

// Claims APIs
export const claimsAPI = {
  getClaims: (params) => api.get('/claims', { params }),
  getClaim: (id) => api.get(`/claims/${id}`),
  createClaim: (itemId, message) => api.post('/claims', { item_id: itemId, message }),
  addVerificationQuestion: (claimId, question) => 
    api.post(`/claims/${claimId}/verification-question`, { claim_id: claimId, question }),
  answerVerification: (claimId, answer) => 
    api.post(`/claims/${claimId}/answer`, { claim_id: claimId, answer }),
  makeDecision: (claimId, status, notes) => 
    api.post(`/claims/${claimId}/decision`, { status, notes })
};

// Messages APIs
export const messagesAPI = {
  getMessages: () => api.get('/messages'),
  getUnreadCount: () => api.get('/messages/unread-count'),
  sendMessage: (recipientId, recipientType, content, itemId) => 
    api.post('/messages', { recipient_id: recipientId, recipient_type: recipientType, content, item_id: itemId }),
  markAsRead: (id) => api.post(`/messages/${id}/read`),
  markAllRead: () => api.post('/messages/mark-all-read')
};

// Students APIs (Admin)
export const studentsAPI = {
  getStudents: () => api.get('/students'),
  getStudent: (id) => api.get(`/students/${id}`),
  // NEW: Context-based student retrieval (Department + Year)
  getStudentsByContext: (department, year) => 
    api.get(`/students/by-context?department=${encodeURIComponent(department)}&year=${encodeURIComponent(year)}`),
  getContexts: () => api.get('/students/contexts'),
  uploadExcel: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/students/upload-excel', formData);
  },
  addNote: (studentId, note) => 
    api.post(`/students/${studentId}/admin-note`, { student_id: studentId, note }),
  deleteStudent: (id) => api.delete(`/students/${id}`)
};

// Admin APIs
export const adminAPI = {
  getAdmins: () => api.get('/admins'),
  createAdmin: (username, password, fullName) => 
    api.post('/admins', { username, password, full_name: fullName }),
  deleteAdmin: (id) => api.delete(`/admins/${id}`),
  changePassword: (oldPassword, newPassword) => 
    api.post('/auth/admin/change-password', { old_password: oldPassword, new_password: newPassword })
};

// Stats APIs
export const statsAPI = {
  getStats: () => api.get('/stats')
};

// AI APIs
export const aiAPI = {
  getMatches: () => api.get('/ai/matches')
};
