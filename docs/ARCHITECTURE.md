# ReelMeter Architecture

## Overview

ReelMeter is a privacy-first browser extension (Manifest V3) built with WXT, TypeScript, and React.

## Layered Design

```
┌────────────────────────────────────────────────────────┐
│               Injected UI & Popup / Dashboard          │
└────────────────────────────────────────────────────────┘
                           │
┌────────────────────────────────────────────────────────┐
│             Core Tracking Engine (ReelTracker)         │
└────────────────────────────────────────────────────────┘
                           │
┌────────────────────────────────────────────────────────┐
│             Adapters Layer (Instagram, etc.)           │
│   - PlatformAdapter interface                          │
│   - Centralized Selectors                              │
│   - SPA Navigation & Active Video Detection            │
└────────────────────────────────────────────────────────┘
                           │
┌────────────────────────────────────────────────────────┐
│                   Target Platform DOM                  │
└────────────────────────────────────────────────────────┘
```

## Platform Adapters

The adapters layer abstracts away the idiosyncrasies of social platforms:
- **Registry (`src/adapters/registry.ts`)**: Resolves the appropriate adapter based on the current window location.
- **Types (`src/adapters/types.ts`)**: Defines `PlatformAdapter`, `CandidateReel`, and detection callbacks.
- **Platform Implementation (`src/adapters/instagram/`)**:
  - `selectors.ts`: Central repository of DOM queries for Instagram.
  - `adapter.ts`: Detection and SPA observer logic.
