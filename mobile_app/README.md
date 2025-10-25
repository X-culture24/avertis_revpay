# Revpay Connect Mobile App

A React Native mobile application for the Revpay Connect eTIMS Integration Platform, enabling businesses to manage KRA eTIMS compliance through OSCU and VSCU integration modes.

## Features

### Authentication
- Business registration with KRA PIN validation
- JWT-based authentication
- Secure token management with automatic refresh

### Dashboard
- Real-time invoice statistics
- Integration mode status (OSCU/VSCU)
- Quick actions for common tasks
- Recent invoices overview

### Invoice Management
- Create invoices with multiple items
- Real-time tax calculations
- Invoice status tracking (PENDING, SUBMITTED, SYNCED, FAILED)
- Manual retry for failed invoices
- Detailed invoice views

### Integration Settings
- Toggle between OSCU (online) and VSCU (virtual) modes
- KRA API credentials management
- Integration status monitoring

### Reports & Analytics
- Visual charts for invoice trends
- Revenue analysis
- Success rate tracking
- Compliance monitoring
- Export functionality (PDF/Excel)

### Offline Support (VSCU Mode)
- Offline invoice creation
- Automatic sync when online
- Queue management for pending invoices
- Network status monitoring

## Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **Navigation**: React Navigation v6
- **State Management**: Recoil
- **UI Library**: React Native Paper
- **Charts**: Victory Native
- **HTTP Client**: Axios
- **Storage**: AsyncStorage
- **Icons**: Expo Vector Icons

## Project Structure

```
src/
├── components/          # Reusable UI components
├── navigation/          # Navigation configuration
├── screens/            # Screen components
│   ├── auth/           # Authentication screens
│   └── main/           # Main app screens
├── services/           # API and offline services
├── store/              # Recoil state management
├── theme/              # Design system and theming
├── types/              # TypeScript type definitions
└── utils/              # Utility functions
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm start
```

3. Run on device/simulator:
```bash
npm run android  # For Android
npm run ios      # For iOS
```

## Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
API_BASE_URL=http://localhost:8000/api
```

### API Integration
The app connects to the Django backend API. Ensure the backend is running and accessible.

## Key Components

### Authentication Flow
- Login/Register screens with validation
- JWT token management
- Automatic token refresh
- Secure storage of credentials

### Invoice Workflow
1. Create invoice with customer details
2. Add multiple items with tax calculations
3. Submit to KRA via OSCU/VSCU
4. Track status and handle retries
5. View detailed submission logs

### Offline Mode (VSCU)
- Invoices saved locally when offline
- Automatic sync when connection restored
- Queue management for pending submissions
- Network status indicators

## Design System

### Color Scheme (Black & White Theme)
- Primary: #000000 (Black)
- Secondary: #ffffff (White)
- Background: #ffffff (White)
- Surface: #f5f5f5 (Light Gray)
- Text: #000000 (Black)
- Text Secondary: #666666 (Gray)

### Typography
- H1: 32px, Bold
- H2: 24px, Bold
- H3: 20px, Semi-bold
- Body: 16px, Regular
- Caption: 14px, Regular

### Spacing
- XS: 4px
- SM: 8px
- MD: 16px
- LG: 24px
- XL: 32px
- XXL: 48px

## State Management

Using Recoil for global state management:

- `authState`: User authentication and profile
- `invoicesState`: Invoice data and loading states
- `integrationSettingsState`: KRA integration configuration
- `dashboardStatsState`: Dashboard metrics
- `offlineInvoicesState`: Offline invoice queue
- `networkState`: Network connectivity status

## API Integration

### Endpoints
- Authentication: `/auth/login/`, `/auth/register/`
- Invoices: `/invoices/`, `/invoices/{id}/resync/`
- Integration: `/integration/settings/`
- Dashboard: `/dashboard/stats/`
- Reports: `/reports/`

### Error Handling
- Network error detection
- Automatic retry with exponential backoff
- User-friendly error messages
- Offline mode fallback

## Testing

Run tests:
```bash
npm test
```

## Building for Production

### Android
```bash
expo build:android
```

### iOS
```bash
expo build:ios
```

## Contributing

1. Follow TypeScript best practices
2. Use the established design system
3. Implement proper error handling
4. Add appropriate loading states
5. Test offline functionality
6. Maintain consistent code style

## License

Copyright © 2024 Revpay Connect Ltd. All rights reserved.
