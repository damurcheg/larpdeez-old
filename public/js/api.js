// Thin fetch wrapper around the protected JSON API (global `API`)
window.API = (() => {
  let csrf = null;

  class ApiError extends Error {
    constructor(status, code, details) {
      super(code || `HTTP ${status}`);
      this.status = status;
      this.code = code;
      this.details = details;
    }
  }

  async function request(method, url, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
    };
    if (csrf && method !== 'GET') opts.headers['X-CSRF-Token'] = csrf;
    if (body !== undefined) opts.body = JSON.stringify(body);
    let res;
    try {
      res = await fetch(url, opts);
    } catch (e) {
      throw new ApiError(0, 'network-error');
    }
    if (res.status === 401 && !url.includes('/api/login')) {
      window.dispatchEvent(new CustomEvent('auth:expired'));
      throw new ApiError(401, 'unauthorized');
    }
    let data = {};
    try { data = await res.json(); } catch (e) { /* empty body */ }
    if (!res.ok) throw new ApiError(res.status, data.error || 'error', data.details);
    return data;
  }

  return {
    ApiError,
    setCsrf(t) { csrf = t; },
    hasCsrf() { return !!csrf; },
    login: (password) => request('POST', '/api/login', { password }),
    logout: () => request('POST', '/api/logout', {}),
    session: () => request('GET', '/api/session'),
    state: () => request('GET', '/api/state'),
    saveProfile: (p) => request('PUT', '/api/profile', p),
    saveSettings: (s) => request('PUT', '/api/settings', s),
    changePassword: (oldPassword, newPassword) => request('POST', '/api/password', { oldPassword, newPassword }),
    createCourse: (doc) => request('POST', '/api/courses', doc),
    saveCourse: (id, doc) => request('PUT', `/api/courses/${id}`, doc),
    deleteCourse: (id) => request('DELETE', `/api/courses/${id}`),
    reorderCourses: (ids) => request('POST', '/api/courses/reorder', { ids }),
    createEvent: (ev) => request('POST', '/api/events', ev),
    saveEvent: (id, ev) => request('PUT', `/api/events/${id}`, ev),
    deleteEvent: (id) => request('DELETE', `/api/events/${id}`),
    restore: (data, mode) => request('POST', '/api/restore', { data, mode }),
    backupUrl: '/api/backup',
  };
})();
