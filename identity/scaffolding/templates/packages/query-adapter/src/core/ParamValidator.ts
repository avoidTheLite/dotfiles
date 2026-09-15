export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/**
 * Future seam: validate dynamic query parameters (correctness) before QueryGuard
 * (resource cost). Not implemented in this package yet.
 */
export interface ParamValidator {
  validate(query: string, params: unknown[]): ValidationResult;
}
