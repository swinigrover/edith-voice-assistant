import math
import datetime
import urllib.request
import urllib.parse
import json
try:
    import psutil
except ImportError:
    psutil = None
from .memory_store import memory_store

def tool_get_current_time(location: str = "local") -> str:
    """Returns the current date, time, and day of the week."""
    now = datetime.datetime.now()
    return now.strftime("Current Date: %A, %B %d, %Y | Time: %I:%M:%S %p")

def tool_calculate(expression: str) -> str:
    """Safely evaluates a mathematical or scientific expression."""
    allowed_names = {
        k: v for k, v in math.__dict__.items() if not k.startswith("__")
    }
    allowed_names.update({
        "abs": abs,
        "round": round,
        "min": min,
        "max": max,
        "sum": sum,
        "pow": pow
    })
    
    clean_expr = expression.strip().replace("^", "**")
    try:
        # compile with AST check
        code = compile(clean_expr, "<string>", "eval")
        for name in code.co_names:
            if name not in allowed_names:
                return f"Error: '{name}' is not an authorized mathematical operation."
        result = eval(code, {"__builtins__": {}}, allowed_names)
        return f"Calculation Result: {result}"
    except Exception as e:
        return f"Calculation Error: {str(e)}"

def tool_get_weather(city: str) -> str:
    """Fetches real-time weather, temperature, and conditions for a given city."""
    if not city:
        city = "current"
    try:
        url = f"https://wttr.in/{urllib.parse.quote(city)}?format=%C+%t+(feels+like+%f),+Humidity:+%h,+Wind:+%w"
        req = urllib.request.Request(url, headers={"User-Agent": "EDITH/1.0"})
        with urllib.request.urlopen(req, timeout=4) as res:
            weather_text = res.read().decode("utf-8").strip()
            return f"Weather for {city}: {weather_text}"
    except Exception as e:
        # Fallback to simple format
        try:
            url_alt = f"https://wttr.in/{urllib.parse.quote(city)}?format=3"
            req_alt = urllib.request.Request(url_alt, headers={"User-Agent": "EDITH/1.0"})
            with urllib.request.urlopen(req_alt, timeout=3) as res:
                return res.read().decode("utf-8").strip()
        except Exception:
            return f"Unable to retrieve live weather for {city} right now."

def tool_search_web(query: str) -> str:
    """Searches the web and knowledge base for real-time answers and factual information."""
    if not query:
        return "Please provide a search query."
    
    # Try DuckDuckGo Instant Answer first
    try:
        url = "https://api.duckduckgo.com/?q=" + urllib.parse.quote(query) + "&format=json&no_html=1&skip_disambig=1"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"})
        with urllib.request.urlopen(req, timeout=4) as res:
            data = json.loads(res.read().decode("utf-8"))
            abstract = data.get("AbstractText")
            if abstract:
                source = data.get("AbstractSource", "Web")
                return f"[{source}] {abstract}"
            # Check related topics
            topics = data.get("RelatedTopics", [])
            if topics and isinstance(topics, list) and len(topics) > 0:
                first_text = topics[0].get("Text")
                if first_text:
                    return f"[DuckDuckGo] {first_text}"
    except Exception:
        pass
    
    # Try Wikipedia summary fallback
    try:
        url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(query)
        req = urllib.request.Request(url, headers={"User-Agent": "EDITH-VoiceAgent/1.0 (personal-assistant)"})
        with urllib.request.urlopen(req, timeout=4) as res:
            data = json.loads(res.read().decode("utf-8"))
            extract = data.get("extract")
            if extract:
                return f"[Wikipedia: {data.get('title')}] {extract}"
    except Exception:
        pass
        
    return f"No direct summary found for '{query}'. Please rephrase or specify the topic."

def tool_save_note(content: str, category: str = "general") -> str:
    """Saves a note, task, or reminder to EDITH's persistent memory."""
    note = memory_store.add_note(content, category)
    return f"Saved to memory: Note #{note['id']} [{category}]: \"{content}\""

def tool_recall_memory() -> str:
    """Retrieves all saved notes, tasks, and stored user facts from memory."""
    notes = memory_store.get_notes()
    facts = memory_store.recall_facts()
    if not notes and not facts:
        return "Memory is currently empty. You haven't asked me to save any notes or facts yet."
    
    output = []
    if facts:
        output.append("Learned Facts: " + ", ".join([f"{k}: {v['value']}" for k, v in facts.items()]))
    if notes:
        output.append("Saved Notes/Tasks:\n" + "\n".join([f"- Note #{n['id']} ({n['category']}): {n['content']}" for n in notes]))
    return "\n\n".join(output)

def tool_system_diagnostics() -> str:
    """Checks the system environment, core status, and host details."""
    system = platform.system()
    release = platform.release()
    machine = platform.machine()
    python_ver = platform.python_version()
    return f"EDITH System Diagnostics: Host OS: {system} {release} ({machine}) | Python: {python_ver} | Neural Core: Online & Synchronized"

# Registry of available tools for LLM and manual execution
TOOL_REGISTRY = {
    "get_current_time": tool_get_current_time,
    "calculate": tool_calculate,
    "get_weather": tool_get_weather,
    "search_web": tool_search_web,
    "save_note": tool_save_note,
    "recall_memory": tool_recall_memory,
    "system_diagnostics": tool_system_diagnostics
}

GEMINI_TOOLS_DECLARATION = [
    tool_get_current_time,
    tool_calculate,
    tool_get_weather,
    tool_search_web,
    tool_save_note,
    tool_recall_memory,
    tool_system_diagnostics
]
