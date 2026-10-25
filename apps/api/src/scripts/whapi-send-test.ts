import {
  sendWhapiText,
} from "../services/whapi/whapi.client.js";


const to =
  process.argv[2]
  ?? "";


const body =
  process.argv
    .slice(
      3,
    )
    .join(
      " ",
    )
    .trim();


if (
  !to
  ||
  !body
) {
  console.log(
    "USO:"
  );

  console.log(
    'pnpm exec tsx src/scripts/whapi-send-test.ts 346XXXXXXXX "Prueba Whapi Eventos Mediterraneo"'
  );
}
else {
  try {
    const result =
      await sendWhapiText(
        to,
        body,
      );


    console.log(
      "WHAPI_SEND_OK=1",
    );


    console.log(
      JSON.stringify(
        result,
        null,
        2,
      ),
    );
  }
  catch (
    error
  ) {
    console.error(
      "WHAPI_SEND_OK=0",
    );


    console.error(
      error instanceof Error
        ? error.message
        : error,
    );


    process.exitCode =
      1;
  }
}
