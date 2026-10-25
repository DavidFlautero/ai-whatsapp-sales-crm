import {
  getWhapiHealth,
} from "../services/whapi/whapi.client.js";


try {
  const result =
    await getWhapiHealth();


  console.log(
    "WHAPI_HEALTH_OK=1",
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
    "WHAPI_HEALTH_OK=0",
  );


  console.error(
    error instanceof Error
      ? error.message
      : error,
  );


  process.exitCode =
    1;
}
