export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login/',
    REGISTER: '/auth/register/',
    LOGOUT: '/auth/logout/',
    REFRESH: '/auth/refresh/',
    PROFILE: '/auth/profile/',
  },
  INTEGRATION: {
    SETTINGS: '/integration/settings/',
  },
  INVOICES: {
    LIST: '/invoices/',
    CREATE: '/invoices/',
    DETAILS: (id: string) => `/invoices/${id}/`,
    RESYNC: (id: string) => `/invoices/${id}/resync/`,
  },
  DASHBOARD: {
    STATS: '/dashboard/stats/',
  },
  REPORTS: {
    LIST: '/reports/',
  },
};

export const STORAGE_KEYS = {
  AUTH_TOKENS: 'auth_tokens',
  USER_DATA: 'user_data',
  OFFLINE_INVOICES: 'offline_invoices',
  SYNC_QUEUE: 'sync_queue',
  INTEGRATION_SETTINGS: 'integration_settings',
  APP_SETTINGS: 'app_settings',
};

export const INVOICE_STATUS = {
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED',
  SYNCED: 'SYNCED',
  FAILED: 'FAILED',
} as const;

export const INTEGRATION_MODES = {
  OSCU: 'OSCU',
  VSCU: 'VSCU',
} as const;

export const SUBSCRIPTION_TYPES = {
  FREE: 'Free',
  SME: 'SME',
  CORPORATE: 'Corporate',
} as const;

export const DEFAULT_TAX_RATE = 16; // Kenya VAT rate

export const RETRY_CONFIG = {
  MAX_RETRIES: 5,
  INITIAL_DELAY: 1000, // 1 second
  BACKOFF_MULTIPLIER: 2,
};

export const SYNC_INTERVALS = {
  VSCU_SYNC: 15 * 60 * 1000, // 15 minutes
  DASHBOARD_REFRESH: 5 * 60 * 1000, // 5 minutes
  INVOICE_LIST_REFRESH: 2 * 60 * 1000, // 2 minutes
};

export const VALIDATION_RULES = {
  PASSWORD_MIN_LENGTH: 8,
  INVOICE_NUMBER_MIN_LENGTH: 3,
  BUSINESS_NAME_MIN_LENGTH: 2,
  PHONE_MIN_LENGTH: 10,
};

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  INVALID_CREDENTIALS: 'Invalid email or password.',
  REGISTRATION_FAILED: 'Registration failed. Please try again.',
  INVOICE_CREATION_FAILED: 'Failed to create invoice. Please try again.',
  SYNC_FAILED: 'Sync failed. Invoice will be retried automatically.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  UNAUTHORIZED: 'Session expired. Please login again.',
  SERVER_ERROR: 'Server error. Please try again later.',
};

export const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: 'Login successful!',
  REGISTRATION_SUCCESS: 'Account created successfully!',
  INVOICE_CREATED: 'Invoice created successfully!',
  PROFILE_UPDATED: 'Profile updated successfully!',
  SETTINGS_SAVED: 'Settings saved successfully!',
  SYNC_COMPLETED: 'Sync completed successfully!',
};
