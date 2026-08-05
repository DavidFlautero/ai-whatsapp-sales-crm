import {
  env,
} from "../../config/env.js";

import {
  isSupabaseConfigured,
  supabaseRequest,
} from "../db/supabase-rest.client.js";

import {
  upsertContact,
  type Contact,
} from "../crm/crm.repository.js";

export type Conversation = {
  id?: string;

  company_id?: string;
  contact_id?: string;

  contact_phone: string;

  channel?: string;
  status?: string;

  last_message?: string;
  last_message_at?: string;

  metadata?:
    Record<string, unknown>;
};

export type Message = {
  id?: string;

  company_id?: string;

  conversation_id?: string;
  contact_id?: string;

  contact_phone: string;

  external_message_id?:
    string | null;

  direction:
    | "inbound"
    | "outbound";

  channel?: string;
  message_type?: string;

  body?: string;

  media?:
    Record<string, unknown>;

  raw_payload?: unknown;

  delivery_status?: string;

  occurred_at?: string;
  created_at?: string;
};

const memoryConversations =
  new Map<string, Conversation>();

const memoryMessages:
  Message[] = [];

function conversationKey(
  companyId: string,
  phone: string,
  channel: string,
) {
  return `${companyId}:${channel}:${phone}`;
}

export async function getOrCreateConversation(
  phone: string,
  lastMessage?: string,
  companyId =
    env.DEFAULT_COMPANY_ID,
  channel =
    "whatsapp",
) {
  const contact:
    Contact =
      await upsertContact(
        {
          phone,

          last_message:
            lastMessage,
        },
        companyId,
      );

  if (!contact.id) {
    throw new Error(
      "CRM_CONTACT_ID_REQUIRED",
    );
  }

  const now =
    new Date().toISOString();

  if (
    !isSupabaseConfigured()
  ) {
    const key =
      conversationKey(
        companyId,
        phone,
        channel,
      );

    const existing =
      memoryConversations.get(
        key,
      );

    if (existing) {
      existing.last_message =
        lastMessage
        ?? existing.last_message;

      existing.last_message_at =
        now;

      return {
        conversation:
          existing,

        contact,
      };
    }

    const created:
      Conversation = {
        id:
          crypto.randomUUID(),

        company_id:
          companyId,

        contact_id:
          contact.id,

        contact_phone:
          phone,

        channel,

        status:
          "open",

        last_message:
          lastMessage,

        last_message_at:
          now,

        metadata:
          {},
      };

    memoryConversations.set(
      key,
      created,
    );

    return {
      conversation:
        created,

      contact,
    };
  }

  const existing =
    await supabaseRequest<
      Conversation[]
    >({
      table:
        "conversations",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&contact_id=eq.${encodeURIComponent(contact.id)}`
        + `&channel=eq.${encodeURIComponent(channel)}`
        + "&select=*"
        + "&limit=1",
    });

  if (existing[0]) {
    const rows =
      await supabaseRequest<
        Conversation[]
      >({
        table:
          "conversations",

        method:
          "PATCH",

        query:
          `?company_id=eq.${encodeURIComponent(companyId)}`
          + `&id=eq.${encodeURIComponent(existing[0].id ?? "")}`,

        prefer:
          "return=representation",

        body: {
          last_message:
            lastMessage,

          last_message_at:
            now,
        },
      });

    return {
      conversation:
        rows[0]
        ?? {
          ...existing[0],

          last_message:
            lastMessage,

          last_message_at:
            now,
        },

      contact,
    };
  }

  const rows =
    await supabaseRequest<
      Conversation[]
    >({
      table:
        "conversations",

      method:
        "POST",

      prefer:
        "return=representation",

      body: [
        {
          company_id:
            companyId,

          contact_id:
            contact.id,

          contact_phone:
            phone,

          channel,

          status:
            "open",

          last_message:
            lastMessage,

          last_message_at:
            now,

          metadata:
            {},
        },
      ],
    });

  const conversation =
    rows[0];

  if (!conversation?.id) {
    throw new Error(
      "CONVERSATION_CREATE_FAILED",
    );
  }

  return {
    conversation,
    contact,
  };
}

export async function findMessageByExternalId(
  externalMessageId: string,
  companyId =
    env.DEFAULT_COMPANY_ID,
) {
  if (
    !isSupabaseConfigured()
  ) {
    return (
      memoryMessages.find(
        (message) =>
          message.company_id
            === companyId
          && message.external_message_id
            === externalMessageId,
      )
      ?? null
    );
  }

  const rows =
    await supabaseRequest<
      Message[]
    >({
      table:
        "messages",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&external_message_id=eq.${encodeURIComponent(externalMessageId)}`
        + "&select=*"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}

export async function saveMessage(
  input: Message,
  companyId =
    env.DEFAULT_COMPANY_ID,
) {
  if (
    input.external_message_id
  ) {
    const duplicate =
      await findMessageByExternalId(
        input.external_message_id,
        companyId,
      );

    if (duplicate) {
      return {
        message:
          duplicate,

        duplicate:
          true,
      };
    }
  }

  const {
    conversation,
    contact,
  } =
    await getOrCreateConversation(
      input.contact_phone,
      input.body,
      companyId,
      input.channel
        ?? "whatsapp",
    );

  if (
    !conversation.id
    || !contact.id
  ) {
    throw new Error(
      "MESSAGE_CONTEXT_INCOMPLETE",
    );
  }

  const now =
    new Date().toISOString();

  const message:
    Message = {
      ...input,

      company_id:
        companyId,

      conversation_id:
        conversation.id,

      contact_id:
        contact.id,

      channel:
        input.channel
        ?? "whatsapp",

      message_type:
        input.message_type
        ?? "text",

      media:
        input.media
        ?? {},

      delivery_status:
        input.delivery_status
        ?? (
          input.direction
            === "inbound"
            ? "received"
            : "sent"
        ),

      occurred_at:
        input.occurred_at
        ?? now,

      created_at:
        now,
    };

  if (
    !isSupabaseConfigured()
  ) {
    memoryMessages.unshift(
      message,
    );

    return {
      message,
      duplicate:
        false,
    };
  }

  const rows =
    await supabaseRequest<
      Message[]
    >({
      table:
        "messages",

      method:
        "POST",

      prefer:
        "return=representation",

      body: [
        message,
      ],
    });

  const stored =
    rows[0];

  if (!stored?.id) {
    throw new Error(
      "MESSAGE_CREATE_FAILED",
    );
  }

  return {
    message:
      stored,

    duplicate:
      false,
  };
}

export async function listConversations(
  companyId =
    env.DEFAULT_COMPANY_ID,
) {
  if (
    !isSupabaseConfigured()
  ) {
    return Array
      .from(
        memoryConversations.values(),
      )
      .filter(
        (conversation) =>
          conversation.company_id
          === companyId,
      )
      .sort(
        (a, b) =>
          String(
            b.last_message_at,
          )
            .localeCompare(
              String(
                a.last_message_at,
              ),
            ),
      );
  }

  return supabaseRequest<
    Conversation[]
  >({
    table:
      "conversations",

    query:
      `?company_id=eq.${encodeURIComponent(companyId)}`
      + "&select=*"
      + "&order=last_message_at.desc",
  });
}

export async function listMessages(
  phone?: string,
  companyId =
    env.DEFAULT_COMPANY_ID,
) {
  if (
    !isSupabaseConfigured()
  ) {
    return memoryMessages
      .filter(
        (message) =>
          message.company_id
          === companyId,
      )
      .filter(
        (message) =>
          phone
            ? message.contact_phone
              === phone
            : true,
      );
  }

  const base =
    `?company_id=eq.${encodeURIComponent(companyId)}`;

  const query =
    phone
      ? base
        + `&contact_phone=eq.${encodeURIComponent(phone)}`
        + "&select=*"
        + "&order=occurred_at.desc"
      : base
        + "&select=*"
        + "&order=occurred_at.desc"
        + "&limit=200";

  return supabaseRequest<
    Message[]
  >({
    table:
      "messages",

    query,
  });
}

export async function updateMessageBody(
  messageId: string,
  body: string,
  companyId = env.DEFAULT_COMPANY_ID,
): Promise<Message> {
  if (!isSupabaseConfigured()) {
    const message =
      memoryMessages.find(
        (item) =>
          item.id === messageId
          && item.company_id === companyId,
      );

    if (!message) {
      throw new Error("MESSAGE_NOT_FOUND");
    }

    message.body = body;

    if (message.conversation_id) {
      for (const conversation of memoryConversations.values()) {
        if (
          conversation.id === message.conversation_id
          && conversation.company_id === companyId
        ) {
          conversation.last_message = body;
          conversation.last_message_at =
            new Date().toISOString();
        }
      }
    }

    return message;
  }

  const rows =
    await supabaseRequest<Message[]>({
      table: "messages",
      method: "PATCH",
      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&id=eq.${encodeURIComponent(messageId)}`,
      prefer: "return=representation",
      body: {
        body,
      },
    });

  const updated = rows[0];

  if (!updated?.id) {
    throw new Error("MESSAGE_UPDATE_FAILED");
  }

  if (updated.conversation_id) {
    await supabaseRequest<Conversation[]>({
      table: "conversations",
      method: "PATCH",
      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&id=eq.${encodeURIComponent(updated.conversation_id)}`,
      prefer: "return=representation",
      body: {
        last_message: body,
        last_message_at:
          new Date().toISOString(),
      },
    });
  }

  return updated;
}


export async function getConversationByPhone(
  phone: string,
  companyId = env.DEFAULT_COMPANY_ID,
  channel = "whatsapp",
): Promise<Conversation | null> {
  if (!isSupabaseConfigured()) {
    return (
      memoryConversations.get(
        conversationKey(
          companyId,
          phone,
          channel,
        ),
      )
      ?? null
    );
  }

  const rows =
    await supabaseRequest<
      Conversation[]
    >({
      table:
        "conversations",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&contact_phone=eq.${encodeURIComponent(phone)}`
        + `&channel=eq.${encodeURIComponent(channel)}`
        + "&select=*"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}

export async function updateConversationMetadata(
  phone: string,
  metadata:
    Record<string, unknown>,
  companyId = env.DEFAULT_COMPANY_ID,
  channel = "whatsapp",
): Promise<Conversation> {
  const existing =
    await getConversationByPhone(
      phone,
      companyId,
      channel,
    );

  if (!existing?.id) {
    const created =
      await getOrCreateConversation(
        phone,
        undefined,
        companyId,
        channel,
      );

    if (!created.conversation.id) {
      throw new Error(
        "CONVERSATION_ID_REQUIRED",
      );
    }

    return updateConversationMetadata(
      phone,
      metadata,
      companyId,
      channel,
    );
  }

  const mergedMetadata = {
    ...(existing.metadata
      ?? {}),
    ...metadata,
  };

  if (!isSupabaseConfigured()) {
    existing.metadata =
      mergedMetadata;

    return existing;
  }

  const rows =
    await supabaseRequest<
      Conversation[]
    >({
      table:
        "conversations",

      method:
        "PATCH",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&id=eq.${encodeURIComponent(existing.id)}`,

      prefer:
        "return=representation",

      body: {
        metadata:
          mergedMetadata,

        updated_at:
          new Date()
            .toISOString(),
      },
    });

  const updated =
    rows[0];

  if (!updated?.id) {
    throw new Error(
      "CONVERSATION_METADATA_UPDATE_FAILED",
    );
  }

  return updated;
}

export async function getMessageById(
  messageId: string,
  companyId =
    env.DEFAULT_COMPANY_ID,
) {
  const cleanId =
    messageId.trim();

  if (!cleanId) {
    throw new Error(
      "MESSAGE_ID_REQUIRED",
    );
  }

  if (
    !isSupabaseConfigured()
  ) {
    return (
      memoryMessages.find(
        (message) =>
          message.company_id
            === companyId
          && message.id
            === cleanId,
      )
      ?? null
    );
  }

  const rows =
    await supabaseRequest<
      Message[]
    >({
      table:
        "messages",

      query:
        `?company_id=eq.${encodeURIComponent(companyId)}`
        + `&id=eq.${encodeURIComponent(cleanId)}`
        + "&select=*"
        + "&limit=1",
    });

  return rows[0]
    ?? null;
}
