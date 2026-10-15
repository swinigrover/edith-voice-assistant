import re
import traceback
from typing import AsyncGenerator, Dict, Any, List, Optional
from google import genai
from google.genai import types

from .config import config
from .memory_store import memory_store
from .tools import (
    TOOL_REGISTRY,
    GEMINI_TOOLS_DECLARATION,
    tool_get_current_time,
    tool_calculate,
    tool_get_weather,
    tool_search_web,
    tool_save_note,
    tool_recall_memory,
    tool_system_diagnostics
)

SYSTEM_PROMPT = """You are E.D.I.T.H. (Even Dead, I'm The Hero), an advanced cognitive AI voice agent and executive intelligence system.
Your goal is to reduce human effort strictly to voice.
Key guidelines:
1. Spoken Persona: Crisp, sharp, articulate, confident, and warm—like an executive digital chief of staff (Tony Stark's EDITH).
2. Spoken Optimization: Since the user hears your response aloud, keep your answers concise, direct, and conversational (usually 1 to 3 natural sentences unless asked for an in-depth breakdown).
3. Do not read aloud markdown asterisks, raw URLs, or complex lists of symbols. Speak fluidly.
4. Tool Calling: Use your tools whenever appropriate for time, calculations, live weather, web search facts, memory/notes, or system diagnostics.
5. Proactive Memory: When the user shares personal facts or asks to remember/remind them of something, always call the save_note tool.
6. Contextual Awareness: Refer back to prior context or memories when relevant.
"""

