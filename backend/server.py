import os
import json
import asyncio
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .config import config
from .memory_store import memory_store
from .tools import TOOL_REGISTRY
from .cognitive_agent import cognitive_agent

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"

app = FastAPI(title="E.D.I.T.H. Cognitive Voice Agent", version="1.0.0")

# Enable CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SettingsPayload(BaseModel):
    api_key: str
    model: str = "gemini-3.8-flash"

class QueryPayload(BaseModel):
    text: str

class ToolPayload(BaseModel):
    tool: str
    args: dict = {}

@app.get("/api/status")
async def get_status():
    return {
        "status": "online",
        "has_api_key": bool(config.GEMINI_API_KEY),
        "api_key_masked": f"{config.GEMINI_API_KEY[:4]}...{config.GEMINI_API_KEY[-4:]}" if config.GEMINI_API_KEY else "",
        "model": config.DEFAULT_MODEL,
        "notes_count": len(memory_store.get_notes()),
        "tools_available": list(TOOL_REGISTRY.keys())
    }

@app.post("/api/settings")
async def update_settings(payload: SettingsPayload):
    if payload.api_key:
        config.update_api_key(payload.api_key)
        cognitive_agent.refresh_client()
    if payload.model:
        config.DEFAULT_MODEL = payload.model
    return {
        "success": True,
        "has_api_key": bool(config.GEMINI_API_KEY),
        "model": config.DEFAULT_MODEL
    }

@app.get("/api/notes")
async def get_notes():
    return {
        "notes": memory_store.get_notes(),
        "facts": memory_store.recall_facts()
    }

@app.delete("/api/notes/{note_id}")
async def delete_note(note_id: int):
    success = memory_store.delete_note(note_id)
    if not success:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"success": True, "notes": memory_store.get_notes()}

@app.post("/api/reset")
async def reset_session():
    cognitive_agent.reset_conversation()
    return {"success": True, "message": "Conversation history reset"}

@app.post("/api/execute_tool")
async def execute_tool(payload: ToolPayload):
    if payload.tool not in TOOL_REGISTRY:
        raise HTTPException(status_code=404, detail="Unknown tool")
    try:
        result = TOOL_REGISTRY[payload.tool](**payload.args)
        return {"success": True, "result": result}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/query")
async def rest_query(payload: QueryPayload):
    """Fallback REST endpoint for query processing"""
    events = []
    async for event in cognitive_agent.process_query(payload.text):
        events.append(event)
    return {"events": events}

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        # Send initial welcome state
        await websocket.send_json({
            "type": "ready",
            "message": "E.D.I.T.H. Core Connected",
            "has_api_key": bool(config.GEMINI_API_KEY),
            "model": config.DEFAULT_MODEL
        })

        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
            except Exception:
                continue

            msg_type = msg.get("type")

            if msg_type in ["voice_input", "text_input"]:
                user_text = msg.get("transcript") or msg.get("text", "")
                
                # Acknowledge receipt
                await websocket.send_json({
                    "type": "user_message",
                    "text": user_text
                })

                # Stream cognitive process
                async for event in cognitive_agent.process_query(user_text):
                    await websocket.send_json(event)

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif msg_type == "reset":
                cognitive_agent.reset_conversation()
                await websocket.send_json({
                    "type": "status",
                    "message": "Cognitive buffer cleared."
                })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")

# Mount static files
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

@app.get("/")
async def serve_index():
    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    return JSONResponse({"status": "Frontend loading..."})

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.server:app", host=config.HOST, port=config.PORT, reload=True)
