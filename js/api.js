// js/api.js — DCO CMS API client
// Talks to the Express backend. Auth is cookie-based (httpOnly session).

const API = {
  BASE: CONFIG.API_BASE || '',

  _headers: function() {
    return { 'Content-Type': 'application/json' };
  },

  _fetch: async function(path, options = {}) {
    const resp = await fetch(this.BASE + path, {
      credentials: 'include',
      headers: this._headers(),
      ...options,
    });
    if (resp.status === 401) {
      window.location.href = 'index.html';
      return;
    }
    if (!resp.ok) {
      const e = await resp.json().catch(() => ({}));
      throw new Error(e.error || `Request failed: ${resp.status}`);
    }
    return resp.json();
  },

  // Auth
  login: async function(username, password) {
    return this._fetch('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  logout: async function() {
    await this._fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = 'index.html';
  },

  getSession: async function() {
    return this._fetch('/api/auth/me');
  },

  // Contracts
  getContracts: function() {
    return this._fetch('/api/contracts');
  },

  createContract: function(data) {
    return this._fetch('/api/contracts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateContract: function(id, data) {
    return this._fetch('/api/contracts/' + id, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  deleteContract: function(id) {
    return this._fetch('/api/contracts/' + id, { method: 'DELETE' });
  },

  submitRenewal: function(contractId, data) {
    return this._fetch('/api/contracts/' + contractId + '/renewal', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Priorities
  getPriorities: function() {
    return this._fetch('/api/priorities');
  },

  savePriorities: function(orderedIds) {
    return this._fetch('/api/priorities', {
      method: 'PUT',
      body: JSON.stringify({ orderedIds }),
    });
  },

  // Audit log
  getAuditLog: function() {
    return this._fetch('/api/audit-log');
  },

  // Email preview
  getEmailPreview: function(contractId) {
    return this._fetch('/api/email-preview/' + contractId);
  },
};
