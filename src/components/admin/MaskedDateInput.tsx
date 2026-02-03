"use client";

import { useMemo } from "react";
import type { FocusEvent, KeyboardEvent } from "react";

type MaskedDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  name?: string;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLInputElement>) => void;
};

const MAX_DIGITS = 12; // YYYYMMDDHHmm

function extractDigits(input: string) {
  return input.replace(/\D/g, "").slice(0, MAX_DIGITS);
}

function formatDigits(digits: string) {
  const year = digits.slice(0, 4);
  const month = digits.slice(4, 6);
  const day = digits.slice(6, 8);
  const hour = digits.slice(8, 10);
  const minute = digits.slice(10, 12);

  let result = year;
  if (digits.length > 4) result += `-${month}`;
  if (digits.length > 6) result += `-${day}`;
  if (digits.length > 8) result += ` ${hour}`;
  if (digits.length > 10) result += `:${minute}`;
  return result;
}

export default function MaskedDateInput({
  value,
  onChange,
  placeholder = "YYYY-MM-DD HH:mm",
  className,
  disabled,
  name,
  onBlur,
  onKeyDown,
}: MaskedDateInputProps) {
  const formatted = useMemo(() => formatDigits(extractDigits(value)), [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      className={className}
      placeholder={placeholder}
      name={name}
      disabled={disabled}
      value={formatted}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (event.defaultPrevented) return;
        if (event.key !== "Backspace") return;
        const { selectionStart, selectionEnd } = event.currentTarget;
        if (
          selectionStart !== null &&
          selectionEnd !== null &&
          selectionStart !== selectionEnd
        ) {
          return;
        }
        event.preventDefault();
        const digits = extractDigits(value);
        const nextDigits = digits.slice(0, -1);
        onChange(formatDigits(nextDigits));
      }}
      onChange={(event) => {
        const digits = extractDigits(event.target.value);
        onChange(formatDigits(digits));
      }}
      onBlur={onBlur}
    />
  );
}
