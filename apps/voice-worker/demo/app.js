const get = (id) =>
  document.getElementById(id);

const startButton = get("start");
const stopButton = get("stop");
const interruptButton = get("interrupt");
const stateNode = get("state");
const eventsNode = get("events");
const transcriptNode = get("transcript");

let socket = null;
let context = null;
let mediaStream = null;
let microphoneSource = null;
let captureNode = null;
let activeAudio = null;
let expectedMimeType = null;


function writeEvent(type, data = {}) {
  const line = [
    new Date().toISOString(),
    type,
    JSON.stringify(data),
  ].join(" ");

  eventsNode.textContent = (
    `${line}\n${eventsNode.textContent}`
  ).slice(0, 16000);
}


function setState(value) {
  stateNode.textContent = value;
}


function addBubble(role, text) {
  const bubble = document.createElement("div");

  bubble.className = `bubble ${role}`;
  bubble.textContent = text;

  transcriptNode.appendChild(bubble);

  bubble.scrollIntoView({
    behavior: "smooth",
    block: "end",
  });
}


async function playAudio(
  audioBuffer,
  mimeType,
) {
  if (activeAudio) {
    activeAudio.pause();

    if (activeAudio.src) {
      URL.revokeObjectURL(
        activeAudio.src,
      );
    }
  }

  const blob = new Blob(
    [audioBuffer],
    {
      type: mimeType || "audio/wav",
    },
  );

  const url = URL.createObjectURL(blob);

  activeAudio = new Audio(url);

  activeAudio.onended = () => {
    URL.revokeObjectURL(url);
    activeAudio = null;
    setState("Escuchando");
  };

  setState("Respondiendo");

  await activeAudio.play();
}


async function startMicrophone() {
  context = new AudioContext({
    latencyHint: "interactive",
  });

  await context.audioWorklet.addModule(
    "./pcm-worklet.js",
  );

  mediaStream =
    await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

  microphoneSource =
    context.createMediaStreamSource(
      mediaStream,
    );

  captureNode = new AudioWorkletNode(
    context,
    "pcm16-capture",
    {
      processorOptions: {
        targetRate: 16000,
      },
    },
  );

  captureNode.port.onmessage = ({
    data,
  }) => {
    if (
      socket
      && socket.readyState
        === WebSocket.OPEN
    ) {
      socket.send(data);
    }
  };

  const silentGain =
    context.createGain();

  silentGain.gain.value = 0;

  microphoneSource
    .connect(captureNode)
    .connect(silentGain)
    .connect(context.destination);
}


async function stopMicrophone() {
  if (mediaStream) {
    for (
      const track
      of mediaStream.getTracks()
    ) {
      track.stop();
    }
  }

  captureNode?.disconnect();
  microphoneSource?.disconnect();

  if (context) {
    await context.close();
  }

  mediaStream = null;
  captureNode = null;
  microphoneSource = null;
  context = null;
}


function buildSocketUrl() {
  const endpoint = new URL(
    get("endpoint").value,
  );

  endpoint.searchParams.set(
    "token",
    get("token").value,
  );

  endpoint.searchParams.set(
    "company_id",
    get("company").value,
  );

  endpoint.searchParams.set(
    "language",
    get("language").value,
  );

  endpoint.searchParams.set(
    "call_id",
    crypto.randomUUID(),
  );

  return endpoint.toString();
}


async function connect() {
  startButton.disabled = true;
  setState("Conectando");

  await startMicrophone();

  socket = new WebSocket(
    buildSocketUrl(),
  );

  socket.binaryType = "arraybuffer";

  socket.onopen = () => {
    writeEvent("websocket.open");
  };

  socket.onmessage = async ({
    data,
  }) => {
    if (data instanceof ArrayBuffer) {
      if (expectedMimeType) {
        await playAudio(
          data,
          expectedMimeType,
        );
      }

      expectedMimeType = null;
      return;
    }

    const frame = JSON.parse(data);

    writeEvent(
      frame.type,
      frame,
    );

    if (frame.type === "ready") {
      stopButton.disabled = false;
      interruptButton.disabled = false;
      setState("Escuchando");
      return;
    }

    if (
      frame.type === "speech_started"
    ) {
      if (activeAudio) {
        activeAudio.pause();
        activeAudio = null;
      }

      setState("Te escucho");
      return;
    }

    if (frame.type === "processing") {
      setState("Pensando");
      return;
    }

    if (frame.type === "result") {
      addBubble(
        "user",
        frame.transcript,
      );

      addBubble(
        "assistant",
        frame.reply,
      );

      expectedMimeType =
        frame.mime_type;

      return;
    }

    if (frame.type === "error") {
      setState(
        `Error: ${frame.message}`,
      );
    }
  };

  socket.onerror = (error) => {
    writeEvent(
      "websocket.error",
      {
        message: error.message,
      },
    );
  };

  socket.onclose = async ({
    code,
    reason,
  }) => {
    writeEvent(
      "websocket.close",
      {
        code,
        reason,
      },
    );

    await stopMicrophone();

    startButton.disabled = false;
    stopButton.disabled = true;
    interruptButton.disabled = true;

    setState("Desconectado");
  };
}


function interrupt() {
  activeAudio?.pause();
  activeAudio = null;

  if (
    socket
    && socket.readyState
      === WebSocket.OPEN
  ) {
    socket.send(
      JSON.stringify({
        type: "interrupt",
      }),
    );
  }

  setState("Escuchando");
}


function disconnect() {
  if (
    socket
    && socket.readyState
      === WebSocket.OPEN
  ) {
    socket.send(
      JSON.stringify({
        type: "stop",
      }),
    );

    socket.close(
      1000,
      "user_stop",
    );
  }
}


startButton.addEventListener(
  "click",
  () => {
    connect().catch((error) => {
      writeEvent(
        "start.failed",
        {
          message: error.message,
        },
      );

      setState(
        `Error: ${error.message}`,
      );

      startButton.disabled = false;
    });
  },
);

interruptButton.addEventListener(
  "click",
  interrupt,
);

stopButton.addEventListener(
  "click",
  disconnect,
);
