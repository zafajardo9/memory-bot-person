import { z } from "zod";

/**
 * Safe math evaluation for the chat assistant.
 *
 * The expression grammar is parsed with a recursive-descent parser over a
 * restricted token set — no eval(), no Function constructor, so there is no
 * code-injection surface. Supports arithmetic, percentages, exponents, a small
 * function/constant whitelist, unit conversion (length, mass, time, data,
 * volume, temperature), and live currency conversion with a cached rate table.
 */

export class CalculatorError extends Error {}

// --- Tokenizer & parser -----------------------------------------------------

type Token =
  | { type: "number"; value: number; percent: boolean }
  | { type: "op"; value: string }
  | { type: "ident"; value: string }
  | { type: "lparen" }
  | { type: "rparen" }
  | { type: "comma" };

const FUNCTIONS = new Set([
  "sqrt",
  "abs",
  "round",
  "floor",
  "ceil",
  "min",
  "max",
  "log10",
  "ln",
  "exp",
  "pow",
  "sin",
  "cos",
  "tan",
  "asin",
  "acos",
  "atan",
]);

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;

  while (index < input.length) {
    const char = input[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      const start = index;
      while (index < input.length && /[0-9.]/.test(input[index])) index += 1;
      const literal = input.slice(start, index);
      const value = Number(literal);
      if (!Number.isFinite(value)) {
        throw new CalculatorError(`Invalid number: ${literal}`);
      }
      // A "%" attached directly to the number is a percentage literal ("50%").
      const percent = input[index] === "%";
      if (percent) index += 1;
      tokens.push({ type: "number", value, percent });
      continue;
    }

    if (/[a-zA-Z]/.test(char)) {
      const start = index;
      while (index < input.length && /[a-zA-Z]/.test(input[index])) index += 1;
      tokens.push({ type: "ident", value: input.slice(start, index).toLowerCase() });
      continue;
    }

    if (char === "(") {
      tokens.push({ type: "lparen" });
      index += 1;
      continue;
    }

    if (char === ")") {
      tokens.push({ type: "rparen" });
      index += 1;
      continue;
    }

    if (char === ",") {
      tokens.push({ type: "comma" });
      index += 1;
      continue;
    }

    if ("+-*/^%".includes(char)) {
      tokens.push({ type: "op", value: char });
      index += 1;
      continue;
    }

    throw new CalculatorError(`Unsupported character: ${char}`);
  }

  return tokens;
}

class Parser {
  private position = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private next(): Token {
    const token = this.tokens[this.position];
    if (!token) throw new CalculatorError("Unexpected end of expression.");
    this.position += 1;
    return token;
  }

  private match(value: string): boolean {
    const token = this.peek();
    if (token?.type === "op" && token.value === value) {
      this.position += 1;
      return true;
    }
    return false;
  }

  parse(): number {
    const value = this.parseAdditive();
    if (this.position < this.tokens.length) {
      throw new CalculatorError("Unexpected token after expression.");
    }
    return value;
  }

  private parseAdditive(): number {
    let left = this.parseMultiplicative();
    for (;;) {
      if (this.match("+")) left += this.parseMultiplicative();
      else if (this.match("-")) left -= this.parseMultiplicative();
      else return left;
    }
  }

  private parseMultiplicative(): number {
    let left = this.parseUnary();
    for (;;) {
      if (this.match("*")) left *= this.parseUnary();
      else if (this.match("/")) {
        const right = this.parseUnary();
        if (right === 0) throw new CalculatorError("Division by zero is not defined.");
        left /= right;
      } else if (this.match("%")) {
        const right = this.parseUnary();
        if (right === 0) throw new CalculatorError("Modulo by zero is not defined.");
        left %= right;
      } else return left;
    }
  }

  private parseUnary(): number {
    if (this.match("-")) return -this.parseUnary();
    if (this.match("+")) return this.parseUnary();
    return this.parsePower();
  }

  private parsePower(): number {
    const base = this.parsePrimary();
    if (this.match("^")) return Math.pow(base, this.parseUnary()); // right-associative
    return base;
  }

