import {
  Router,
  type Request,
  type Response,
} from "express";

import {
  z,
  ZodError,
} from "zod";

import {
  supabaseRequest,
} from "../services/db/supabase-rest.client.js";


export const crmFinanceRoutes =
  Router();


type DbRow =
  Record<string, unknown>;


const adminRoles =
  new Set([
    "superadmin",
    "owner",
    "admin",
    "supervisor",
  ]);


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


function isAdmin(
  request: Request,
) {
  return Boolean(
    request.authUser
    && adminRoles.has(
      request.authUser.role,
    ),
  );
}


function requireAdmin(
  request: Request,
  response: Response,
) {
  if (!isAdmin(request)) {
    response.status(403).json({
      ok: false,
      error:
        "ADMIN_PERMISSION_REQUIRED",
    });

    return false;
  }

  return true;
}


function eq(
  value: string,
) {
  return encodeURIComponent(
    value,
  );
}


function numeric(
  value: unknown,
) {
  const parsed =
    Number(value ?? 0);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : 0;
}


function round2(
  value: number,
) {
  return Math.round(
    value * 100,
  ) / 100;
}


function handleError(
  error: unknown,
  response: Response,
) {
  if (
    error instanceof ZodError
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
    "[CRM FINANCE]",
    error,
  );

  return response
    .status(500)
    .json({
      ok: false,
      error:
        "CRM_FINANCE_INTERNAL_ERROR",
    });
}


const financeSettingsSchema =
  z.object({
    targetMarginPercent:
      z.number()
        .min(0)
        .max(99.99),

    warningMarginPercent:
      z.number()
        .min(0)
        .max(99.99),

    minimumMarginPercent:
      z.number()
        .min(0)
        .max(99.99),
  });


crmFinanceRoutes.get(
  "/settings/finance",
  async (
    request,
    response,
  ) => {
    try {
      const tenant =
        companyId(request);

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_company_settings",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + "&select=target_margin_percent,warning_margin_percent,minimum_margin_percent"
            + "&limit=1",
        });

      const settings =
        rows[0] ?? {};

      return response.json({
        ok: true,

        settings: {
          targetMarginPercent:
            numeric(
              settings
                .target_margin_percent
              ?? 25,
            ),

          warningMarginPercent:
            numeric(
              settings
                .warning_margin_percent
              ?? 22,
            ),

          minimumMarginPercent:
            numeric(
              settings
                .minimum_margin_percent
              ?? 18,
            ),
        },
      });

    } catch (
      error
    ) {
      return handleError(
        error,
        response,
      );
    }
  },
);


