import {
  randomUUID,
} from "node:crypto";

import {
  salesAgentReply,
} from "../services/agent/sales-agent.service.js";

import {
  saveMessage,
} from "../services/conversations/conversation.repository.js";

import {
  supabaseRequest,
} from "../services/db/supabase-rest.client.js";


const companyId =
  "fulanitas";

const phone =
  "5491100007777";


async function talk(
  text: string,
) {
  const externalId =
    `smoke-${randomUUID()}`;

  const inbound =
    await saveMessage(
      {
        contact_phone:
          phone,

        external_message_id:
          externalId,

        direction:
          "inbound",

        channel:
          "whatsapp",

        message_type:
          "text",

        body:
          text,

        raw_payload: {
          smoke_test:
            true,
        },

        delivery_status:
          "received",
      },
      companyId,
    );

  console.log(
    `\nCLIENTE > ${text}`,
  );

  const response =
    await salesAgentReply({
      companyId,

      phone,

      message:
        text,

      currentMessageId:
        inbound.message?.id,
    });

  console.log(
    `IA      > ${response.text}`,
  );

  await saveMessage(
    {
      contact_phone:
        phone,

      external_message_id:
        `smoke-out-${randomUUID()}`,

      direction:
        "outbound",

      channel:
        "whatsapp",

      message_type:
        "text",

      body:
        response.text,

      raw_payload: {
        smoke_test:
          true,
      },

      delivery_status:
        "sent",
    },
    companyId,
  );
}


async function main() {
  console.log(
    "===== SMOKE TEST FINAL =====",
  );

  await talk(
    "Hola, quiero hacer una compra",
  );

  await talk(
    "Que tienes disponible?",
  );

  await talk(
    "Quiero 2 cintos",
  );

  await talk(
    "Si, confirmo el pedido",
  );

  /*
   * A partir de acá respondemos exactamente
   * el formulario de envío.
   */
  await talk(
    "Luis Prueba",
  );

  await talk(
    "Buenos Aires",
  );

  await talk(
    "CABA",
  );

  await talk(
    "Av. Corrientes 1234",
  );

  await talk(
    "Si, confirmo",
  );

  /*
   * Ya creado el pedido:
   * probamos pago + consulta de pedidos.
   */
  await talk(
    "Como pago?",
  );

  await talk(
    "Que pedidos tengo?",
  );


  console.log(
    "\n===== PEDIDO DE PRUEBA =====",
  );

  const orders =
    await supabaseRequest<
      Array<Record<string, unknown>>
    >({
      table:
        "commerce_orders",

      query:
        `?company_id=eq.${companyId}`
        + "&total=eq.44000"
        + "&select=id,number,total,paid_amount,payment_status,commercial_status,reservation_status,created_at"
        + "&order=created_at.desc"
        + "&limit=3",
    });

  console.log(
    JSON.stringify(
      orders,
      null,
      2,
    ),
  );


  console.log(
    "\n===== STOCK CINTOS =====",
  );

  const stock =
    await supabaseRequest<
      Array<Record<string, unknown>>
    >({
      table:
        "commerce_stock_balances",

      query:
        `?company_id=eq.${companyId}`
        + "&on_hand=eq.50"
        + "&select=on_hand,reserved,committed,available,updated_at"
        + "&order=updated_at.desc"
        + "&limit=1",
    });

  console.log(
    JSON.stringify(
      stock,
      null,
      2,
    ),
  );


  if (!orders.length) {
    throw new Error(
      "FAIL: no existe pedido nuevo por ARS 44.000",
    );
  }

  const latest =
    orders[0];

  console.log(
    "\n===== RESULTADO FINAL =====",
  );

  console.log(
    `Pedido: ${String(latest.number)}`,
  );

  console.log(
    `Total: ${String(latest.total)}`,
  );

  console.log(
    `Pago: ${String(latest.payment_status)}`,
  );

  console.log(
    `Reserva: ${String(latest.reservation_status)}`,
  );

  console.log(
    "\n✅ SMOKE TEST COMPLETADO",
  );
}


main()
  .catch(
    (error) => {
      console.error(
        "\n❌ SMOKE TEST FAIL",
      );

      console.error(
        error,
      );

      process.exitCode =
        1;
    },
  );
