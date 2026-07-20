import {
  canonicalizeUnsignedDecimalLiteral,
  multiplyDecimals,
  nonNegativeDecimalStringSchema,
  positiveDecimalStringSchema,
  type DecimalString,
} from "@zagvar/decimal";
import type { LosslessNumber } from "lossless-json";

const canonicalIntegerPattern = /^(?:0|[1-9]\d*)$/;

export function toPositiveDecimal(value: LosslessNumber): DecimalString {
  return positiveDecimalStringSchema.parse(canonicalizeUnsignedDecimalLiteral(value.toString()));
}

export function toNonNegativeDecimal(value: LosslessNumber): DecimalString {
  return nonNegativeDecimalStringSchema.parse(canonicalizeUnsignedDecimalLiteral(value.toString()));
}

export function multiplyNonNegativeDecimal(
  value: LosslessNumber,
  multiplier: DecimalString,
): DecimalString {
  return nonNegativeDecimalStringSchema.parse(
    multiplyDecimals(toNonNegativeDecimal(value), multiplier),
  );
}

export function toSafeNonNegativeInteger(value: LosslessNumber, field: string): number {
  const normalized = canonicalizeUnsignedDecimalLiteral(value.toString());

  if (!canonicalIntegerPattern.test(normalized)) {
    throw new RangeError(`${field} must be a non-negative integer.`);
  }

  const integer = Number(normalized);

  if (!Number.isSafeInteger(integer)) {
    throw new RangeError(`${field} must be a safe integer.`);
  }

  return integer;
}
