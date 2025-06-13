// Type-safe wrappers
export type MicroDollars = number & { readonly __brand: unique symbol };
export type Cents = number & { readonly __brand: unique symbol };
export type Dollars = number & { readonly __brand: unique symbol };

export const asMicro = (value: number): MicroDollars => value as MicroDollars;
export const asCents = (value: number): Cents => value as Cents;
export const asDollars = (value: number): Dollars => value as Dollars;

export const CurrencyConverter = {
	dollarsToCents: (dollars: number): number => Math.round(dollars * 100),
	dollarsToDecimalCents: (dollars: number): number => Math.round((dollars * 100) * 100) / 100,
	dollarsToMicro: (dollars: number): number => Math.round(dollars * 1_000_000),

	centsToDollars: (cents: number): number => cents / 100,
	centsToMicro: (cents: number): number => cents * 10_000,

	microToDollars: (micro: number): number => micro / 1_000_000,
	microToCents: (micro: number): number => Math.round(micro / 10_000),
	microToDecimalCents: (micro: number): number => Math.round((micro / 10_000) * 100) / 100,

	// Precision-safe operations
	addMicro: (...amounts: number[]): number => amounts.reduce((sum, amt) => sum + amt, 0),
	multiplyMicro: (micro: number, factor: number): number => Math.round(micro * factor),
	divideMicro: (micro: number, divisor: number): number => Math.round(micro / divisor),

	// Formatting
	formatDollars: (micro: number): string => (micro / 1_000_000).toFixed(2),
	formatCents: (micro: number): string => Math.round(micro / 10_000).toString(),
} as const;

/*

// Basic conversions
const price = 99.99;
const priceInMicro = CurrencyConverter.dollarsToMicro(price); // 99990000
const priceInCents = CurrencyConverter.dollarsToCents(price); // 9999

// Financial calculations in micro precision
const orderTotal = asMicro(CurrencyConverter.dollarsToMicro(150.75));
const taxRate = 0.0875;
const tax = CurrencyConverter.multiplyMicro(orderTotal, taxRate); // 13190625
const finalAmount = CurrencyConverter.addMicro(orderTotal, tax); // 163940625

interface Transaction {
  id: string;
  amountMicro: MicroDollars;
  feeMicro: MicroDollars;
  timestamp: Date;
}

// Oak endpoint handling
router.post("/payment", async (ctx) => {
  const { amount } = await ctx.request.body().value;
  const amountMicro = asMicro(CurrencyConverter.dollarsToMicro(amount));
  const processingFee = asMicro(CurrencyConverter.multiplyMicro(amountMicro, 0.029));

  await db.collection("transactions").insertOne({
    amountMicro,
    feeMicro: processingFee,
    netMicro: asMicro(CurrencyConverter.addMicro(amountMicro, -processingFee)),
    timestamp: new Date()
  });

  ctx.response.body = {
    amount: CurrencyConverter.formatDollars(amountMicro),
    fee: CurrencyConverter.formatDollars(processingFee)
  };
});

// Aggregation pipeline for reporting
const dailyRevenue = await db.collection("transactions").aggregate([
  { $match: { timestamp: { $gte: startOfDay } } },
  { $group: { _id: null, totalMicro: { $sum: "$amountMicro" } } },
  { $project: { revenue: { $divide: ["$totalMicro", 1000000] } } }
]).toArray();

// Interest calculation with compound precision
const principal = asMicro(CurrencyConverter.dollarsToMicro(10000));
const dailyRate = 0.05 / 365;
const compoundedAmount = Array.from({ length: 365 }, (_, day) =>
  CurrencyConverter.multiplyMicro(principal, Math.pow(1 + dailyRate, day + 1))
)[364];


 */
