const API_BASE = "https://www.theaudiodb.com/api/v1/json/123";

const form = document.querySelector("#musicForm");
const artistInput = document.querySelector("#artistName");
const decadeSelect = document.querySelector("#decade");
const limitSelect = document.querySelector("#resultLimit");
const results = document.querySelector("#results");
const statusMessage = document.querySelector("#searchStatus");
const clearButton = document.querySelector("#clearResults");
const menuToggle = document.querySelector("#menuToggle");
const siteNav = document.querySelector("#siteNav");
const currentYear = document.querySelector("#currentYear");

currentYear.textContent = new Date().getFullYear();

menuToggle.addEventListener("click", () => {
  const open = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!open));
  siteNav.classList.toggle("is-open", !open);
});

siteNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    menuToggle.setAttribute("aria-expanded", "false");
    siteNav.classList.remove("is-open");
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!form.checkValidity()) {
    form.reportValidity();
    statusMessage.textContent = "Please enter an artist or band name.";
    artistInput.focus();
    return;
  }

  const artistName = artistInput.value.trim();
  const decade = decadeSelect.value;
  const limit = Number(limitSelect.value);

  setLoading(true);
  statusMessage.textContent = `Searching for ${artistName}…`;

  try {
    // API CALL 1: Search for the artist using form data.
    const artistResponse = await fetch(
      `${API_BASE}/search.php?s=${encodeURIComponent(artistName)}`
    );

    if (!artistResponse.ok) {
      throw new Error("The music service returned an error.");
    }

    const artistData = await artistResponse.json();
    const artist = artistData.artists?.[0];

    if (!artist) {
      throw new Error(`No artist was found for "${artistName}".`);
    }

    // API CALL 2: Request the artist's discography.
    const discographyResponse = await fetch(
      `${API_BASE}/discography.php?s=${encodeURIComponent(artist.strArtist)}`
    );

    if (!discographyResponse.ok) {
      throw new Error("The artist's discography could not be loaded.");
    }

    const discographyData = await discographyResponse.json();
    let albums = discographyData.album ?? [];

    if (decade !== "all") {
      const start = Number(decade);
      const end = start + 9;

      albums = albums.filter((album) => {
        const year = Number(album.intYearReleased);
        return year >= start && year <= end;
      });
    }

    albums.sort((a, b) => Number(b.intYearReleased || 0) - Number(a.intYearReleased || 0));

    // API CALL 3+: Get album details and track lists.
    const selectedAlbums = albums.slice(0, 8);
    const albumResults = await Promise.all(
      selectedAlbums.map(async (album) => {
        try {
          const response = await fetch(
            `${API_BASE}/album.php?i=${encodeURIComponent(album.idAlbum)}`
          );
          if (!response.ok) return null;

          const data = await response.json();
          return data.album?.[0] ?? null;
        } catch {
          return null;
        }
      })
    );

    const tracks = [];

    albumResults.filter(Boolean).forEach((album) => {
      const albumTracks = album.track ?? [];

      albumTracks.forEach((track) => {
        if (tracks.length >= limit) return;

        const composer = track.strComposer || track.strComposerName || "Not listed";

        tracks.push({
          song: track.strTrack || "Unknown track",
          artist: track.strArtist || artist.strArtist,
          album: track.strAlbum || album.strAlbum || "Unknown album",
          year: album.intYearReleased || "Unknown",
          artwork: track.strTrackThumb || album.strAlbumThumbHQ || album.strAlbumThumb || "",
          composer
        });
      });
    });

    if (!tracks.length) {
      throw new Error(
        "TheAudioDB returned the artist, but no tracks were available through the free discography endpoints."
      );
    }

    renderResults(tracks);
    statusMessage.textContent =
      `Showing ${tracks.length} track${tracks.length === 1 ? "" : "s"} for ${artist.strArtist}.`;
  } catch (error) {
    renderError(error.message);
    statusMessage.textContent = "Search could not be completed.";
  } finally {
    setLoading(false);
  }
});

clearButton.addEventListener("click", () => {
  results.innerHTML = `
    <div class="empty-state">
      <span class="empty-icon" aria-hidden="true">◉</span>
      <h3>Nothing searched yet</h3>
      <p>Choose an artist above to begin exploring.</p>
    </div>
  `;
  clearButton.hidden = true;
  statusMessage.textContent = "";
  artistInput.focus();
});

function setLoading(isLoading) {
  results.setAttribute("aria-busy", String(isLoading));

  if (isLoading) {
    results.innerHTML = `
      <div class="loading-state">
        <h3>Searching the music database…</h3>
        <p>Please wait while the results are collected.</p>
      </div>
    `;
    clearButton.hidden = true;
  }
}

function renderResults(tracks) {
  results.innerHTML = "";

  tracks.forEach((track) => {
    const card = document.createElement("article");
    card.className = "music-card";

    const artwork = track.artwork
      ? `<img src="${escapeAttribute(track.artwork)}"
               alt="Artwork for ${escapeAttribute(track.album)}"
               loading="lazy">`
      : `<div class="artwork-placeholder" aria-hidden="true">♫</div>`;

    card.innerHTML = `
      <div class="artwork">${artwork}</div>
      <div class="card-content">
        <h3 class="card-title">${escapeHtml(track.song)}</h3>
        <p class="card-artist">${escapeHtml(track.artist)}</p>

        <dl class="metadata">
          <div>
            <dt>Album</dt>
            <dd>${escapeHtml(track.album)}</dd>
          </div>
          <div>
            <dt>Release</dt>
            <dd>${escapeHtml(String(track.year))}</dd>
          </div>
          <div>
            <dt>Composer</dt>
            <dd>${escapeHtml(track.composer)}</dd>
          </div>
        </dl>
      </div>
    `;

    results.appendChild(card);
  });

  clearButton.hidden = false;
}

function renderError(message) {
  results.innerHTML = `
    <div class="error-state">
      <h3>Something went wrong</h3>
      <p>${escapeHtml(message)}</p>
      <p>Try a well-known artist name, such as Queen, Coldplay or The Beatles.</p>
    </div>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
