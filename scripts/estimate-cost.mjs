#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SCENARIOS = ["minimum", "expected", "high_failure"];

function printHelp() {
  console.log(`Usage:
  node estimate-cost.mjs --input <project.json> [options]

Options:
  -i, --input <path>          Project JSON containing cost_inputs.
  -o, --output <path>         Write the estimate to a file.
      --currency <ISO-4217>   Override base currency.
      --round <digits>        Decimal places (default: 2).
      --pretty                Pretty-print JSON (default).
      --compact               Emit compact JSON.
  -h, --help                  Show this help.

Expected project fragment:
  {
    "cost_inputs": {
      "currency": "CNY",
      "assumptions": {
        "default_tax_rate": 0.06,
        "payment_fee_rate": 0.01,
        "contingency_rates": {
          "minimum": 0.03,
          "expected": 0.10,
          "high_failure": 0.25
        }
      },
      "line_items": [{
        "line_item_id": "generation",
        "unit_price": 10,
        "quantity_distribution": {
          "low": 8,
          "expected": 16,
          "high_failure": 30
        }
      }]
    }
  }

The estimate reports minimum, expected, and high_failure scenarios.
Unknown prices are reported, never invented.
`);
}

function parseArgs(argv) {
  const options = { digits: 2, pretty: true };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) throw new Error(`Missing value for ${arg}`);
      index += 1;
      return value;
    };
    if (arg === "-h" || arg === "--help") options.help = true;
    else if (arg === "-i" || arg === "--input") options.input = next();
    else if (arg === "-o" || arg === "--output") options.output = next();
    else if (arg === "--currency") options.currency = next().toUpperCase();
    else if (arg === "--round") options.digits = Number(next());
    else if (arg === "--pretty") options.pretty = true;
    else if (arg === "--compact") options.pretty = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.help && !options.input) throw new Error("--input is required");
  if (!Number.isInteger(options.digits) || options.digits < 0 || options.digits > 8) {
    throw new Error("--round must be an integer from 0 to 8");
  }
  if (options.currency && !/^[A-Z]{3}$/.test(options.currency)) {
    throw new Error("--currency must be a three-letter ISO-style code");
  }
  return options;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read JSON from ${path}: ${error.message}`);
  }
}

function asNonNegativeNumber(value, label, errors, { allowUndefined = true } = {}) {
  if (value === undefined || value === null) {
    if (!allowUndefined) errors.push(`${label} is required`);
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    errors.push(`${label} must be a finite non-negative number`);
    return undefined;
  }
  return value;
}

function scenarioValues(value, aliases = {}) {
  if (typeof value === "number") {
    return { minimum: value, expected: value, high_failure: value };
  }
  const source = value && typeof value === "object" ? value : {};
  const minimum =
    source.minimum ?? source.low ?? source.min ?? aliases.minimum;
  const expected =
    source.expected ?? source.mean ?? source.p50 ?? aliases.expected ?? minimum;
  const high =
    source.high_failure ??
    source.high ??
    source.p90 ??
    source.max ??
    aliases.high_failure ??
    expected;
  return { minimum, expected, high_failure: high };
}

function rounder(digits) {
  const factor = 10 ** digits;
  return (value) => Math.round((value + Number.EPSILON) * factor) / factor;
}

function convertPrice(item, scenario, baseCurrency, errors, assumptions) {
  const sourceCurrency = item.source_currency ?? item.currency ?? baseCurrency;
  const priceValues = scenarioValues(
    item.unit_price_distribution ?? item.unit_price,
  );
  const raw = asNonNegativeNumber(
    priceValues[scenario],
    `${item.line_item_id}.unit_price.${scenario}`,
    errors,
    { allowUndefined: false },
  );
  if (raw === undefined) return undefined;
  if (sourceCurrency === baseCurrency) return raw;

  const rateValues = scenarioValues(item.exchange_rate);
  const rate = asNonNegativeNumber(
    rateValues[scenario],
    `${item.line_item_id}.exchange_rate.${scenario}`,
    errors,
    { allowUndefined: false },
  );
  if (rate === undefined) return undefined;
  assumptions.push(
    `${item.line_item_id}: converted ${sourceCurrency} to ${baseCurrency} using supplied ${scenario} exchange rate ${rate}.`,
  );
  return raw * rate;
}

function normalizeLineItem(item, index, baseCurrency, globalAssumptions, errors) {
  const id = item.line_item_id ?? item.id ?? `line-${index + 1}`;
  const normalized = { line_item_id: id, category: item.category ?? "other" };
  const quantityValues = scenarioValues(
    item.quantity_distribution ?? item.quantity,
    { minimum: 1, expected: 1, high_failure: 1 },
  );
  const fixedValues = scenarioValues(item.fixed_cost ?? 0);
  const itemAssumptions = [];
  normalized.scenarios = {};

  for (const scenario of SCENARIOS) {
    const quantity = asNonNegativeNumber(
      quantityValues[scenario],
      `${id}.quantity.${scenario}`,
      errors,
      { allowUndefined: false },
    );
    const unitPrice = convertPrice(
      { ...item, line_item_id: id },
      scenario,
      baseCurrency,
      errors,
      itemAssumptions,
    );
    const fixedCost = asNonNegativeNumber(
      fixedValues[scenario],
      `${id}.fixed_cost.${scenario}`,
      errors,
      { allowUndefined: false },
    );
    if (quantity === undefined || unitPrice === undefined || fixedCost === undefined) {
      continue;
    }
    normalized.scenarios[scenario] = {
      quantity,
      unit_price: unitPrice,
      fixed_cost: fixedCost,
      subtotal: quantity * unitPrice + fixedCost,
    };
  }
  normalized.tax_rate =
    item.tax_included === true
      ? 0
      : item.tax_rate ?? globalAssumptions.default_tax_rate ?? 0;
  normalized.payment_fee_rate =
    item.payment_fee_rate ?? globalAssumptions.payment_fee_rate ?? 0;
  asNonNegativeNumber(normalized.tax_rate, `${id}.tax_rate`, errors);
  asNonNegativeNumber(
    normalized.payment_fee_rate,
    `${id}.payment_fee_rate`,
    errors,
  );
  if (item.tax_included === true) itemAssumptions.push(`${id}: unit price includes tax.`);
  normalized.assumptions = [...new Set(itemAssumptions)];
  return normalized;
}

function budgetStatus(totals, budget) {
  if (!budget) return { status: "unknown" };
  const hard =
    typeof budget.hard_limit === "object"
      ? budget.hard_limit.amount
      : budget.hard_limit;
  const soft =
    typeof budget.soft_limit === "object"
      ? budget.soft_limit.amount
      : budget.soft_limit;
  if (typeof hard === "number" && totals.expected.total > hard) {
    return { status: "over_hard_limit", hard_limit: hard, soft_limit: soft ?? null };
  }
  if (typeof hard === "number" && totals.high_failure.total > hard) {
    return { status: "high_failure_over_hard_limit", hard_limit: hard, soft_limit: soft ?? null };
  }
  if (typeof soft === "number" && totals.expected.total > soft) {
    return { status: "over_expected", hard_limit: hard ?? null, soft_limit: soft };
  }
  if (
    typeof soft === "number" &&
    totals.expected.total >= soft * 0.9
  ) {
    return { status: "near_limit", hard_limit: hard ?? null, soft_limit: soft };
  }
  return { status: "within", hard_limit: hard ?? null, soft_limit: soft ?? null };
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    printHelp();
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    printHelp();
    return;
  }

  const inputPath = resolve(options.input);
  if (!existsSync(inputPath)) {
    console.error(`Input file not found: ${inputPath}`);
    process.exitCode = 2;
    return;
  }

  let project;
  try {
    project = readJson(inputPath);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
    return;
  }

  const input = project.cost_inputs ?? project.cost_model ?? project.cost_estimate_inputs;
  if (!input || !Array.isArray(input.line_items) || input.line_items.length === 0) {
    console.error("Project must contain cost_inputs.line_items.");
    process.exitCode = 2;
    return;
  }

  const currency = options.currency ?? input.currency ?? input.base_currency ?? "CNY";
  if (!/^[A-Z]{3}$/.test(currency)) {
    console.error(`Invalid base currency: ${currency}`);
    process.exitCode = 2;
    return;
  }

  const errors = [];
  const assumptions = [];
  const suppliedAssumptions = input.assumptions ?? {};
  const contingency = {
    minimum:
      suppliedAssumptions.contingency_rates?.minimum ??
      suppliedAssumptions.contingency_rates?.low ??
      0,
    expected: suppliedAssumptions.contingency_rates?.expected ?? 0.1,
    high_failure:
      suppliedAssumptions.contingency_rates?.high_failure ??
      suppliedAssumptions.contingency_rates?.high ??
      0.25,
  };
  for (const scenario of SCENARIOS) {
    asNonNegativeNumber(
      contingency[scenario],
      `contingency_rates.${scenario}`,
      errors,
      { allowUndefined: false },
    );
  }
  if (!suppliedAssumptions.contingency_rates) {
    assumptions.push("Default contingency rates used: minimum 0%, expected 10%, high_failure 25%.");
  }
  if (suppliedAssumptions.default_tax_rate === undefined) {
    assumptions.push("Missing tax rates default to 0%; tax review may still be required.");
  }
  if (suppliedAssumptions.payment_fee_rate === undefined) {
    assumptions.push("Missing payment fee rates default to 0%.");
  }

  const lineItems = input.line_items.map((item, index) =>
    normalizeLineItem(item, index, currency, suppliedAssumptions, errors),
  );
  if (errors.length > 0) {
    const failure = {
      report_type: "cost-estimate-error",
      generated_at: new Date().toISOString(),
      project_id: project.project_id ?? project?.job_spec?.project_id ?? null,
      errors,
    };
    process.stdout.write(`${JSON.stringify(failure, null, 2)}\n`);
    process.exitCode = 2;
    return;
  }

  const round = rounder(options.digits);
  const totals = {};
  for (const scenario of SCENARIOS) {
    let subtotal = 0;
    let taxes = 0;
    let paymentFees = 0;
    for (const item of lineItems) {
      const itemSubtotal = item.scenarios[scenario].subtotal;
      subtotal += itemSubtotal;
      taxes += itemSubtotal * item.tax_rate;
      paymentFees += itemSubtotal * item.payment_fee_rate;
    }
    const beforeContingency = subtotal + taxes + paymentFees;
    const contingencyAmount = beforeContingency * contingency[scenario];
    totals[scenario] = {
      subtotal: round(subtotal),
      taxes: round(taxes),
      payment_fees: round(paymentFees),
      contingency_rate: contingency[scenario],
      contingency: round(contingencyAmount),
      total: round(beforeContingency + contingencyAmount),
    };
  }

  const estimate = {
    report_type: "cost-estimate",
    schema_version: "1.0.0",
    cost_estimate_id: `cost-${project.project_id ?? "project"}-${Date.now()}`,
    project_id: project.project_id ?? project?.job_spec?.project_id ?? null,
    generated_at: new Date().toISOString(),
    pricing_as_of: input.pricing_as_of ?? null,
    base_currency: currency,
    scenarios: {
      minimum: totals.minimum,
      expected: totals.expected,
      high_failure: totals.high_failure,
    },
    line_items: lineItems.map((item) => ({
      ...item,
      scenarios: Object.fromEntries(
        SCENARIOS.map((scenario) => [
          scenario,
          {
            ...item.scenarios[scenario],
            unit_price: round(item.scenarios[scenario].unit_price),
            fixed_cost: round(item.scenarios[scenario].fixed_cost),
            subtotal: round(item.scenarios[scenario].subtotal),
          },
        ]),
      ),
    })),
    assumptions: [
      ...assumptions,
      ...(Array.isArray(suppliedAssumptions.notes)
        ? suppliedAssumptions.notes
        : []),
      "Minimum is a feasible low scenario, not a guaranteed absolute minimum.",
      "Expected and high-failure totals depend on the supplied retry and quantity assumptions.",
      "Unknown or stale vendor prices must be verified before commitment.",
    ],
    excluded_costs: input.excluded_costs ?? [],
    unknown_costs: input.unknown_costs ?? [],
    budget: budgetStatus(totals, input.budget ?? project?.job_spec?.budget),
  };

  const json = JSON.stringify(estimate, null, options.pretty ? 2 : 0);
  if (options.output) writeFileSync(resolve(options.output), `${json}\n`, "utf8");
  else process.stdout.write(`${json}\n`);
}

main();
