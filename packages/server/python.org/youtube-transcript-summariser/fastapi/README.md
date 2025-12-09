# 📝 YouTube Transcript Summariser

## 📚 Table of Contents

- [📝 YouTube Transcript Summariser](#-youtube-transcript-summariser)
  - [📚 Table of Contents](#-table-of-contents)
  - [🧠 Introduction](#-introduction)
  - [📤 Request](#-request)
  - [✅ Response](#-response)
  - [⚠️ Notes](#️-notes)

## 🧠 Introduction

This is a simple REST API that fetches and summarizes YouTube video transcripts using the video ID.

## 📤 Request

```bash
curl -X POST https://youtube-transcript-summariser.onrender.com/api/transcript/summarise \
  -H "Content-Type: application/json" \
  -d '{
    "video_id": "z3prA1py3vU",
    "language": "en"
  }'
```

## ✅ Response

```json
{
  "video_id": "z3prA1py3vU",
  "transcript": "string"
  "summary": "This video explains the fundamentals of quantum computing...",
}
```

## ⚠️ Notes

Transcripts must be available for the requested language.

This API may not work for videos with:

- Disabled transcripts
- Auto-generated transcripts in unsupported languages
- Age restrictions or geo-blocks
