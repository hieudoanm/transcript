from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from services.gen_ai import summarise_transcript
from services.youtube_transcript import get_transcript


class TranscriptRequest(BaseModel):
    video_id: str


class TranscriptResponse(BaseModel):
    video_id: str
    transcript: str
    summary: str


app = FastAPI(
    title="YouTube Transcript Summariser API",
    description="""
A simple API service to retrieve and summarise transcripts of YouTube videos using their video ID.

Features:
- Auto-detect or specify transcript language
- Supports plain text or JSON response
- Clear error responses for unavailable or restricted videos
    """,
    version="0.0.1",
    license_info={
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT",
    },
    docs_url="/docs",
    redoc_url="/",
)


# ✅ Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # You can restrict this to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post(
    "/api/transcript/summarise",
    summary="Summarise YouTube Video Transcript",
    response_model=TranscriptResponse,
    tags=["Summarise"],
)
def summarise(request: TranscriptRequest):
    """
    Fetches and summarises the transcript for a given YouTube video.

    Request body should include:
    - **video_id**: Required YouTube video ID
    """
    try:
        print("get_transcript")
        video_transcript = get_transcript(video_id=request.video_id)
        if video_transcript is None:
            print("No Transcript.")
            return {
                "video_id": request.video_id,
                "transcript": "No Transcript.",
                "summary": "No Summary.",
            }
        print("summarise_transcript")
        summary = summarise_transcript(video_transcript)
        return {
            "video_id": request.video_id,
            "transcript": video_transcript,
            "summary": summary,
        }
    except Exception as exception:
        raise HTTPException(status_code=500, detail=f"Error: {str(exception)}")
