import requests


def summarise_transcript(video_transcript: str) -> str:
    try:
        # Prepare the prompt for summary
        system_prompt: str = (
            "Summarize the following transcript in 3 concise bullet points:"
        )
        user_prompt: str = f"{system_prompt}\n\n{video_transcript}"
        url: str = "https://gaslit.vercel.app/api/generate"
        headers: dict[str, str] = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        json: dict[str] = {
            "model": "deepseek/deepseek-r1:free",
            "messages": [{"role": "user", "text": user_prompt}],
        }
        response = requests.post(
            url,
            headers=headers,
            json=json,
            timeout=60,
        )
        response.raise_for_status()
        data = response.json()
        summary = data.get("output", "No summary.")
        return summary
    except Exception as exception:
        print(f"Unexpected error: {str(exception)}")
        return "No summary."
