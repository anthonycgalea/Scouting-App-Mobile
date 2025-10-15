# App Structure Overview

The project now implements the scouting application's modular layout, navigation, and provider setup. Feature-specific screens
live alongside supporting hooks, while shared UI primitives are kept in the global `components/` directory.

## High-Level Organization

- **Navigation** – Expo Router drives navigation with a left-side drawer that supports swipe gestures and burger-icon toggles.
  Navigation metadata (routes, drawer items) resides in `app/navigation/`, and custom drawer content lives in `components/layout/`.
- **Providers** – `AuthProvider`, `OrganizationProvider`, and `ColorSchemeProvider` wrap the app in `app/_layout.tsx`, giving
  every screen access to authentication status, organization context, and the current theme preference.
- **Screens** – Feature folders in `app/screens/` expose typed React components for the drawer routes (Pit Scout, Match Scout,
  settings flows, and OAuth login). Expo Router route files import these components to keep domain logic co-located.
- **State & Services** – Reserved directories (`app/services/`, `app/store/`, `app/utils/`) provide dedicated homes for
  networking, persistence, state, and utility logic as it evolves.
- **Shared UI** – Reusable layout primitives (`ScreenContainer`, `AppDrawerContent`) and future input/feedback components live
  under `components/`.

## Directory Layout

```
app/
├── (drawer)/
│   ├── _layout.tsx
│   ├── match-scout/
│   │   └── index.tsx
│   ├── organization-select/
│   │   └── index.tsx
│   ├── pit-scout/
│   │   └── index.tsx
│   └── settings/
│       └── index.tsx
├── _layout.tsx
├── auth/
│   └── login.tsx
├── navigation/
│   ├── drawer-items.ts
│   └── index.ts
├── providers/
│   ├── AuthProvider.tsx
│   ├── OrganizationProvider.tsx
│   └── index.ts
├── screens/
│   ├── Auth/
│   │   └── LoginScreen.tsx
│   ├── MatchScout/
│   │   └── MatchScoutScreen.tsx
│   ├── PitScout/
│   │   └── PitScoutScreen.tsx
│   ├── Settings/
│   │   ├── AppSettingsScreen.tsx
│   │   └── OrganizationSelectScreen.tsx
│   ├── Shared/
│   └── index.ts
├── services/
│   ├── api/
│   └── storage/
├── store/
│   └── slices/
└── utils/

components/
├── feedback/
├── inputs/
├── layout/
│   ├── AppDrawerContent.tsx
│   └── ScreenContainer.tsx
└── ui/

constants/
├── routes.ts
└── theme.ts

hooks/
├── use-authentication.ts
├── use-color-scheme.ts
├── use-organization.ts
└── use-theme-color.ts

tests/
├── e2e/
└── unit/
```

## Navigation Flow

1. **Login** – `/auth/login` renders `LoginScreen`, presenting a mocked OAuth button. Successful login updates both the
   authentication state and the default organization selection.
2. **Drawer** – Authenticated users are redirected to the drawer (`/(drawer)`), which lists Pit Scout, Match Scout, App
   Settings, and Organization Select. The drawer supports both burger-menu toggles and swipe gestures.
3. **Feature Screens** – Each drawer route renders a dedicated screen component from `app/screens/`, keeping UI and feature
   logic co-located.

This structure provides the requested OAuth-only authentication flow, modular feature directories, and a reusable navigation
foundation for future scouting functionality.
