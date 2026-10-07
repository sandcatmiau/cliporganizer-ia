/*! coi-serviceworker v0.1.7 - MIT License - https://github.com */
const coepDegrade = true;

if (typeof window === "undefined") {
    self.addEventListener("install", () => self.skipWaiting());
    self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

    self.addEventListener("message", (event) => {
        if (event.data && event.data.type === "deregister") {
            self.registration.unregister()
                .then(() => self.clients.matchAll())
                .then((clients) => {
                    clients.forEach((client) => client.navigate(client.url));
                });
        }
    });

    self.addEventListener("fetch", (event) => {
        const request = event.request;
        if (request.method !== "GET") {
            return;
        }

        if (request.url.startsWith(self.location.origin) && request.destination === "document") {
            event.respondWith(
                fetch(request)
                    .then((response) => {
                        if (response.status === 0) {
                            return response;
                        }

                        const newHeaders = new Headers(response.headers);
                        newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
                        if (coepDegrade) {
                            newHeaders.set("Cross-Origin-Embedder-Policy", "credentialless");
                        } else {
                            newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
                        }

                        return newResponse(response, newHeaders);
                    })
                    .catch((e) => console.error(e))
            );
        } else if (
            coepDegrade &&
            request.destination === "iframe" &&
            !request.url.startsWith(self.location.origin)
        ) {
            // No op
        } else {
            event.respondWith(
                fetch(request)
                    .then((response) => {
                        if (response.status === 0) {
                            return response;
                        }

                        const newHeaders = new Headers(response.headers);
                        newHeaders.set("Cross-Origin-Resource-Policy", "cross-origin");

                        return newResponse(response, newHeaders);
                    })
                    .catch((e) => console.error(e))
            );
        }
    });

} else {
    (() => {
        const script = document.currentScript;
        const reloadedBySelf = window.sessionStorage.getItem("coiReloadedBySelf");
        window.sessionStorage.removeItem("coiReloadedBySelf");

        function isCrossOriginIsolated() {
            return window.crossOriginIsolated;
        }

        if (isCrossOriginIsolated()) {
            return;
        }

        if (reloadedBySelf) {
            console.warn("coi-serviceworker: El aislamiento de origen cruzado falló a pesar del service worker.");
            return;
        }

        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register(script.src)
                .then((registration) => {
                    console.log("coi-serviceworker: Service Worker registrado con éxito:", registration.scope);

                    registration.addEventListener("updatefound", () => {
                        window.sessionStorage.setItem("coiReloadedBySelf", "true");
                        window.location.reload();
                    });

                    if (registration.active) {
                        window.sessionStorage.setItem("coiReloadedBySelf", "true");
                        window.location.reload();
                    }
                })
                .catch((err) => {
                    console.error("coi-serviceworker: Falló el registro del Service Worker:", err);
                });
        }
    })();
}

function newResponse(response, newHeaders) {
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
    });
                          }
                          
