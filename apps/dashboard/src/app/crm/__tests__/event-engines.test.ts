import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  Event360Data,
} from "../EventOperationsContext";

import {
  calculateEventRisk,
} from "../event-risk-engine";

import {
  buildNextActions,
} from "../event-next-action-engine";

function futureDate(
  days: number,
) {
  return new Date(
    Date.now()
    + days
      * 86400000,
  )
    .toISOString();
}

describe(
  "event operational engines",
  () => {
    it(
      "raises critical risk when a critical service has no provider",
      () => {
        const data:
          Event360Data =
            {
              event: {
                event_date:
                  futureDate(
                    2,
                  ),
              },

              readiness: {
                readiness_percent:
                  40,
              },

              requirements: [
                {
                  id:
                    "catering",

                  service_name:
                    "Catering",

                  is_critical:
                    true,

                  service_status:
                    "searching",

                  assigned_provider_id:
                    null,

                  responsible_team_member_id:
                    null,

                  contract_status:
                    "pending",

                  deposit_required:
                    500,

                  deposit_paid:
                    0,
                },
              ],
            };

        const risk =
          calculateEventRisk(
            data,
          );

        expect(
          risk.score,
        )
          .toBeGreaterThanOrEqual(
            75,
          );

        expect(
          risk.level,
        )
          .toBe(
            "critical",
          );

        expect(
          risk.signals.some(
            signal =>
              signal.code
              === "NO_PROVIDER",
          ),
        )
          .toBe(
            true,
          );
      },
    );

    it(
      "prioritizes provider assignment as P0",
      () => {
        const data:
          Event360Data =
            {
              event: {
                event_date:
                  futureDate(
                    4,
                  ),
              },

              requirements: [
                {
                  id:
                    "dj",

                  service_name:
                    "DJ",

                  is_critical:
                    true,

                  service_status:
                    "searching",

                  assigned_provider_id:
                    null,
                },
              ],
            };

        const actions =
          buildNextActions(
            data,
          );

        expect(
          actions[0]
            ?.category,
        )
          .toBe(
            "provider",
          );

        expect(
          actions[0]
            ?.priority,
        )
          .toBe(
            "P0",
          );
      },
    );

    it(
      "returns low risk for a fully closed service",
      () => {
        const data:
          Event360Data =
            {
              event: {
                event_date:
                  futureDate(
                    30,
                  ),
              },

              readiness: {
                readiness_percent:
                  100,
              },

              requirements: [
                {
                  id:
                    "dj",

                  service_name:
                    "DJ",

                  is_critical:
                    true,

                  service_status:
                    "completed",

                  assigned_provider_id:
                    "provider-1",

                  responsible_team_member_id:
                    "member-1",

                  contract_status:
                    "signed",

                  deposit_required:
                    500,

                  deposit_paid:
                    500,
                },
              ],
            };

        const risk =
          calculateEventRisk(
            data,
          );

        expect(
          risk.level,
        )
          .toBe(
            "low",
          );

        expect(
          risk.signals,
        )
          .toHaveLength(
            0,
          );
      },
    );

    it(
      "creates a payment action when deposit remains unpaid",
      () => {
        const data:
          Event360Data =
            {
              event: {
                event_date:
                  futureDate(
                    15,
                  ),
              },

              requirements: [
                {
                  id:
                    "lighting",

                  service_name:
                    "Iluminación",

                  service_status:
                    "confirmed",

                  assigned_provider_id:
                    "provider-1",

                  responsible_team_member_id:
                    "member-1",

                  contract_status:
                    "signed",

                  deposit_required:
                    600,

                  deposit_paid:
                    200,
                },
              ],
            };

        const actions =
          buildNextActions(
            data,
          );

        expect(
          actions.some(
            action =>
              action.category
              === "payment",
          ),
        )
          .toBe(
            true,
          );
      },
    );

    it(
      "does not create provider action for assigned provider",
      () => {
        const data:
          Event360Data =
            {
              event: {
                event_date:
                  futureDate(
                    5,
                  ),
              },

              requirements: [
                {
                  id:
                    "sound",

                  service_name:
                    "Sonido",

                  is_critical:
                    true,

                  service_status:
                    "confirmed",

                  assigned_provider_id:
                    "provider-33",

                  responsible_team_member_id:
                    "member-1",

                  contract_status:
                    "signed",
                },
              ],
            };

        const actions =
          buildNextActions(
            data,
          );

        expect(
          actions.some(
            action =>
              action.category
              === "provider",
          ),
        )
          .toBe(
            false,
          );
      },
    );
  },
);
