module.exports = {
  apps: [
    {
      name: "ventas-voice",
      cwd:
        "/opt/ventas-ia-mayorista/apps/voice-worker",
      script: ".venv/bin/python",
      args: "-m voice_worker.run",
      interpreter: "none",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "3200M",
      kill_timeout: 15000,
      restart_delay: 3000,
      exp_backoff_restart_delay: 200,
      time: true,
      env: {
        PYTHONUNBUFFERED: "1",
        PYTHONPATH:
          "/opt/ventas-ia-mayorista/apps/voice-worker",
        VOICE_BIND_HOST: "127.0.0.1",
        VOICE_HTTP_PORT: "4100",
        VOICE_AUDIOSOCKET_HOST:
          "127.0.0.1",
        VOICE_AUDIOSOCKET_PORT: "9019",
        VOICE_SAMPLE_RATE: "16000",
        VOICE_MAX_SESSIONS: "1",
        VOICE_ALLOW_UNSAFE_DEMO: "true",
      },
      error_file:
        "/opt/ventas-ia-mayorista/logs/voice-error.log",
      out_file:
        "/opt/ventas-ia-mayorista/logs/voice-out.log",
      merge_logs: true,
    },
  ],
};
