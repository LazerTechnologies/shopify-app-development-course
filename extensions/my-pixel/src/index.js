import { register } from "@shopify/web-pixels-extension";

register(({ analytics, browser, settings }) => {
  // Subscribe to all events emitted by Shopify
  analytics.subscribe("all_events", (event) => {
    console.log("Event:", event.name);
    console.log("Payload:", event);
    console.log("Settings:", settings);
  });
});
