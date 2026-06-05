const canvas = document.querySelector("#signalCanvas");
const context = canvas.getContext("2d");
const statusDot = document.querySelector("[data-status-dot]");
const statusLabel = document.querySelector("[data-status-label]");
const latencyValue = document.querySelector("[data-latency]");
const checksValue = document.querySelector("[data-checks]");
const uptimeValue = document.querySelector("[data-uptime]");
const clockValue = document.querySelector("[data-clock]");
const endpointValue = document.querySelector("[data-endpoint]");
const runButton = document.querySelector("[data-run-test]");
const resetButton = document.querySelector("[data-reset]");
const logList = document.querySelector("[data-log]");

const startedAt = Date.now();
const endpoints = ["remote-01", "edge-17", "relay-42", "core-08"];

let checks = 0;
let latency = null;
let pulse = 0;
let health = "ready";

function formatDuration(totalSeconds) {
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function setStatus(nextHealth, label) {
  health = nextHealth;
  statusDot.className = "status-dot";

  if (nextHealth === "good") {
    statusDot.classList.add("good");
  }

  if (nextHealth === "slow") {
    statusDot.classList.add("slow");
  }

  statusLabel.textContent = label;
}

function addLog(message) {
  const item = document.createElement("li");
  item.textContent = message;
  logList.prepend(item);

  while (logList.children.length > 5) {
    logList.lastElementChild.remove();
  }
}

function runTest() {
  checks += 1;
  latency = Math.round(32 + Math.random() * 210);
  const endpoint = endpoints[checks % endpoints.length];

  endpointValue.textContent = endpoint;
  checksValue.textContent = String(checks);
  latencyValue.textContent = `${latency} ms`;

  if (latency < 120) {
    setStatus("good", "Healthy");
  } else if (latency < 190) {
    setStatus("ready", "Watch");
  } else {
    setStatus("slow", "Slow");
  }

  addLog(`${endpoint} responded in ${latency} ms.`);
  pulse = 1;
}

function resetSession() {
  checks = 0;
  latency = null;
  pulse = 0;
  checksValue.textContent = "0";
  latencyValue.textContent = "-- ms";
  endpointValue.textContent = "remote-01";
  setStatus("ready", "Ready");
  logList.innerHTML = "<li>Ready for first check.</li>";
}

function updateClock() {
  const now = new Date();
  clockValue.textContent = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  uptimeValue.textContent = formatDuration(Math.floor((Date.now() - startedAt) / 1000));
}

function drawSignal() {
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width * 0.5;
  const centerY = height * 0.52;
  const latencyFactor = latency ? Math.min(latency / 250, 1) : 0.36;
  const accent = health === "slow" ? "#d96545" : health === "good" ? "#39b89f" : "#d9a821";

  context.clearRect(0, 0, width, height);

  context.fillStyle = "rgba(255,255,255,0.055)";
  for (let x = 72; x < width; x += 96) {
    for (let y = 72; y < height; y += 96) {
      context.beginPath();
      context.arc(x, y, 2, 0, Math.PI * 2);
      context.fill();
    }
  }

  const nodes = [
    [centerX - 260, centerY - 90],
    [centerX + 260, centerY - 86],
    [centerX - 190, centerY + 150],
    [centerX + 205, centerY + 145],
  ];

  context.strokeStyle = "rgba(255,255,255,0.24)";
  context.lineWidth = 3;
  nodes.forEach(([x, y]) => {
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(x, y);
    context.stroke();
  });

  const radius = 62 + pulse * 170;
  context.strokeStyle = accent;
  context.globalAlpha = 0.28 + pulse * 0.32;
  context.lineWidth = 10 - pulse * 6;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.stroke();
  context.globalAlpha = 1;

  nodes.forEach(([x, y], index) => {
    const size = 18 + (index + 1) * 2;
    context.fillStyle = index % 2 === 0 ? "#f0c653" : "#e78364";
    context.beginPath();
    context.arc(x, y, size, 0, Math.PI * 2);
    context.fill();
  });

  context.fillStyle = accent;
  context.beginPath();
  context.arc(centerX, centerY, 44 + latencyFactor * 18, 0, Math.PI * 2);
  context.fill();

  context.fillStyle = "#ffffff";
  context.font = "700 28px system-ui, sans-serif";
  context.textAlign = "center";
  context.fillText(latency ? `${latency} ms` : "Ready", centerX, centerY + 10);

  pulse = Math.max(0, pulse - 0.012);
  requestAnimationFrame(drawSignal);
}

runButton.addEventListener("click", runTest);
resetButton.addEventListener("click", resetSession);

updateClock();
setInterval(updateClock, 1000);
drawSignal();
