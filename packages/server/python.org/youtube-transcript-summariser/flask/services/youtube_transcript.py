from pydantic import BaseModel
from youtube_transcript_api import (
    YouTubeTranscriptApi,
    TranscriptsDisabled,
    NoTranscriptFound,
    VideoUnavailable,
    CouldNotRetrieveTranscript,
)


class TranscriptEntry(BaseModel):
    text: str
    start: float
    duration: float


# get_transcript
def get_transcript(video_id: str, language: str = None) -> str | None:
    try:
        transcript: list[TranscriptEntry] = (
            YouTubeTranscriptApi.get_transcript(video_id, languages=[language])
            if language
            else YouTubeTranscriptApi.get_transcript(video_id)
        )
        transcript_text = " ".join([entry["text"] for entry in transcript])
        return transcript_text
    except VideoUnavailable as exception:
        print(f"Video is unavailable or does not exist: {str(exception)}")
        return None
    except TranscriptsDisabled as exception:
        print(f"Transcripts are disabled for this video: {str(exception)}")
        return None
    except NoTranscriptFound as exception:
        print(f"No transcript found in the requested language: {str(exception)}")
        return None
    except CouldNotRetrieveTranscript as exception:
        print(f"Failed to retrieve transcript due to unknown error: {str(exception)}")
        return None
    except Exception as exception:
        print(f"Unexpected error: {str(exception)}")
        return None