  private parsePrimary(): number {
    const token = this.next();

    if (token.type === "number") {
      return token.percent ? token.value / 100 : token.value;
    }

    if (token.type === "lparen") {
      const value = this.parseAdditive();
      if (this.next().type !== "rparen") {
        throw new CalculatorError("Missing closing parenthesis.");
      }
      return value;
    }

    if (token.type === "ident") {
      if (token.value in CONSTANTS) return CONSTANTS[token.value];

      if (FUNCTIONS.has(token.value)) {
        if (this.next().type !== "lparen") {
          throw new CalculatorError(`${token.value}() requires parentheses.`);
        }
        const args = [this.parseAdditive()];
        while (this.peek()?.type === "comma") {
          this.position += 1;
          args.push(this.parseAdditive());
        }
        if (this.next().type !== "rparen") {
          throw new CalculatorError(`Missing closing parenthesis for ${token.value}().`);
        }
        return applyFunction(token.value, args);
      }

      throw new CalculatorError(
        `Unknown name "${token.value}". Allowed functions: ${[...FUNCTIONS].join(", ")}.`,
      );
    }

    throw new CalculatorError(
      `Unexpected token "${token.type === "op" ? token.value : token.type}".`,
    );
  }
}

function applyFunction(name: string, args: number[]): number {
  switch (name) {
    case "sqrt":
      return Math.sqrt(requireArgs(name, args, 1)[0]);
    case "abs":
      return Math.abs(requireArgs(name, args, 1)[0]);
    case "round":
      return Math.round(requireArgs(name, args, 1)[0]);
    case "floor":
      return Math.floor(requireArgs(name, args, 1)[0]);
    case "ceil":
      return Math.ceil(requireArgs(name, args, 1)[0]);
    case "min":
      return Math.min(...requireArgs(name, args, 1));
    case "max":
      return Math.max(...requireArgs(name, args, 1));
    case "log10":
      return Math.log10(requireArgs(name, args, 1)[0]);
    case "ln":
      return Math.log(requireArgs(name, args, 1)[0]);
    case "exp":
      return Math.exp(requireArgs(name, args, 1)[0]);
    case "pow": {
      const [base, exponent] = requireArgs(name, args, 2);
      return Math.pow(base, exponent);
    }
    case "sin":
      return Math.sin(requireArgs(name, args, 1)[0]);
    case "cos":
      return Math.cos(requireArgs(name, args, 1)[0]);
    case "tan":
      return Math.tan(requireArgs(name, args, 1)[0]);
    case "asin":
      return Math.asin(requireArgs(name, args, 1)[0]);
    case "acos":
      return Math.acos(requireArgs(name, args, 1)[0]);
    case "atan":
      return Math.atan(requireArgs(name, args, 1)[0]);
    default:
      throw new CalculatorError(`Unsupported function: ${name}`);
  }
}

function requireArgs(name: string, args: number[], count: number) {
  if (args.length < count) {
    throw new CalculatorError(`${name}() requires ${count} argument${count > 1 ? "s" : ""}.`);
  }
  return args;
}

export function evaluateMathExpression(expression: string): number {
  const trimmed = expression.trim();
  if (!trimmed) throw new CalculatorError("An empty expression cannot be evaluated.");

  // "15% of 250" → 0.15 × 250
  const ofMatch = trimmed.match(/^\s*(\d+(?:\.\d+)?)\s*%\s+of\s+(.+)$/i);
  if (ofMatch) {
    const percent = Number(ofMatch[1]) / 100;
    const rest = evaluateMathExpression(ofMatch[2]);
    return percent * rest;
  }

  return new Parser(tokenize(trimmed)).parse();
}

// --- Unit conversion --------------------------------------------------------

const LENGTH: Record<string, number> = {
  m: 1,
  km: 1000,
  cm: 0.01,
  mm: 0.001,
  mi: 1609.344,
  yd: 0.9144,
  ft: 0.3048,
  in: 0.0254,
  nm: 1852, // nautical mile
};

const MASS: Record<string, number> = {
  kg: 1,
  g: 0.001,
  mg: 1e-6,
  t: 1000,
  lb: 0.45359237,
  oz: 0.028349523125,
};

const TIME: Record<string, number> = {
  ms: 0.001,
  s: 1,
  min: 60,
  h: 3600,
  day: 86400,
  wk: 604800,
  yr: 31536000,
};

const DATA: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 ** 2,
  gb: 1024 ** 3,
  tb: 1024 ** 4,
};

const VOLUME: Record<string, number> = {
  ml: 0.001,
  l: 1,
  "fl oz": 0.0295735295625,
  cup: 0.2365882365,
  pt: 0.473176473,
  qt: 0.946352946,
  gal: 3.785411784,
  tbsp: 0.01478676478125,
  tsp: 0.00492892159375,
  m3: 1000,
};

