import { type Request, type Response, type NextFunction, type RequestHandler } from "express";
import { z, type ZodTypeAny } from "zod";
import { serialiseError } from "@travel/contracts";

// Express type augmentation for typed parsed values
declare global {
  namespace Express {
    interface Request {
      parsedBody?: unknown;
      parsedQuery?: unknown;
      parsedParams?: unknown;
      parsedHeaders?: unknown;
      traceId?: string;
    }
  }
}

export interface ValidateRequestOptions {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
  headers?: ZodTypeAny;
}

/**
 * Creates validation middleware for one or more request locations.
 * Schemas are resolved ONCE at route registration (module scope), not per request.
 * The Stripe webhook route must NOT use this middleware — use rawBody + signature header instead.
 */
export function validateRequest(options: ValidateRequestOptions): RequestHandler {
  const { body: bodySchema, query: querySchema, params: paramsSchema, headers: headersSchema } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const traceId = req.traceId ?? req.headers["x-correlation-id"] as string | undefined;

    // Validate body
    if (bodySchema) {
      const result = bodySchema.safeParse(req.body);
      if (!result.success) {
        const { envelope, status } = serialiseError(result.error, traceId);
        res.status(status).json(envelope);
        return;
      }
      req.parsedBody = result.data;
    }

    // Validate query
    if (querySchema) {
      const result = querySchema.safeParse(req.query);
      if (!result.success) {
        const { envelope, status } = serialiseError(result.error, traceId);
        res.status(status).json(envelope);
        return;
      }
      req.parsedQuery = result.data;
    }

    // Validate params
    if (paramsSchema) {
      const result = paramsSchema.safeParse(req.params);
      if (!result.success) {
        const { envelope, status } = serialiseError(result.error, traceId);
        res.status(status).json(envelope);
        return;
      }
      req.parsedParams = result.data;
    }

    // Validate headers
    if (headersSchema) {
      const result = headersSchema.safeParse(req.headers);
      if (!result.success) {
        const { envelope, status } = serialiseError(result.error, traceId);
        res.status(status).json(envelope);
        return;
      }
      req.parsedHeaders = result.data;
    }

    next();
  };
}
