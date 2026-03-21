package transcript

type CaptionTrack struct {
	BaseURL      string `json:"baseUrl"`
	LanguageCode string `json:"languageCode"`
	Kind         string `json:"kind"` // "asr" = auto-generated
	Name         struct {
		SimpleText string `json:"simpleText"`
	} `json:"name"`
	IsTranslatable bool `json:"isTranslatable"`
}

type Line struct {
	Start    float64 `json:"start"`
	Duration float64 `json:"duration"`
	Text     string  `json:"text"`
}

type Transcript struct {
	VideoID  string
	Language string
	Kind     string // "manual" or "auto"
	Lines    []Line
}
