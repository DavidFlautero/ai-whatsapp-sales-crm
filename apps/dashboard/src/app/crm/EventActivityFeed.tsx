"use client";

import styles from "./event-activity-feed.module.css";

type Props = {
  customerName?: string | null;
};

export function EventActivityFeed({
  customerName,
}: Props) {
  const items = [
    {
      time: "Hace 12 min",
      text:
        "Se revisó el estado operativo del evento.",
    },
    {
      time: "Hace 35 min",
      text:
        "Proveedor de sonido pendiente de confirmación.",
    },
    {
      time: "Hoy",
      text:
        "Presupuesto actualizado con los últimos servicios.",
    },
    {
      time: "Ayer",
      text:
        `${customerName ?? "El cliente"} recibió seguimiento comercial.`,
    },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span>
          ACTIVIDAD
        </span>

        <h3>
          Últimos movimientos
        </h3>
      </div>

      <div className={styles.list}>
        {items.map(
          (
            item,
          ) => (
            <div
              key={`${item.time}-${item.text}`}
              className={styles.item}
            >
              <span />

              <div>
                <strong>
                  {item.text}
                </strong>

                <small>
                  {item.time}
                </small>
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
