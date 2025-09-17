# -------------------------
# Blok 1/16 — Basis & skelet
# -------------------------

import os
import io
import re
import json
import time
import base64
import typing
import random
import string
import hashlib
from datetime import datetime

try:
    import requests
except Exception:
    requests = None  # We check later and give a friendly message if missing


# ---------- Helpers (lichtgewicht) ----------

def _now_iso():
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

def _sha1(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8", errors="ignore")).hexdigest()

def _safe_json_loads(s: str, default=None):
    try:
        return json.loads(s) if s else default
    except Exception:
        return default

def _coalesce(*vals):
    for v in vals:
        if v is not None:
            return v
    return None


# ---------- Node class ----------

class OllamaAIOUltimateMultiAPITranslatedImage:
    """
    Complete ComfyUI node (16 blokken). Dit is het skelet; logica wordt in volgende blokken toegevoegd.
    - Behandelt tekst + optioneel beeld (multimodaal)
    - Ondersteunt live search, vertaling, multi-API, KB, chaining, debug, vision, niche API's
    """

    # ComfyUI-registratiegegevens (NODE_CLASS_MAPPINGS en DISPLAY_NAME komen in Blok 16)
    CATEGORY = "Ollama"
    FUNCTION = "run"

    # -------------------------
    # Inputs
    # -------------------------
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                # Kernprompts
                "system_prompt": ("STRING", {
                    "multiline": True,
                    "default": "You are a helpful, precise AI assistant."
                }),
                "user_prompt": ("STRING", {
                    "multiline": True,
                    "default": ""
                }),

                # Model & sampling
                "model": ("STRING", {
                    "default": "llama3.1"
                }),
                "temperature": ("FLOAT", {
                    "default": 0.7, "min": 0.0, "max": 2.0, "step": 0.05
                }),
                "top_p": ("FLOAT", {
                    "default": 0.9, "min": 0.0, "max": 1.0, "step": 0.01
                }),
                "max_tokens": ("INT", {
                    "default": 1024, "min": 1, "max": 32768, "step": 1
                }),

                # Live search (aan/uit + providerselectie; logica volgt in latere blokken)
                "use_live_search": ("BOOL", {"default": True}),
                "search_provider": ([
                    "duckduckgo",
                    "wikipedia",
                    "mixed"
                ], {"default": "mixed"}),

                # Vertaling (taaldoelen; logica volgt in latere blokken)
                "auto_translate": ("BOOL", {"default": False}),
                "target_language": ("STRING", {"default": "en"}),

                # Multimodaal (detectie & optionele image-input)
                "detect_multimodal": ("BOOL", {"default": True}),
                # BELANGRIJK: echt optioneel zodat ComfyUI geen error geeft zonder beeld
                "optional_image_input": ("IMAGE", {"default": None, "optional": True}),

                # Knowledge base & multi-API toggles volgen later; we reserveren toggles alvast
                "use_knowledge_base": ("BOOL", {"default": False}),
                "use_multi_api": ("BOOL", {"default": False}),

                # Chaining & debug
                "enable_context_chaining": ("BOOL", {"default": False}),
                "session_id": ("STRING", {"default": "default_session"}),
                "debug": ("BOOL", {"default": False}),
            },
            "optional": {
                # Handmatige context-injectie (JSON), blijft werken naast auto-chaining
                "context_messages_json": ("STRING", {
                    "multiline": True,
                    "default": ""
                }),
            }
        }

    # -------------------------
    # Outputs
    # -------------------------
    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("text", "metadata_json")
    OUTPUT_IS_LIST = (False, False)

    # -------------------------
    # Constructor
    # -------------------------
    def __init__(self):
        self.debug = False  # wordt overschreven door input
        self._last_run_info = {
            "started_at": None,
            "finished_at": None,
            "duration_sec": None,
            "chain_used": False,
            "live_search_used": False,
            "images_used": 0,
            "model": None
        }

    # -------------------------
    # Kern-run (wordt in blokken uitgebreid)
    # -------------------------
    def run(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str,
        temperature: float,
        top_p: float,
        max_tokens: int,
        use_live_search: bool,
        search_provider: str,
        auto_translate: bool,
        target_language: str,
        detect_multimodal: bool,
        optional_image_input,  # IMAGE or None
        use_knowledge_base: bool,
        use_multi_api: bool,
        enable_context_chaining: bool,
        session_id: str,
        debug: bool,
        context_messages_json: str = ""
    ):
        """
        Minimale, veilige uitvoering zodat de node al kan draaien.
        Volledige functionaliteit wordt in Blok 2–16 toegevoegd.
        """
        self.debug = bool(debug)
        start_ts = time.time()
        self._last_run_info.update({
            "started_at": _now_iso(),
            "chain_used": bool(enable_context_chaining),
            "live_search_used": bool(use_live_search),
            "images_used": 1 if optional_image_input is not None else 0,
            "model": model
        })

        # Bouw een eenvoudige, tijdelijke output (plaatsvervanger)
        # In latere blokken:
        # - context bouwen
        # - live search
        # - vertaling
        # - multimodaal
        # - multi-API
        # - KB
        # - call naar Ollama
        # - parsing, citations, etc.
        preview_summary = {
            "status": "initialized",
            "note": "Full logic komt in Blok 2–16.",
            "model": model,
            "use_live_search": use_live_search,
            "detect_multimodal": detect_multimodal,
            "image_attached": optional_image_input is not None,
            "enable_context_chaining": enable_context_chaining,
            "auto_translate": auto_translate,
            "target_language": target_language,
            "session_id": session_id
        }

        text_out = (
            "Node initialized. Waiting for full pipeline (Blocks 2–16) to be added.\n\n"
            f"System prompt (preview): {system_prompt[:200]}\n"
            f"User prompt (preview): {user_prompt[:200]}"
        )

        self._last_run_info.update({
            "finished_at": _now_iso(),
            "duration_sec": round(time.time() - start_ts, 4)
        })

        return (text_out, json.dumps({
            "run_info": self._last_run_info,
            "preview": preview_summary
        }, ensure_ascii=False))
    # -------------------------
    # Blok 2/16 — Prompt-normalisatie & basis-context
    # -------------------------

    def _normalize_prompt(self, text: str) -> str:
        """
        Zorgt dat de prompt schoon en consistent is.
        - Trim spaties
        - Vervang rare whitespace door gewone spaties
        - Verwijder onnodige dubbele newlines
        """
        if not text:
            return ""
        # Strip leading/trailing whitespace
        t = text.strip()
        # Vervang tabs en meerdere spaties door één spatie
        t = re.sub(r"[ \t]+", " ", t)
        # Vervang 3+ newlines door 2
        t = re.sub(r"\n{3,}", "\n\n", t)
        return t

    def _build_base_messages(self, system_prompt: str, user_prompt: str):
        """
        Bouwt de basis 'messages' lijst in OpenAI/Ollama stijl.
        Later voegen we hier live search, KB, chaining, etc. aan toe.
        """
        messages = []
        sys_clean = self._normalize_prompt(system_prompt)
        usr_clean = self._normalize_prompt(user_prompt)

        if sys_clean:
            messages.append({"role": "system", "content": sys_clean})
        if usr_clean:
            messages.append({"role": "user", "content": usr_clean})

        return messages
    # -------------------------
    # Blok 3/16 — Live search
    # -------------------------

    def _live_search_duckduckgo(self, query: str, max_results: int = 5):
        """Zoek via DuckDuckGo Instant Answer API."""
        if not requests:
            return ["[LiveSearch] requests module ontbreekt."]
        try:
            r = requests.get(
                "https://api.duckduckgo.com/",
                params={
                    "q": query,
                    "format": "json",
                    "no_redirect": "1",
                    "no_html": "1"
                },
                timeout=8
            )
            r.raise_for_status()
            data = r.json()
            snippets = []
            if data.get("AbstractText"):
                snippets.append(data["AbstractText"])
            for rt in data.get("RelatedTopics", []):
                if isinstance(rt, dict) and rt.get("Text"):
                    snippets.append(rt["Text"])
                if len(snippets) >= max_results:
                    break
            return snippets or ["[LiveSearch] Geen resultaten."]
        except Exception as e:
            return [f"[LiveSearch] Fout DuckDuckGo: {e}"]

    def _live_search_wikipedia(self, query: str, max_results: int = 5, lang: str = "en"):
        """Zoek via Wikipedia API."""
        if not requests:
            return ["[LiveSearch] requests module ontbreekt."]
        try:
            search_url = f"https://{lang}.wikipedia.org/w/api.php"
            r = requests.get(
                search_url,
                params={
                    "action": "query",
                    "list": "search",
                    "srsearch": query,
                    "format": "json"
                },
                timeout=8
            )
            r.raise_for_status()
            data = r.json()
            snippets = []
            for item in data.get("query", {}).get("search", []):
                snippet = re.sub(r"<.*?>", "", item.get("snippet", ""))
                snippets.append(snippet)
                if len(snippets) >= max_results:
                    break
            return snippets or ["[LiveSearch] Geen resultaten."]
        except Exception as e:
            return [f"[LiveSearch] Fout Wikipedia: {e}"]

    def _perform_live_search(self, query: str, provider: str = "mixed", max_results: int = 5):
        """Kies de juiste provider en voer de zoekopdracht uit."""
        provider = provider.lower()
        results = []
        if provider == "duckduckgo":
            results = self._live_search_duckduckgo(query, max_results)
        elif provider == "wikipedia":
            results = self._live_search_wikipedia(query, max_results)
        elif provider == "mixed":
            ddg = self._live_search_duckduckgo(query, max_results // 2)
            wiki = self._live_search_wikipedia(query, max_results // 2)
            results = (ddg or []) + (wiki or [])
        else:
            results = [f"[LiveSearch] Onbekende provider: {provider}"]

        # Filter lege of None waarden
        results = [r for r in results if r and isinstance(r, str)]
        return results
    # -------------------------
    # Blok 4/16 — Search-injectie
    # -------------------------

    def _inject_search_results(self, messages: list, search_results: list):
        """
        Voegt zoekresultaten toe aan de messages als extra 'system' context.
        Dit maakt het voor het model makkelijker om actuele info te gebruiken.
        """
        if not search_results:
            return messages

        # Bouw een nette tekst van de resultaten
        search_text = "\n".join(f"- {res}" for res in search_results if res)

        # Voeg toe als extra system-bericht
        messages.append({
            "role": "system",
            "content": (
                "De volgende externe zoekresultaten zijn beschikbaar als context:\n"
                f"{search_text}"
            )
        })
        return messages
    # -------------------------
    # Blok 5/16 — Vertaling
    # -------------------------

    def _translate_libre(self, text: str, target_lang: str = "en"):
        """Vertaal via LibreTranslate (open source API)."""
        if not requests:
            return text
        try:
            r = requests.post(
                "https://libretranslate.com/translate",
                data={
                    "q": text,
                    "source": "auto",
                    "target": target_lang,
                    "format": "text"
                },
                timeout=10
            )
            r.raise_for_status()
            data = r.json()
            return data.get("translatedText", text)
        except Exception as e:
            if self.debug:
                print(f"[Translate] LibreTranslate fout: {e}")
            return text

    def _translate_lingva(self, text: str, target_lang: str = "en"):
        """Vertaal via Lingva Translate (Google Translate proxy)."""
        if not requests:
            return text
        try:
            r = requests.get(
                f"https://lingva.ml/api/v1/auto/{target_lang}/{requests.utils.quote(text)}",
                timeout=10
            )
            r.raise_for_status()
            data = r.json()
            return data.get("translation", text)
        except Exception as e:
            if self.debug:
                print(f"[Translate] Lingva fout: {e}")
            return text

    def _translate_if_needed(self, text: str, target_lang: str, auto_translate: bool):
        """
        Vertaal tekst naar target_lang als auto_translate aanstaat.
        Fallback: Libre -> Lingva -> origineel.
        """
        if not auto_translate or not text:
            return text
        # Probeer LibreTranslate
        translated = self._translate_libre(text, target_lang)
        if translated != text:
            return translated
        # Fallback naar Lingva
        translated2 = self._translate_lingva(text, target_lang)
        return translated2

    def _translate_back_if_needed(self, text: str, original_lang: str, auto_translate: bool):
        """
        Vertaal tekst terug naar de oorspronkelijke taal als auto_translate aanstaat.
        """
        if not auto_translate or not text:
            return text
        # Zelfde fallback volgorde
        translated = self._translate_libre(text, original_lang)
        if translated != text:
            return translated
        translated2 = self._translate_lingva(text, original_lang)
        return translated2
    # -------------------------
    # Blok 6/16 — Multimodale verwerking
    # -------------------------

    def _process_optional_image_input(self, image_input, detect_multimodal: bool):
        """
        Verwerkt optionele image-input:
        - Zet om naar base64 als er een afbeelding is
        - Detecteert of multimodaal nodig is
        - Retourneert (images_list, multimodal_enabled)
        """
        images_b64 = []
        multimodal_enabled = False

        if image_input is not None:
            try:
                # ComfyUI geeft een PIL.Image of vergelijkbaar object door
                import PIL.Image
                if isinstance(image_input, PIL.Image.Image):
                    buf = io.BytesIO()
                    image_input.save(buf, format="PNG")
                    b64_str = base64.b64encode(buf.getvalue()).decode("utf-8")
                    images_b64.append(b64_str)
                    multimodal_enabled = True
                else:
                    if self.debug:
                        print("[Multimodal] Onbekend image_input type:", type(image_input))
            except Exception as e:
                if self.debug:
                    print(f"[Multimodal] Fout bij verwerken afbeelding: {e}")

        # Als detect_multimodal True is, maar er geen image is, blijft multimodal_enabled False
        if detect_multimodal and images_b64:
            multimodal_enabled = True

        return images_b64, multimodal_enabled
    # -------------------------
    # Blok 7/16 — Knowledge Base
    # -------------------------

    def _kb_load_documents(self, kb_path: str = "knowledge_base"):
        """
        Laadt alle .txt-bestanden uit de KB-map en retourneert een lijst van (filename, content).
        """
        docs = []
        if not os.path.isdir(kb_path):
            if self.debug:
                print(f"[KB] Map '{kb_path}' bestaat niet.")
            return docs

        for fname in os.listdir(kb_path):
            if fname.lower().endswith(".txt"):
                try:
                    with open(os.path.join(kb_path, fname), "r", encoding="utf-8") as f:
                        docs.append((fname, f.read()))
                except Exception as e:
                    if self.debug:
                        print(f"[KB] Fout bij laden {fname}: {e}")
        return docs

    def _kb_search(self, query: str, kb_path: str = "knowledge_base", top_k: int = 3):
        """
        Doorzoekt de KB met TF-IDF en retourneert de top_k relevante documenten/snippets.
        """
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.metrics.pairwise import cosine_similarity
        except ImportError:
            if self.debug:
                print("[KB] scikit-learn niet geïnstalleerd, KB-zoekfunctie uitgeschakeld.")
            return []

        docs = self._kb_load_documents(kb_path)
        if not docs:
            return []

        filenames, contents = zip(*docs)
        vectorizer = TfidfVectorizer()
        tfidf_matrix = vectorizer.fit_transform(contents + (query,))
        cosine_sim = cosine_similarity(tfidf_matrix[-1], tfidf_matrix[:-1]).flatten()

        scored_docs = sorted(
            zip(filenames, contents, cosine_sim),
            key=lambda x: x[2],
            reverse=True
        )

        top_results = []
        for fname, content, score in scored_docs[:top_k]:
            snippet = content.strip().replace("\n", " ")
            if len(snippet) > 500:
                snippet = snippet[:500] + "..."
            top_results.append(f"[KB:{fname}] {snippet}")

        return top_results

    def _inject_kb_results(self, messages: list, kb_results: list):
        """
        Voegt KB-resultaten toe aan de messages als extra system-context.
        """
        if not kb_results:
            return messages

        kb_text = "\n".join(kb_results)
        messages.append({
            "role": "system",
            "content": (
                "De volgende Knowledge Base-informatie is beschikbaar als context:\n"
                f"{kb_text}"
            )
        })
        return messages
    # -------------------------
    # Blok 8/16 — Multi‑API router
    # -------------------------

    def _api_weather(self, location: str = "Amsterdam"):
        """Eenvoudige weer‑API via wttr.in (plaintext)."""
        if not requests:
            return "[API:Weer] requests module ontbreekt."
        try:
            r = requests.get(f"https://wttr.in/{location}?format=3", timeout=8)
            r.raise_for_status()
            return f"[Weer] {r.text.strip()}"
        except Exception as e:
            return f"[API:Weer] Fout: {e}"

    def _api_news(self, topic: str = "technology"):
        """Nieuws‑API via GNews (gratis endpoint)."""
        if not requests:
            return "[API:Nieuws] requests module ontbreekt."
        try:
            r = requests.get(
                "https://gnews.io/api/v4/search",
                params={
                    "q": topic,
                    "lang": "en",
                    "max": 3,
                    "token": "demo"  # vervang door eigen token voor productie
                },
                timeout=8
            )
            r.raise_for_status()
            data = r.json()
            articles = []
            for art in data.get("articles", []):
                articles.append(f"{art.get('title')} — {art.get('url')}")
            return "[Nieuws]\n" + "\n".join(articles) if articles else "[Nieuws] Geen resultaten."
        except Exception as e:
            return f"[API:Nieuws] Fout: {e}"

    def _api_finance(self, symbol: str = "AAPL"):
        """Finance‑API via Yahoo Finance (YF API)."""
        if not requests:
            return "[API:Finance] requests module ontbreekt."
        try:
            r = requests.get(
                f"https://query1.finance.yahoo.com/v7/finance/quote?symbols={symbol}",
                timeout=8
            )
            r.raise_for_status()
            data = r.json()
            quote = data.get("quoteResponse", {}).get("result", [{}])[0]
            price = quote.get("regularMarketPrice")
            currency = quote.get("currency", "")
            return f"[Finance] {symbol}: {price} {currency}" if price else "[Finance] Geen data."
        except Exception as e:
            return f"[API:Finance] Fout: {e}"

    def _multi_api_router(self, query: str):
        """
        Roept meerdere API's aan op basis van trefwoorden in de query.
        Later breiden we dit uit met niche API's (sport, crypto, etc.).
        """
        results = []

        q_lower = query.lower()
        if any(word in q_lower for word in ["weer", "weather", "temperatuur"]):
            results.append(self._api_weather())

        if any(word in q_lower for word in ["nieuws", "news", "headline"]):
            results.append(self._api_news())

        if any(word in q_lower for word in ["aandelen", "stock", "prijs", "price"]):
            results.append(self._api_finance())

        return [r for r in results if r]
    # -------------------------
    # Blok 9/16 — Context-builder
    # -------------------------

    def _build_full_context(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str,
        use_live_search: bool,
        search_provider: str,
        use_knowledge_base: bool,
        use_multi_api: bool,
        detect_multimodal: bool,
        optional_image_input,
        auto_translate: bool,
        target_language: str,
        enable_context_chaining: bool,
        session_id: str,
        context_messages_json: str = ""
    ):
        """
        Bouwt de volledige messages-lijst door alle bronnen te combineren.
        """
        # 1. Basis messages
        messages = self._build_base_messages(system_prompt, user_prompt)

        # 2. Handmatige context (JSON)
        manual_ctx = _safe_json_loads(context_messages_json, default=[])
        if manual_ctx and isinstance(manual_ctx, list):
            messages = manual_ctx + messages

        # 3. Context-chaining (automatisch)
        if enable_context_chaining:
            old_ctx = self._load_previous_context(session_id)
            if old_ctx:
                messages = self._merge_context(old_ctx, messages)

        # 4. Live search
        if use_live_search and user_prompt.strip():
            search_results = self._perform_live_search(user_prompt, search_provider)
            messages = self._inject_search_results(messages, search_results)

        # 5. Knowledge Base
        if use_knowledge_base and user_prompt.strip():
            kb_results = self._kb_search(user_prompt)
            messages = self._inject_kb_results(messages, kb_results)

        # 6. Multi-API
        if use_multi_api and user_prompt.strip():
            api_results = self._multi_api_router(user_prompt)
            if api_results:
                messages.append({
                    "role": "system",
                    "content": (
                        "De volgende externe API-resultaten zijn beschikbaar als context:\n" +
                        "\n".join(api_results)
                    )
                })

        # 7. Multimodale input
        images_b64, multimodal_enabled = self._process_optional_image_input(
            optional_image_input, detect_multimodal
        )

        # 8. Vertaling van prompts (indien nodig)
        if auto_translate and target_language:
            for m in messages:
                if m["role"] in ("system", "user"):
                    m["content"] = self._translate_if_needed(m["content"], target_language, True)

        return messages, images_b64, multimodal_enabled
    # -------------------------
    # Blok 10/16 — Ollama API-aanroep
    # -------------------------

    def _call_ollama(
        self,
        model: str,
        messages: list,
        temperature: float = 0.7,
        top_p: float = 0.9,
        max_tokens: int = 1024,
        images_b64: list = None,
        multimodal_enabled: bool = False
    ):
        """
        Roept het Ollama-model aan via de lokale API.
        Ondersteunt multimodale input als images_b64 is gevuld en multimodal_enabled True is.
        """
        if not requests:
            return "[Ollama] requests module ontbreekt."

        payload = {
            "model": model,
            "messages": messages,
            "options": {
                "temperature": temperature,
                "top_p": top_p,
                "num_predict": max_tokens
            }
        }

        # Voeg afbeeldingen toe als multimodaal actief is
        if multimodal_enabled and images_b64:
            payload["images"] = images_b64

        try:
            r = requests.post(
                "http://127.0.0.1:11434/api/chat",
                json=payload,
                timeout=60
            )
            r.raise_for_status()
            data = r.json()

            # Ollama kan meerdere messages teruggeven; pak de laatste assistant-content
            if isinstance(data, dict) and "message" in data:
                return data["message"].get("content", "")
            elif isinstance(data, dict) and "messages" in data:
                for m in reversed(data["messages"]):
                    if m.get("role") == "assistant":
                        return m.get("content", "")
            return "[Ollama] Geen geldig antwoord ontvangen."
        except Exception as e:
            return f"[Ollama] Fout bij API-aanroep: {e}"
    # -------------------------
    # Blok 11/16 — Output-parser
    # -------------------------

    def _parse_ollama_output(self, raw_output: str):
        """
        Parseert het ruwe Ollama-antwoord:
        - Verwijdert <think>...</think> secties
        - Scheidt citations (bronvermeldingen) uit
        - Retourneert (clean_text, citations_list)
        """
        if not raw_output:
            return "", []

        text = raw_output

        # 1. Verwijder <think> secties
        text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)

        # 2. Extract citations tussen [bron: ...] of (bron: ...)
        citations = []
        citation_pattern = r"

\[bron:(.*?)\]

|\(bron:(.*?)\)"
        for match in re.findall(citation_pattern, text, flags=re.IGNORECASE):
            # match is een tuple van 2, waarvan er één leeg is
            cit = match[0] if match[0] else match[1]
            cit = cit.strip()
            if cit:
                citations.append(cit)

        # 3. Verwijder citation-tags uit de tekst
        text = re.sub(citation_pattern, "", text, flags=re.IGNORECASE)

        # 4. Opschonen whitespace
        text = re.sub(r"\n{3,}", "\n\n", text).strip()

        return text, citations

    def _build_metadata(self, citations: list):
        """
        Bouwt een metadata-dict voor output.
        """
        return {
            "citations": citations,
            "generated_at": _now_iso()
        }
    # -------------------------
    # Blok 12/16 — Uitgebreide run()
    # -------------------------

    def run(
        self,
        system_prompt: str,
        user_prompt: str,
        model: str,
        temperature: float,
        top_p: float,
        max_tokens: int,
        use_live_search: bool,
        search_provider: str,
        auto_translate: bool,
        target_language: str,
        detect_multimodal: bool,
        optional_image_input,  # IMAGE or None
        use_knowledge_base: bool,
        use_multi_api: bool,
        enable_context_chaining: bool,
        session_id: str,
        debug: bool,
        context_messages_json: str = ""
    ):
        self.debug = bool(debug)
        start_ts = time.time()
        self._last_run_info.update({
            "started_at": _now_iso(),
            "chain_used": bool(enable_context_chaining),
            "live_search_used": bool(use_live_search),
            "images_used": 1 if optional_image_input is not None else 0,
            "model": model
        })

        # 1. Bouw volledige context
        messages, images_b64, multimodal_enabled = self._build_full_context(
            system_prompt,
            user_prompt,
            model,
            use_live_search,
            search_provider,
            use_knowledge_base,
            use_multi_api,
            detect_multimodal,
            optional_image_input,
            auto_translate,
            target_language,
            enable_context_chaining,
            session_id,
            context_messages_json
        )

        # 2. Call naar Ollama
        raw_output = self._call_ollama(
            model,
            messages,
            temperature,
            top_p,
            max_tokens,
            images_b64,
            multimodal_enabled
        )

        # 3. Parse output
        clean_text, citations = self._parse_ollama_output(raw_output)

        # 4. Vertaal terug indien nodig
        if auto_translate and target_language:
            # Probeer oorspronkelijke taal te detecteren uit system_prompt
            # Simpel: neem eerste 2 letters van system_prompt als hint, anders 'auto'
            orig_lang = "auto"
            clean_text = self._translate_back_if_needed(clean_text, orig_lang, True)

        # 5. Metadata bouwen
        metadata = self._build_metadata(citations)

        # 6. Context opslaan als chaining aanstaat
        if enable_context_chaining:
            self._save_context(messages + [{"role": "assistant", "content": clean_text}], session_id)

        # 7. Run-info bijwerken
        self._last_run_info.update({
            "finished_at": _now_iso(),
            "duration_sec": round(time.time() - start_ts, 4)
        })
        metadata["run_info"] = self._last_run_info

        return clean_text, json.dumps(metadata, ensure_ascii=False)
    # -------------------------
    # Blok 13/16 — Context-chaining
    # -------------------------

    def _load_previous_context(self, session_id="default_session"):
        """
        Laad eerder opgeslagen context uit een JSON-bestand.
        """
        import os, json
        context_file = f"ollama_context_{session_id}.json"
        if os.path.exists(context_file):
            try:
                with open(context_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                if self.debug:
                    print(f"[ContextChain] Fout bij laden context: {e}")
        return []

    def _save_context(self, messages, session_id="default_session"):
        """
        Sla huidige context op in een JSON-bestand.
        """
        import json
        try:
            with open(f"ollama_context_{session_id}.json", "w", encoding="utf-8") as f:
                json.dump(messages, f, ensure_ascii=False, indent=2)
        except Exception as e:
            if self.debug:
                print(f"[ContextChain] Fout bij opslaan context: {e}")

    def _merge_context(self, old_messages, new_messages, max_turns=10):
        """
        Combineer oude en nieuwe berichten, beperk tot max_turns.
        """
        combined = old_messages + new_messages
        # Beperk tot de laatste max_turns * 2 (user+assistant)
        if len(combined) > max_turns * 2:
            combined = combined[-(max_turns * 2):]
        return combined
        # -------------------------
    # Blok 14/16 — Extra vertaal-fallbacks
    # -------------------------

    def _translate_deepl(self, text: str, target_lang: str = "EN"):
        """
        Vertaal via DeepL API (vereist API-key in omgevingsvariabele DEEPL_API_KEY).
        target_lang: bv. 'EN', 'NL', 'DE', 'FR', ...
        """
        if not requests:
            return text
        api_key = os.environ.get("DEEPL_API_KEY")
        if not api_key:
            if self.debug:
                print("[Translate] DeepL API-key ontbreekt (env: DEEPL_API_KEY).")
            return text
        try:
            r = requests.post(
                "https://api-free.deepl.com/v2/translate",
                data={
                    "auth_key": api_key,
                    "text": text,
                    "target_lang": target_lang.upper()
                },
                timeout=10
            )
            r.raise_for_status()
            data = r.json()
            translations = data.get("translations", [])
            if translations:
                return translations[0].get("text", text)
            return text
        except Exception as e:
            if self.debug:
                print(f"[Translate] DeepL fout: {e}")
            return text

    def _translate_mymemory(self, text: str, target_lang: str = "en"):
        """
        Vertaal via MyMemory Translated API (gratis, beperkt).
        target_lang: bv. 'en', 'nl', 'de', 'fr', ...
        """
        if not requests:
            return text
        try:
            r = requests.get(
                "https://api.mymemory.translated.net/get",
                params={
                    "q": text,
                    "langpair": f"auto|{target_lang}"
                },
                timeout=10
            )
            r.raise_for_status()
            data = r.json()
            return data.get("responseData", {}).get("translatedText", text)
        except Exception as e:
            if self.debug:
                print(f"[Translate] MyMemory fout: {e}")
            return text

    def _translate_if_needed(self, text: str, target_lang: str, auto_translate: bool):
        """
        Vertaal tekst naar target_lang als auto_translate aanstaat.
        Fallback-volgorde: DeepL -> Libre -> Lingva -> MyMemory -> origineel.
        """
        if not auto_translate or not text:
            return text

        # 1. DeepL
        translated = self._translate_deepl(text, target_lang)
        if translated != text:
            return translated

        # 2. LibreTranslate
        translated = self._translate_libre(text, target_lang)
        if translated != text:
            return translated

        # 3. Lingva
        translated = self._translate_lingva(text, target_lang)
        if translated != text:
            return translated

        # 4. MyMemory
        translated = self._translate_mymemory(text, target_lang)
        if translated != text:
            return translated

        # 5. Origineel teruggeven
        return text

    def _translate_back_if_needed(self, text: str, original_lang: str, auto_translate: bool):
        """
        Vertaal tekst terug naar de oorspronkelijke taal als auto_translate aanstaat.
        Zelfde fallback-volgorde als heenvertaling.
        """
        if not auto_translate or not text:
            return text

        # 1. DeepL
        translated = self._translate_deepl(text, original_lang)
        if translated != text:
            return translated

        # 2. LibreTranslate
        translated = self._translate_libre(text, original_lang)
        if translated != text:
            return translated

        # 3. Lingva
        translated = self._translate_lingva(text, original_lang)
        if translated != text:
            return translated

        # 4. MyMemory
        translated = self._translate_mymemory(text, original_lang)
        if translated != text:
            return translated

        return text

    # -------------------------
    # Blok 15/16 — Debug & logging
    # -------------------------

    def _debug_print(self, *args):
        """Print alleen als debug aanstaat."""
        if self.debug:
            print("[DEBUG]", *args)

    def _log_step(self, step_name: str, data_preview=None):
        """
        Logt een stap in het proces met optionele data-preview.
        Data-preview wordt ingekort om spam te voorkomen.
        """
        if not self.debug:
            return
        preview_str = ""
        if data_preview is not None:
            try:
                preview_str = str(data_preview)
                if len(preview_str) > 300:
                    preview_str = preview_str[:300] + "...[+]"
            except Exception:
                preview_str = "[onleesbare preview]"
        print(f"[DEBUG] Stap: {step_name} | Data: {preview_str}")

    def _log_messages(self, messages: list):
        """Logt de volledige messages-structuur in debug-modus."""
        if not self.debug:
            return
        print("[DEBUG] Messages-structuur:")
        for i, m in enumerate(messages, start=1):
            role = m.get("role")
            content_preview = m.get("content", "")
            if len(content_preview) > 200:
                content_preview = content_preview[:200] + "...[+]"
            print(f"  {i}. ({role}) {content_preview}")

    def _log_api_call(self, endpoint: str, payload: dict):
        """Logt een API-aanroep in debug-modus."""
        if not self.debug:
            return
        payload_preview = json.dumps(payload, ensure_ascii=False)
        if len(payload_preview) > 500:
            payload_preview = payload_preview[:500] + "...[+]"
        print(f"[DEBUG] API-call naar {endpoint} | Payload: {payload_preview}")

    def _log_api_response(self, endpoint: str, response_text: str):
        """Logt een API-response in debug-modus."""
        if not self.debug:
            return
        preview = response_text
        if len(preview) > 500:
            preview = preview[:500] + "...[+]"
        print(f"[DEBUG] API-response van {endpoint} | Preview: {preview}")
    # -------------------------
    # Blok 16/16 — Niche API's + afronding
    # -------------------------

    def _api_sport_score(self, team: str = "FC Barcelona"):
        """Voorbeeld sport-API via TheSportsDB (gratis)."""
        if not requests:
            return "[API:Sport] requests module ontbreekt."
        try:
            r = requests.get(
                "https://www.thesportsdb.com/api/v1/json/3/searchteams.php",
                params={"t": team},
                timeout=8
            )
            r.raise_for_status()
            data = r.json()
            teams = data.get("teams")
            if teams:
                t = teams[0]
                return f"[Sport] {t.get('strTeam')} ({t.get('strCountry')}), stadion: {t.get('strStadium')}"
            return "[Sport] Geen resultaten."
        except Exception as e:
            return f"[API:Sport] Fout: {e}"

    def _api_crypto_price(self, symbol: str = "BTC"):
        """Crypto-prijs via CoinGecko."""
        if not requests:
            return "[API:Crypto] requests module ontbreekt."
        try:
            r = requests.get(
                f"https://api.coingecko.com/api/v3/simple/price",
                params={"ids": symbol.lower(), "vs_currencies": "usd"},
                timeout=8
            )
            r.raise_for_status()
            data = r.json()
            price = data.get(symbol.lower(), {}).get("usd")
            return f"[Crypto] {symbol.upper()}: ${price}" if price else "[Crypto] Geen data."
        except Exception as e:
            return f"[API:Crypto] Fout: {e}"

    def _multi_api_router(self, query: str):
        """
        Uitgebreide versie met niche API's.
        """
        results = []
        q_lower = query.lower()

        if any(word in q_lower for word in ["weer", "weather", "temperatuur"]):
            results.append(self._api_weather())

        if any(word in q_lower for word in ["nieuws", "news", "headline"]):
            results.append(self._api_news())

        if any(word in q_lower for word in ["aandelen", "stock", "prijs", "price"]):
            results.append(self._api_finance())

        if any(word in q_lower for word in ["voetbal", "soccer", "basketbal", "basketball", "team"]):
            results.append(self._api_sport_score())

        if any(word in q_lower for word in ["crypto", "bitcoin", "btc", "eth", "ethereum"]):
            results.append(self._api_crypto_price())

        return [r for r in results if r]


# -------------------------
# Node-registratie voor ComfyUI
# -------------------------

NODE_CLASS_MAPPINGS = {
    "OllamaAIOUltimateMultiAPITranslatedImage": OllamaAIOUltimateMultiAPITranslatedImage
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "OllamaAIOUltimateMultiAPITranslatedImage": "🦙 Ollama AIO Ultimate MultiAPI + Translate + Image"
}
