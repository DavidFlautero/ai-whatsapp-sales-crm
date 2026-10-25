import {
  randomUUID,
} from "node:crypto";

import {
  Router,
} from "express";

import {
  z,
} from "zod";

import {
  createManagedUser,
  listManagedUsers,
  patchManagedUser,
} from "../auth/managed-users.service.js";

export const crmTeamUsersRoutes =
  Router();

const views =
  z.enum([
    "dashboard",
    "customers",
    "events",
    "providers",
    "quotes",
    "agenda",
    "conversations",
    "coordination",
    "documents",
    "finance",
    "commissions",
    "team",
    "administration",
  ]);

const actions =
  z.enum([
    "customers.create",
    "customers.edit",

    "events.create",
    "events.edit",
    "events.assign",

    "providers.view",
    "providers.edit",

    "quotes.create",
    "quotes.approve",

    "finance.view",
    "commissions.view",

    "team.manage",
  ]);

const schema =
  z.object({
    name:
      z.string()
        .trim()
        .min(2)
        .max(160),

    email:
      z.string()
        .trim()
        .email()
        .max(200),

    phone:
      z.string()
        .trim()
        .max(50)
        .optional()
        .nullable(),

    role:
      z.enum([
        "admin",
        "supervisor",
        "vendedor",
      ]),

    password:
      z.string()
        .min(10)
        .max(200),

    views:
      z.array(views),

    actions:
      z.array(actions),
  });

function companyId(
  request:
    Parameters<
      typeof crmTeamUsersRoutes.get
    >[1] extends never
      ? never
      : any,
) {
  const company =
    request.authUser
      ?.companyId;

  if (!company) {
    throw new Error(
      "COMPANY_ID_REQUIRED",
    );
  }

  return company;
}

function requireManager(
  request: any,
  response: any,
) {
  const role =
    request.authUser
      ?.role;

  if (
    role !== "owner"
    && role !== "admin"
    && role !== "superadmin"
  ) {
    response
      .status(403)
      .json({
        ok: false,
        error:
          "FORBIDDEN",
      });

    return false;
  }

  return true;
}

crmTeamUsersRoutes.get(
  "/",
  async (
    request,
    response,
  ) => {
    if (
      !requireManager(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const users =
        await listManagedUsers(
          companyId(request),
        );

      return response.json({
        ok: true,

        users:
          users.map(
            ({
              passwordHash:
                _passwordHash,
              ...user
            }) => user,
          ),
      });
    } catch (error) {
      console.error(
        "[CRM TEAM USERS]",
        error,
      );

      return response
        .status(500)
        .json({
          ok: false,
          error:
            "TEAM_USERS_LIST_FAILED",
        });
    }
  },
);

crmTeamUsersRoutes.post(
  "/",
  async (
    request,
    response,
  ) => {
    if (
      !requireManager(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const input =
        schema.parse(
          request.body,
        );

      const user =
        await createManagedUser({
          id:
            randomUUID(),

          companyId:
            companyId(request),

          ...input,
        });

      const {
        passwordHash:
          _passwordHash,
        ...safe
      } = user;

      return response
        .status(201)
        .json({
          ok: true,
          user: safe,
        });
    } catch (error) {
      console.error(
        "[CREATE CRM USER]",
        error,
      );

      return response
        .status(400)
        .json({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "USER_CREATE_FAILED",
        });
    }
  },
);

crmTeamUsersRoutes.patch(
  "/:userId",
  async (
    request,
    response,
  ) => {
    if (
      !requireManager(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const input =
        schema
          .partial()
          .parse(
            request.body,
          );

      const user =
        await patchManagedUser(
          companyId(request),

          request.params.userId,

          input,
        );

      return response.json({
        ok: true,
        user,
      });
    } catch (error) {
      return response
        .status(400)
        .json({
          ok: false,
          error:
            error instanceof Error
              ? error.message
              : "USER_UPDATE_FAILED",
        });
    }
  },
);

crmTeamUsersRoutes.delete(
  "/:userId",
  async (
    request,
    response,
  ) => {
    if (
      !requireManager(
        request,
        response,
      )
    ) {
      return;
    }

    const user =
      await patchManagedUser(
        companyId(request),

        request.params.userId,

        {
          active:
            false,
        },
      );

    return response.json({
      ok: true,
      user,
    });
  },
);
