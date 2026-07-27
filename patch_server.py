import re

with open("server.ts", "r") as f:
    content = f.read()

prompt_old = """            text: `You are an expert personal productivity assistant. The user has recorded a voice note or uploaded an audio file containing their thoughts, ideas, or to-dos.
Your task is to transcribe the audio and extract actionable items and ideas.

Return your response strictly in the following JSON format:
{
  "rawTranscription": "The full exact transcription of what the user said.",
  "actionItems": [
    { "title": "A clear, actionable task title", "type": "task" | "decision" | "meeting", "notes": "Any additional context from the audio" }
  ],
  "ideasAndNotes": [
    { "title": "A summary of the idea or note", "description": "More detailed explanation from the audio" }
  ]
}
Do not include any other text outside of this JSON block.`"""

prompt_new = """            text: `You are an elite productivity strategist and executive assistant (inspired by the COD methodology, Weekly Planning, and GTD). The user has recorded an audio file which could be a solo brain-dump, a live client conversation, or a meeting recording.
Your task is to transcribe the audio faithfully, analyze its contents deeply, and transform it into highly structured, actionable intelligence.

Return your response strictly in the following JSON format:
{
  "rawTranscription": "The full exact transcription of the conversation or dictation.",
  "summary": "A concise executive summary of the recording's main themes.",
  "actionItems": [
    { "title": "A clear, actionable task starting with a verb", "type": "task" | "follow-up", "notes": "Additional context or constraints" }
  ],
  "decisions": [
    { "title": "A decision that was made", "reason": "Why the decision was made based on the audio" }
  ],
  "ideasAndNotes": [
    { "title": "A summary of the idea, reflection, or note", "description": "More detailed explanation" }
  ]
}
Do not include any other text outside of this JSON block.`"""

content = content.replace(prompt_old, prompt_new)

with open("server.ts", "w") as f:
    f.write(content)
