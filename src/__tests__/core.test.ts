import { describe, expect, it } from 'vitest';
import {
  KimiAuthenticationError,
  KimiContentFilterError,
  KimiContextLengthError,
  KimiError,
  KimiModelNotFoundError,
  KimiRateLimitError,
  KimiValidationError,
  kimiErrorSchema
} from '../core';

describe('KimiError', () => {
  it('should create a base error', () => {
    const error = new KimiError('Test error', 'test_code', 500);
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('test_code');
    expect(error.statusCode).toBe(500);
    expect(error.name).toBe('KimiError');
  });

  it('should work without status code', () => {
    const error = new KimiError('Test error', 'test_code');
    expect(error.statusCode).toBeUndefined();
  });
});

describe('KimiAuthenticationError', () => {
  it('should create authentication error with default message', () => {
    const error = new KimiAuthenticationError();
    expect(error.message).toBe('Invalid API key or authentication failed');
    expect(error.code).toBe('authentication_error');
    expect(error.statusCode).toBe(401);
    expect(error.name).toBe('KimiAuthenticationError');
  });

  it('should create authentication error with custom message', () => {
    const error = new KimiAuthenticationError('Custom auth error');
    expect(error.message).toBe('Custom auth error');
  });
});

describe('KimiRateLimitError', () => {
  it('should create rate limit error with default message', () => {
    const error = new KimiRateLimitError();
    expect(error.message).toBe('Rate limit exceeded');
    expect(error.code).toBe('rate_limit_error');
    expect(error.statusCode).toBe(429);
    expect(error.name).toBe('KimiRateLimitError');
  });

  it('should include retry after', () => {
    const error = new KimiRateLimitError('Too many requests', 30);
    expect(error.retryAfter).toBe(30);
  });
});

describe('KimiValidationError', () => {
  it('should create validation error', () => {
    const error = new KimiValidationError('Invalid parameter');
    expect(error.message).toBe('Invalid parameter');
    expect(error.code).toBe('validation_error');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('KimiValidationError');
  });

  it('should include param in message', () => {
    const error = new KimiValidationError('Invalid value', 'temperature');
    expect(error.message).toBe('Invalid value (param: temperature)');
  });
});

describe('KimiModelNotFoundError', () => {
  it('should create model not found error', () => {
    const error = new KimiModelNotFoundError('kimi-invalid');
    expect(error.message).toBe("Model 'kimi-invalid' not found");
    expect(error.code).toBe('model_not_found');
    expect(error.statusCode).toBe(404);
    expect(error.modelId).toBe('kimi-invalid');
    expect(error.name).toBe('KimiModelNotFoundError');
  });
});

describe('KimiContentFilterError', () => {
  it('should create content filter error with default message', () => {
    const error = new KimiContentFilterError();
    expect(error.message).toBe('Content was filtered due to policy violation');
    expect(error.code).toBe('content_filter');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('KimiContentFilterError');
  });
});

describe('KimiContextLengthError', () => {
  it('should create context length error with default message', () => {
    const error = new KimiContextLengthError();
    expect(error.message).toBe('Context length exceeded');
    expect(error.code).toBe('context_length_exceeded');
    expect(error.statusCode).toBe(400);
    expect(error.name).toBe('KimiContextLengthError');
  });

  it('should create with custom message', () => {
    const error = new KimiContextLengthError('Max 128k tokens exceeded');
    expect(error.message).toBe('Max 128k tokens exceeded');
  });
});

describe('kimiErrorSchema', () => {
  it('should parse standard error response', () => {
    const result = kimiErrorSchema.safeParse({
      error: {
        message: 'Invalid API key',
        type: 'authentication_error',
        code: 'invalid_api_key'
      }
    });

    expect(result.success).toBe(true);
    if (result.success && 'error' in result.data) {
      expect(result.data.error.message).toBe('Invalid API key');
      expect(result.data.error.type).toBe('authentication_error');
      expect(result.data.error.code).toBe('invalid_api_key');
    }
  });

  it('should parse error with minimal fields', () => {
    const result = kimiErrorSchema.safeParse({
      error: {
        message: 'Something went wrong'
      }
    });

    expect(result.success).toBe(true);
    if (result.success && 'error' in result.data) {
      expect(result.data.error.message).toBe('Something went wrong');
    }
  });

  it('should parse simple message error format', () => {
    const result = kimiErrorSchema.safeParse({
      message: 'Simple error message'
    });

    expect(result.success).toBe(true);
    if (result.success && 'message' in result.data) {
      expect(result.data.message).toBe('Simple error message');
    }
  });

  it('should parse error with numeric code', () => {
    const result = kimiErrorSchema.safeParse({
      error: {
        message: 'Rate limit exceeded',
        code: 429
      }
    });

    expect(result.success).toBe(true);
    if (result.success && 'error' in result.data) {
      expect(result.data.error.code).toBe(429);
    }
  });

  it('should fail for completely invalid structure', () => {
    const result = kimiErrorSchema.safeParse({
      invalid: 'structure'
    });

    expect(result.success).toBe(false);
  });
});
