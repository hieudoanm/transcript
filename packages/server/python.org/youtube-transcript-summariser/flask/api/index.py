from flasgger import Swagger
from flask import Flask, request, jsonify
from flask_cors import CORS
from services.gen_ai import summarise_transcript
from services.youtube_transcript import get_transcript

app = Flask(__name__)
CORS(app)  # Allow all origins, adjust as needed
swagger = Swagger(app)


@app.route("/api/transcript/summarise", methods=["POST"])
def summarise():
    """
    Summarise YouTube Video Transcript
    ---
    tags:
      - Summarise
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            video_id:
              type: string
              example: Xty2gi5cMa8
            language:
              type: string
              example: en
    responses:
      200:
        description: Successful summary
        schema:
          type: object
          properties:
            video_id:
              type: string
            transcript:
              type: string
            summary:
              type: string
    """
    try:
        data = request.get_json()
        video_id = data.get("video_id")
        language = data.get("language")

        if not video_id:
            return jsonify({"error": "video_id is required"}), 400

        video_transcript = get_transcript(video_id=video_id, language=language)

        if video_transcript is None:
            return jsonify(
                {
                    "video_id": video_id,
                    "transcript": "No Transcript.",
                    "summary": "No Summary.",
                }
            )

        summary = summarise_transcript(video_transcript)

        return jsonify(
            {"video_id": video_id, "transcript": video_transcript, "summary": summary}
        )

    except Exception as e:
        return jsonify({"error": f"Error: {str(e)}"}), 500


if __name__ == "__main__":
    app.run(debug=True)
