"use client";

import styles from "./event-coordination-timeline.module.css";

type Props = {
  startTime?: string | null;
};

export function EventCoordinationTimeline({
  startTime,
}: Props) {
  const items = [
    {
      time: "15:30",
      title: "Acceso al espacio",
      owner: "Coordinación",
      status: "Preparado",
    },
    {
      time: "16:00",
      title: "Llegada de proveedores",
      owner: "Producción",
      status: "Pendiente",
    },
    {
      time: "17:00",
      title: "Montaje sonido e iluminación",
      owner: "Proveedor técnico",
      status: "Pendiente",
    },
    {
      time: "18:00",
      title: "Revisión catering y decoración",
      owner: "Coordinador",
      status: "Pendiente",
    },
    {
      time: startTime || "20:00",
      title: "Inicio del evento",
      owner: "Equipo completo",
      status: "Programado",
    },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span>
          OPERACIÓN DEL DÍA
        </span>

        <h3>
          Timeline de coordinación
        </h3>
      </div>

      <div className={styles.timeline}>
        {items.map(
          (
            item,
            index,
          ) => (
            <div
              key={`${item.time}-${item.title}`}
              className={styles.item}
            >
              <div className={styles.time}>
                {item.time}
              </div>

              <div className={styles.line}>
                <span />

                {index
                  < items.length - 1
                  ? <i />
                  : null}
              </div>

              <div className={styles.content}>
                <strong>
                  {item.title}
                </strong>

                <small>
                  {item.owner}
                </small>
              </div>

              <div className={styles.status}>
                {item.status}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
