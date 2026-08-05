"use client";

import {
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import styles from "./conversations-center.module.css";

import {
  ContactEditor,
} from "./ContactEditor";

import {
  MessageMedia,
} from "./MessageMedia";

type Conversation = {
  id?: string;
  contact_id?: string;
  contact_phone: string;
  status?: string;
  last_message?: string;
  last_message_at?: string;
};

type Message = {
  id?: string;
  contact_phone: string;
  direction:
    | "inbound"
    | "outbound";
  body?: string;
  message_type?: string;
  occurred_at?: string;
  created_at?: string;
  media?: Record<string, unknown>;
  delivery_status?: string;
};

type Assignment = {
  company_id?: string;
  contact_phone: string;
  status:
    | "ai"
    | "human"
    | "paused";
  assigned_to?: string | null;
  updated_at?: string;
};

type Contact = {
  id?: string;
  phone: string;
  name?: string;
  business_name?: string;
  status?: string;
  temperature?: string;
  last_message?: string;
  last_seen_at?: string;
  name_source?: string;
  name_confirmed?: boolean;
  metadata?: Record<string, unknown>;
};

type LocalMessage =
  Message & {
    optimistic?: boolean;
  };

type Props = {
  conversations: Conversation[];
  messages: Message[];
  assignments: Assignment[];
  contacts: Contact[];
};

function normalizePhone(
  value: string,
) {
  return value.replace(
    /\D/g,
    "",
  );
}

function initials(
  name: string,
) {
  const parts =
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (
    parts.length === 0
  ) {
    return "?";
  }

  return parts
    .slice(0, 2)
    .map(
      (part) =>
        part[0]
          ?.toUpperCase()
        ?? "",
    )
    .join("");
}

function shortTime(
  value?: string,
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  const now =
    new Date();

  const sameDay =
    date.getFullYear()
      === now.getFullYear()
    && date.getMonth()
      === now.getMonth()
    && date.getDate()
      === now.getDate();

  if (sameDay) {
    return new Intl.DateTimeFormat(
      "es-AR",
      {
        hour:
          "2-digit",

        minute:
          "2-digit",
      },
    ).format(date);
  }

  return new Intl.DateTimeFormat(
    "es-AR",
    {
      day:
        "2-digit",

      month:
        "2-digit",
    },
  ).format(date);
}

function messageSource(
  message: Message,
) {
  if (
    message.direction
      === "inbound"
  ) {
    return "Cliente";
  }

  if (
    message.media
      ?.source
      === "human_operator"
  ) {
    return "Operador";
  }

  return "IA";
}

function messageBubbleClass(
  message: Message,
) {
  if (
    message.direction
      === "inbound"
  ) {
    return styles.bubbleInbound;
  }

  if (
    message.media
      ?.source
      === "human_operator"
  ) {
    return styles.bubbleOperator;
  }

  return styles.bubbleAi;
}

export function ConversationsCenter({
  conversations,
  messages,
  assignments,
  contacts,
}: Props) {
  const router =
    useRouter();

  const messagesEndRef =
    useRef<HTMLDivElement | null>(
      null,
    );

  const previousMessageCountRef =
    useRef(0);

  const [
    selectedPhone,
    setSelectedPhone,
  ] =
    useState(
      conversations[0]
        ?.contact_phone
      ?? "",
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    localAssignments,
    setLocalAssignments,
  ] =
    useState(assignments);

  const [
    localContacts,
    setLocalContacts,
  ] =
    useState(contacts);

  const [
    optimisticMessages,
    setOptimisticMessages,
  ] =
    useState<LocalMessage[]>(
      [],
    );

  const [
    draft,
    setDraft,
  ] =
    useState("");

  const [
    isChangingMode,
    setIsChangingMode,
  ] =
    useState(false);

  const [
    isSending,
    setIsSending,
  ] =
    useState(false);

  const [
    notice,
    setNotice,
  ] =
    useState("");

  const contactsByPhone =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            Contact
          >();

        for (
          const contact
          of localContacts
        ) {
          map.set(
            normalizePhone(
              contact.phone,
            ),
            contact,
          );
        }

        return map;
      },
      [
        localContacts,
      ],
    );

  const selectedConversation =
    conversations.find(
      (conversation) =>
        normalizePhone(
          conversation.contact_phone,
        )
        === normalizePhone(
          selectedPhone,
        ),
    );

  const selectedContact =
    contactsByPhone.get(
      normalizePhone(
        selectedPhone,
      ),
    );

  const selectedName =
    selectedContact
      ?.business_name
    || selectedContact
      ?.name
    || "Cliente sin identificar";

  const selectedAssignment =
    localAssignments.find(
      (assignment) =>
        normalizePhone(
          assignment.contact_phone,
        )
        === normalizePhone(
          selectedPhone,
        ),
    );

  const operatorStatus =
    selectedAssignment
      ?.status
    ?? "ai";

  const isHumanMode =
    operatorStatus === "human";

  const selectedMessages =
    useMemo(
      () => {
        const persisted =
          messages.filter(
            (message) =>
              normalizePhone(
                message.contact_phone,
              )
              === normalizePhone(
                selectedPhone,
              ),
          );

        const optimistic =
          optimisticMessages.filter(
            (message) =>
              normalizePhone(
                message.contact_phone,
              )
              === normalizePhone(
                selectedPhone,
              ),
          );

        return [
          ...persisted,
          ...optimistic,
        ]
          .slice()
          .sort(
            (
              left,
              right,
            ) =>
              String(
                left.occurred_at
                ?? left.created_at
                ?? "",
              ).localeCompare(
                String(
                  right.occurred_at
                  ?? right.created_at
                  ?? "",
                ),
              ),
          );
      },
      [
        messages,
        optimisticMessages,
        selectedPhone,
      ],
    );

  const filteredConversations =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        if (!query) {
          return conversations;
        }

        return conversations.filter(
          (conversation) => {
            const contact =
              contactsByPhone.get(
                normalizePhone(
                  conversation.contact_phone,
                ),
              );

            const haystack = [
              conversation
                .contact_phone,
              conversation
                .last_message,
              contact?.name,
              contact
                ?.business_name,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return haystack.includes(
              query,
            );
          },
        );
      },
      [
        conversations,
        contactsByPhone,
        search,
      ],
    );

  useEffect(
    () => {
      const timer =
        window.setInterval(
          () => {
            if (
              document
                .visibilityState
              === "visible"
            ) {
              router.refresh();
            }
          },
          1000,
        );

      function refreshOnFocus() {
        router.refresh();
      }

      window.addEventListener(
        "focus",
        refreshOnFocus,
      );

      return () => {
        window.clearInterval(
          timer,
        );

        window.removeEventListener(
          "focus",
          refreshOnFocus,
        );
      };
    },
    [
      router,
    ],
  );

  useEffect(
    () => {
      setLocalAssignments(
        assignments,
      );
    },
    [
      assignments,
    ],
  );

  useEffect(
    () => {
      setLocalContacts(
        contacts,
      );
    },
    [
      contacts,
    ],
  );

  useEffect(
    () => {
      if (
        !selectedPhone
        && conversations[0]
      ) {
        setSelectedPhone(
          conversations[0]
            .contact_phone,
        );
      }
    },
    [
      conversations,
      selectedPhone,
    ],
  );

  useEffect(
    () => {
      const persistedIds =
        new Set(
          messages
            .map(
              (message) =>
                message.id,
            )
            .filter(Boolean),
        );

      setOptimisticMessages(
        (current) =>
          current.filter(
            (message) =>
              !message.id
              || !persistedIds.has(
                message.id,
              ),
          ),
      );
    },
    [
      messages,
    ],
  );

  useEffect(
    () => {
      if (
        selectedMessages.length
        > previousMessageCountRef.current
      ) {
        messagesEndRef.current
          ?.scrollIntoView({
            behavior:
              "smooth",

            block:
              "end",
          });
      }

      previousMessageCountRef.current =
        selectedMessages.length;
    },
    [
      selectedMessages.length,
      selectedPhone,
    ],
  );

  async function changeMode(
    status:
      | "ai"
      | "human",
  ) {
    if (
      !selectedPhone
      || isChangingMode
    ) {
      return;
    }

    setIsChangingMode(true);
    setNotice("");

    try {
      const response =
        await fetch(
          "/dashboard-api/operator/mode",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                contact_phone:
                  selectedPhone,

                status,

                reason:
                  status === "human"
                    ? "Tomada desde el panel"
                    : "Devuelta a la IA desde el panel",
              }),
          },
        );

      const payload =
        await response.json();

      if (
        !response.ok
        || !payload.ok
      ) {
        throw new Error(
          payload.error
          ?? "No se pudo cambiar el modo",
        );
      }

      setLocalAssignments(
        (current) => {
          const next =
            current.filter(
              (assignment) =>
                normalizePhone(
                  assignment
                    .contact_phone,
                )
                !== normalizePhone(
                  selectedPhone,
                ),
            );

          next.unshift(
            payload.assignment,
          );

          return next;
        },
      );

      setNotice(
        status === "human"
          ? "Conversación tomada. La IA quedó pausada."
          : "Conversación devuelta a la IA.",
      );

      router.refresh();
    } catch (
      error
    ) {
      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo cambiar el modo",
      );
    } finally {
      setIsChangingMode(false);
    }
  }

  async function sendMessage() {
    const text =
      draft.trim();

    if (
      !selectedPhone
      || !text
      || isSending
    ) {
      return;
    }

    const optimisticId =
      `optimistic-${Date.now()}`;

    const optimisticMessage:
      LocalMessage = {
        id:
          optimisticId,

        contact_phone:
          selectedPhone,

        direction:
          "outbound",

        message_type:
          "text",

        body:
          text,

        occurred_at:
          new Date()
            .toISOString(),

        media: {
          source:
            "human_operator",
        },

        optimistic:
          true,
      };

    setOptimisticMessages(
      (current) => [
        ...current,
        optimisticMessage,
      ],
    );

    setDraft("");
    setIsSending(true);
    setNotice("");

    try {
      const response =
        await fetch(
          "/dashboard-api/operator/message",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                contact_phone:
                  selectedPhone,

                text,
              }),
          },
        );

      const payload =
        await response.json();

      if (
        !response.ok
        || !payload.ok
      ) {
        throw new Error(
          payload.error
          ?? "No se pudo enviar el mensaje",
        );
      }

      setNotice(
        "Mensaje enviado por WhatsApp.",
      );

      router.refresh();
    } catch (
      error
    ) {
      setOptimisticMessages(
        (current) =>
          current.filter(
            (message) =>
              message.id
              !== optimisticId,
          ),
      );

      setDraft(text);

      setNotice(
        error instanceof Error
          ? error.message
          : "No se pudo enviar el mensaje",
      );
    } finally {
      setIsSending(false);
    }
  }

  function handleDraftKeyDown(
    event:
      KeyboardEvent<HTMLTextAreaElement>,
  ) {
    if (
      event.key === "Enter"
      && !event.shiftKey
    ) {
      event.preventDefault();

      if (
        isHumanMode
        && draft.trim()
      ) {
        void sendMessage();
      }
    }
  }

  return (
    <section className={styles.workspace}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div>
            <h2 className={styles.title}>
              Conversaciones
            </h2>

            <div className={styles.live}>
              <span className={styles.liveDot} />
              Actualización en vivo
            </div>
          </div>

          <span className={styles.counter}>
            {filteredConversations.length}
          </span>
        </div>

        <input
          className={styles.search}
          type="search"
          value={search}
          placeholder="Buscar cliente, negocio o teléfono..."
          onChange={
            (
              event,
            ) =>
              setSearch(
                event.target.value,
              )
          }
        />

        <div className={styles.conversationList}>
          {filteredConversations.length
            === 0 ? (
            <div className={styles.empty}>
              No hay conversaciones que coincidan.
            </div>
          ) : (
            filteredConversations.map(
              (
                conversation,
              ) => {
                const phone =
                  conversation
                    .contact_phone;

                const contact =
                  contactsByPhone.get(
                    normalizePhone(
                      phone,
                    ),
                  );

                const name =
                  contact
                    ?.business_name
                  || contact
                    ?.name
                  || "Cliente sin identificar";

                const assignment =
                  localAssignments.find(
                    (item) =>
                      normalizePhone(
                        item.contact_phone,
                      )
                      === normalizePhone(
                        phone,
                      ),
                  );

                const mode =
                  assignment
                    ?.status
                  ?? "ai";

                const selected =
                  normalizePhone(
                    phone,
                  )
                  === normalizePhone(
                    selectedPhone,
                  );

                return (
                  <button
                    type="button"
                    className={[
                      styles.conversation,
                      selected
                        ? styles.conversationSelected
                        : "",
                    ].join(" ")}
                    key={
                      conversation.id
                      ?? phone
                    }
                    onClick={
                      () => {
                        setSelectedPhone(
                          phone,
                        );

                        setNotice("");
                      }
                    }
                  >
                    <div className={styles.avatar}>
                      {contact?.name
                        || contact
                          ?.business_name
                        ? initials(name)
                        : String(phone)
                            .slice(-2)}
                    </div>

                    <div className={styles.conversationBody}>
                      <div className={styles.conversationTop}>
                        <strong className={styles.contactName}>
                          {name}
                        </strong>

                        <span className={styles.time}>
                          {shortTime(
                            conversation
                              .last_message_at,
                          )}
                        </span>
                      </div>

                      <div className={styles.phone}>
                        {phone}
                      </div>

                      <div className={styles.preview}>
                        {conversation
                          .last_message
                          ?? "Sin mensajes"}
                      </div>

                      {!contact?.name
                      && !contact?.business_name ? (
                        <div className={styles.missingName}>
                          Falta identificar al cliente
                        </div>
                      ) : null}
                    </div>

                    <span
                      className={[
                        styles.status,
                        mode === "human"
                          ? styles.statusHuman
                          : mode === "paused"
                            ? styles.statusPaused
                            : styles.statusAi,
                      ].join(" ")}
                    >
                      {mode === "human"
                        ? "OPERADOR"
                        : mode === "paused"
                          ? "PAUSADA"
                          : "IA"}
                    </span>
                  </button>
                );
              },
            )
          )}
        </div>
      </aside>

      <div className={styles.chat}>
        {selectedConversation ? (
          <>
            <header className={styles.chatHeader}>
              <div className={styles.chatIdentity}>
                <div className={styles.avatar}>
                  {selectedContact
                    ?.name
                    || selectedContact
                      ?.business_name
                    ? initials(
                        selectedName,
                      )
                    : String(
                        selectedPhone,
                      ).slice(-2)}
                </div>

                <div>
                  <h2 className={styles.chatName}>
                    {selectedName}
                  </h2>

                  <div className={styles.chatMeta}>
                    {selectedPhone}
                    {" · "}
                    {isHumanMode
                      ? "Atención manual activa"
                      : operatorStatus
                        === "paused"
                        ? "IA pausada"
                        : "IA atendiendo automáticamente"}
                  </div>
                </div>
              </div>

              <div className={styles.headerActions}>
                <ContactEditor
                  contact={{
                    phone:
                      selectedPhone,

                    name:
                      selectedContact
                        ?.name,

                    business_name:
                      selectedContact
                        ?.business_name,

                    status:
                      selectedContact
                        ?.status,

                    temperature:
                      selectedContact
                        ?.temperature,

                    name_confirmed:
                      selectedContact
                        ?.name_confirmed,
                  }}
                  onSaved={
                    (
                      updated,
                    ) => {
                      setLocalContacts(
                        (
                          current,
                        ) => {
                          const filtered =
                            current.filter(
                              (
                                contact,
                              ) =>
                                normalizePhone(
                                  contact.phone,
                                )
                                !== normalizePhone(
                                  updated.phone,
                                ),
                            );

                          return [
                            updated,
                            ...filtered,
                          ];
                        },
                      );

                      setNotice(
                        "Datos del cliente actualizados.",
                      );

                      router.refresh();
                    }
                  }
                />

                {isHumanMode ? (
                  <button
                    type="button"
                    className={[
                      styles.modeButton,
                      styles.modeButtonSecondary,
                    ].join(" ")}
                    disabled={
                      isChangingMode
                    }
                    onClick={
                      () =>
                        void changeMode(
                          "ai",
                        )
                    }
                  >
                    {isChangingMode
                      ? "Cambiando..."
                      : "Devolver a la IA"}
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.modeButton}
                    disabled={
                      isChangingMode
                    }
                    onClick={
                      () =>
                        void changeMode(
                          "human",
                        )
                    }
                  >
                    {isChangingMode
                      ? "Tomando..."
                      : "Tomar conversación"}
                  </button>
                )}
              </div>
            </header>

            <div className={styles.messages}>
              {selectedMessages.length
                === 0 ? (
                <div className={styles.empty}>
                  Todavía no hay mensajes en esta conversación.
                </div>
              ) : (
                selectedMessages.map(
                  (
                    message,
                    index,
                  ) => (
                    <div
                      className={[
                        styles.messageRow,
                        message.direction
                          === "outbound"
                          ? styles.messageOutbound
                          : styles.messageInbound,
                      ].join(" ")}
                      key={
                        message.id
                        ?? `${message.contact_phone}-${message.created_at}-${index}`
                      }
                    >
                      <article
                        className={[
                          styles.bubble,
                          messageBubbleClass(
                            message,
                          ),
                        ].join(" ")}
                      >
                        <div className={styles.messageSource}>
                          {messageSource(
                            message,
                          )}
                          {" · "}
                          {message.message_type
                            ?? "texto"}
                          {(message as LocalMessage).optimistic
                            ? " · enviando"
                            : ""}
                        </div>

                        <div className={styles.messageBody}>
                          {[
                            "image",
                            "audio",
                            "video",
                            "document",
                          ].includes(
                            message.message_type
                            ?? "",
                          ) ? (
                            <MessageMedia
                              messageId={
                                message.id
                              }
                              messageType={
                                message.message_type
                              }
                              body={
                                message.body
                              }
                              media={
                                message.media
                              }
                            />
                          ) : (
                            message.body
                            ?? `[${message.message_type ?? "mensaje"}]`
                          )}
                        </div>

                        <div className={styles.messageTime}>
                          {shortTime(
                            message.occurred_at
                            ?? message.created_at,
                          )}
                        </div>
                      </article>
                    </div>
                  ),
                )
              )}

              <div ref={messagesEndRef} />
            </div>

            <footer className={styles.composer}>
              {!selectedContact?.name
              && !selectedContact?.business_name ? (
                <div className={styles.operatorNotice}>
                  Este contacto todavía no tiene nombre confirmado. El robot debe solicitarlo antes de cerrar un pedido.
                </div>
              ) : null}

              {isHumanMode ? (
                <div className={styles.operatorNotice}>
                  La IA está pausada. Los mensajes enviados desde aquí salen como operador humano.
                </div>
              ) : null}

              <textarea
                className={styles.textarea}
                value={draft}
                disabled={
                  !isHumanMode
                  || isSending
                }
                placeholder={
                  isHumanMode
                    ? "Escribí un mensaje. Enter para enviar, Shift + Enter para nueva línea."
                    : "Tomá la conversación para responder manualmente."
                }
                rows={3}
                maxLength={4096}
                onKeyDown={
                  handleDraftKeyDown
                }
                onChange={
                  (
                    event,
                  ) =>
                    setDraft(
                      event.target.value,
                    )
                }
              />

              <div className={styles.composerFooter}>
                <div className={styles.notice}>
                  {notice
                    || `${draft.length}/4096`}
                </div>

                <button
                  type="button"
                  className={styles.sendButton}
                  disabled={
                    !isHumanMode
                    || !draft.trim()
                    || isSending
                  }
                  onClick={
                    () =>
                      void sendMessage()
                  }
                >
                  {isSending
                    ? "Enviando..."
                    : "Enviar por WhatsApp"}
                </button>
              </div>
            </footer>
          </>
        ) : (
          <div className={styles.empty}>
            Seleccioná una conversación para comenzar.
          </div>
        )}
      </div>
    </section>
  );
}
