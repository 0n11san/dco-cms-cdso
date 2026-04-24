// js/config.js — DCO CMS Configuration
// Authentication is now server-side. Credentials are NOT stored here.

const CONFIG = {
  API_BASE: '',  // empty = same origin; set to full URL if backend is on a different host

  POR_OPTIONS:     ['GDP', 'DDS', 'F&MA', 'Tools', 'Miscellaneous'],
  VEHICLE_OPTIONS: ['CHESS ITES-4H', 'CHESS ITES SW'],
  METRIC_TYPES:    ['seats', 'endpoints', 'cores', 'users', 'processors', 'nodes', 'servers', 'workstations', 'gb/day', 'credits', 'unlimited', 'units'],

  RENEWAL_LEAD_TIME: 45,
  RENEWAL_WINDOW:    120,
};
