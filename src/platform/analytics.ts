import posthog from "posthog-js";

let initialized = false;

function init() {
    if (initialized) return;
    posthog.init("phc_kgEBtifs0EgWlrl4ROYEbnsQ1b7BS2W5BKLNyXe7f8z", {
        api_host: "https://app.posthog.com",
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
    });
    initialized = true;
}

export const analytics = {
    enable() {
        init();
        posthog.opt_in_capturing();
    },
    disable() {
        if (!initialized) return;
        posthog.opt_out_capturing();
        posthog.reset();
    },
    capture(event: string, properties?: Record<string, unknown>) {
        if (initialized) posthog.capture(event, properties);
    },
};
