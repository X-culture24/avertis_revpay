export interface User {
  id: string;
  email: string;
  businessName?: string;
  roles?: string[];
  permissions?: string[];
  is_staff?: boolean;
  is_superuser?: boolean;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
  date_joined?: string;
  last_login?: string;
  role?: 'admin' | 'user' | 'company_admin';
  company_id?: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  tokens: AuthTokens | null;
  loading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AdminLoginCredentials extends LoginCredentials {
  admin_code?: string;
}

export interface RegistrationData {
  businessName: string;
  kraPin: string;
  email: string;
  phone: string;
  password: string;
  posDetails?: string;
}
