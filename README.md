# Mecha Sonic

An offline-first acoustic exploration workstation built with React, Vite, Web Audio and IndexedDB. Run `npm install`, `npm run dev`, `npm run build`, or `npm test`.

Microphone capture requires a secure context and permission. The simulator generates audio through the same FFT pipeline; it is explicitly synthetic. Frequency matching and repair price ranges are illustrative, not a reliable mechanical diagnosis or a live local quote. Consult a qualified technician. Filtered monitoring is off by default; use headphones and low volume.

Scans, assets and estimates stay in IndexedDB by default. The service worker caches the app for subsequent offline use; open the app online once before relying on offline mode. An optional account-scoped cloud backup is provided but is not configured by default; see below.

## Android

The Capacitor Android project is included. With the Android SDK and JDK 21 installed, run `npm run build`, `npx cap sync android`, and `cd android && ./gradlew assembleDebug`. The GitHub Actions workflow runs tests, builds and uploads a debug-signed APK on branch pushes. A manual workflow run with the `bundle` option explicitly enabled also commits that APK and its SHA-256 file to `public/releases/` on the triggering branch. A debug APK is for testing, not a verified production release. No APK is included until the workflow runs. The download center does not offer a fake binary. For production, configure release signing and verify its checksum independently.

## Signal and motion notes

The FFT uses a 2048-sample window (1024 magnitude bins); the match score is a simple frequency/level heuristic, not a diagnostic probability. Waterfall and waveform charts use the active analyser. The lab output chain uses a high-pass, band-pass and optional notch filter, with monitoring muted by default. Avoid acoustic feedback; use headphones and begin at low volume.

The seismograph uses linear acceleration when the browser supplies it, or an explicitly labelled 3 Hz simulator. RMS and peak values are computed over a rolling five-second vector window. RPM is a rough autocorrelation-based periodicity estimate and may be inaccurate for irregular, noisy, or slow sensor samples; it is not a tachometer. Sensor permission and availability depend on the device and browser.

Saved estimates (including quote and checklist) and scans are stored locally. Saved scans include a local FFT snapshot. Garage history can compare dominant frequency against a previous scan for the same asset and signature, mark scans resolved, download JSON, or print a summary using the browser's Save as PDF option. Older scans without stored FFT bins remain readable.

## Optional Supabase backup

The backup migration has been applied to the user-selected Supabase project `kennedy-blip's Project`. Its public project URL and publishable key are configured in `src/config/cloud.ts`; these are public browser identifiers, not privileged secrets. To point a deployment to a different project, apply `supabase/migrations/202611200001_mechasonic_backup.sql` there, set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (a **public** publishable/anon key) in your deployment environment or an untracked `.env`, and rebuild. Never put a service-role or secret key in a Vite environment variable. Sign in using an existing account in that project's Supabase Auth (not your Supabase dashboard password). Email-link sign-in is disabled by default because this shared project's existing redirect settings point to other apps. To use it, add the deployed site's exact origin to the Supabase Auth redirect allow-list and set `VITE_ENABLE_MAGIC_LINK=true`. Android app deep-link handling is not configured.

In System Telemetry, users must sign in and explicitly opt in before any local snapshots upload. The confirmation explains that names, FFT bins, repair estimates and quotes may be sent; raw microphone audio is never saved or sent. Once enabled, local record mutations and queued snapshots commit together. Pending changes retry when the app is open and online. Pausing or signing out stops uploads but continues recording changes locally for the linked account. The queue is account-scoped; signing into a different account requires explicit opt-in again. Existing local-only ledger entries are not uploaded, but enabling backup queues a snapshot of current records. Deletes become tombstones, and monotonic per-device sequence numbers prevent late retries from overwriting newer snapshots.

This is a **per-device upload backup**, not a completed two-way sync product: there is no in-app restore, merge, remote deletion, or end-to-end encryption. Backups live in the chosen Supabase project under row-level security, and pausing does not delete already uploaded data. Supabase administrators can access database contents; manage retention and deletion in that project. UI role switches are demonstration controls, not security boundaries. RLS and anonymous/authenticated privileges were checked against the selected project. End-to-end hosted sign-in and upload have not been tested; mocked queue and IndexedDB migration tests are included.
