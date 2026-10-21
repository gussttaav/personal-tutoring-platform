/*
 * CHAT-CONTENT-01 — the mobile app's store links, in one place.
 *
 * Read by the home's app showcase (src/components/AppShowcase.tsx) and by the chat
 * assistant's prompt (src/constants/chat-prompt.ts), so the page and the assistant can never
 * disagree about where the app can be downloaded.
 *
 * APP-ANDROID-01: the Play Store URL is a constant (the package id never changes). The App
 * Store has no listing yet: it stays unset until `NEXT_PUBLIC_APP_STORE_URL` is, which turns
 * the showcase's placeholder into a link and the assistant's «próximamente» into the URL,
 * with no code change.
 */

export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=dev.gustavoai.mobile";

export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL;
