const RANDOM_VIDEO_URL =
  "https://api.animethemes.moe/video?sort=random&page%5Bsize%5D=1&include=animethemeentries.animetheme.anime";
const ANIMETHEMES_API = "https://api.animethemes.moe";
const JIKAN_API = "https://api.jikan.moe/v4";

const statusDot = document.querySelector("[data-status-dot]");
const statusLabel = document.querySelector("[data-status-label]");
const videoFrame = document.querySelector("[data-video-frame]");
let activePlayer = document.querySelector('[data-player="active"]');
let bufferPlayer = document.querySelector('[data-player="buffer"]');
const emptyState = document.querySelector("[data-empty-state]");
const titleEnglish = document.querySelector("[data-title-english]");
const titleJapanese = document.querySelector("[data-title-japanese]");
const themeTitle = document.querySelector("[data-theme-title]");
const clockValue = document.querySelector("[data-clock]");
const warning = document.querySelector("[data-warning]");
const addRandomButton = document.querySelector("[data-add-random]");
const skipButton = document.querySelector("[data-skip]");
const replayButton = document.querySelector("[data-replay]");
const fullscreenButton = document.querySelector("[data-fullscreen]");
const clearQueueButton = document.querySelector("[data-clear-queue]");
const autoplayToggle = document.querySelector("[data-autoplay]");
const queueList = document.querySelector("[data-queue-list]");
const queueCount = document.querySelector("[data-queue-count]");
const malTitle = document.querySelector("[data-mal-title]");
const yearValue = document.querySelector("[data-year]");
const studioValue = document.querySelector("[data-studio]");
const scoreValue = document.querySelector("[data-score]");
const rankValue = document.querySelector("[data-rank]");
const genresValue = document.querySelector("[data-genres]");
const videoMeta = document.querySelector("[data-video-meta]");
const flagsValue = document.querySelector("[data-flags]");

const queue = [];
const malCache = new Map();

let currentItem = null;
let bufferedItemId = null;

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

function getItemId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

function formatNumber(value) {
  return Number.isFinite(value) ? value.toLocaleString() : "--";
}

function joinNames(items, fallback = "--") {
  if (!Array.isArray(items) || items.length === 0) {
    return fallback;
  }

  const names = items.map((item) => item.name).filter(Boolean);
  return names.length > 0 ? names.join(", ") : fallback;
}

function getPrimaryEntry(video) {
  return Array.isArray(video.animethemeentries) ? video.animethemeentries[0] : null;
}

function getAnime(video) {
  return getPrimaryEntry(video)?.animetheme?.anime || null;
}

