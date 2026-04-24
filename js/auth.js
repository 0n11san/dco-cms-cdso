// js/auth.js — Session management
// Authentication is server-side. Session state is stored in sessionStorage
// as a cache of the server's response; the real authority is the httpOnly cookie.

const AUTH = {
  setSession: function(username, role) {
    sessionStorage.setItem('dco_session', JSON.stringify({ username, role }));
  },

  getSession: function() {
    const raw = sessionStorage.getItem('dco_session');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch(e) { return null; }
  },

  logout: async function() {
    sessionStorage.removeItem('dco_session');
    await API.logout();
  },

  requireAuth: function() {
    const session = this.getSession();
    if (!session) { window.location.href = 'index.html'; return null; }
    return session;
  },

  isSuperuser: function() {
    const session = this.getSession();
    return session && session.role === 'superuser';
  },

  // Login calls the server; stores the result locally on success.
  login: async function(username, password) {
    const result = await API.login(username, password);
    this.setSession(result.username, result.role);
    return result;
  },
};
