import { z } from 'zod/v4';
import { createJsonErrorResponseHandler } from '@ai-sdk/provider-utils';

export const kimiErrorSchema = z.union([
  z.object({
    error: z.object({
      message: z.string(),
      type: z.string().nullish(),
      param: z.any().nullish(),
      code: z.union([z.string(), z.number()]).nullish(),
      request_id: z.string().nullish(),
    }),
  }),
  z.object({
    message: z.string(),
  }),
]);

type KimiErrorData = z.infer<typeof kimiErrorSchema>;

export const kimiFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: kimiErrorSchema,
  errorToMessage: (error: KimiErrorData) => {
    if ('error' in error) {
      return error.error.message;
    }

    return error.message;
  },
  isRetryable: response =>
    response.status === 408 ||
    response.status === 409 ||
    response.status === 429 ||
    response.status >= 500,
});
