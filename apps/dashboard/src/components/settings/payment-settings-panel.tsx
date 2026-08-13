"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import styles from "../../app/settings/Settings.module.css";


const apiUrl = (
  process.env.NEXT_PUBLIC_API_URL
  || "https://panel.fulanitasfabrica.site/api"
).replace(/\/+$/, "");


type PaymentAccount = {
  id: string;

  displayName: string;
  institutionName: string;

  accountType:
    | "bank_account"
    | "virtual_wallet"
    | "cash"
    | "other";

  holderName: string;

  taxId:
    string | null;

  alias:
    string | null;

  accountNumberMasked:
    string | null;

  hasAccountNumber:
    boolean;

  currency:
    "ARS"
    | "USD"
    | "EUR";

  instructions:
    string | null;

  active:
    boolean;

  isDefault:
    boolean;

  sortOrder:
    number;

  createdAt:
    string;

  updatedAt:
    string;
};


type PaymentOwner = {
  configured:
    boolean;

  maskedPhone:
    string | null;

  last2:
    string | null;

  locked:
    boolean;

  configuredAt:
    string | null;
};


type PaymentSettings = {
  accounts:
    PaymentAccount[];

  owner:
    PaymentOwner;
};


type AccountForm = {
  displayName:
    string;

  institutionName:
    string;

  accountType:
    PaymentAccount["accountType"];

  holderName:
    string;

  taxId:
    string;

  alias:
    string;

  accountNumber:
    string;

  currency:
    PaymentAccount["currency"];

  instructions:
    string;

  sortOrder:
    string;
};


const emptyAccountForm:
  AccountForm = {
  displayName:
    "",

  institutionName:
    "",

  accountType:
    "bank_account",

  holderName:
    "",

  taxId:
    "",

  alias:
    "",

  accountNumber:
    "",

  currency:
    "ARS",

  instructions:
    "",

  sortOrder:
    "0",
};


function parseAccountType(
  value:
    string,
): PaymentAccount["accountType"] {
  switch (value) {
    case "bank_account":
    case "virtual_wallet":
    case "cash":
    case "other":
      return value;

    default:
      return "bank_account";
  }
}


function parseCurrency(
  value:
    string,
): PaymentAccount["currency"] {
  switch (value) {
    case "ARS":
    case "USD":
    case "EUR":
      return value;

    default:
      return "ARS";
  }
}


function accountTypeLabel(
  value:
    PaymentAccount["accountType"],
) {
  switch (value) {
    case "bank_account":
      return "Cuenta bancaria";

    case "virtual_wallet":
      return "Billetera virtual";

    case "cash":
      return "Efectivo";

    default:
      return "Otro";
  }
}


function errorMessage(
  payload:
    unknown,

  fallback:
    string,
) {
  if (
    payload
    && typeof payload === "object"
  ) {
    const record =
      payload as Record<
        string,
        unknown
      >;

    if (
      typeof record.message
      === "string"
      && record.message.trim()
    ) {
      return record.message;
    }

    if (
      typeof record.error
      === "string"
      && record.error.trim()
    ) {
      return record.error;
    }
  }

  return fallback;
}