const UNIT_ALIASES: Record<string, string> = {
  meters: "m",
  metre: "m",
  metres: "m",
  kilometer: "km",
  kilometers: "km",
  kilometre: "km",
  centimetre: "cm",
  centimeters: "cm",
  centimetres: "cm",
  millimetre: "mm",
  millimeters: "mm",
  millimetres: "mm",
  mile: "mi",
  miles: "mi",
  yard: "yd",
  yards: "yd",
  foot: "ft",
  feet: "ft",
  inch: "in",
  inches: "in",
  "nautical mile": "nm",
  "nautical miles": "nm",
  kilogram: "kg",
  kilograms: "kg",
  gram: "g",
  grams: "g",
  milligram: "mg",
  milligrams: "mg",
  tonne: "t",
  ton: "t",
  pound: "lb",
  pounds: "lb",
  lbs: "lb",
  ounce: "oz",
  ounces: "oz",
  millisecond: "ms",
  milliseconds: "ms",
  second: "s",
  seconds: "s",
  minute: "min",
  minutes: "min",
  hour: "h",
  hours: "h",
  hr: "h",
  hrs: "h",
  day: "day",
  days: "day",
  week: "wk",
  weeks: "wk",
  year: "yr",
  years: "yr",
  byte: "b",
  bytes: "b",
  kilobyte: "kb",
  kilobytes: "kb",
  megabyte: "mb",
  megabytes: "mb",
  gigabyte: "gb",
  gigabytes: "gb",
  terabyte: "tb",
  terabytes: "tb",
  liter: "l",
  liters: "l",
  litre: "l",
  litres: "l",
  milliliter: "ml",
  milliliters: "ml",
  millilitre: "ml",
  millilitres: "ml",
  gallon: "gal",
  gallons: "gal",
  quart: "qt",
  quarts: "qt",
  pint: "pt",
  pints: "pt",
  cup: "cup",
  cups: "cup",
  tablespoon: "tbsp",
  tablespoons: "tbsp",
  teaspoon: "tsp",
  teaspoons: "tsp",
  celsius: "c",
  celsius_scale: "c",
  centigrade: "c",
  fahrenheit: "f",
  fahrenheit_scale: "f",
  kelvin_scale: "k",
};

const TEMPERATURE = new Set(["c", "f", "k"]);

function normalizeUnit(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  return UNIT_ALIASES[normalized] ?? normalized;
}

function temperatureConvert(value: number, from: string, to: string): number | null {
  if (!TEMPERATURE.has(from) || !TEMPERATURE.has(to)) return null;
  // Convert through Celsius.
  let celsius: number;
  if (from === "c") celsius = value;
  else if (from === "f") celsius = ((value - 32) * 5) / 9;
  else celsius = value - 273.15;

  if (to === "c") return celsius;
  if (to === "f") return (celsius * 9) / 5 + 32;
  return celsius + 273.15;
}

const UNIT_TABLES: Array<Record<string, number>> = [LENGTH, MASS, TIME, DATA, VOLUME];

function convertUnit(value: number, from: string, to: string): number {
  const temperature = temperatureConvert(value, from, to);
  if (temperature !== null) return temperature;

  for (const table of UNIT_TABLES) {
    if (from in table && to in table) {
      return (value * table[from]) / table[to];
    }
  }

  const known = new Set<string>();
  for (const table of UNIT_TABLES) {
    for (const key of Object.keys(table)) known.add(key);
  }
  throw new CalculatorError(
    `Cannot convert "${from}" to "${to}". Supported units: ${[...known].sort().join(", ")} (or use a currency code like USD, EUR, GBP).`,
  );
}

// --- Currency conversion ----------------------------------------------------

const CURRENCY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const currencyCache = new Map<string, { rates: Record<string, number>; fetchedAt: number }>();

async function fetchCurrencyRates(base: string): Promise<Record<string, number>> {
  const cached = currencyCache.get(base);
  if (cached && Date.now() - cached.fetchedAt < CURRENCY_CACHE_TTL_MS) {
    return cached.rates;
  }

  const response = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new CalculatorError("Currency conversion service is temporarily unavailable.");
  }
  const data = (await response.json()) as {
    result?: string;
    rates?: Record<string, number>;
  };
  if (data.result !== "success" || !data.rates) {
    throw new CalculatorError(`Unknown currency code "${base}". Use a 3-letter code like USD, EUR, GBP, JPY.`);
  }
  currencyCache.set(base, { rates: data.rates, fetchedAt: Date.now() });
  return data.rates;
}

