/**
 * Custom error classes for the Kimi provider.
 * @module
 */

import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';
import { z } from 'zod/v4';

// ============================================================================
// Error Schema
// ============================================================================

/**
 * Zod schema for Kimi API error responses.
 * Handles both standard OpenAI-style errors and simple message errors.
 */
export const kimiErrorSchema = z.union([
  z.object({
    error: z.object({
      message: z.string(),
      type: z.string().nullish(),
      param: z.string().nullish(),
      code: z.union([z.string(), z.number()]).nullish(),
      request_id: z.string().nullish()
    })
  }),
  z.object({
    message: z.string()
  })
]);

/**
 * Type for Kimi API error data.
 */
export type KimiErrorData = z.infer<typeof kimiErrorSchema>;

// ============================================================================
// Error Handler
// ============================================================================

/**
 * Failed response handler for Kimi API errors.
 * Parses error responses and creates appropriate error objects.
 */
export const kimiFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: kimiErrorSchema,
  errorToMessage: (error: KimiErrorData) => {
    if ('error' in error) {
      return error.error.message;
    }
    return error.message;
  },
  isRetryable: (response) =>
    response.status === 408 || response.status === 409 || response.status === 429 || response.status >= 500
});

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Base error class for Kimi provider errors.
 */
export class KimiError extends Error {
  readonly code: string;
  readonly statusCode?: number;

  constructor(message: string, code: string, statusCode?: number) {
    super(message);
    this.name = 'KimiError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Error thrown when authentication fails.
 */
export class KimiAuthenticationError extends KimiError {
  constructor(message: string = 'Invalid API key or authentication failed') {
    super(message, 'authentication_error', 401);
    this.name = 'KimiAuthenticationError';
  }
}

/**
 * Error thrown when rate limit is exceeded.
 */
export class KimiRateLimitError extends KimiError {
  readonly retryAfter?: number;

  constructor(message: string = 'Rate limit exceeded', retryAfter?: number) {
    super(message, 'rate_limit_error', 429);
    this.name = 'KimiRateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Error thrown when the request is invalid.
 */
export class KimiValidationError extends KimiError {
  constructor(message: string, param?: string) {
    super(param ? `${message} (param: ${param})` : message, 'validation_error', 400);
    this.name = 'KimiValidationError';
  }
}

/**
 * Error thrown when a model is not found.
 */
export class KimiModelNotFoundError extends KimiError {
  readonly modelId: string;

  constructor(modelId: string) {
    super(`Model '${modelId}' not found`, 'model_not_found', 404);
    this.name = 'KimiModelNotFoundError';
    this.modelId = modelId;
  }
}

/**
 * Error thrown when content is filtered.
 */
export class KimiContentFilterError extends KimiError {
  constructor(message: string = 'Content was filtered due to policy violation') {
    super(message, 'content_filter', 400);
    this.name = 'KimiContentFilterError';
  }
}

/**
 * Error thrown when context length is exceeded.
 */
export class KimiContextLengthError extends KimiError {
  constructor(message: string = 'Context length exceeded') {
    super(message, 'context_length_exceeded', 400);
    this.name = 'KimiContextLengthError';
  }
}
