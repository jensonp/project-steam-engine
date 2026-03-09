import Opossum from 'opossum';

export const circuitBreakerOptions = {
  timeout: 10000, // If our function takes longer than 10 seconds, trigger a failure
  errorThresholdPercentage: 50, // When 50% of requests fail, trip the circuit
  resetTimeout: 30000 // After 30 seconds, try again.
};

// Error mapping for Circuit Breaker to differentiate between business errors (404) and system errors (500)
export function isSteamSystemError(error: any): boolean {
  if (error?.response?.status) {
    const status = error.response.status;
    // 401/403 (Private Profile), 404 (Not Found) are business errors, don't trip circuit
    if (status === 401 || status === 403 || status === 404) return false;
    // 429 (Rate Limit), 5xx (Server Error) are system errors, should trip circuit
    if (status === 429 || status >= 500) return true;
  }
  // Network timeouts, DNS issues, etc. should trip circuit
  return true;
}
