"use client";

import React from "react";

type Props = {
  children:
    React.ReactNode;
};

type State = {
  failed:
    boolean;

  message:
    string
    | null;
};

export class EventOperationsErrorBoundary
  extends React.Component<
    Props,
    State
  > {
  state:
    State =
      {
        failed:
          false,

        message:
          null,
      };

  static getDerivedStateFromError(
    error: unknown,
  ): State {
    return {
      failed:
        true,

      message:
        error
          instanceof Error
          ? error.message
          : "UNKNOWN_UI_FAILURE",
    };
  }

  componentDidCatch(
    error: unknown,
  ) {
    console.error(
      "[event-control-tower]",
      error,
    );
  }

  private reset =
    () => {
      this.setState({
        failed:
          false,

        message:
          null,
      });

      window.dispatchEvent(
        new Event(
          "event-operations-refresh",
        ),
      );
    };

  render() {
    if (
      this.state
        .failed
    ) {
      return (
        <section
          role="alert"
          style={{
            border:
              "1px solid rgba(180,80,80,.35)",

            borderRadius:
              12,

            padding:
              14,
          }}
        >
          <strong>
            Control operativo degradado
          </strong>

          <p>
            {
              this.state
                .message
            }
          </p>

          <button
            type="button"
            onClick={
              this.reset
            }
          >
            Reintentar
          </button>
        </section>
      );
    }

    return (
      this.props
        .children
    );
  }
}
