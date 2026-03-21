package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/hieudoanm/transcript/src/transcript"
	"github.com/spf13/cobra"
)

var (
	lang       string
	outputFile string
	format     string
	noTS       bool
	listLangs  bool
)

var fetchCmd = &cobra.Command{
	Use:   "fetch <video-id-or-url>",
	Short: "Fetch transcript for a YouTube video",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		videoID := extractVideoID(args[0])
		client := transcript.NewClient()

		t, err := client.Fetch(videoID, lang)
		if err != nil {
			return err
		}

		fmt.Fprintf(os.Stderr, "✓ %s (%s, %s)\n", videoID, t.Language, t.Kind)

		var out string
		switch strings.ToLower(format) {
		case "json":
			b, _ := json.MarshalIndent(t, "", "  ")
			out = string(b)
		default:
			var sb strings.Builder
			for _, line := range t.Lines {
				if noTS {
					sb.WriteString(line.Text + "\n")
				} else {
					sb.WriteString(fmt.Sprintf("[%6.2fs] %s\n", line.Start, line.Text))
				}
			}
			out = sb.String()
		}

		if outputFile != "" {
			return os.WriteFile(outputFile, []byte(out), 0644)
		}
		fmt.Print(out)
		return nil
	},
}

// extractVideoID handles full URLs and bare IDs
func extractVideoID(input string) string {
	// youtu.be/ID
	if strings.Contains(input, "youtu.be/") {
		parts := strings.Split(input, "youtu.be/")
		return strings.Split(parts[1], "?")[0]
	}
	// youtube.com/watch?v=ID
	if strings.Contains(input, "v=") {
		parts := strings.Split(input, "v=")
		return strings.Split(parts[1], "&")[0]
	}
	return input // assume bare ID
}

func init() {
	rootCmd.AddCommand(fetchCmd)
	fetchCmd.Flags().StringVarP(&lang, "lang", "l", "en", "Language code (e.g. en, es, fr)")
	fetchCmd.Flags().StringVarP(&outputFile, "output", "o", "", "Save to file instead of stdout")
	fetchCmd.Flags().StringVarP(&format, "format", "f", "text", "Output format: text or json")
	fetchCmd.Flags().BoolVar(&noTS, "no-timestamps", false, "Omit timestamps from text output")
}
