# Spec Delta

## Purpose

Defines how the mdconnect web app reaches users: which browsers it supports, the security and isolation headers it is served with, how routing works, how its source is made available, and how it is deployed.

## ADDED Requirements

### Requirement: Supported browsers

The web app SHALL run its device features only where WebUSB is available in a secure context. Elsewhere it SHALL show an "unsupported browser" screen that names supported browsers (Chrome, Edge, Opera and other Chromium-based browsers) and links to the desktop app, and SHALL NOT attempt any USB call.

#### Scenario: Chromium browser

- **WHEN** a user opens the web app in a current version of Chrome or Edge over HTTPS
- **THEN** the Connect screen is shown

#### Scenario: Browser without WebUSB

- **WHEN** a user opens the web app in Firefox or Safari
- **THEN** the unsupported-browser screen is shown with the list of supported browsers and a link to the desktop app
- **AND** no USB API is called

### Requirement: Security and isolation headers

Every response of the web app SHALL carry the same Content Security Policy as the packaged desktop app, and `Cross-Origin-Opener-Policy: same-origin` with `Cross-Origin-Embedder-Policy: require-corp`, so the page is cross-origin isolated.

#### Scenario: Headers present

- **WHEN** the production URL is requested
- **THEN** the response includes the desktop app's Content Security Policy, `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`

#### Scenario: Cross-origin isolated

- **WHEN** the app has loaded in a supported browser
- **THEN** `crossOriginIsolated` is `true`

#### Scenario: Remote script blocked

- **WHEN** the page attempts to load a script from another origin
- **THEN** the browser refuses it and the app keeps working

### Requirement: Routing fallback

Any path under the web app's origin that is not a static asset SHALL load the app, so reloads and shared links never show a server 404.

#### Scenario: Reload on a nested path

- **WHEN** a user reloads the page on a path such as `/device`
- **THEN** the app loads instead of a 404 page

### Requirement: Source availability

The web app SHALL show a link to its source code repository and state that it is licensed under GPL-2.0, on every screen including the unsupported-browser screen.

#### Scenario: Source link

- **WHEN** a user opens any screen of the web app
- **THEN** a link to the source repository and a GPL-2.0 notice are visible

### Requirement: Deployments

Changes merged to `main` SHALL be deployed to production. Every pull request that affects the web app or a package it depends on SHALL get its own preview deployment. A pull request that affects neither SHALL NOT trigger a web build.

#### Scenario: Pull request preview

- **WHEN** a pull request changes `packages/app`
- **THEN** a preview deployment is created and its URL is posted on the pull request

#### Scenario: Unrelated change

- **WHEN** a pull request only changes `apps/desktop`
- **THEN** no web build runs for it

#### Scenario: Production

- **WHEN** a pull request is merged to `main`
- **THEN** the production URL serves the new version
