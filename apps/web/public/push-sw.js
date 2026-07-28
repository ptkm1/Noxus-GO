/* PedixPro — Web Push service worker */
/* eslint-disable no-undef */
self.addEventListener("push", (event) => {
  let payload = { title: "PedixPro", body: "", data: {} };
  try {
    if (event.data) {
      payload = { ...payload, ...event.data.json() };
    }
  } catch {
    /* ignore */
  }

  const title = payload.title || "PedixPro";
  const options = {
    body: payload.body || "",
    data: payload.data || {},
    icon: "/favicon.ico",
    badge: "/favicon.ico",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  let path = "/notificacoes";
  if (typeof data.href === "string" && data.href.startsWith("/")) {
    path = data.href;
  } else if (typeof data.orderId === "string" && data.orderId) {
    path = `/pedidos/${data.orderId}`;
  }

  const url = new URL(path, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            return client.focus().then((focused) => {
              if (focused && "navigate" in focused) {
                return focused.navigate(url);
              }
              return focused;
            });
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      }),
  );
});
