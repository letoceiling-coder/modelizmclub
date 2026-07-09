/**
 * Client-side feature flags.
 *
 * `communitiesEnabled` is meant to eventually read the generic AdminSetting
 * key `feature.communities_enabled` (GET /admin/settings — the mechanism
 * already exists and is generic). It's hardcoded here instead because that
 * endpoint requires admin auth (no `security: []` override in the OpenAPI
 * spec, tag "Admin — System") — anonymous/regular site visitors, who are the
 * audience this flag actually needs to affect, can't read it. There is no
 * public-readable settings/flags endpoint yet. See
 * backend-endpoints-needed.md #17 for the requested backend addition.
 *
 * Until that exists, flip this constant directly to toggle visibility.
 */
export const FEATURE_FLAGS = {
  communitiesEnabled: false,
} as const;
