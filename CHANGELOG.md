# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.1] - 2026-05-22

### Changed
- **Restructured for npm publishing** — source moved to `src/`, compiled output to `dist/`
- **Removed legacy root TypeScript files** — clean project layout

### Added
- **Deterministic cache IDs** — MD5 hash of query enables cache deduplication and `get_search_results` lookups
- **Configurable safesearch** — `"off"`, `"moderate"`, `"strict"` mapped to SearXNG's `0/1/2`
- **Cache with TTL and LRU eviction** — freshness TTL (15 min), access TTL (24h), max 200 entries
- **Configurable cache settings** — `cacheFreshnessMs`, `cacheTtlMs`, `cacheMaxSize` in config
- **Cache config fields** — all cache parameters tunable via `config.json`

### Fixed
- **Error handling** — malformed JSON and non-OK responses now produce descriptive errors with URL and body
- **Config validation** — field type checks with `console.warn` on invalid values, `console.error` on corrupt JSON
- **Config path** — robust `resolveHomeDir()` with `PI_CODING_AGENT_DIR`, `HOME`, `homedir()` fallbacks
- **URL field mapping** — fallback to `url_normalized` when `r.url` is missing
- **Consistent response shape** — `details` field present in both success and error paths for both tools
- **Cache eviction** — LRU ordering instead of FIFO for correct least-recently-used behavior
- **Publish config** — `files` restricted to `dist/`, `pi.extensions` points to compiled JS

### Removed
- **`fetch_content` tool** — out of scope for this SearXNG-only search plugin
- **GitHub repo cloning** — no longer attempts to clone repositories from search results

### Chores
- Added `package-lock.json` to `.gitignore`
- Corrected authorship and repository URL
- Normalized `repository.url` to `git+https` format

## [1.0.0] - 2026-05-20

### Added
- Initial fork of [jcha0713/pi-searxng](https://github.com/jcha0713/pi-searxng)
- `web_search` tool — search the web via SearXNG
- `get_search_results` tool — retrieve cached search results by ID
- Basic in-memory search cache