class CognitiveAgent:
    def __init__(self):
        self.history: List[Dict[str, str]] = []
        self._init_client()

    def _init_client(self):
        self.client: Optional[genai.Client] = None
        if config.GEMINI_API_KEY:
            try:
                self.client = genai.Client(api_key=config.GEMINI_API_KEY)
            except Exception as e:
                print(f"Failed to initialize Gemini client: {e}")
                self.client = None

    def refresh_client(self):
        self._init_client()

    def reset_conversation(self):
        self.history = []

    async def process_query(self, user_text: str) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Processes a voice query, yielding real-time status, tool results, and the final response.
        """
        clean_text = user_text.strip()
        if not clean_text:
            yield {
                "type": "response",
                "text": "I'm listening. How can I assist you?",
                "tools_used": []
            }
            return

        yield {"type": "status", "message": "Analyzing voice command..."}

        # Check if Gemini Client is configured
        if not self.client and config.GEMINI_API_KEY:
            self.refresh_client()

        if self.client:
            async for event in self._process_with_gemini(clean_text):
                yield event
        else:
            # Fallback cognitive router if no API key is configured yet
            async for event in self._process_with_fallback(clean_text):
                yield event

    async def _process_with_gemini(self, user_text: str) -> AsyncGenerator[Dict[str, Any], None]:
        tools_executed = []
        try:
            # Prepare contextual memory
            memory_context = memory_store.get_context_summary()
            full_system_instruction = f"{SYSTEM_PROMPT}\n\n[Active Memory State]:\n{memory_context}"

            # Prepare chat contents
            contents = []
            for turn in self.history[-8:]:
                contents.append(
                    types.Content(
                        role=turn["role"],
                        parts=[types.Part.from_text(text=turn["content"])]
                    )
                )
            # Add current user prompt
            contents.append(
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=user_text)]
                )
            )

            gen_config = types.GenerateContentConfig(
                system_instruction=full_system_instruction,
                temperature=0.7,
                tools=GEMINI_TOOLS_DECLARATION
            )

            # Model selection with automatic resilience if a model returns 404, 503, or 429 rate limits
            candidate_models = [config.DEFAULT_MODEL]
            for fallback_m in ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-flash-lite-latest", "gemini-flash-latest"]:
                if fallback_m not in candidate_models:
                    candidate_models.append(fallback_m)

            response = None
            active_model = config.DEFAULT_MODEL
            last_err = None

            for m in candidate_models:
                try:
                    response = self.client.models.generate_content(
                        model=m,
                        contents=contents,
                        config=gen_config
                    )
                    active_model = m
                    break
                except Exception as err:
                    last_err = err
                    err_str = str(err)
                    if any(indicator in err_str for indicator in [
                        "404", "503", "429", "NOT_FOUND", "UNAVAILABLE", 
                        "RESOURCE_EXHAUSTED", "quota", "limit", "rate limit", "no longer available"
                    ]):
                        print(f"Model {m} quota or rate limit reached, trying next model...")
                        continue
                    else:
                        raise err

            if response is None:
                raise last_err

            final_text = ""
            
            # Check function calls
            if response.function_calls:
                for fc in response.function_calls:
                    fname = fc.name
                    fargs = fc.args or {}
                    yield {
                        "type": "tool_call",
                        "tool": fname,
                        "args": fargs,
                        "message": f"Executing tactical module: {fname}"
                    }
                    if fname in TOOL_REGISTRY:
                        try:
                            result = TOOL_REGISTRY[fname](**fargs)
                        except Exception as tool_err:
                            result = f"Tool execution failed: {tool_err}"
                        tools_executed.append({
                            "tool": fname,
                            "args": fargs,
                            "result": str(result)
                        })

                # Follow-up with tool results to synthesize final voice reply
                followup_contents = list(contents)
                followup_contents.append(response.candidates[0].content)

                function_response_parts = []
                for tool in tools_executed:
                    function_response_parts.append(
                        types.Part.from_function_response(
                            name=tool["tool"],
                            response={"result": tool["result"]}
                        )
                    )
                followup_contents.append(
                    types.Content(role="tool", parts=function_response_parts)
                )

                yield {"type": "status", "message": "Synthesizing voice response..."}
                try:
                    followup_response = self.client.models.generate_content(
                        model=active_model,
                        contents=followup_contents,
                        config=types.GenerateContentConfig(
                            system_instruction=full_system_instruction,
                            temperature=0.7
                        )
                    )
                    final_text = followup_response.text or "I have processed that request."
                except Exception:
                    # If followup call hits quota, synthesize from direct tool results
                    results_list = [str(t["result"]) for t in tools_executed]
                    final_text = " ".join(results_list)
            else:
                final_text = response.text or "Standing by."

            # Record in history
            self.history.append({"role": "user", "content": user_text})
            self.history.append({"role": "model", "content": final_text})

            yield {
                "type": "response",
                "text": final_text,
                "tools_used": tools_executed
            }

        except Exception as e:
            traceback.print_exc()
            err_msg = str(e)
            if any(term in err_msg.lower() for term in ["429", "resource_exhausted", "quota", "rate limit"]):
                yield {
                    "type": "error",
                    "message": "Gemini API rate/quota limit reached (Free tier: 15 req/min). Switching to local tactical mode."
                }
            else:
                yield {
                    "type": "error",
                    "message": f"Cognitive processing error: {err_msg}"
                }
            # Fall back to rule-based tools if Gemini call had an error (e.g. rate limit or bad key)
            yield {"type": "status", "message": "Engaging local tactical engine..."}
            async for fallback_event in self._process_with_fallback(user_text):
                yield fallback_event

    async def _process_with_fallback(self, user_text: str) -> AsyncGenerator[Dict[str, Any], None]:
        """
        Smart local heuristic router for when Gemini API key is missing or offline.
        Allows instant testing of time, weather, math, notes, web search, and diagnostics!
        """
        text_lower = user_text.lower().strip()
        tools_executed = []

        # 1. Time / Date
        if any(w in text_lower for w in ["what time", "current time", "what date", "today's date", "day is it"]):
            yield {"type": "tool_call", "tool": "get_current_time", "args": {}, "message": "Retrieving local temporal sync..."}
            res = tool_get_current_time()
            tools_executed.append({"tool": "get_current_time", "result": res})
            response_text = f"It is currently {res}. All systems running on schedule."

        # 2. Weather
        elif "weather" in text_lower:
            # extract city
            city_match = re.search(r"weather (?:in|for|at)?\s*([a-zA-Z\s]+)", text_lower)
            city = city_match.group(1).strip() if city_match else "Delhi"
            yield {"type": "tool_call", "tool": "get_weather", "args": {"city": city}, "message": f"Accessing meteorological data for {city}..."}
            res = tool_get_weather(city)
            tools_executed.append({"tool": "get_weather", "args": {"city": city}, "result": res})
            response_text = f"According to current telemetry: {res}"

        # 3. Calculation / Math
        elif any(w in text_lower for w in ["calculate", "compute", "multiplied", "multiply", "divided", "times", "+", "-", "*", "/", "what is", "how much is"]) and re.search(r"\d", text_lower):
            math_text = text_lower
            for phrase, op in [
                ("multiplied by", "*"),
                ("multiply by", "*"),
                ("multiply", "*"),
                ("times", "*"),
                ("into", "*"),
                ("divided by", "/"),
                ("divide by", "/"),
                ("plus", "+"),
                ("minus", "-"),
                ("×", "*"),
                ("÷", "/"),
            ]:
                math_text = math_text.replace(phrase, op)
            # Remove anything not a math token
            expr = re.sub(r"[^\d+\-*/().%^]", "", math_text)
            if not expr:
                expr = "42*18.5"
            yield {"type": "tool_call", "tool": "calculate", "args": {"expression": expr}, "message": f"Calculating: {expr}..."}
            res = tool_calculate(expr)
            tools_executed.append({"tool": "calculate", "args": {"expression": expr}, "result": res})
            response_text = f"{res}. Let me know if you need further computations."

        # 4. Save note / task
        elif any(text_lower.startswith(prefix) for prefix in ["remember that", "remember to", "take a note", "save note", "add task", "note that"]):
            note_content = re.sub(r"^(remember that|remember to|take a note that|take a note|save note|add task|note that)\s*", "", user_text, flags=re.IGNORECASE)
            yield {"type": "tool_call", "tool": "save_note", "args": {"content": note_content}, "message": "Committing to memory..."}
            res = tool_save_note(note_content)
            tools_executed.append({"tool": "save_note", "args": {"content": note_content}, "result": res})
            response_text = f"Acknowledged. I have stored that in memory: '{note_content}'."

        # 5. Recall memory
        elif any(w in text_lower for w in ["what do you remember", "show notes", "read my notes", "recall notes", "what notes", "my tasks"]):
            yield {"type": "tool_call", "tool": "recall_memory", "args": {}, "message": "Accessing memory banks..."}
            res = tool_recall_memory()
            tools_executed.append({"tool": "recall_memory", "result": res})
            response_text = f"Here is what I have on record: {res}"

        # 6. Diagnostics
        elif any(w in text_lower for w in ["system status", "diagnostics", "status report", "core status", "who are you"]):
            yield {"type": "tool_call", "tool": "system_diagnostics", "args": {}, "message": "Running diagnostics..."}
            res = tool_system_diagnostics()
            tools_executed.append({"tool": "system_diagnostics", "result": res})
            response_text = "I am E.D.I.T.H., your cognitive voice intelligence system. All diagnostic checks are nominal and ready for commands."

        # 7. Search web / Who is / What is
        elif any(text_lower.startswith(w) for w in ["who is", "who was", "search for", "look up", "what is"]):
            query = re.sub(r"^(who is|who was|search for|look up|what is)\s*", "", user_text, flags=re.IGNORECASE)
            yield {"type": "tool_call", "tool": "search_web", "args": {"query": query}, "message": f"Querying knowledge network for '{query}'..."}
            res = tool_search_web(query)
            tools_executed.append({"tool": "search_web", "args": {"query": query}, "result": res})
            response_text = f"Here is what I found regarding {query}: {res}"

        # Default conversational response
        else:
            if not config.GEMINI_API_KEY:
                response_text = (
                    "I heard you loud and clear. To activate my full Gemini cognitive neural reasoning, "
                    "please enter your Gemini API Key in the Settings panel. In the meantime, you can ask me "
                    "for the time, weather, calculations, web searches, or to save notes and reminders hands-free."
                )
            else:
                response_text = f"Understood: '{user_text}'. I am standing by for your next voice directive."

        self.history.append({"role": "user", "content": user_text})
        self.history.append({"role": "model", "content": response_text})

        yield {
            "type": "response",
            "text": response_text,
            "tools_used": tools_executed
        }

cognitive_agent = CognitiveAgent()
