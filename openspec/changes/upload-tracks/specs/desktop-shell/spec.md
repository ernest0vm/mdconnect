# Spec Delta

## ADDED Requirements

### Requirement: Network destinations

In packaged builds the UI SHALL only open network connections to the app's own origin and to the online ATRAC encoding service at `https://atrac.minidisc.wiki`. Connections to any other origin SHALL be blocked. The web app SHALL apply the same rule through the shared Content Security Policy.

#### Scenario: Encoding service allowed

- **WHEN** the user uploads in LP2 with the online encoder
- **THEN** the request to `https://atrac.minidisc.wiki` is allowed

#### Scenario: Other origins blocked

- **WHEN** UI code in a packaged build calls `fetch` for `https://example.com`
- **THEN** the request is refused by the Content Security Policy