export function PaymentSettingsPanel() {
  const [
    settings,
    setSettings,
  ] =
    useState<
      PaymentSettings
      | null
    >(null);

  const [
    accountForm,
    setAccountForm,
  ] =
    useState<AccountForm>(
      emptyAccountForm,
    );

  const [
    ownerPhone,
    setOwnerPhone,
  ] =
    useState("");

  const [
    ownerConfirmed,
    setOwnerConfirmed,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    action,
    setAction,
  ] =
    useState<
      string
      | null
    >(null);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    success,
    setSuccess,
  ] =
    useState("");


  const loadSettings =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const response =
            await fetch(
              `${apiUrl}/admin/payment-settings`,
              {
                credentials:
                  "include",

                headers: {
                  Accept:
                    "application/json",
                },

                cache:
                  "no-store",
              },
            );

          const payload =
            await response
              .json()
              .catch(
                () => null,
              );

          if (!response.ok) {
            throw new Error(
              errorMessage(
                payload,
                `Error ${response.status}`,
              ),
            );
          }

          const data =
            payload?.data;

          if (
            !data
            || !Array.isArray(
              data.accounts,
            )
            || !data.owner
          ) {
            throw new Error(
              "La respuesta de configuración de cobros no es válida.",
            );
          }

          setSettings(
            data as PaymentSettings,
          );
        } catch (
          caught
        ) {
          setError(
            caught instanceof Error
              ? caught.message
              : "No se pudo cargar la configuración de cobros.",
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );


  useEffect(
    () => {
      void loadSettings();
    },
    [
      loadSettings,
    ],
  );


  const activeAccounts =
    useMemo(
      () =>
        settings
          ?.accounts
          .filter(
            (account) =>
              account.active,
          )
        ?? [],
      [
        settings,
      ],
    );


  async function mutation(
    input: {
      pathname: string;

      method:
        "POST"
        | "PUT";

      body?:
        Record<
          string,
          unknown
        >;

      label:
        string;
    },
  ) {
    setAction(
      input.label,
    );

    setError("");
    setSuccess("");

    try {
      const response =
        await fetch(
          `${apiUrl}${input.pathname}`,
          {
            method:
              input.method,

            credentials:
              "include",

            headers: {
              Accept:
                "application/json",

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                input.body
                ?? {},
              ),
          },
        );

      const payload =
        await response
          .json()
          .catch(
            () => null,
          );

      if (!response.ok) {
        throw new Error(
          errorMessage(
            payload,
            `Error ${response.status}`,
          ),
        );
      }

      setSuccess(
        `${input.label} completado correctamente.`,
      );

      await loadSettings();

      return payload;
    } catch (
      caught
    ) {
      const message =
        caught instanceof Error
          ? caught.message
          : "No se pudo completar la operación.";

      setError(
        message,
      );

      throw caught;
    } finally {
      setAction(null);
    }
  }


  async function createAccount(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const payload: Record<
      string,
      unknown
    > = {
      displayName:
        accountForm.displayName,

      institutionName:
        accountForm.institutionName,

      accountType:
        accountForm.accountType,

      holderName:
        accountForm.holderName,

      currency:
        accountForm.currency,

      sortOrder:
        Number(
          accountForm.sortOrder,
        ) || 0,
    };

    if (
      accountForm.taxId.trim()
    ) {
      payload.taxId =
        accountForm.taxId.trim();
    }

    if (
      accountForm.alias.trim()
    ) {
      payload.alias =
        accountForm.alias.trim();
    }

    if (
      accountForm
        .accountNumber
        .trim()
    ) {
      payload.accountNumber =
        accountForm
          .accountNumber
          .trim();
    }

    if (
      accountForm
        .instructions
        .trim()
    ) {
      payload.instructions =
        accountForm
          .instructions
          .trim();
    }

    await mutation({
      pathname:
        "/admin/payment-settings/accounts",

      method:
        "POST",

      body:
        payload,

      label:
        "Alta de cuenta",
    });

    setAccountForm(
      emptyAccountForm,
    );
  }


  async function makeDefault(
    account:
      PaymentAccount,
  ) {
    if (
      !window.confirm(
        `¿Usar "${account.displayName}" como cuenta predeterminada para ${account.currency}?`,
      )
    ) {
      return;
    }

    await mutation({
      pathname:
        `/admin/payment-settings/accounts/${encodeURIComponent(account.id)}/default`,

      method:
        "POST",

      label:
        "Cambio de cuenta predeterminada",
    });
  }


  async function deactivate(
    account:
      PaymentAccount,
  ) {
    if (
      !window.confirm(
        `¿Desactivar la cuenta "${account.displayName}"?`,
      )
    ) {
      return;
    }

    await mutation({
      pathname:
        `/admin/payment-settings/accounts/${encodeURIComponent(account.id)}/deactivate`,

      method:
        "POST",

      label:
        "Desactivación de cuenta",
    });
  }


  async function initializeOwner(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !ownerConfirmed
    ) {
      setError(
        "Tenés que confirmar que entendés que el número no podrá modificarse desde el panel.",
      );

      return;
    }

    const normalized =
      ownerPhone.replace(
        /\D/g,
        "",
      );

    if (
      !window.confirm(
        `Se configurará permanentemente el WhatsApp terminado en ${normalized.slice(-2)}. ¿Continuar?`,
      )
    ) {
      return;
    }

    await mutation({
      pathname:
        "/admin/payment-settings/owner",

      method:
        "POST",

      body: {
        phone:
          ownerPhone,
      },

      label:
        "Configuración del WhatsApp dueño",
    });

    setOwnerPhone("");
    setOwnerConfirmed(false);
  }


  return (
    <section
      className={
        styles.paymentSettingsSection
      }
      aria-labelledby="payment-settings-title"
    >
      <div
        className={
          styles.paymentSettingsHeader
        }
      >
        <div>
          <div
            className={
              styles.eyebrow
            }
          >
            Cobros y comprobantes
          </div>

          <h2
            id="payment-settings-title"
            className={
              styles.sectionTitle
            }
          >
            Cuentas para recibir pagos
          </h2>

          <p
            className={
              styles.sectionDescription
            }
          >
            El agente solamente comunica cuentas activas
            configuradas acá. Los comprobantes recibidos
            quedan pendientes de revisión humana.
          </p>
        </div>

        <div
          className={
            styles.paymentSummary
          }
        >
          <span>
            {activeAccounts.length}
            {" "}
            cuentas activas
          </span>

          <span>
            {activeAccounts.filter(
              (account) =>
                account.isDefault,
            ).length}
            {" "}
            predeterminadas
          </span>
        </div>
      </div>

      {error ? (
        <div
          className={
            styles.paymentError
          }
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {success ? (
        <div
          className={
            styles.paymentSuccess
          }
          role="status"
        >
          {success}
        </div>
      ) : null}

      <div
        className={
          styles.paymentSettingsGrid
        }
      >
        <div
          className={
            styles.paymentPanel
          }
        >
          <div
            className={
              styles.paymentPanelHeader
            }
          >
            <div>
              <h3>
                Cuentas precargadas
              </h3>

              <p>
                La predeterminada es la que recibe el cliente
                cuando consulta cómo pagar.
              </p>
            </div>

            <button
              type="button"
              className={
                styles.paymentSecondaryButton
              }
              onClick={
                () =>
                  void loadSettings()
              }
              disabled={
                loading
                || Boolean(action)
              }
            >
              Actualizar
            </button>
          </div>

          {loading ? (
            <div
              className={
                styles.paymentEmpty
              }
            >
              Cargando cuentas…
            </div>
          ) : activeAccounts.length
            === 0 ? (
              <div
                className={
                  styles.paymentEmpty
                }
              >
                Todavía no hay cuentas cargadas.
              </div>
            ) : (
              <div
                className={
                  styles.paymentAccountList
                }
              >
                {activeAccounts.map(
                  (account) => (
                    <article
                      key={
                        account.id
                      }
                      className={
                        styles.paymentAccountCard
                      }
                    >
                      <div
                        className={
                          styles.paymentAccountTop
                        }
                      >
                        <div>
                          <strong>
                            {account.displayName}
                          </strong>

                          <span>
                            {account.institutionName}
                            {" · "}
                            {accountTypeLabel(
                              account.accountType,
                            )}
                          </span>
                        </div>

                        {account.isDefault ? (
                          <span
                            className={
                              styles.paymentDefaultBadge
                            }
                          >
                            Predeterminada
                          </span>
                        ) : null}
                      </div>

                      <dl
                        className={
                          styles.paymentAccountDetails
                        }
                      >
                        <div>
                          <dt>
                            Titular
                          </dt>

                          <dd>
                            {account.holderName}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Alias
                          </dt>

                          <dd>
                            {account.alias
                              || "—"}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            CBU/CVU
                          </dt>

                          <dd>
                            {account.accountNumberMasked
                              || "—"}
                          </dd>
                        </div>

                        <div>
                          <dt>
                            Moneda
                          </dt>

                          <dd>
                            {account.currency}
                          </dd>
                        </div>
                      </dl>

                      <div
                        className={
                          styles.paymentAccountActions
                        }
                      >
                        {!account.isDefault ? (
                          <button
                            type="button"
                            className={
                              styles.paymentPrimaryButton
                            }
                            disabled={
                              Boolean(action)
                            }
                            onClick={
                              () =>
                                void makeDefault(
                                  account,
                                )
                            }
                          >
                            Usar como predeterminada
                          </button>
                        ) : null}

                        <button
                          type="button"
                          className={
                            styles.paymentDangerButton
                          }
                          disabled={
                            Boolean(action)
                            || account.isDefault
                          }
                          title={
                            account.isDefault
                              ? "Primero elegí otra cuenta predeterminada."
                              : undefined
                          }
                          onClick={
                            () =>
                              void deactivate(
                                account,
                              )
                          }
                        >
                          Desactivar
                        </button>
                      </div>
                    </article>
                  ),
                )}
              </div>
            )}
        </div>

        <form
          className={
            styles.paymentPanel
          }
          onSubmit={
            createAccount
          }
        >
          <div
            className={
              styles.paymentPanelHeader
            }
          >
            <div>
              <h3>
                Agregar cuenta
              </h3>

              <p>
                Alias y CBU/CVU pueden completarse juntos
                o usar solamente uno de ellos.
              </p>
            </div>
          </div>

          <div
            className={
              styles.paymentFormGrid
            }
          >
            <label>
              <span>
                Nombre visible
              </span>

              <input
                required
                value={
                  accountForm.displayName
                }
                onChange={
                  (event) =>
                    setAccountForm({
                      ...accountForm,

                      displayName:
                        event.target.value,
                    })
                }
                placeholder="Banco principal"
              />
            </label>

            <label>
              <span>
                Banco o billetera
              </span>

              <input
                required
                value={
                  accountForm.institutionName
                }
                onChange={
                  (event) =>
                    setAccountForm({
                      ...accountForm,

                      institutionName:
                        event.target.value,
                    })
                }
                placeholder="Banco Nación"
              />
            </label>

            <label>
              <span>
                Tipo
              </span>

              <select
                value={
                  accountForm.accountType
                }
                onChange={
                  (event) =>
                    setAccountForm({
                      ...accountForm,

                      accountType:
                        parseAccountType(
                          event.target.value,
                        ),
                    })
                }
              >
                <option value="bank_account">
                  Cuenta bancaria
                </option>

                <option value="virtual_wallet">
                  Billetera virtual
                </option>

                <option value="cash">
                  Efectivo
                </option>

                <option value="other">
                  Otro
                </option>
              </select>
            </label>

            <label>
              <span>
                Titular
              </span>

              <input
                required
                value={
                  accountForm.holderName
                }
                onChange={
                  (event) =>
                    setAccountForm({
                      ...accountForm,

                      holderName:
                        event.target.value,
                    })
                }
                placeholder="Nombre o razón social"
              />
            </label>

            <label>
              <span>
                Alias
              </span>

              <input
                value={
                  accountForm.alias
                }
                onChange={
                  (event) =>
                    setAccountForm({
                      ...accountForm,

                      alias:
                        event.target.value,
                    })
                }
                placeholder="FULANITAS.PAGOS"
              />
            </label>

            <label>
              <span>
                CBU o CVU
              </span>

              <input
                inputMode="numeric"
                value={
                  accountForm.accountNumber
                }
                onChange={
                  (event) =>
                    setAccountForm({
                      ...accountForm,

                      accountNumber:
                        event.target.value,
                    })
                }
                placeholder="22 dígitos"
              />
            </label>

            <label>
              <span>
                CUIT
              </span>

              <input
                value={
                  accountForm.taxId
                }
                onChange={
                  (event) =>
                    setAccountForm({
                      ...accountForm,

                      taxId:
                        event.target.value,
                    })
                }
                placeholder="Opcional"
              />
            </label>

            <label>
              <span>
                Moneda
              </span>

              <select
                value={
                  accountForm.currency
                }
                onChange={
                  (event) =>
                    setAccountForm({
                      ...accountForm,

                      currency:
                        parseCurrency(
                          event.target.value,
                        ),
                    })
                }
              >
                <option value="ARS">
                  ARS
                </option>

                <option value="USD">
                  USD
                </option>

                <option value="EUR">
                  EUR
                </option>
              </select>
            </label>

            <label
              className={
                styles.paymentFullField
              }
            >
              <span>
                Instrucciones adicionales
              </span>

              <textarea
                rows={3}
                value={
                  accountForm.instructions
                }
                onChange={
                  (event) =>
                    setAccountForm({
                      ...accountForm,

                      instructions:
                        event.target.value,
                    })
                }
                placeholder="Texto opcional que verá el cliente."
              />
            </label>
          </div>

          <button
            type="submit"
            className={
              styles.paymentPrimaryButton
            }
            disabled={
              Boolean(action)
            }
          >
            {action
              === "Alta de cuenta"
                ? "Guardando…"
                : "Agregar cuenta"}
          </button>
        </form>
      </div>

      <div
        className={
          styles.paymentOwnerPanel
        }
      >
        <div>
          <div
            className={
              styles.eyebrow
            }
          >
            Control por WhatsApp
          </div>

          <h3>
            Número único del dueño
          </h3>

          <p>
            Desde ese número se podrá solicitar el cambio
            de cuenta de cobro y confirmar la selección.
            El panel sólo mostrará los últimos dos dígitos.
          </p>
        </div>

        {settings?.owner.configured ? (
          <div
            className={
              styles.paymentOwnerLocked
            }
          >
            <span>
              WhatsApp configurado
            </span>

            <strong>
              {settings.owner.maskedPhone}
            </strong>

            <small>
              Bloqueado permanentemente desde el panel
            </small>
          </div>
        ) : (
          <form
            className={
              styles.paymentOwnerForm
            }
            onSubmit={
              initializeOwner
            }
          >
            <label>
              <span>
                WhatsApp del dueño
              </span>

              <input
                required
                inputMode="tel"
                autoComplete="tel"
                value={
                  ownerPhone
                }
                onChange={
                  (event) =>
                    setOwnerPhone(
                      event.target.value,
                    )
                }
                placeholder="54911…"
              />
            </label>

            <label
              className={
                styles.paymentConfirmation
              }
            >
              <input
                type="checkbox"
                checked={
                  ownerConfirmed
                }
                onChange={
                  (event) =>
                    setOwnerConfirmed(
                      event.target.checked,
                    )
                }
              />

              <span>
                Confirmo que este número es correcto y
                entiendo que no podrá cambiarse desde
                la interfaz ni mediante la API ordinaria.
              </span>
            </label>

            <button
              type="submit"
              className={
                styles.paymentDangerPrimaryButton
              }
              disabled={
                Boolean(action)
                || !ownerConfirmed
              }
            >
              {action
              === "Configuración del WhatsApp dueño"
                ? "Configurando…"
                : "Configurar permanentemente"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
