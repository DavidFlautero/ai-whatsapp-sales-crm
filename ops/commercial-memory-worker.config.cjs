module.exports = {
  apps: [
    {
      name: "eventos-commercial-memory",
      cwd: "/var/www/control/apps/api",

      script: "node",

      args:
        "--env-file=../../.env --import tsx scripts/commercial-memory/run-worker.ts",

      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      min_uptime: "10s",

      env: {
        CM_COMPANY_ID: "eventos-mediterraneo",
        CM_WRITE_ENABLED: "true",
        CM_AI_ENABLED: "false",
        CM_POLL_MS: "30000",
        CM_START_AT: "2026-01-01T00:00:00.000Z",
      },
    },
  ],
};
