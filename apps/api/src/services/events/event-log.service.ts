type EventLog = {
  id: string;
  type: string;
  message: string;
  createdAt: string;
  meta?: unknown;
};

const events: EventLog[] = [];

export function addEventLog(input: {
  type: string;
  message: string;
  meta?: unknown;
}) {
  const event = {
    id: crypto.randomUUID(),
    type: input.type,
    message: input.message,
    meta: input.meta,
    createdAt: new Date().toISOString()
  };

  events.unshift(event);

  if (events.length > 100) events.pop();

  return event;
}

export function listEventLogs() {
  return events;
}