const CURRENCY_ALIASES: Record<string, string> = {
  dollars: "USD",
  dollar: "USD",
  usd: "USD",
  us: "USD",
  euro: "EUR",
  euros: "EUR",
  eur: "EUR",
  pounds: "GBP",
  pound: "GBP",
  gbp: "GBP",
  yens: "JPY",
  yen: "JPY",
  jpy: "JPY",
  pesos: "PHP",
  peso: "PHP",
  php: "PHP",
  cad: "CAD",
  aud: "AUD",
  chf: "CHF",
  inr: "INR",
  cny: "CNY",
  krw: "KRW",
  sgd: "SGD",
  mxn: "MXN",
};

export async function convertValue(
  value: number,
  from: string,
  to: string,
): Promise<{ result: number; from: string; to: string }> {
  const fromUnit = normalizeUnit(from);
  const toUnit = normalizeUnit(to);

  // Units first: several unit codes (km, ft, min, day, gal, cup, tsp) look
  // like 3-letter currency codes, so only fall through to currency when the
  // pair is not a valid unit pair.
  if (isKnownUnit(fromUnit) && isKnownUnit(toUnit)) {
    return { result: convertUnit(value, fromUnit, toUnit), from, to };
  }

  const fromCode = (CURRENCY_ALIASES[from.trim().toLowerCase()] ?? from.trim()).toUpperCase();
  const toCode = (CURRENCY_ALIASES[to.trim().toLowerCase()] ?? to.trim()).toUpperCase();

  if (/^[A-Z]{3}$/.test(fromCode) && /^[A-Z]{3}$/.test(toCode)) {
    const rates = await fetchCurrencyRates(fromCode);
    const rate = rates[toCode];
    if (rate === undefined) {
      throw new CalculatorError(`Unknown currency code "${toCode}".`);
    }
    return { result: value * rate, from: fromCode, to: toCode };
  }

  throw new CalculatorError(
    `Cannot convert "${from}" to "${to}". Use supported units or 3-letter currency codes like USD, EUR, GBP.`,
  );
}

function isKnownUnit(unit: string): boolean {
  if (TEMPERATURE.has(unit)) return true;
  return UNIT_TABLES.some((table) => unit in table);
}

// --- Tool -------------------------------------------------------------------

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new CalculatorError("The expression produced an infinite or undefined result.");
  }
  return new Intl.NumberFormat("en-US", { maximumSignificantDigits: 12 }).format(value);
}

const convertSchema = z.object({
  value: z.number(),
  from: z.string().trim().min(1).max(30),
  to: z.string().trim().min(1).max(30),
});

export function createCalculatorTool() {
  return {
    calculate: {
      description:
        "Evaluate math expressions with exact arithmetic and convert between units or currencies. Use this for any arithmetic the user asks about instead of doing math in your head. Expressions support + - * / ^ % ( ) and functions sqrt(), abs(), round(), floor(), ceil(), min(), max(), pow(), ln(), log10(), exp(), sin(), cos(), tan(), plus constants pi and e. A % attached to a number is a percentage (50% = 0.5) and \"15% of 250\" works as a phrase. For percent increases use e.g. \"250 * 1.15\". Use the convert field for unit conversions (length, mass, time, data, volume, temperature) or live currency conversion (e.g. from: \"USD\", to: \"EUR\").",
      inputSchema: z.object({
        expression: z
          .string()
          .trim()
          .min(1)
          .max(500)
          .describe("Math expression, e.g. \"(1200 + 350) * 0.85\", \"2^10\", \"sqrt(144)\", \"15% of 250\"")
          .optional(),
        convert: convertSchema
          .describe("Unit or currency conversion, e.g. { value: 5, from: \"km\", to: \"mi\" } or { value: 100, from: \"USD\", to: \"EUR\" }")
          .optional(),
      }),
      execute: async (input: {
        expression?: string;
        convert?: { value: number; from: string; to: string };
      }) => {
        if (input.convert) {
          const { result, from, to } = await convertValue(
            input.convert.value,
            input.convert.from,
            input.convert.to,
          );
          return {
            result,
            formatted: `${formatNumber(input.convert.value)} ${from} = ${formatNumber(result)} ${to}`,
            note: "Currency rates are live but may be up to a few hours old. Verify against an official source for critical decisions.",
          };
        }

        if (!input.expression) {
          throw new CalculatorError("Provide either an expression or a convert object.");
        }
        const result = evaluateMathExpression(input.expression);
        return {
          expression: input.expression,
          result,
          formatted: `${input.expression} = ${formatNumber(result)}`,
        };
      },
    },
  };
}
