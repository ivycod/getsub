import { initializePaddle } from "@paddle/paddle-js";

let paddlePromise;

export function getPaddle() {
  if (!paddlePromise) {
    const environment = process.env.REACT_APP_PADDLE_ENV || "sandbox";
    const token = process.env.REACT_APP_PADDLE_CLIENT_TOKEN;
    if (!token) return Promise.resolve(null);
    paddlePromise = initializePaddle({
      environment,
      token,
      eventCallback: (event) => {
        if (event?.name === "checkout.completed") {
          window.dispatchEvent(new CustomEvent("paddle-checkout-completed", { detail: event }));
        }
      },
    });
  }
  return paddlePromise;
}

// Maps our internal plan IDs to Paddle price IDs from env.
export const PADDLE_PRICE_IDS = {
  "youtube-monthly": process.env.REACT_APP_PADDLE_YOUTUBE_MONTHLY,
  "youtube-annual": process.env.REACT_APP_PADDLE_YOUTUBE_ANNUAL,
  "youtube-shared": process.env.REACT_APP_PADDLE_YOUTUBE_SHARED,
  "spotify-monthly": process.env.REACT_APP_PADDLE_SPOTIFY_MONTHLY,
  "spotify-annual": process.env.REACT_APP_PADDLE_SPOTIFY_ANNUAL,
  "spotify-shared": process.env.REACT_APP_PADDLE_SPOTIFY_SHARED,
};

export async function openCheckout(planId, quantity = 1) {
  const priceId = PADDLE_PRICE_IDS[planId];
  const paddle = await getPaddle();
  if (!paddle || !priceId || !priceId.startsWith("pri_")) {
    return { ok: false, reason: "not-configured" };
  }
  paddle.Checkout.open({
    items: [{ priceId, quantity }],
    settings: {
      displayMode: "overlay",
      theme: "light",
      locale: "en",
      successUrl: `${window.location.origin}/?checkout=success`,
    },
  });
  return { ok: true };
}
