import json
import time
from pathlib import Path
from typing import Dict, Any, List
from .config import config

class MemoryStore:
    def __init__(self, file_path: Path = config.MEMORY_FILE):
        self.file_path = file_path
        self.file_path.parent.mkdir(parents=True, exist_ok=True)
        self.data: Dict[str, Any] = {
            "notes": [],
            "reminders": [],
            "facts": {},
            "conversation_summary": ""
        }
        self.load()

    def load(self):
        if self.file_path.exists():
            try:
                content = self.file_path.read_text(encoding="utf-8")
                self.data = json.loads(content)
            except Exception as e:
                print(f"Error loading memory: {e}")

    def save(self):
        try:
            self.file_path.write_text(json.dumps(self.data, indent=2), encoding="utf-8")
        except Exception as e:
            print(f"Error saving memory: {e}")

    def add_note(self, content: str, category: str = "general") -> Dict[str, Any]:
        note = {
            "id": len(self.data["notes"]) + 1,
            "content": content,
            "category": category,
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        self.data["notes"].append(note)
        self.save()
        return note

    def get_notes(self) -> List[Dict[str, Any]]:
        return self.data.get("notes", [])

    def delete_note(self, note_id: int) -> bool:
        notes = self.data.get("notes", [])
        before_len = len(notes)
        self.data["notes"] = [n for n in notes if n.get("id") != note_id]
        if len(self.data["notes"]) < before_len:
            self.save()
            return True
        return False

    def remember_fact(self, key: str, value: str):
        self.data.setdefault("facts", {})[key.lower().strip()] = {
            "value": value,
            "updated_at": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        self.save()

    def recall_facts(self) -> Dict[str, Any]:
        return self.data.get("facts", {})

    def get_context_summary(self) -> str:
        facts = self.data.get("facts", {})
        notes = self.data.get("notes", [])
        
        parts = []
        if facts:
            fact_lines = [f"- {k}: {v['value']}" for k, v in facts.items()]
            parts.append("Known User Facts:\n" + "\n".join(fact_lines))
        if notes:
            recent_notes = notes[-5:]
            note_lines = [f"#{n['id']} [{n['category']}] {n['content']} ({n['timestamp']})" for n in recent_notes]
            parts.append("Recent Saved Notes:\n" + "\n".join(note_lines))
            
        return "\n\n".join(parts) if parts else "No prior facts or notes stored."

memory_store = MemoryStore()