function getThemeLabel(video) {
  const entry = getPrimaryEntry(video);
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

function setActivePlayer(nextPlayer) {
  if (nextPlayer === activePlayer) {
    return;
  }

  activePlayer.pause();
  activePlayer.removeAttribute("controls");
  activePlayer.classList.remove("is-active");
  activePlayer.setAttribute("aria-hidden", "true");
  activePlayer.tabIndex = -1;

  nextPlayer.controls = true;
  nextPlayer.muted = false;
  nextPlayer.classList.add("is-active");
  nextPlayer.removeAttribute("aria-hidden");
  nextPlayer.removeAttribute("tabindex");

  [activePlayer, bufferPlayer] = [nextPlayer, activePlayer];
}

function resetBufferPlayer() {
  bufferPlayer.pause();
  bufferPlayer.removeAttribute("src");
  bufferPlayer.load();
  bufferPlayer.muted = true;
  bufferPlayer.preload = "auto";
  bufferPlayer.removeAttribute("controls");
  bufferPlayer.classList.remove("is-active");
  bufferPlayer.setAttribute("aria-hidden", "true");
  bufferPlayer.tabIndex = -1;
  bufferedItemId = null;
}

function warmQueueHead() {
  const nextItem = queue[0];

  if (!nextItem) {
    resetBufferPlayer();
    return;
  }

  if (bufferedItemId === nextItem.id && bufferPlayer.src === nextItem.video.link) {
    return;
  }

  resetBufferPlayer();
  bufferPlayer.src = nextItem.video.link;
  bufferPlayer.load();
  bufferedItemId = nextItem.id;
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Request failed with ${response.status}`);
  }

  return response.json();
}

async function fetchRandomVideo() {
  const data = await fetchJson(`${RANDOM_VIDEO_URL}&_=${Date.now()}`);
  const video = data.videos?.[0];

  if (!video?.link) {
    throw new Error("AnimeThemes did not return a playable video link.");
  }

  return video;
}

async function fetchAnimeThemeAnime(slug) {
  const data = await fetchJson(`${ANIMETHEMES_API}/anime/${encodeURIComponent(slug)}?include=resources`);
  return data.anime || null;
}

function normalizeMalData(data) {
  if (!data) {
    return null;
  }

  const airedYear = data.aired?.from ? new Date(data.aired.from).getFullYear() : null;

  return {
    id: data.mal_id || null,
    url: data.url || "",
    title: data.title || "Not listed",
    english: data.title_english || "Not listed",
    japanese: data.title_japanese || "Not listed",
    year: data.year || airedYear || null,
    score: Number.isFinite(data.score) ? data.score : null,
    scoredBy: Number.isFinite(data.scored_by) ? data.scored_by : null,
    rank: Number.isFinite(data.rank) ? data.rank : null,
    popularity: Number.isFinite(data.popularity) ? data.popularity : null,
    members: Number.isFinite(data.members) ? data.members : null,
    studios: joinNames(data.studios),
    genres: joinNames(data.genres),
    status: data.status || "--",
    rating: data.rating || "--",
    type: data.type || "--",
    source: data.source || "--",
    episodes: Number.isFinite(data.episodes) ? data.episodes : null,
    duration: data.duration || "--",
  };
}

async function fetchMalById(malId) {
  const data = await fetchJson(`${JIKAN_API}/anime/${malId}/full`);
  return normalizeMalData(data.data);
}

async function searchMalByName(name) {
  const data = await fetchJson(`${JIKAN_API}/anime?q=${encodeURIComponent(name)}&limit=1`);
  return normalizeMalData(data.data?.[0]);
}

async function fetchMalInfo(video) {
  const anime = getAnime(video);
  const cacheKey = anime?.slug || anime?.name || video.filename || video.basename;

  if (malCache.has(cacheKey)) {
    return malCache.get(cacheKey);
  }

  let malInfo = null;

  if (anime?.slug) {
    const animeDetails = await fetchAnimeThemeAnime(anime.slug);
    const malResource = animeDetails?.resources?.find(
      (resource) => resource.site === "MyAnimeList" && Number.isFinite(resource.external_id),
    );

    if (malResource?.external_id) {
      malInfo = await fetchMalById(malResource.external_id);
    }
  }

  if (!malInfo && anime?.name) {
    malInfo = await searchMalByName(anime.name);
  }

  malCache.set(cacheKey, malInfo);
  return malInfo;
}

function createQueueItem(video) {
  const entries = Array.isArray(video.animethemeentries) ? video.animethemeentries : [];
  const anime = getAnime(video);

  return {
    id: getItemId(),
    video,
    entries,
    mal: {
      title: anime?.name || "Not listed",
      english: "Not listed",
      japanese: "Not listed",
    },
    theme: getThemeLabel(video),
  };
}

async function enrichItem(item) {
  try {
    const mal = await fetchMalInfo(item.video);

    if (!mal) {
      return;
    }

    item.mal = mal;
    renderQueue();

    if (currentItem?.id === item.id) {
      showItem(item);
    }
  } catch {
    // Keep the AnimeThemes video playable even when MAL-backed metadata is unavailable.
  }
}

function getQueueTitle(item) {
  return item.mal?.english && item.mal.english !== "Not listed"
    ? item.mal.english
    : item.mal?.title || getAnime(item.video)?.name || "Unknown anime";
}

function updateQueueButtons() {
  skipButton.disabled = queue.length === 0;
  clearQueueButton.disabled = queue.length === 0;
  queueCount.textContent = String(queue.length);
}

function renderQueue() {
  queueList.innerHTML = "";

  if (queue.length === 0) {
    const empty = document.createElement("li");
    empty.className = "queue-empty";
    empty.textContent = "Queue is empty.";
    queueList.append(empty);
    updateQueueButtons();
    return;
  }

  queue.forEach((item, index) => {
    const queueItem = document.createElement("li");
    queueItem.className = "queue-item";

    const text = document.createElement("div");
    text.className = "queue-item-text";

    const title = document.createElement("strong");
    title.textContent = getQueueTitle(item);

    const meta = document.createElement("span");
    meta.textContent = `${index + 1}. ${item.theme}`;

    const remove = document.createElement("button");
    remove.className = "queue-remove";
    remove.type = "button";
    remove.dataset.removeId = item.id;
    remove.textContent = "Remove";

    text.append(title, meta);
    queueItem.append(text, remove);
    queueList.append(queueItem);
  });

  updateQueueButtons();
}

function showItem(item) {
  const mal = item.mal;
  const video = item.video;

  emptyState.hidden = true;
  titleEnglish.textContent = mal?.english || "Not listed";
  titleJapanese.textContent = mal?.japanese || "Not listed";
  themeTitle.textContent = item.theme;
  malTitle.textContent = mal?.title || "--";
  yearValue.textContent = mal?.year || "--";
  studioValue.textContent = mal?.studios || "--";
  scoreValue.textContent = Number.isFinite(mal?.score)
    ? `${mal.score.toFixed(2)} (${formatNumber(mal.scoredBy)} votes)`
    : "--";
  rankValue.textContent = Number.isFinite(mal?.rank)
    ? `#${formatNumber(mal.rank)} / popularity #${formatNumber(mal.popularity)}`
    : "--";
  genresValue.textContent = mal?.genres || "--";
  videoMeta.textContent = [
    video.resolution ? `${video.resolution}p` : null,
    video.source,
    formatBytes(video.size),
  ]
    .filter(Boolean)
    .join(" / ");
  flagsValue.textContent = getFlags(video, item.entries);
  updateWarning(item.entries);
}

async function playCurrentVideo() {
  try {
    await activePlayer.play();
    setStatus("good", "Playing");
  } catch {
    setStatus("good", "Loaded");
  }
}

async function playNextFromQueue() {
  if (queue.length === 0) {
    setStatus("ready", "Queue empty");
    updateQueueButtons();
    return;
  }

  const item = queue.shift();
  renderQueue();

  if (bufferedItemId === item.id && bufferPlayer.src === item.video.link) {
    setActivePlayer(bufferPlayer);
  } else {
    activePlayer.src = item.video.link;
    activePlayer.load();
  }

  currentItem = item;
  showItem(item);
  replayButton.disabled = false;
  await playCurrentVideo();
  warmQueueHead();
}

async function addRandomToQueue() {
  addRandomButton.disabled = true;
  setStatus("ready", "Fetching");

  try {
    const video = await fetchRandomVideo();
    const item = createQueueItem(video);
    queue.push(item);
    renderQueue();
    warmQueueHead();

    if (!currentItem && !activePlayer.currentSrc) {
      await playNextFromQueue();
    } else {
      setStatus("good", "Queued");
    }

    enrichItem(item);
  } catch (error) {
    setStatus("slow", "Error");
    malTitle.textContent = error.message;
  } finally {
    addRandomButton.disabled = false;
  }
}

async function replayVideo() {
  if (!activePlayer.currentSrc) {
    return;
  }

  activePlayer.currentTime = 0;
  await playCurrentVideo();
}

function removeQueuedItem(id) {
  const itemIndex = queue.findIndex((item) => item.id === id);

  if (itemIndex < 0) {
    return;
  }

  const [removed] = queue.splice(itemIndex, 1);
  renderQueue();

  if (removed.id === bufferedItemId) {
    warmQueueHead();
  }
}

function clearQueue() {
  queue.length = 0;
  renderQueue();
  resetBufferPlayer();
}

async function toggleFullscreen() {
  if (!document.fullscreenEnabled) {
    setStatus("slow", "Fullscreen unavailable");
    return;
  }

  if (document.fullscreenElement) {
    await document.exitFullscreen();
  } else {
    await videoFrame.requestFullscreen();
  }
}

function updateFullscreenButton() {
  fullscreenButton.textContent = document.fullscreenElement ? "Exit Fullscreen" : "Fullscreen";
}

async function handleEnded(video) {
  if (video !== activePlayer) {
    return;
  }

  setStatus("good", "Finished");

  if (autoplayToggle.checked && queue.length > 0) {
    await playNextFromQueue();
  }
}

function bindPlayerEvents(video) {
  video.addEventListener("ended", () => handleEnded(video));
  video.addEventListener("play", () => {
    if (video === activePlayer) {
      setStatus("good", "Playing");
    }
  });
  video.addEventListener("pause", () => {
    if (!video.ended && video.currentSrc && video === activePlayer) {
      setStatus("good", "Paused");
    }
  });
}

function shouldIgnoreKey(event) {
  const tagName = document.activeElement?.tagName;
  return event.ctrlKey || event.metaKey || event.altKey || ["INPUT", "TEXTAREA", "SELECT"].includes(tagName);
}

addRandomButton.addEventListener("click", addRandomToQueue);
skipButton.addEventListener("click", playNextFromQueue);
replayButton.addEventListener("click", replayVideo);
fullscreenButton.addEventListener("click", toggleFullscreen);
clearQueueButton.addEventListener("click", clearQueue);
queueList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-remove-id]");

  if (button) {
    removeQueuedItem(button.dataset.removeId);
  }
});
document.addEventListener("fullscreenchange", updateFullscreenButton);
document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "f" && !shouldIgnoreKey(event)) {
    event.preventDefault();
    toggleFullscreen();
  }
});

bindPlayerEvents(activePlayer);
bindPlayerEvents(bufferPlayer);
renderQueue();
updateClock();
setInterval(updateClock, 1000);
