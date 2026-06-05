const API_URL =
  "https://api.animethemes.moe/video?sort=random&page%5Bsize%5D=1&include=animethemeentries.animetheme.anime";

const statusDot = document.querySelector("[data-status-dot]");
const statusLabel = document.querySelector("[data-status-label]");
const player = document.querySelector("[data-player]");
const emptyState = document.querySelector("[data-empty-state]");
const animeTitle = document.querySelector("[data-anime-title]");
const themeTitle = document.querySelector("[data-theme-title]");
const videoMeta = document.querySelector("[data-video-meta]");
const clockValue = document.querySelector("[data-clock]");
const warning = document.querySelector("[data-warning]");
const fileName = document.querySelector("[data-file-name]");
const randomButton = document.querySelector("[data-random-video]");
const replayButton = document.querySelector("[data-replay]");
const sourceValue = document.querySelector("[data-source]");
const resolutionValue = document.querySelector("[data-resolution]");
const sizeValue = document.querySelector("[data-size]");
const flagsValue = document.querySelector("[data-flags]");

function setStatus(state, label) {
  statusDot.className = "status-dot";

  if (state === "good") {
    statusDot.classList.add("good");
  }

  if (state === "slow") {
    statusDot.classList.add("slow");
  }

  statusLabel.textContent = label;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "--";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function getPrimaryEntry(video) {
  return Array.isArray(video.animethemeentries) ? video.animethemeentries[0] : null;
}

function getAnimeName(entry) {
  return entry?.animetheme?.anime?.name || "Unknown anime";
}

function getThemeLabel(entry, video) {
  const theme = entry?.animetheme;
  const type = theme?.type || "";
  const slug = theme?.slug || video.filename || video.basename;
  const version = entry?.version && entry.version > 1 ? `v${entry.version}` : "";
  const prefix = type && !slug.startsWith(type) ? type : "";
  return [prefix, slug, version].filter(Boolean).join(" ");
}

function getFlags(video, entries) {
  const flags = [];

  if (video.nc) {
    flags.push("Creditless");
  }

  if (video.subbed) {
    flags.push("Subbed");
  }

  if (video.lyrics) {
    flags.push("Lyrics");
  }

  if (video.uncen) {
    flags.push("Uncensored");
  }

  if (entries.some((entry) => entry.spoiler)) {
    flags.push("Spoiler");
  }

  if (entries.some((entry) => entry.nsfw)) {
    flags.push("NSFW");
  }

  return flags.length > 0 ? flags.join(", ") : "None";
}

function updateClock() {
  clockValue.textContent = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function updateWarning(entries) {
  warning.hidden = !entries.some((entry) => entry.nsfw);
}

async function playCurrentVideo() {
  try {
    await player.play();
    setStatus("good", "Playing");
  } catch {
    setStatus("good", "Loaded");
  }
}

async function loadRandomVideo() {
  randomButton.disabled = true;
  replayButton.disabled = true;
  setStatus("ready", "Loading");

  try {
    const response = await fetch(`${API_URL}&_=${Date.now()}`);

    if (!response.ok) {
      throw new Error(`AnimeThemes returned ${response.status}`);
    }

    const data = await response.json();
    const video = data.videos?.[0];

    if (!video?.link) {
      throw new Error("AnimeThemes did not return a playable video link.");
    }

    const entries = Array.isArray(video.animethemeentries) ? video.animethemeentries : [];
    const entry = getPrimaryEntry(video);

    player.src = video.link;
    player.load();
    emptyState.hidden = true;

    animeTitle.textContent = getAnimeName(entry);
    themeTitle.textContent = getThemeLabel(entry, video);
    videoMeta.textContent = `${video.resolution || "--"}p ${video.source || ""}`.trim();
    fileName.textContent = video.basename || video.filename || "Unknown file";
    sourceValue.textContent = video.source || "--";
    resolutionValue.textContent = video.resolution ? `${video.resolution}p` : "--";
    sizeValue.textContent = formatBytes(video.size);
    flagsValue.textContent = getFlags(video, entries);
    updateWarning(entries);

    replayButton.disabled = false;
    await playCurrentVideo();
  } catch (error) {
    setStatus("slow", "Error");
    animeTitle.textContent = "Unable to load a video";
    themeTitle.textContent = error.message;
    videoMeta.textContent = "--";
    warning.hidden = true;
  } finally {
    randomButton.disabled = false;
  }
}

async function replayVideo() {
  if (!player.currentSrc) {
    return;
  }

  player.currentTime = 0;
  await playCurrentVideo();
}

randomButton.addEventListener("click", loadRandomVideo);
replayButton.addEventListener("click", replayVideo);
player.addEventListener("ended", () => setStatus("good", "Finished"));
player.addEventListener("play", () => setStatus("good", "Playing"));
player.addEventListener("pause", () => {
  if (!player.ended && player.currentSrc) {
    setStatus("good", "Paused");
  }
});

updateClock();
setInterval(updateClock, 1000);
