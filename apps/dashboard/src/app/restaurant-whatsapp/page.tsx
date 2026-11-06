import styles from "../../components/conversations/conversations-center.module.css";
import { cookies } from "next/headers";


import {
  ConversationsCenter,
} from "../../components/conversations/conversations-center";

type Inbox = Parameters<typeof ConversationsCenter>[0];

export const dynamic = "force-dynamic";

export default async function RestaurantWhatsappPage() {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");

  const apiBase = (
    process.env.NEXT_PUBLIC_API_URL ??
    "http://127.0.0.1:4000"
  ).replace(/\/+$/, "");

  const response = await fetch(
    `${apiBase}/admin/tenant/conversations`,
    {
      headers: { Cookie: cookieHeader },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `No se pudieron cargar las conversaciones (${response.status})`
    );
  }

  const data = await response.json() as Partial<Inbox>;

  return (
    <main id="deli-chat-full">
      <style>{`
        #deli-chat-full {
          width: 100%;
          height: calc(100dvh - 64px);
          min-height: 560px;
          padding: 12px 16px;
          background: #f3f6f8;
          box-sizing: border-box;
          z-index: 20;
        }

        #deli-chat-full .${styles.workspace} {
          width: 100%;
          height: 100%;
          min-height: 0;
          max-width: none;
          grid-template-columns: minmax(280px, 28%) minmax(0, 1fr);
        }

        #deli-chat-full .${styles.sidebar} {
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        #deli-chat-full .${styles.conversationList} {
          flex: 1;
          min-height: 0;
          max-height: none;
          overflow-y: auto;
        }

        #deli-chat-full .${styles.chat} {
          min-height: 0;
        }

        #deli-chat-full .${styles.messages} {
          min-height: 0;
          max-height: none;
          overflow-y: auto;
        }

        @media (max-width: 1050px) {
          #deli-chat-full {
            height: auto;
            min-height: calc(100dvh - 64px);
            padding: 12px;
          }

          #deli-chat-full .${styles.workspace} {
            height: auto;
            grid-template-columns: minmax(0, 1fr);
          }

          #deli-chat-full .${styles.chat} {
            min-height: 480px;
          }

          #deli-chat-full .${styles.conversationList} {
            max-height: 320px;
          }
        }
      `}</style>
      <ConversationsCenter
        conversations={data.conversations ?? []}
        messages={data.messages ?? []}
        assignments={data.assignments ?? []}
        contacts={data.contacts ?? []}
      />
    </main>
  );
}
