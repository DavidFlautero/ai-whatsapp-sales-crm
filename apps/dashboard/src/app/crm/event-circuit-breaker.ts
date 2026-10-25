export type CircuitState =
  | "closed"
  | "open"
  | "half-open";

type State = {
  failures: number;
  openedAt: number | null;
  state: CircuitState;
};

const circuits =
  new Map<
    string,
    State
  >();

const FAILURE_LIMIT =
  4;

const RESET_AFTER_MS =
  30000;

function getState(
  key: string,
) {
  let state =
    circuits.get(
      key,
    );

  if (!state) {
    state = {
      failures: 0,
      openedAt: null,
      state: "closed",
    };

    circuits.set(
      key,
      state,
    );
  }

  return state;
}

export function canRequest(
  key: string,
) {
  const state =
    getState(
      key,
    );

  if (
    state.state
    === "closed"
  ) {
    return true;
  }

  if (
    state.state
    === "open"
    && state.openedAt
    && Date.now()
      - state.openedAt
      >= RESET_AFTER_MS
  ) {
    state.state =
      "half-open";

    return true;
  }

  return (
    state.state
    === "half-open"
  );
}

export function requestSucceeded(
  key: string,
) {
  const state =
    getState(
      key,
    );

  state.failures =
    0;

  state.openedAt =
    null;

  state.state =
    "closed";
}

export function requestFailed(
  key: string,
) {
  const state =
    getState(
      key,
    );

  state.failures +=
    1;

  if (
    state.failures
    >= FAILURE_LIMIT
  ) {
    state.state =
      "open";

    state.openedAt =
      Date.now();
  }
}

export function getCircuitState(
  key: string,
): CircuitState {
  return getState(
    key,
  ).state;
}
