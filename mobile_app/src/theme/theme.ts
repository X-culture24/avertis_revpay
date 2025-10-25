import { DefaultTheme } from 'react-native-paper';

export const colors = {
  primary: '#000000',
  secondary: '#ffffff',
  background: '#ffffff',
  surface: '#f5f5f5',
  accent: '#333333',
  text: '#000000',
  textSecondary: '#666666',
  border: '#e0e0e0',
  error: '#000000',
  success: '#000000',
  warning: '#000000',
  disabled: '#cccccc',
  placeholder: '#999999',
  card: '#ffffff',
  shadow: '#000000',
};

export const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    accent: colors.accent,
    background: colors.background,
    surface: colors.surface,
    text: colors.text,
    disabled: colors.disabled,
    placeholder: colors.placeholder,
    backdrop: 'rgba(0, 0, 0, 0.5)',
    onSurface: colors.text,
    notification: colors.primary,
  },
  roundness: 8,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: 'bold' as const,
    color: colors.text,
  },
  h2: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: colors.text,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: colors.text,
  },
  body: {
    fontSize: 16,
    fontWeight: 'normal' as const,
    color: colors.text,
  },
  caption: {
    fontSize: 14,
    fontWeight: 'normal' as const,
    color: colors.textSecondary,
  },
  small: {
    fontSize: 12,
    fontWeight: 'normal' as const,
    color: colors.textSecondary,
  },
};
