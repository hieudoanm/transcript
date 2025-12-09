import whisper
import yt_dlp
import os
import uuid
from log.logger import logger


def progress_hook(d):
    if d["status"] == "downloading":
        logger.info(
            f"Downloading: {d['_percent_str']} at {d['_speed_str']} ETA {d['_eta_str']}"
        )
    elif d["status"] == "finished":
        logger.info(f"Download finished: {d['filename']}")


def download_audio(video_url, output_dir="./tmp"):
    logger.info("download_audio")
    output_path = os.path.join(output_dir, f"{uuid.uuid4()}")
    ydl_opts = {
        "cookiefile": "cookies.txt",
        "format": "bestaudio/best",
        "outtmpl": output_path,
        "progress_hooks": [progress_hook],
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": "192",
            }
        ],
    }

    logger.info("downloading_audio")
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.download([video_url])

    return f"{output_path}.mp3"


def transcribe_with_whisper(audio_path, model_size="base"):
    logger.info("transcribe_with_whisper")
    model = whisper.load_model(model_size)
    result = model.transcribe(audio_path)
    return result["text"]


def get_transcript(video_id: str) -> str | None:
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    audio_path = download_audio(video_url)
    logger.info(audio_path)
    try:
        transcript = transcribe_with_whisper(audio_path)
        return transcript
    except Exception as exception:
        logger.error(exception)
        return None
    finally:
        os.remove(audio_path)  # Clean up
