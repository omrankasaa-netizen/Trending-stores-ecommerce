// Local, self-hosted drop-in replacement for the Base44 SDK client.
// Exposes the exact same surface the app already uses:
//   base44.entities.<Name>.{ list, filter, get, create, update, delete }
//   base44.auth.{ me, register, verifyOtp, resendOtp, loginViaEmailPassword,
//                 logout, setToken, resetPassword, resetPasswordRequest,
//                 redirectToLogin, loginWithProvider }
//   base44.integrations.Core.UploadFile({ file }) -> { file_url }
//
// All calls hit the Express backend under /api. Auth uses an httpOnly session
// cookie; a Bearer token (stored in localStorage for OTP/social flows) is also
// sent when present.

const TOKEN_KEY = 'ts_access_token';

function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || null; } catch { return null; }
}

function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

async function request(method, url, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: body != null ? JSON.stringify(body) : undefined,
  });
  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function entityApi(name) {
  const base = `/api/entities/${name}`;
  const buildQs = (query, sort, limit) => {
    const params = new URLSearchParams();
    if (query && Object.keys(query).length > 0) params.set('q', JSON.stringify(query));
    if (sort) params.set('sort', sort);
    if (limit != null) params.set('limit', String(limit));
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  };
  return {
    list: (sort = null, limit = null) => request('GET', `${base}${buildQs(null, sort, limit)}`),
    filter: (query = {}, sort = null, limit = null) =>
      request('GET', `${base}${buildQs(query, sort, limit)}`),
    get: (id) => request('GET', `${base}/${id}`),
    create: (data) => request('POST', base, data),
    update: (id, patch) => request('PUT', `${base}/${id}`, patch),
    delete: (id) => request('DELETE', `${base}/${id}`),
  };
}

const ENTITY_NAMES = [
  'Product', 'Category', 'Order', 'Banner', 'SiteSettings',
  'Testimonial', 'User', 'Discount', 'Coupon', 'EmailLog',
  'Customer', 'AuditLog', 'CmsSection', 'Faq', 'CustomerAddress',
];

const entities = {};
for (const n of ENTITY_NAMES) entities[n] = entityApi(n);

const auth = {
  setToken,
  me: () => request('GET', '/api/auth/me'),

  async loginViaEmailPassword(email, password) {
    const result = await request('POST', '/api/auth/login', { email, password });
    if (result?.access_token) setToken(result.access_token);
    return result;
  },

  register: ({ email, password, full_name, phone } = {}) =>
    request('POST', '/api/auth/register', { email, password, full_name, phone }),

  verifyOtp: ({ email, otpCode } = {}) =>
    request('POST', '/api/auth/verify-otp', { email, otpCode }),

  resendOtp: (email) => request('POST', '/api/auth/resend-otp', { email }),

  async logout(redirectUrl) {
    try { await request('POST', '/api/auth/logout'); } catch { /* ignore */ }
    setToken(null);
    if (redirectUrl) window.location.href = '/login';
  },

  resetPasswordRequest: (email) =>
    request('POST', '/api/auth/reset-password-request', { email }),

  resetPassword: ({ resetToken, newPassword } = {}) =>
    request('POST', '/api/auth/reset-password', { resetToken, newPassword }),

  redirectToLogin() {
    window.location.href = '/login';
  },

  // No external OAuth provider in the self-hosted build — route to email login.
  loginWithProvider() {
    window.location.href = '/login';
  },

  updateMe: (patch) => request('POST', '/api/auth/update-me', patch),
  changePassword: (currentPassword, newPassword) =>
    request('POST', '/api/auth/change-password', { currentPassword, newPassword }),
};

// Convert a File/Blob to a base64 data URL.
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const integrations = {
  Core: {
    async UploadFile({ file } = {}) {
      if (!file) throw new Error('file required');
      const dataUrl = await fileToDataUrl(file);
      return request('POST', '/api/upload', { file: dataUrl, filename: file.name });
    },
  },
};

// Invoke a backend function: base44.functions.<name>(body) -> data
function functionInvoker(name) {
  return async (body = {}) => {
    const res = await request('POST', `/api/functions/${name}`, body);
    return res?.data;
  };
}

const functions = new Proxy({}, {
  get: (_t, prop) => functionInvoker(String(prop)),
});

export const base44 = { entities, auth, integrations, functions };
export default base44;
