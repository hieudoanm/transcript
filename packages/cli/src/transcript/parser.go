package transcript

import (
	"encoding/xml"
	"html"
	"regexp"
	"strings"
)

// YouTube returns TimedText XML:
// <transcript>
//   <text start="1.23" dur="2.5">Hello world</text>
// </transcript>

type timedTextDoc struct {
	Body struct {
		Paragraphs []timedTextEntry `xml:"p"`
	} `xml:"body"`
}

type timedTextEntry struct {
	T    int64  `xml:"t,attr"` // start in milliseconds
	D    int64  `xml:"d,attr"` // duration in milliseconds
	Text string `xml:",chardata"`
}

var reWhitespace = regexp.MustCompile(`\s+`)

func parseTimedText(data []byte) ([]Line, error) {
	var doc timedTextDoc
	if err := xml.Unmarshal(data, &doc); err != nil {
		return nil, err
	}

	lines := make([]Line, 0, len(doc.Body.Paragraphs))
	for _, t := range doc.Body.Paragraphs {
		text := html.UnescapeString(t.Text)
		text = reWhitespace.ReplaceAllString(strings.TrimSpace(text), " ")
		if text == "" {
			continue
		}

		lines = append(lines, Line{
			Start:    float64(t.T) / 1000.0,
			Duration: float64(t.D) / 1000.0,
			Text:     text,
		})
	}
	return lines, nil
}