crmFinanceRoutes.patch(
  "/settings/finance",
  async (
    request,
    response,
  ) => {
    if (
      !requireAdmin(
        request,
        response,
      )
    ) {
      return;
    }

    try {
      const body =
        financeSettingsSchema
          .parse(
            request.body,
          );

      const tenant =
        companyId(request);

      const rows =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_company_settings",

          method:
            "PATCH",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`,

          body: {
            target_margin_percent:
              body
                .targetMarginPercent,

            warning_margin_percent:
              body
                .warningMarginPercent,

            minimum_margin_percent:
              body
                .minimumMarginPercent,
          },
        });

      if (!rows[0]) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "CRM_SETTINGS_NOT_FOUND",
          });
      }

      return response.json({
        ok: true,
        settings:
          rows[0],
      });

    } catch (
      error
    ) {
      return handleError(
        error,
        response,
      );
    }
  },
);


crmFinanceRoutes.get(
  "/events/:eventId/finance",
  async (
    request,
    response,
  ) => {
    try {
      const eventId =
        z.string()
          .uuid()
          .parse(
            request.params
              .eventId,
          );

      const tenant =
        companyId(request);

      const events =
        await supabaseRequest<
          DbRow[]
        >({
          table:
            "crm_events",

          query:
            `?company_id=eq.${eq(
              tenant,
            )}`
            + `&id=eq.${eq(
              eventId,
            )}`
            + "&select=id,target_budget,final_client_price,final_provider_cost,direct_expenses,currency"
            + "&limit=1",
        });

      const event =
        events[0];

      if (!event) {
        return response
          .status(404)
          .json({
            ok: false,
            error:
              "EVENT_NOT_FOUND",
          });
      }


      const [
        settingsRows,
        requirements,
        assignments,
        rules,
        commissions,
      ] =
        await Promise.all([
          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_company_settings",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + "&limit=1",
          }),

          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_event_requirements",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + `&event_id=eq.${eq(
                eventId,
              )}`
              + "&select=id,service_name,provider_cost,client_price,service_status,contract_status,assigned_provider_id",
          }),

          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_event_assignments",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + `&event_id=eq.${eq(
                eventId,
              )}`
              + "&status=neq.cancelled"
              + "&select=id,team_member_id,participation_type,status",
          }),

          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_commission_rules",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + "&active=eq.true"
              + "&order=priority.asc,created_at.asc",
          }),

          supabaseRequest<
            DbRow[]
          >({
            table:
              "crm_event_commissions",

            query:
              `?company_id=eq.${eq(
                tenant,
              )}`
              + `&event_id=eq.${eq(
                eventId,
              )}`
              + "&status=neq.cancelled",
          }),
        ]);


      const settings =
        settingsRows[0]
        ?? {};

      const targetMargin =
        numeric(
          settings
            .target_margin_percent
          ?? 25,
        );

      const warningMargin =
        numeric(
          settings
            .warning_margin_percent
          ?? 22,
        );

      const minimumMargin =
        numeric(
          settings
            .minimum_margin_percent
          ?? 18,
        );


      const requirementSale =
        requirements.reduce(
          (
            total,
            item,
          ) =>
            total
            + numeric(
              item.client_price,
            ),
          0,
        );

      const providerCost =
        requirements.reduce(
          (
            total,
            item,
          ) =>
            total
            + numeric(
              item.provider_cost,
            ),
          0,
        );


      const finalClientPrice =
        numeric(
          event
            .final_client_price,
        );

      const targetBudget =
        numeric(
          event
            .target_budget,
        );

      const sale =
        finalClientPrice > 0
          ? finalClientPrice
          : targetBudget > 0
            ? targetBudget
            : requirementSale;


      const directExpenses =
        numeric(
          event
            .direct_expenses,
        );

      const totalCost =
        providerCost
        + directExpenses;

      const grossMargin =
        sale
        - totalCost;

      const marginPercent =
        sale > 0
          ? (
              grossMargin
              / sale
            ) * 100
          : 0;

      const maximumCost =
        sale
        * (
          1
          - targetMargin
            / 100
        );

      const remainingCostCapacity =
        maximumCost
        - totalCost;

      const recommendedSalePrice =
        targetMargin < 100
        && totalCost > 0
          ? totalCost
            / (
              1
              - targetMargin
                / 100
            )
          : 0;


      /*
       * Antes de aceptar el presupuesto
       * calculamos la comisión estimada.
       *
       * Después de aceptarlo usamos las
       * comisiones reales generadas.
       */
      const persistedCommission =
        commissions.reduce(
          (
            total,
            item,
          ) =>
            total
            + numeric(
              item
                .commission_amount,
            ),
          0,
        );


      let estimatedCommission =
        0;

      if (
        persistedCommission
        <= 0
      ) {
        for (
          const assignment
          of assignments
        ) {
          const participationType =
            String(
              assignment
                .participation_type
              ?? "",
            );

          const rule =
            rules.find(
              (
                item,
              ) =>
                String(
                  item
                    .participation_type
                  ?? "",
                )
                === participationType,
            );

          if (!rule) {
            continue;
          }

          const calculationType =
            String(
              rule
                .calculation_type
              ?? "",
            );

          let amount =
            0;

          if (
            calculationType
            === "percent_margin"
          ) {
            amount =
              Math.max(
                grossMargin,
                0,
              )
              * (
                numeric(
                  rule
                    .percent_value,
                )
                / 100
              );
          }

          if (
            calculationType
            === "fixed_amount"
          ) {
            amount =
              numeric(
                rule
                  .fixed_amount,
              );
          }

          const maxAmount =
            numeric(
              rule.max_amount,
            );

          if (
            maxAmount > 0
          ) {
            amount =
              Math.min(
                amount,
                maxAmount,
              );
          }

          estimatedCommission +=
            amount;
        }
      }


      const commissionTotal =
        persistedCommission > 0
          ? persistedCommission
          : estimatedCommission;

      const companyResult =
        grossMargin
        - commissionTotal;


      let profitability:
        | "loss"
        | "critical"
        | "warning"
        | "below_target"
        | "healthy";

      if (
        grossMargin < 0
      ) {
        profitability =
          "loss";
      } else if (
        marginPercent
        < minimumMargin
      ) {
        profitability =
          "critical";
      } else if (
        marginPercent
        < warningMargin
      ) {
        profitability =
          "warning";
      } else if (
        marginPercent
        < targetMargin
      ) {
        profitability =
          "below_target";
      } else {
        profitability =
          "healthy";
      }


      const recommendations:
        string[] = [];

      if (
        profitability
        === "loss"
      ) {
        recommendations.push(
          "Los costes superan el precio de venta.",
        );
      }

      if (
        marginPercent
        < targetMargin
      ) {
        recommendations.push(
          "Subir el precio al cliente o reducir costes de proveedores.",
        );
      }

      if (
        remainingCostCapacity
        < 0
      ) {
        recommendations.push(
          `Los costes superan en ${Math.abs(
            round2(
              remainingCostCapacity,
            ),
          ).toFixed(
            2,
          )} € el máximo recomendado.`,
        );
      }

      if (
        recommendedSalePrice
        > sale
      ) {
        recommendations.push(
          `Precio recomendado para conservar el margen objetivo: ${round2(
            recommendedSalePrice,
          ).toFixed(
            2,
          )} €.`,
        );
      }

      if (
        profitability
        === "healthy"
      ) {
        recommendations.push(
          "La operación cumple el margen objetivo.",
        );
      }


      const admin =
        isAdmin(request);

      const allowSellerCosts =
        settings
          .allow_seller_view_costs
        === true;

      const allowSellerMargin =
        settings
          .allow_seller_view_margin
        === true;


      return response.json({
        ok: true,

        finance: {
          currency:
            String(
              event.currency
              ?? "EUR",
            ),

          saleAmount:
            round2(sale),

          targetBudget:
            round2(
              targetBudget,
            ),

          providerCost:
            admin
            || allowSellerCosts
              ? round2(
                  providerCost,
                )
              : null,

          directExpenses:
            admin
            || allowSellerCosts
              ? round2(
                  directExpenses,
                )
              : null,

          totalCost:
            admin
            || allowSellerCosts
              ? round2(
                  totalCost,
                )
              : null,

          grossMargin:
            admin
            || allowSellerMargin
              ? round2(
                  grossMargin,
                )
              : null,

          marginPercent:
            admin
            || allowSellerMargin
              ? round2(
                  marginPercent,
                )
              : null,

          targetMarginPercent:
            targetMargin,

          warningMarginPercent:
            warningMargin,

          minimumMarginPercent:
            minimumMargin,

          maximumCost:
            admin
            || allowSellerCosts
              ? round2(
                  maximumCost,
                )
              : null,

          remainingCostCapacity:
            admin
            || allowSellerCosts
              ? round2(
                  remainingCostCapacity,
                )
              : null,

          commissionTotal:
            round2(
              commissionTotal,
            ),

          commissionStatus:
            persistedCommission > 0
              ? "generated"
              : "estimated",

          companyResult:
            admin
              ? round2(
                  companyResult,
                )
              : null,

          recommendedSalePrice:
            admin
            || allowSellerMargin
              ? round2(
                  recommendedSalePrice,
                )
              : null,

          profitability:
            admin
            || allowSellerMargin
              ? profitability
              : null,

          recommendations:
            admin
            || allowSellerMargin
              ? recommendations
              : [],

          serviceCount:
            requirements.length,
        },
      });

    } catch (
      error
    ) {
      return handleError(
        error,
        response,
      );
    }
  },
);
