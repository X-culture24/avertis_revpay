export const colors = {
  // Color palette
  primary: '#000000',
  secondary: '#ffffff',
  background: '#ffffff',
  surface: '#ffffff',
  accent: '#007AFF',
  text: '#000000',
  textSecondary: '#8E8E93',
  textTertiary: '#C7C7CC',
  border: '#E5E5EA',
  error: '#FF3B30',
  success: '#34C759',
  warning: '#FF9500',
  disabled: '#C7C7CC',
  placeholder: '#C7C7CC',
  card: '#ffffff',
  shadow: 'rgba(0, 0, 0, 0.1)',
  divider: '#F2F2F7',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
};

export const typography = {
  // Headings
  h1: {
    fontSize: 34,
    fontWeight: 'bold' as const,
    color: colors.text,
  },
  h2: {
    fontSize: 28,
    fontWeight: 'bold' as const,
    color: colors.text,
  },
  h3: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: colors.text,
  },
  h4: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.text,
  },
  
  // Body text
  body: {
    fontSize: 16,
    fontWeight: 'normal' as const,
    color: colors.text,
    lineHeight: 24,
  },
  
  // Secondary text
  secondary: {
    fontSize: 14,
    fontWeight: 'normal' as const,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  
  // Caption text
  caption: {
    fontSize: 12,
    fontWeight: 'normal' as const,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  
  // Button text
  button: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: colors.primary,
    textTransform: 'uppercase' as const,
  },
  
  // Input labels
  label: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: colors.text,
    marginBottom: 4,
  },
  
  // Error text
  error: {
    fontSize: 12,
    fontWeight: 'normal' as const,
    color: colors.error,
    marginTop: 4,
  },
};
