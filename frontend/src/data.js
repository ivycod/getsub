export const money = (n) => `$${n.toFixed(2)}`;

export const SHARED_MONTH_OPTIONS = [3, 6, 9, 12, 16];

export const DELIVERY_OPTIONS = {
  preplanned: {
    title: "Pre-planned account",
    chip: "New account",
    sub: "We hand you a ready-made account with premium already active.",
    videoUrl: null,
    steps: [
      "You complete the purchase",
      "We set up a fresh account with your premium plan active",
      "Full login credentials arrive in your email (10 min – 2 hrs)",
      "Sign in on the official app and enjoy",
    ],
    bestFor: "Best if you want the fastest, zero-effort start and don't mind a new account.",
  },
  recharge: {
    title: "Recharge my account",
    chip: "Your account",
    sub: "We activate premium on YOUR existing account — playlists, history and subscriptions stay.",
    videoUrl: null,
    steps: [
      "You complete the purchase",
      "You share the Gmail + password of the account to upgrade",
      "A live chat opens with us — share the OTP/code there when asked",
      "Premium goes live on your own account, nothing else changes",
    ],
    bestFor: "Best if you want to keep everything on the account you already use.",
  },
};
