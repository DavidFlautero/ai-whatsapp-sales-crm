"use client";

import styles from "./event-responsibles.module.css";

export type EventTeamMember = {
  id: string;
  name?: string | null;
  role?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  active?: boolean | null;
};

export type EventAssignment = {
  id?: string;
  team_member_id?: string | null;
  responsibility?: string | null;
  role?: string | null;
};

type Props = {
  team: EventTeamMember[];
  assignments: EventAssignment[];
};

function roleLabel(
  value?: string | null,
) {
  if (!value) {
    return "Equipo";
  }

  const map: Record<string, string> = {
    owner: "Dirección",
    admin: "Administración",
    vendedor: "Ventas",
    sales: "Ventas",
    coordinator: "Coordinación",
    coordinador: "Coordinación",
    marketing: "Marketing",
    supervisor: "Supervisión",
  };

  return map[value.toLowerCase()]
    ?? value;
}

export function EventResponsiblesPanel({
  team,
  assignments,
}: Props) {
  const assignedIds =
    new Set(
      assignments
        .map(
          (item) =>
            item.team_member_id,
        )
        .filter(Boolean),
    );

  let visible =
    team.filter(
      (member) =>
        assignedIds.has(member.id),
    );

  if (!visible.length) {
    visible =
      team
        .filter(
          (member) =>
            member.active !== false,
        )
        .slice(0, 5);
  }

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div>
          <span>
            EQUIPO DEL EVENTO
          </span>

          <h3>
            Responsables
          </h3>

          <p>
            Personas responsables de venta,
            coordinación y ejecución.
          </p>
        </div>

        <button type="button">
          + Asignar responsable
        </button>
      </header>

      <div className={styles.grid}>
        {visible.map(
          (member) => {
            const assignment =
              assignments.find(
                (item) =>
                  item.team_member_id
                  === member.id,
              );

            const phone =
              member.whatsapp
              || member.phone;

            return (
              <article
                key={member.id}
                className={styles.card}
              >
                <div className={styles.avatar}>
                  {
                    (
                      member.name
                      ?? "?"
                    )
                      .slice(0, 1)
                      .toUpperCase()
                  }
                </div>

                <div className={styles.content}>
                  <strong>
                    {member.name ?? "Sin nombre"}
                  </strong>

                  <span>
                    {
                      roleLabel(
                        assignment?.role
                        ?? member.role,
                      )
                    }
                  </span>

                  <p>
                    {
                      assignment
                        ?.responsibility
                      ?? "Responsable operativo del evento"
                    }
                  </p>

                  <div className={styles.contact}>
                    {phone ? (
                      <a
                        href={
                          `https://wa.me/${
                            phone.replace(
                              /\D/g,
                              "",
                            )
                          }`
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        WhatsApp · {phone}
                      </a>
                    ) : (
                      <small>
                        Teléfono no cargado
                      </small>
                    )}

                    {member.email ? (
                      <a
                        href={`mailto:${member.email}`}
                      >
                        {member.email}
                      </a>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          },
        )}

        {!visible.length ? (
          <div className={styles.empty}>
            <strong>
              Todavía no hay responsables.
            </strong>

            <p>
              Asigna vendedor, coordinador
              o responsable onsite.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
