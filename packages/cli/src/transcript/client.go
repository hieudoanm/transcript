package transcript

import (
	"encoding/json"
	"fmt"
	"html"
	"io"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
)

const (
	userAgent     = "Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 Chrome/90.0.4430.91 Mobile Safari/537.36"
	innertubeURL  = "https://www.youtube.com/youtubei/v1/player?key=%s"
	clientName    = "ANDROID"
	clientVersion = "20.10.38"
)

var (
	reAPIKey     = regexp.MustCompile(`"INNERTUBE_API_KEY":"([^"]+)"`)
	rePlayerResp = regexp.MustCompile(`ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;\s*(?:var\s+(?:meta|head)|<\/script|\n)`)
)

type Client struct {
	http *http.Client
}

func NewClient() *Client {
	return &Client{
		http: &http.Client{Timeout: 15 * time.Second},
	}
}

// Fetch fetches a transcript for the given video ID and preferred language.
// It tries Innertube first, falls back to HTML scraping.
func (c *Client) Fetch(videoID, lang string) (*Transcript, error) {
	// Step 1: Get the watch page (needed for API key extraction)
	pageHTML, err := c.getPage(videoID)
	if err != nil {
		return nil, fmt.Errorf("fetching page: %w", err)
	}

	// Step 2: Try Innertube (preferred)
	tracks, err := c.tracksViaInnertube(videoID, pageHTML)
	if err != nil {
		// Fallback: extract from embedded ytInitialPlayerResponse
		tracks, err = c.tracksViaHTMLScrape(pageHTML)
		if err != nil {
			return nil, fmt.Errorf("could not extract caption tracks: %w", err)
		}
	}

	if len(tracks) == 0 {
		return nil, fmt.Errorf("no caption tracks found — video may have no captions")
	}

	// Step 3: Pick best track for requested language
	track := selectTrack(tracks, lang)
	if track == nil {
		return nil, fmt.Errorf("no captions for language %q (available: %s)",
			lang, availableLangs(tracks))
	}

	// Step 4: Fetch and parse the TimedText XML
	lines, err := c.fetchCaptions(track.BaseURL)
	if err != nil {
		return nil, fmt.Errorf("fetching captions XML: %w", err)
	}

	kind := "manual"
	if track.Kind == "asr" {
		kind = "auto-generated"
	}

	return &Transcript{
		VideoID:  videoID,
		Language: track.LanguageCode,
		Kind:     kind,
		Lines:    lines,
	}, nil
}

func (c *Client) getPage(videoID string) (string, error) {
	req, _ := http.NewRequest("GET",
		"https://www.youtube.com/watch?v="+videoID, nil)
	req.Header.Set("User-Agent", userAgent)
	req.Header.Set("Accept-Language", "en-US,en;q=0.9")

	resp, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	b, err := io.ReadAll(resp.Body)
	return string(b), err
}

// tracksViaInnertube uses YouTube's internal player API — more stable.
func (c *Client) tracksViaInnertube(videoID, pageHTML string) ([]CaptionTrack, error) {
	// Extract API key from page
	m := reAPIKey.FindStringSubmatch(pageHTML)
	if m == nil {
		return nil, fmt.Errorf("INNERTUBE_API_KEY not found in page")
	}
	apiKey := m[1]

	// Build POST body
	body := fmt.Sprintf(`{
        "context": {
            "client": {
                "clientName": "%s",
                "clientVersion": "%s"
            }
        },
        "videoId": "%s"
    }`, clientName, clientVersion, videoID)

	req, _ := http.NewRequest("POST",
		fmt.Sprintf(innertubeURL, apiKey),
		strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", userAgent)

	resp, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	return parseCaptionTracks(resp.Body)
}

// tracksViaHTMLScrape is the fallback — regex the embedded JSON blob.
func (c *Client) tracksViaHTMLScrape(pageHTML string) ([]CaptionTrack, error) {
	m := rePlayerResp.FindStringSubmatch(pageHTML)
	if m == nil {
		return nil, fmt.Errorf("ytInitialPlayerResponse not found in page")
	}
	return parseCaptionTracks(strings.NewReader(m[1]))
}

func parseCaptionTracks(r io.Reader) ([]CaptionTrack, error) {
	var raw struct {
		Captions struct {
			PlayerCaptionsTracklistRenderer struct {
				CaptionTracks []CaptionTrack `json:"captionTracks"`
			} `json:"playerCaptionsTracklistRenderer"`
		} `json:"captions"`
	}
	if err := json.NewDecoder(r).Decode(&raw); err != nil {
		return nil, err
	}
	tracks := raw.Captions.PlayerCaptionsTracklistRenderer.CaptionTracks
	// Unescape HTML entities in baseUrl (YouTube encodes & as &amp; in embedded JSON)
	for i := range tracks {
		tracks[i].BaseURL = html.UnescapeString(tracks[i].BaseURL)
	}
	return tracks, nil
}

func (c *Client) fetchCaptions(baseURL string) ([]Line, error) {
	resp, err := c.http.Get(baseURL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// DEBUG — remove after fixing
	fmt.Fprintf(os.Stderr, "--- RAW CAPTION RESPONSE ---\n%s\n---\n", string(b[:min(500, len(b))]))

	return parseTimedText(b)
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// selectTrack prefers manual captions over auto-generated for the given lang.
func selectTrack(tracks []CaptionTrack, lang string) *CaptionTrack {
	var fallback *CaptionTrack
	for i := range tracks {
		if tracks[i].LanguageCode == lang {
			if tracks[i].Kind != "asr" {
				return &tracks[i] // manual — best
			}
			fallback = &tracks[i] // auto-generated — acceptable
		}
	}
	return fallback
}

func availableLangs(tracks []CaptionTrack) string {
	seen := map[string]bool{}
	var langs []string
	for _, t := range tracks {
		if !seen[t.LanguageCode] {
			langs = append(langs, t.LanguageCode)
			seen[t.LanguageCode] = true
		}
	}
	return strings.Join(langs, ", ")
}
