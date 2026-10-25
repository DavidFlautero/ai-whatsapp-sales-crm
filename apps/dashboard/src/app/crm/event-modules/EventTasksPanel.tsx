"use client";

export type EventTask = {
  id: string;

  title: string;

  description?:
    string
    | null;

  status:
    | "pending"
    | "in_progress"
    | "done"
    | "cancelled";

  priority:
    | "low"
    | "normal"
    | "high"
    | "critical";

  due_at?:
    string
    | null;

  responsible_name?:
    string
    | null;
};

type Props = {
  tasks:
    EventTask[];

  onComplete?: (
    task:
      EventTask,
  ) => void;

  onOpen?: (
    task:
      EventTask,
  ) => void;

  onAdd?: () => void;
};

function overdue(
  task:
    EventTask,
) {
  if (
    !task.due_at
    || task.status
    === "done"
    || task.status
    === "cancelled"
  ) {
    return false;
  }

  return (
    new Date(
      task.due_at,
    ).getTime()
    < Date.now()
  );
}

export function EventTasksPanel({
  tasks,
  onComplete,
  onOpen,
  onAdd,
}: Props) {
  const pending =
    tasks
      .filter(
        (
          task,
        ) =>
          task.status
          !== "done"
          && task.status
          !== "cancelled",
      )
      .sort(
        (
          a,
          b,
        ) => {
          if (
            !a.due_at
          ) {
            return 1;
          }

          if (
            !b.due_at
          ) {
            return -1;
          }

          return (
            new Date(
              a.due_at,
            ).getTime()
            - new Date(
              b.due_at,
            ).getTime()
          );
        },
      );

  return (
    <section
      style={{
        display:
          "grid",

        gap:
          14,
      }}
    >
      <header
        style={{
          display:
            "flex",

          justifyContent:
            "space-between",

          alignItems:
            "center",
        }}
      >
        <div>
          <h3
            style={{
              margin:
                0,
            }}
          >
            Tareas
          </h3>

          <div
            style={{
              marginTop:
                3,

              color:
                "#6b7280",

              fontSize:
                12,
            }}
          >
            {
              pending.length
            }
            {" "}
            pendientes
          </div>
        </div>

        {onAdd ? (
          <button
            type="button"
            onClick={
              onAdd
            }
          >
            + Tarea
          </button>
        ) : null}
      </header>

      <div
        style={{
          display:
            "grid",

          gap:
            8,
        }}
      >
        {pending.map(
          (
            task,
          ) => {
            const isOverdue =
              overdue(
                task,
              );

            return (
              <article
                key={
                  task.id
                }
                style={{
                  display:
                    "grid",

                  gridTemplateColumns:
                    "minmax(0,1fr) auto",

                  gap:
                    14,

                  padding:
                    13,

                  border:
                    isOverdue
                      ? "1px solid #fca5a5"
                      : "1px solid #e5e7eb",

                  borderRadius:
                    10,

                  background:
                    isOverdue
                      ? "#fef2f2"
                      : "#fff",
                }}
              >
                <button
                  type="button"
                  onClick={() =>
                    onOpen?.(
                      task,
                    )
                  }
                  style={{
                    border:
                      0,

                    padding:
                      0,

                    background:
                      "transparent",

                    textAlign:
                      "left",
                  }}
                >
                  <strong>
                    {
                      task.title
                    }
                  </strong>

                  <div
                    style={{
                      marginTop:
                        4,

                      color:
                        "#6b7280",

                      fontSize:
                        12,
                    }}
                  >
                    {
                      task.due_at
                        ? `Vence ${task.due_at}`
                        : "Sin fecha"
                    }

                    {
                      task.responsible_name
                        ? ` · ${task.responsible_name}`
                        : ""
                    }
                  </div>

                  {isOverdue ? (
                    <div
                      style={{
                        marginTop:
                          4,

                        color:
                          "#991b1b",

                        fontWeight:
                          700,

                        fontSize:
                          11,
                      }}
                    >
                      VENCIDA
                    </div>
                  ) : null}
                </button>

                {onComplete ? (
                  <button
                    type="button"
                    onClick={() =>
                      onComplete(
                        task,
                      )
                    }
                  >
                    Completar
                  </button>
                ) : null}
              </article>
            );
          },
        )}

        {!pending.length ? (
          <div
            style={{
              padding:
                20,

              border:
                "1px dashed #d1d5db",

              borderRadius:
                10,

              textAlign:
                "center",

              color:
                "#6b7280",
            }}
          >
            No hay tareas pendientes.
          </div>
        ) : null}
      </div>
    </section>
  );
}
