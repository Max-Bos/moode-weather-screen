/*!
 * SPDX-License-Identifier: GPL-3.0-or-later
 * OrangeSound PWA Service Worker
 */

const CACHE_NAME = 'orangesound-v1';
const STATIC_ASSETS = [
	'/',
	'/css/styles.min.css',
	'/css/weather.css',
	'/css/liquid-glass.css',
	'/js/playerlib.js',
	'/js/scripts-panels.js',
	'/js/weather.js',
	'/images/pwa-icon.svg',
	'/v5-android-chrome-192x192.png',
	'/v5-android-chrome-512x512.png'
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((keys) =>
			Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
		)
	);
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	// Only handle GET requests
	if (event.request.method !== 'GET') {
		return;
	}

	const url = new URL(event.request.url);

	// Network-first for dynamic PHP/API and command endpoints
	if (url.pathname.endsWith('.php') || url.pathname.startsWith('/command/')) {
		event.respondWith(
			fetch(event.request).catch(() => caches.match(event.request))
		);
		return;
	}

	// Network-first for page navigations to avoid stale HTML
	if (event.request.mode === 'navigate') {
		event.respondWith(
			fetch(event.request).catch(() => caches.match(event.request))
		);
		return;
	}

	// Cache-first for static assets
	event.respondWith(
		caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
			// Only cache valid same-origin responses
			if (!response || response.status !== 200 || response.type !== 'basic') {
				return response;
			}
			const clone = response.clone();
			caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
			return response;
		}).catch(() => caches.match(event.request)))
	);
});
