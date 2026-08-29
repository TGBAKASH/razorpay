/**
 * Centralized dashboard client configuration.
 * Always reads environment variables (NEXT_PUBLIC_*) with safe fallbacks.
 * Never hardcodes production URLs or keys.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export const RAZORPAY_KEY_ID =
  process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_placeholder_key_id';
