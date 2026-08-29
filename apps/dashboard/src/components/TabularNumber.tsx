'use client';

import React from 'react';

interface TabularNumberProps {
  value: number | string;
  prefix?: string;
  suffix?: string;
  isCurrencyPaise?: boolean;
  className?: string;
}

export function TabularNumber({
  value,
  prefix = '',
  suffix = '',
  isCurrencyPaise = false,
  className = '',
}: TabularNumberProps) {
  let displayValue = value;

  if (isCurrencyPaise && typeof value === 'number') {
    displayValue = Math.round(value / 100).toLocaleString('en-IN');
  } else if (typeof value === 'number') {
    displayValue = value.toLocaleString('en-IN');
  }

  return (
    <span
      className={`font-mono tabular-nums tracking-tight ${className}`}
      data-ticker="true"
    >
      {prefix}
      {displayValue}
      {suffix}
    </span>
  );
}
