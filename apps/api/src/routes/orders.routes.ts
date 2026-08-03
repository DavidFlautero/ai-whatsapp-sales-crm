import {
  Router,
} from "express";

import type {
  Request,
  Response,
} from "express";

import {
  z,
  ZodError,
} from "zod";

import {
  requirePermission,
} from "../core/http/permission.middleware.js";

import {
  createOrder,
  getOrder,
  listOrders,
  recordPayment,
  transitionFulfillment,
} from "../services/orders/order.service.js";

export const ordersRoutes =
  Router();

const uuidSchema =
  z.string().uuid();

const createOrderSchema =
  z.object({
    customer:
      z.record(
        z.string(),
        z.unknown(),
      ),

    lines:
      z.array(
        z.record(
          z.string(),
          z.unknown(),
        ),
      )
        .min(1)
        .max(500),

    options:
      z.record(
        z.string(),
        z.unknown(),
      )
        .optional(),
  });

const paymentSchema =
  z.object({
    amount:
      z.coerce
        .number()
        .positive(),

    method:
      z.string()
        .trim()
        .min(1)
        .max(80),

    reference:
      z.string()
        .trim()
        .max(200)
        .nullable()
        .optional(),
  });

const fulfillmentSchema =
  z.object({
    action:
      z.string()
        .trim()
        .min(1)
        .max(80),

    payload:
      z.record(
        z.string(),
        z.unknown(),
      )
        .optional(),
  });

function companyId(
  request: Request,
) {
  const value =
    request
      .tenantContext
      ?.effectiveCompanyId;

  if (!value) {
    throw new Error(
      "COMPANY_CONTEXT_NOT_RESOLVED",
    );
  }

  return value;
}

function actor(
  request: Request,
) {
  if (!request.authUser) {
    throw new Error(
      "AUTHENTICATED_USER_NOT_FOUND",
    );
  }

  return {
    id:
      request.authUser.id,

    name:
      request.authUser.name,

    email:
      request.authUser.email,

    role:
      request.authUser.role,
  };
}

function handleError(
  error: unknown,
  response: Response,
) {
  if (
    error instanceof
      ZodError
  ) {
    return response
      .status(400)
      .json({
        ok: false,
        error:
          "VALIDATION_ERROR",
        issues:
          error.issues,
      });
  }

  console.error(
    "[ORDERS]",
    error,
  );

  return response
    .status(500)
    .json({
      ok: false,
      error:
        "ORDER_OPERATION_FAILED",
      message:
        error instanceof Error
          ? error.message
          : "No fue posible completar la operación.",
    });
}

ordersRoutes.get(
  "/",

  requirePermission(
    "orders.read",
  ),

  async (
    request: Request,
    response: Response,
  ) => {
    try {
      const orders =
        await listOrders(
          companyId(request),
        );

      return response.json({
        ok: true,
        orders,
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);

ordersRoutes.get(
  "/:orderId",

  requirePermission(
    "orders.read",
  ),

  async (
    request: Request,
    response: Response,
  ) => {
    try {
      const orderId =
        uuidSchema.parse(
          request.params.orderId,
        );

      const order =
        await getOrder(
          companyId(request),
          orderId,
        );

      if (!order) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "ORDER_NOT_FOUND",
          });
      }

      return response.json({
        ok: true,
        order,
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);

ordersRoutes.post(
  "/",

  requirePermission(
    "orders.create",
  ),

  async (
    request: Request,
    response: Response,
  ) => {
    try {
      const input =
        createOrderSchema.parse(
          request.body,
        );

      const order =
        await createOrder(
          companyId(request),
          input,
          actor(request),
        );

      return response
        .status(201)
        .json({
          ok: true,
          order,
        });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);

ordersRoutes.post(
  "/:orderId/payments",

  requirePermission(
    "orders.update",
  ),

  async (
    request: Request,
    response: Response,
  ) => {
    try {
      const orderId =
        uuidSchema.parse(
          request.params.orderId,
        );

      const input =
        paymentSchema.parse(
          request.body,
        );

      const result =
        await recordPayment(
          companyId(request),
          orderId,
          input,
          actor(request),
        );

      if (!result) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "ORDER_NOT_FOUND",
          });
      }

      return response.json({
        ok: true,
        result,
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);

ordersRoutes.post(
  "/:orderId/fulfillment",

  requirePermission(
    "fulfillment.manage",
  ),

  async (
    request: Request,
    response: Response,
  ) => {
    try {
      const orderId =
        uuidSchema.parse(
          request.params.orderId,
        );

      const input =
        fulfillmentSchema.parse(
          request.body,
        );

      const result =
        await transitionFulfillment(
          companyId(request),
          orderId,
          input,
          actor(request),
        );

      if (!result) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "ORDER_NOT_FOUND",
          });
      }

      return response.json({
        ok: true,
        result,
      });
    } catch (error) {
      return handleError(
        error,
        response,
      );
    }
  },
);
