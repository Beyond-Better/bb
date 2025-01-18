export * from './api/index.d.ts';
export * from './stripe-js/index.d.ts';

import {StripeConstructor} from './stripe-js/index.d.ts';

export {loadStripe} from './shared.d.ts';

declare global {
  interface Window {
    // Stripe.js must be loaded directly from https://js.stripe.com/v3, which
    // places a `Stripe` object on the window
    Stripe?: StripeConstructor;
  }
}
