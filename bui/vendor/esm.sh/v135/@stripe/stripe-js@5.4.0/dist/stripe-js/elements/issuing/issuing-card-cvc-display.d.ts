import {StripeElementBase, StripeElementStyle} from '../base.d.ts';

export type StripeIssuingCardCvcDisplayElement = StripeElementBase & {
  /**
   * Updates the options the `IssuingCardCvcDisplayElement` was initialized with.
   * Updates are merged into the existing configuration.
   *
   * The styles of an `IssuingCardCvcDisplayElement` can be dynamically changed using `element.update`.
   * This method can be used to simulate CSS media queries that automatically adjust the size of elements when viewed on different devices.
   */
  update(options: Partial<StripeIssuingCardCvcDisplayElementOptions>): void;
};

export interface StripeIssuingCardCvcDisplayElementOptions {
  /**
   * The token (e.g. `ic_abc123`) of the issued card to display in this Element
   */
  issuingCard: string;

  /**
   * The secret component of the ephemeral key with which to authenticate this sensitive
   * card details request
   */
  ephemeralKeySecret?: string;

  /**
   * The nonce used to mint the ephemeral key provided in `ephemeralKeySecret`
   */
  nonce?: string;

  style?: StripeElementStyle;
}
