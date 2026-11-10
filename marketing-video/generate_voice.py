import asyncio
import edge_tts
import os

VOICE = "en-US-ChristopherNeural"  # Professional, deep, broadcast commercial voice

LINES = [
    # (Scene, StartSec, Text, Rate)
    (
        "scene1",
        "Tired of managing multi-million farm operations and joint funds on scattered spreadsheets and messy paper?",
        "+5%"
    ),
    (
        "scene2",
        "Meet Agro Planner. The all-in-one enterprise farm ERP and collective treasury engine, crafted by BASOBASO SOFTWARES.",
        "+5%"
    ),
    (
        "scene3",
        "Track precision livestock milestones, cook custom feed recipes, and monitor daily flock livability with absolute accuracy.",
        "+5%"
    ),
    (
        "scene4",
        "Govern collective treasury pools, 24-hour invitation codes, and maintain an immutable ledger with total financial transparency.",
        "+5%"
    ),
    (
        "scene5",
        "Take control of your agricultural venture today. Download Agro Planner now for Android and Web!",
        "+5%"
    ),
]

async def generate():
    out_dir = r"c:\Users\dell\Desktop\My Projects\My Projects\agro-planner\marketing-video\public\audio"
    os.makedirs(out_dir, exist_ok=True)
    
    for name, text, rate in LINES:
        out_file = os.path.join(out_dir, f"{name}.mp3")
        communicate = edge_tts.Communicate(text, VOICE, rate=rate)
        await communicate.save(out_file)
        print(f"Generated {out_file}")

if __name__ == "__main__":
    asyncio.run(generate())

