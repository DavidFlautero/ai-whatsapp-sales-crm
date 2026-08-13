import {
  runCatalogMediaMonitor,
} from "../services/catalog/catalog-media-monitor.service.js";


function argument(
  prefix:
    string,
) {
  return process.argv
    .slice(2)
    .find(
      (value) =>
        value.startsWith(
          prefix,
        ),
    )
    ?.slice(
      prefix.length,
    );
}


const companyId =
  argument(
    "--company=",
  )
  || process.env
    .DEFAULT_COMPANY_ID
  || "fulanitas";


try {
  const result =
    await runCatalogMediaMonitor({
      companyId,

      source:
        "cron",
    });

  console.log(
    JSON.stringify(
      result,
      null,
      2,
    ),
  );

} catch (error) {
  console.error(
    "[CATALOG MEDIA MONITOR FATAL]",
    error,
  );

  process.exitCode =
    1;
}
