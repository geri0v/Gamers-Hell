# ============================================================
# AIOllama Modular Nodes - Versie 1.0
# ============================================================
# Categorie: AIOllama
# Modules:
#  - Main Node
#  - Options Node
#  - API Node (Free)
#  - API Node With Key
# ============================================================

# ------------------------------------------------------------
# Blok 1/?? : Imports & Utilities
# ------------------------------------------------------------
import os
import re
import io
import json
import math
import glob
import time
import base64
import hashlib
import requests
import numpy as np
from PIL import Image
from urllib.parse import quote_plus
from collections import Counter, defaultdict
from typing import List, Dict, Any, Optional, Tuple

def _ua():
    return {"User-Agent": "ComfyUI-AIOllama/1.0"}

def _clamp(s, limit):
    if not isinstance(s, str):
        try:
            s = str(s)
        except Exception:
            return ""
    if len(s) <= limit:
        return s
    return s[:limit].rsplit(" ", 1)[0] + "..."

# ------------------------------------------------------------
# Blok 2/?? : Base64 Image Helpers
# ------------------------------------------------------------
def _png_b64_from_ndarray(arr: np.ndarray) -> str:
    if arr.ndim == 3 and arr.shape[0] in (1, 3, 4):
        arr = np.transpose(arr, (1, 2, 0))
    if arr.dtype != np.uint8:
        arr = np.clip(arr * 255.0, 0, 255).astype(np.uint8)
    pil = Image.fromarray(arr)
    buf = io.BytesIO()
    pil.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")

# ------------------------------------------------------------
# Blok 3/?? : Main Node Skeleton
# ------------------------------------------------------------
class AIOllamaMain:
    CATEGORY = "AIOllama"
    RETURN_TYPES = ("STRING", "STRING", "STRING",)
    RETURN_NAMES = ("thinking_output", "result", "sources_json",)
    FUNCTION = "run"

    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "url": ("STRING", {"default": "http://127.0.0.1:11434"}),
                "model_choice": ("STRING", {"default": ""}),
                "model_override": ("STRING", {"default": ""}),
                "keep_alive": ("INT", {"default": 10}),
                "keep_alive_unit": (["minutes", "hours"], {"default": "minutes"}),
                "refresh_connection": ("BOOLEAN", {"default": False}),
                "use_live_search": ("BOOLEAN", {"default": True}),
                "use_tool_prompt": ("BOOLEAN", {"default": False}),
                "debug_mode": ("BOOLEAN", {"default": False}),
                "apikeys_enabled": ("BOOLEAN", {"default": False}),
                "system_prompt": ("STRING", {"multiline": True, "default": ""}),
                "user_prompt": ("STRING", {"multiline": True, "default": ""}),
                "options_string": ("STRING", {"multiline": True, "default": ""}),
                "api_string": ("STRING", {"multiline": True, "default": ""}),
                "auth_api_string": ("STRING", {"multiline": True, "default": ""}),
            },
            "optional": {
                "optional_image_input": ("IMAGE", {"default": None}),
            }
        }

# ------------------------------------------------------------
# Blok 4/?? : Main Node Run Method
# ------------------------------------------------------------
    def run(self, url, model_choice, model_override,
            keep_alive, keep_alive_unit,
            refresh_connection, use_live_search, use_tool_prompt,
            debug_mode, apikeys_enabled,
            system_prompt, user_prompt,
            options_string, api_string, auth_api_string,
            optional_image_input=None):

        # Toolprompt injectie
        if use_tool_prompt:
            system_prompt = "[TOOLPROMPT] Gebruik live search en API's indien nodig.\n" + system_prompt

        # Context opbouwen
        context_block = self._build_context(api_string, auth_api_string, use_live_search, debug_mode)

        # Payload samenstellen
        payload = {
            "model": model_override or model_choice,
            "system": system_prompt,
            "prompt": user_prompt,
            "context": context_block,
            "options": json.loads(options_string) if options_string else {}
        }

        # Simulatie API-call (hier komt Ollama-call)
        if debug_mode:
            print("[DEBUG] Payload:", payload)

        # Dummy output
        return ("[thinking] ...", "[result] ...", json.dumps({"sources": []}))

# ------------------------------------------------------------
# Blok 5/?? : Context Builder
# ------------------------------------------------------------
    def _build_context(self, api_string, auth_api_string, use_live_search, debug):
        parts = []
        if api_string:
            parts.append("FREE API CONTEXT:\n" + api_string)
        if auth_api_string:
            parts.append("AUTH API CONTEXT:\n" + auth_api_string)
        if use_live_search:
            parts.append("LIVE SEARCH ENABLED")
        return "\n\n".join(parts)

# ------------------------------------------------------------
# Blok 6/?? : Options Node
# ------------------------------------------------------------
class AIOllamaOptions:
    CATEGORY = "AIOllama"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("options_string",)
    FUNCTION = "run"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "temperature": ("FLOAT", {"default": 0.7}),
                "top_k": ("INT", {"default": 40}),
                "top_p": ("FLOAT", {"default": 0.9}),
                "repeat_penalty": ("FLOAT", {"default": 1.1}),
                "num_predict": ("INT", {"default": 1024}),
            }
        }

    def run(self, temperature, top_k, top_p, repeat_penalty, num_predict):
        opts = {
            "temperature": temperature,
            "top_k": top_k,
            "top_p": top_p,
            "repeat_penalty": repeat_penalty,
            "num_predict": num_predict
        }
        return (json.dumps(opts),)

# ------------------------------------------------------------
# Blok 7/?? : API Node (Free)
# ------------------------------------------------------------
class AIOllamaAPIs:
    CATEGORY = "AIOllama"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("api_string",)
    FUNCTION = "run"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "use_weather_apis": ("BOOLEAN", {"default": True}),
                "use_nature_apis": ("BOOLEAN", {"default": True}),
                "use_finance_apis": ("BOOLEAN", {"default": True}),
                "use_news_apis": ("BOOLEAN", {"default": True}),
                "use_general_apis": ("BOOLEAN", {"default": True}),
                "use_scraping_fallback": ("BOOLEAN", {"default": False}),
            }
        }

    def run(self, **kwargs):
        return (json.dumps(kwargs),)

# ------------------------------------------------------------
# Blok 8/?? : API Node With Key
# ------------------------------------------------------------
class AIOllamaAuthAPIs:
    CATEGORY = "AIOllama"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("auth_api_string",)
    FUNCTION = "run"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "brave_key": ("STRING", {"default": ""}),
                "serper_key": ("STRING", {"default": ""}),
                "google_cse_key": ("STRING", {"default": ""}),
                "google_cse_cx": ("STRING", {"default": ""}),
                "unsplash_key": ("STRING", {"default": ""}),
                "bing_key": ("STRING", {"default": ""}),
                "pexels_key": ("STRING", {"default": ""}),
            }
        }

    def run(self, **kwargs):
        return (json.dumps(kwargs),)

# ------------------------------------------------------------
# Blok 9/?? : Node Registratie
# ------------------------------------------------------------
NODE_CLASS_MAPPINGS = {
    "AIOllamaMain": AIOllamaMain,
    "AIOllamaOptions": AIOllamaOptions,
    "AIOllamaAPIs": AIOllamaAPIs,
    "AIOllamaAuthAPIs": AIOllamaAuthAPIs
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AIOllamaMain": "AIOllama Main Node",
    "AIOllamaOptions": "AIOllama Options Node",
    "AIOllamaAPIs": "AIOllama API Node (Free)",
    "AIOllamaAuthAPIs": "AIOllama API Node (With Key)"
}
# ------------------------------------------------------------
# Blok 2/?? : Base64 Image Helpers
# ------------------------------------------------------------
def _png_b64_from_ndarray(arr: np.ndarray) -> str:
    """
    Zet een NumPy-array om naar een PNG in base64-string.
    Ondersteunt zowel HWC- als CHW-indeling.
    """
    # Als het een CHW-array is (channels-first), transponeren naar HWC
    if arr.ndim == 3 and arr.shape[0] in (1, 3, 4):
        arr = np.transpose(arr, (1, 2, 0))

    # Normaliseer naar uint8
    if arr.dtype != np.uint8:
        # Als waarden tussen 0 en 1 liggen, schaal op naar 0-255
        if np.max(arr) <= 1.01:
            arr = np.clip(arr, 0.0, 1.0) * 255.0
        arr = np.clip(arr, 0, 255).astype(np.uint8)

    pil = Image.fromarray(arr)
    buf = io.BytesIO()
    pil.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def _png_b64_from_bytes(img_bytes: bytes) -> str:
    """
    Zet raw image-bytes om naar een PNG in base64-string.
    """
    pil = Image.open(io.BytesIO(img_bytes))
    if pil.mode not in ("RGB", "RGBA"):
        pil = pil.convert("RGBA")
    buf = io.BytesIO()
    pil.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")
# ------------------------------------------------------------
# Blok 3/?? : Main Node Skeleton
# ------------------------------------------------------------
class AIOllamaMain:
    CATEGORY = "AIOllama"
    RETURN_TYPES = ("STRING", "STRING", "STRING",)
    RETURN_NAMES = ("thinking_output", "result", "sources_json",)
    FUNCTION = "run"

    def __init__(self):
        pass

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "url": ("STRING", {"default": "http://127.0.0.1:11434"}),
                "model_choice": ("STRING", {"default": ""}),
                "model_override": ("STRING", {"default": ""}),
                "keep_alive": ("INT", {"default": 10}),
                "keep_alive_unit": (["minutes", "hours"], {"default": "minutes"}),
                "refresh_connection": ("BOOLEAN", {"default": False}),
                "use_live_search": ("BOOLEAN", {"default": True}),
                "use_tool_prompt": ("BOOLEAN", {"default": False}),
                "debug_mode": ("BOOLEAN", {"default": False}),
                "apikeys_enabled": ("BOOLEAN", {"default": False}),
                "system_prompt": ("STRING", {"multiline": True, "default": ""}),
                "user_prompt": ("STRING", {"multiline": True, "default": ""}),
                "options_string": ("STRING", {"multiline": True, "default": ""}),
                "api_string": ("STRING", {"multiline": True, "default": ""}),
                "auth_api_string": ("STRING", {"multiline": True, "default": ""}),
            },
            "optional": {
                "optional_image_input": ("IMAGE", {"default": None}),
            }
        }
# ------------------------------------------------------------
# Blok 4/?? : Main Node Run Method
# ------------------------------------------------------------
    def run(self, url, model_choice, model_override,
            keep_alive, keep_alive_unit,
            refresh_connection, use_live_search, use_tool_prompt,
            debug_mode, apikeys_enabled,
            system_prompt, user_prompt,
            options_string, api_string, auth_api_string,
            optional_image_input=None):

        # Toolprompt injectie
        if use_tool_prompt:
            system_prompt = "[TOOLPROMPT] Gebruik live search en API's indien nodig.\n" + system_prompt

        # Context opbouwen
        context_block = self._build_context(api_string, auth_api_string, use_live_search, debug_mode)

        # Payload samenstellen
        payload = {
            "model": model_override or model_choice,
            "system": system_prompt,
            "prompt": user_prompt,
            "context": context_block,
            "options": json.loads(options_string) if options_string else {}
        }

        # Debug output
        if debug_mode:
            print("[DEBUG] Payload:", json.dumps(payload, indent=2, ensure_ascii=False))

        # Hier zou de Ollama API-call komen
        # Voor nu dummy output
        return ("[thinking] ...", "[result] ...", json.dumps({"sources": []}))

# ------------------------------------------------------------
# Blok 5/?? : Context Builder
# ------------------------------------------------------------
    def _build_context(self, api_string, auth_api_string, use_live_search, debug):
        parts = []
        if api_string:
            parts.append("FREE API CONTEXT:\n" + api_string)
        if auth_api_string:
            parts.append("AUTH API CONTEXT:\n" + auth_api_string)
        if use_live_search:
            parts.append("LIVE SEARCH ENABLED")
        context_block = "\n\n".join(parts)
        if debug:
            print("[DEBUG] Context block built:\n", context_block)
        return context_block

# ------------------------------------------------------------
# Blok 6/?? : Options Node
# ------------------------------------------------------------
class AIOllamaOptions:
    CATEGORY = "AIOllama"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("options_string",)
    FUNCTION = "run"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "temperature": ("FLOAT", {"default": 0.7}),
                "top_k": ("INT", {"default": 40}),
                "top_p": ("FLOAT", {"default": 0.9}),
                "repeat_penalty": ("FLOAT", {"default": 1.1}),
                "num_predict": ("INT", {"default": 1024}),
                "thinking": ("BOOLEAN", {"default": False}),
                "detect_multimodal": ("BOOLEAN", {"default": True}),
                "list_models_on_run": ("BOOLEAN", {"default": True}),
                "max_context_chars": ("INT", {"default": 3600}),
                "language_override": ("STRING", {"default": ""}),
                "translate_before_api": ("BOOLEAN", {"default": True}),
                "translate_back_results": ("BOOLEAN", {"default": True}),
                "context_messages_json": ("STRING", {"multiline": True, "default": ""}),
                "images_b64_json": ("STRING", {"multiline": True, "default": ""}),
                "optional_image_b64": ("STRING", {"multiline": True, "default": ""}),
                "batch_image_paths": ("STRING", {"multiline": True, "default": "[]"}),
            }
        }

    def run(self, **kwargs):
        return (json.dumps(kwargs),)

# ------------------------------------------------------------
# Blok 7/?? : API Node (Free)
# ------------------------------------------------------------
class AIOllamaAPIs:
    CATEGORY = "AIOllama"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("api_string",)
    FUNCTION = "run"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "use_weather_apis": ("BOOLEAN", {"default": True}),
                "use_nature_apis": ("BOOLEAN", {"default": True}),
                "use_finance_apis": ("BOOLEAN", {"default": True}),
                "use_news_apis": ("BOOLEAN", {"default": True}),
                "use_general_apis": ("BOOLEAN", {"default": True}),
                "use_media_apis": ("BOOLEAN", {"default": True}),
                "use_scraping_fallback": ("BOOLEAN", {"default": False}),
                "use_knowledge_base": ("BOOLEAN", {"default": True}),
                "knowledge_base_dir": ("STRING", {"default": ""}),
                "kb_max_chunks": ("INT", {"default": 6}),
                "kb_chunk_chars": ("INT", {"default": 900}),
                "kb_overlap_chars": ("INT", {"default": 120}),
                "use_live_search": ("BOOLEAN", {"default": True}),
                "wiki_lang": (["en", "nl"], {"default": "en"}),
                "search_query_override": ("STRING", {"default": ""}),
                "search_max_results": ("INT", {"default": 5}),
                "search_timeout_s": ("INT", {"default": 10}),
                "disable_primary_live": ("BOOLEAN", {"default": False}),
                "force_context_if_empty": ("BOOLEAN", {"default": True}),
                "enhanced_live_fallbacks": ("BOOLEAN", {"default": True}),
            }
        }

    def run(self, **kwargs):
        return (json.dumps(kwargs),)

# ------------------------------------------------------------
# Blok 8/?? : API Node With Key
# ------------------------------------------------------------
class AIOllamaAuthAPIs:
    CATEGORY = "AIOllama"
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("auth_api_string",)
    FUNCTION = "run"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "brave_key": ("STRING", {"default": ""}),
                "serper_key": ("STRING", {"default": ""}),
                "google_cse_key": ("STRING", {"default": ""}),
                "google_cse_cx": ("STRING", {"default": ""}),
                "unsplash_key": ("STRING", {"default": ""}),
                "bing_key": ("STRING", {"default": ""}),
                "pexels_key": ("STRING", {"default": ""}),
                "image_search_provider": (["off", "duckduckgo", "unsplash", "bing", "pexels"], {"default": "off"}),
                "image_max_results": ("INT", {"default": 4}),
            }
        }

    def run(self, **kwargs):
        return (json.dumps(kwargs),)

# ------------------------------------------------------------
# Blok 9/?? : Node Registratie
# ------------------------------------------------------------
NODE_CLASS_MAPPINGS = {
    "AIOllamaMain": AIOllamaMain,
    "AIOllamaOptions": AIOllamaOptions,
    "AIOllamaAPIs": AIOllamaAPIs,
    "AIOllamaAuthAPIs": AIOllamaAuthAPIs
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AIOllamaMain": "AIOllama Main Node",
    "AIOllamaOptions": "AIOllama Options Node",
    "AIOllamaAPIs": "AIOllama API Node (Free)",
    "AIOllamaAuthAPIs": "AIOllama API Node (With Key)"
}
# ------------------------------------------------------------
# Blok 10/?? : Live Search Fallback zonder API-keys
# ------------------------------------------------------------
def _live_search_fallback(self, query, max_results=5, timeout=10, wiki_lang="en", debug=False):
    """
    Probeert eerst DuckDuckGo + Wikipedia.
    Als dat niets oplevert, valt terug op gratis bronnen zonder API-key.
    """
    snippets, sources = [], []

    # DuckDuckGo Instant Answer
    try:
        r = requests.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json", "no_redirect": "1", "no_html": "1"},
            timeout=timeout
        )
        r.raise_for_status()
        ddg = r.json()
        if ddg.get("AbstractText"):
            snippets.append(ddg["AbstractText"])
            if ddg.get("AbstractURL"):
                sources.append({"type": "duckduckgo", "title": "Instant Answer", "url": ddg["AbstractURL"]})
    except Exception as e:
        if debug:
            print("[DEBUG] DDG fout:", e)

    # Wikipedia
    try:
        r = requests.get(
            f"https://{wiki_lang}.wikipedia.org/w/api.php",
            params={"action": "opensearch", "search": query, "limit": str(max_results), "format": "json"},
            timeout=timeout
        )
        r.raise_for_status()
        wiki = r.json()
        if isinstance(wiki, list) and len(wiki) >= 4:
            titles, urls = wiki[1], wiki[3]
            for i, t in enumerate(titles):
                snippets.append(t)
                if i < len(urls):
                    sources.append({"type": "wikipedia", "title": t, "url": urls[i]})
    except Exception as e:
        if debug:
            print("[DEBUG] Wikipedia fout:", e)

    if debug:
        print(f"[DEBUG] Live search fallback: {len(snippets)} snippets, {len(sources)} sources")

    return snippets, sources
# ------------------------------------------------------------
# Blok 11/?? : Toolprompt Injectie
# ------------------------------------------------------------
def _inject_toolprompt(self, system_prompt: str, enabled: bool) -> str:
    """
    Voegt een instructie toe aan het system prompt als toolprompt is ingeschakeld.
    """
    if enabled:
        injectie = (
            "[TOOLPROMPT] Je mag live search en API's gebruiken om actuele of externe informatie op te halen. "
            "Gebruik deze bronnen indien nodig en citeer waar mogelijk.\n"
        )
        return injectie + (system_prompt or "")
    return system_prompt
# ------------------------------------------------------------
# Blok 12/?? : Integratie Live Search + Toolprompt in Main Node
# ------------------------------------------------------------
# In je AIOllamaMain.run() vervang je het begin door:
system_prompt = self._inject_toolprompt(system_prompt, use_tool_prompt)

# Live search uitvoeren als toggle aanstaat
live_snips, live_sources = [], []
if use_live_search:
    live_snips, live_sources = self._live_search_fallback(user_prompt, debug=debug_mode)

# Context opbouwen met live search resultaten
context_parts = []
if api_string:
    context_parts.append("FREE API CONTEXT:\n" + api_string)
if auth_api_string:
    context_parts.append("AUTH API CONTEXT:\n" + auth_api_string)
if live_snips:
    context_parts.append("LIVE SEARCH RESULTS:\n" + "\n".join(f"- {s}" for s in live_snips))

context_block = "\n\n".join(context_parts)
# ------------------------------------------------------------
# Blok 13/?? : Context-budgets (16k → 512k) - in AIOllamaMain
# ------------------------------------------------------------
def _estimate_context_budgets(self, max_context_chars: int, debug: bool = False):
    """
    Verdeelt het contextbudget over secties op basis van totale ruimte.
    Werkt op karakters (proxy voor tokens).
    Profielen:
      - ~16k: defensief, meer compressie
      - ~128k: gebalanceerd
      - ~512k: ruim, minder agressief trimmen
    """
    total = max(4000, int(max_context_chars))  # minimale sane baseline

    # Profielschatting
    if total <= 20000:
        profile = "small"
        ratios = {"kb": 0.40, "live": 0.30, "api": 0.18, "images": 0.06, "userimg": 0.06}
    elif total <= 160000:
        profile = "medium"
        ratios = {"kb": 0.36, "live": 0.30, "api": 0.20, "images": 0.07, "userimg": 0.07}
    else:
        profile = "huge"
        ratios = {"kb": 0.32, "live": 0.30, "api": 0.24, "images": 0.07, "userimg": 0.07}

    budgets = {k: int(total * v) for k, v in ratios.items()}
    # Corrigeer afronding
    diff = total - sum(budgets.values())
    if diff != 0:
        budgets["api"] += diff

    if debug:
        print(f"[AIO] Context profile={profile}, total={total}, budgets={budgets}")

    return budgets
# ------------------------------------------------------------
# Blok 14/?? : Contextbuilder v3 - in AIOllamaMain
# ------------------------------------------------------------
def _build_context_v3(self,
                      kb_hits: list,
                      live_snips: list,
                      api_snips: list,
                      live_sources: list,
                      image_items: list,
                      user_images_info: list,
                      max_context_chars: int = 3600,
                      debug: bool = False):
    """
    Bouwt een rijk contextblok met secties:
      - Knowledge base
      - Live search
      - Multi-API
      - Image search (captions)
      - User images (samenvatting)
      - Sources (genummerd)
    Past dynamische budgettering toe per sectie.
    """
    budgets = self._estimate_context_budgets(max_context_chars, debug=debug)

    # Normaliseer input
    kb_hits = kb_hits or []
    live_snips = [s for s in (live_snips or []) if isinstance(s, str) and s.strip()]
    api_snips = [s for s in (api_snips or []) if isinstance(s, str) and s.strip()]
    image_items = image_items or []
    user_images_info = user_images_info or []
    live_sources = live_sources or []

    # Helper om lijst items in budget te passen
    def take_with_budget(items, budget_per_section, clamp_len=600):
        buf, used = [], 0
        for it in items:
            s = _clamp(str(it), clamp_len)
            extra = len(s) + 2
            if used + extra > budget_per_section:
                break
            buf.append(s)
            used += extra
        return buf

    # KB
    kb_lines = []
    for ch in kb_hits:
        title = ch.get("title") or ch.get("path") or "KB"
        text = ch.get("text") or ""
        kb_lines.append(f"{title}: {_clamp(text, 700)}")
    kb_take = take_with_budget(kb_lines, budgets["kb"], clamp_len=700)

    # Live
    live_take = take_with_budget(live_snips, budgets["live"], clamp_len=600)

    # API
    api_take = take_with_budget(api_snips, budgets["api"], clamp_len=650)

    # Image search captions
    img_lines = []
    for it in image_items:
        cap = it.get("title") or "Image"
        url = it.get("url") or it.get("image") or ""
        img_lines.append(_clamp(f"{cap} — {url}", 220))
    img_take = take_with_budget(img_lines, budgets["images"], clamp_len=220)

    # User images
    user_lines = []
    if user_images_info:
        user_lines.append(f"User provided images: {len(user_images_info)} item(s).")
        for i, it in enumerate(user_images_info[:8], 1):
            user_lines.append(f"- Image {i}: {_clamp(str(it), 160)}")
    user_take = take_with_budget(user_lines, budgets["userimg"], clamp_len=200)

    # Sources dedup & nummering
    all_sources = []
    # KB als 'source' met file pad
    for ch in kb_hits:
        all_sources.append({"type": "kb", "title": ch.get("title") or "KB", "url": ch.get("path")})
    # Live
    for s in live_sources:
        if isinstance(s, dict):
            all_sources.append({"type": s.get("type") or "live", "title": s.get("title") or "Source", "url": s.get("url")})
    # Images
    for it in image_items:
        all_sources.append({"type": "image", "title": it.get("title") or "Image", "url": it.get("url")})

    seen_urls, dedup = set(), []
    for s in all_sources:
        u = s.get("url")
        key = (s.get("type"), s.get("title"), u)
        if not u or key in seen_urls:
            continue
        dedup.append(s)
        seen_urls.add(key)

    # Contextlijnen
    lines = []

    if kb_take:
        lines.append("Knowledge base context:")
        lines += [f"- {x}" for x in kb_take]
        lines.append("")

    if live_take:
        lines.append("Retrieved context (live search):")
        lines += [f"- {x}" for x in live_take]
        lines.append("")

    if api_take:
        lines.append("Multi-API context:")
        lines += [f"- {x}" for x in api_take]
        lines.append("")

    if img_take:
        lines.append("Image context (captions):")
        lines += [f"- {x}" for x in img_take]
        lines.append("")

    if user_take:
        lines.append("User images (text-only summary):")
        lines += [f"{x}" for x in user_take]
        lines.append("")

    # Genummerde bronnen
    numbered, n = [], 1
    if dedup:
        lines.append("Sources (numbered):")
        for s in dedup:
            title = s.get("title") or s.get("url") or "Source"
            url = s.get("url") or ""
            lines.append(f"[{n}] {title} — {url}")
            numbered.append({"n": n, **s})
            n += 1

    context_block = "\n".join(lines).strip()

    # Safety clamp op totaal
    if len(context_block) > max_context_chars:
        context_block = context_block[:max_context_chars].rsplit("\n", 1)[0].strip()

    if debug:
        print(f"[AIO] Context v3 length={len(context_block)}, sources={len(numbered)}")

    return context_block, numbered
# ------------------------------------------------------------
# Blok 15/?? : Parsing + Sanitize - in AIOllamaMain
# ------------------------------------------------------------
def _extract_thinking_and_result(self, data: Any, thinking_enabled: bool = False):
    """
    Haal 'thinking' en 'final' uit een string of dict.
    Ondersteunt <think>...</think> en <final>...</final>.
    """
    text, think_out = "", ""

    if isinstance(data, dict):
        # vaak voorkomende velden
        for key in ["response", "display_text", "output"]:
            if data.get(key):
                text = str(data[key]); break
        if not text and "message" in data:
            msg = data["message"]
            if isinstance(msg, dict):
                text = msg.get("content", "") or ""
            elif isinstance(msg, str):
                text = msg
        if not text and "choices" in data and isinstance(data["choices"], list) and data["choices"]:
            ch = data["choices"][0]
            if isinstance(ch, dict):
                if "message" in ch and isinstance(ch["message"], dict):
                    text = ch["message"].get("content", "")
                elif "text" in ch:
                    text = ch["text"]

    if not text and isinstance(data, str):
        text = data
    if not text and isinstance(data, dict):
        try:
            text = json.dumps(data, ensure_ascii=False)
        except Exception:
            text = ""

    text = (text or "").strip()
    final_out = text

    if thinking_enabled:
        m1 = re.search(r"<think>(.*?)</think>", text, flags=re.DOTALL | re.IGNORECASE)
        m2 = re.search(r"<final>(.*?)</final>", text, flags=re.DOTALL | re.IGNORECASE)
        if m1:
            think_tag = m1.group(1).strip()
            think_out = think_tag
        if m2:
            final_out = m2.group(1).strip()
        elif m1:
            final_out = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE).strip()

        if not think_out and text:
            parts = re.split(r"(?<=\.)\s+(?=[A-Z])", text, maxsplit=1)
            if len(parts) == 2:
                think_out, final_out = parts[0].strip(), parts[1].strip()
            else:
                think_out = "[Model stuurde geen apart denkproces terug]"

    return think_out, final_out


def _sanitize_model_output(self, s: str) -> str:
    """
    Verwijder bekende meta/telemetrie regels zonder fragile regex.
    """
    if not s:
        return s

    rx_sentence = re.compile(r'^\s*Sentence\s+\d+\s*[:=：]', re.IGNORECASE)
    out_lines = []
    for raw in s.splitlines():
        line = raw.rstrip("\r")
        stripped = line.strip()

        if stripped.startswith("[DEBUG]"):
            continue
        if stripped.lower().startswith("total_duration:"):
            continue
        if rx_sentence.match(stripped):
            continue
        if "Aristomenis Marinis presents" in stripped:
            continue

        out_lines.append(line)

    # Maximaal 1 lege regel achter elkaar
    normalized, blank = [], False
    for ln in out_lines:
        if ln.strip() == "":
            if blank:
                continue
            blank = True
            normalized.append("")
        else:
            blank = False
            normalized.append(ln)

    out = "\n".join(normalized)
    out = re.sub(r"\n{3,}", "\n\n", out).strip()
    return out
# ------------------------------------------------------------
# Blok 16/?? : Messages builder - in AIOllamaMain
# ------------------------------------------------------------
def _build_messages(self,
                    system_prompt: str,
                    user_prompt: str,
                    context_block: str,
                    thinking: bool = False,
                    multimodal: bool = False,
                    images_b64_list: Optional[list] = None,
                    answer_lang: Optional[str] = None,
                    context_messages_json: str = ""):
    msgs = []

    sys = (system_prompt or "").strip()
    if answer_lang:
        sys = (sys + f"\nBeantwoord in taalcode '{answer_lang}' tenzij anders gevraagd.").strip()
    if sys:
        msgs.append({"role": "system", "content": sys})

    cm = (context_messages_json or "").strip()
    if cm:
        try:
            arr = json.loads(cm)
            if isinstance(arr, list):
                for m in arr:
                    if isinstance(m, dict) and "role" in m and "content" in m:
                        msgs.append({"role": m["role"], "content": str(m["content"])})
        except Exception as e:
            msgs.append({"role": "system", "content": f"Note: previous context parse failed: {e}"})

    if context_block:
        msgs.append({"role": "system", "content": "Gebruik de volgende context en citeer [n] waar van toepassing.\n\n" + context_block})

    user_content = user_prompt or ""
    if thinking:
        user_content = "Geef eerst je denkproces tussen <think>...</think> en daarna het eindresultaat tussen <final>...</final>.\n\n" + user_content

    if multimodal and images_b64_list:
        msgs.append({"role": "user", "content": user_content, "images": images_b64_list})
    else:
        msgs.append({"role": "user", "content": user_content})

    return msgs
# ------------------------------------------------------------
# Blok 17/?? : Integratie in AIOllamaMain.run (voorbeeld)
# ------------------------------------------------------------
# 1) Voor de toolprompt:
system_prompt = self._inject_toolprompt(system_prompt, use_tool_prompt)

# 2) Live search:
live_snips, live_sources = [], []
if use_live_search:
    live_snips, live_sources = self._live_search_fallback(user_prompt, debug=debug_mode)

# 3) (Optioneel) parse de api_string/auth_api_string naar lijsten voor API-snips (free/auth)
api_snips = []
try:
    free_cfg = json.loads(api_string) if api_string else {}
    # Hier kun je later echte free-API calls op baseren; nu placeholder:
    if free_cfg.get("use_general_apis", True):
        api_snips.append("General API: geen specifieke resultaten (placeholder).")
except Exception:
    pass

# 4) Context v3 opbouwen
context_block, numbered_sources = self._build_context_v3(
    kb_hits=[],
    live_snips=live_snips,
    api_snips=api_snips,
    live_sources=live_sources,
    image_items=[],
    user_images_info=[],
    max_context_chars=(json.loads(options_string).get("max_context_chars", 3600) if options_string else 3600),
    debug=debug_mode
)

# 5) Messages bouwen
opts = json.loads(options_string) if options_string else {}
messages = self._build_messages(
    system_prompt=system_prompt,
    user_prompt=user_prompt,
    context_block=context_block,
    thinking=opts.get("thinking", False),
    multimodal=opts.get("detect_multimodal", True),
    images_b64_list=[],
    answer_lang=opts.get("language_override") or "nl",
    context_messages_json=opts.get("context_messages_json", "")
)

# 6) (Hier zou je Ollama /api/chat call doen met messages)
# Voor nu: dummy result op basis van context
dummy_text = "Op basis van live search en API context heb ik je vraag geanalyseerd."
thinking_out, final_out = self._extract_thinking_and_result(dummy_text, thinking_enabled=opts.get("thinking", False))

# 7) Sanitize
thinking_out = self._sanitize_model_output(thinking_out)
final_out = self._sanitize_model_output(final_out)

# 8) Sources JSON
sources_json = json.dumps(numbered_sources, indent=2, ensure_ascii=False)

return (thinking_out, final_out, sources_json)
# ------------------------------------------------------------
# Blok 18/?? : Gratis Live Search + Wikipedia - in AIOllamaAPIs
# ------------------------------------------------------------
def _duckduckgo_instant(self, query, timeout=10):
    try:
        r = requests.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json", "no_redirect": "1", "no_html": "1"},
            timeout=timeout
        )
        r.raise_for_status()
        return r.json()
    except Exception as e:
        return None

def _wiki_opensearch(self, query, limit=3, timeout=10, lang="en"):
    try:
        r = requests.get(
            f"https://{lang}.wikipedia.org/w/api.php",
            params={"action": "opensearch", "search": query, "limit": str(limit), "format": "json"},
            timeout=timeout
        )
        r.raise_for_status()
        return r.json()
    except Exception:
        return None

def _wiki_summary(self, title, timeout=10, lang="en"):
    try:
        safe = quote_plus(title.replace(" ", "_"))
        r = requests.get(
            f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{safe}",
            timeout=timeout
        )
        r.raise_for_status()
        return r.json()
    except Exception:
        return None

def free_live_search(self, query, max_results=5, timeout=10, wiki_lang="en", debug=False):
    """
    Combineert DuckDuckGo en Wikipedia zonder API-key.
    """
    snippets, sources = [], []

    ddg = self._duckduckgo_instant(query, timeout=timeout)
    if ddg:
        if ddg.get("AbstractText"):
            snippets.append(ddg["AbstractText"])
            if ddg.get("AbstractURL"):
                sources.append({"type": "duckduckgo", "title": "Instant Answer", "url": ddg["AbstractURL"]})
        for rt in (ddg.get("RelatedTopics") or [])[:max_results]:
            if isinstance(rt, dict) and rt.get("Text"):
                snippets.append(rt["Text"])
                if rt.get("FirstURL"):
                    sources.append({"type": "duckduckgo", "title": rt["Text"], "url": rt["FirstURL"]})

    wiki = self._wiki_opensearch(query, limit=max_results, timeout=timeout, lang=wiki_lang)
    if isinstance(wiki, list) and len(wiki) >= 4:
        titles, urls = wiki[1], wiki[3]
        for i, t in enumerate(titles):
            s = self._wiki_summary(t, timeout=timeout, lang=wiki_lang)
            if s and s.get("extract"):
                snippets.append(f"{s['title']}: {s['extract']}")
                sources.append({"type": "wikipedia", "title": s.get("title") or t, "url": s.get("url") or urls[i]})

    if debug:
        print(f"[AIO] Free live search: {len(snippets)} snippets, {len(sources)} sources")

    return snippets, sources
# ------------------------------------------------------------
# Blok 19/?? : Gratis API-calls - in AIOllamaAPIs
# ------------------------------------------------------------
def free_weather_wttr(self, location, timeout=8):
    try:
        r = requests.get(f"https://wttr.in/{quote_plus(location)}?format=3", timeout=timeout)
        r.raise_for_status()
        return f"wttr.in: {r.text.strip()}"
    except Exception:
        return None

def free_news_spaceflight(self, timeout=6):
    try:
        r = requests.get("https://api.spaceflightnewsapi.net/v4/articles", timeout=timeout)
        r.raise_for_status()
        data = r.json()
        return " | ".join(f"{a.get('title')}: {a.get('summary')}" for a in data.get("results", [])[:3])
    except Exception:
        return None

def collect_free_api_data(self, query, debug=False):
    """
    Roept gratis API's aan op basis van ingestelde toggles.
    """
    results = []

    if self.use_weather_apis:
        w = self.free_weather_wttr(query)
        if w:
            results.append(w)

    if self.use_news_apis:
        n = self.free_news_spaceflight()
        if n:
            results.append(n)

    if debug:
        print(f"[AIO] Free API data: {len(results)} items")

    return results
# ------------------------------------------------------------
# Blok 20/?? : Image Search (met keys) - in AIOllamaAuthAPIs
# ------------------------------------------------------------
def image_search(self, provider, query, max_results=4, timeout=8, debug=False):
    provider = (provider or "off").lower()
    if provider == "off" or not query:
        return []

    try:
        if provider == "unsplash" and self.unsplash_key:
            r = requests.get(
                "https://api.unsplash.com/search/photos",
                params={"query": query, "per_page": max_results},
                headers={"Authorization": f"Client-ID {self.unsplash_key}"},
                timeout=timeout
            )
            r.raise_for_status()
            data = r.json()
            return [{"title": it.get("description") or "Unsplash image",
                     "image": it.get("urls", {}).get("regular"),
                     "url": it.get("links", {}).get("html")} for it in data.get("results", [])]

        if provider == "bing" and self.bing_key:
            r = requests.get(
                "https://api.bing.microsoft.com/v7.0/images/search",
                params={"q": query, "count": max_results},
                headers={"Ocp-Apim-Subscription-Key": self.bing_key},
                timeout=timeout
            )
            r.raise_for_status()
            data = r.json()
            return [{"title": it.get("name") or "Bing image",
                     "image": it.get("contentUrl"),
                     "url": it.get("hostPageUrl")} for it in data.get("value", [])]

        if provider == "pexels" and self.pexels_key:
            r = requests.get(
                "https://api.pexels.com/v1/search",
                params={"query": query, "per_page": max_results},
                headers={"Authorization": self.pexels_key},
                timeout=timeout
            )
            r.raise_for_status()
            data = r.json()
            return [{"title": it.get("alt") or "Pexels image",
                     "image": it.get("src", {}).get("large"),
                     "url": it.get("url")} for it in data.get("photos", [])]

    except Exception as e:
        if debug:
            print(f"[AIO] Image search error ({provider}): {e}")
        return []

    return []
# ------------------------------------------------------------
# Blok 21/?? : Main Node integratie met Free & Auth API's
# ------------------------------------------------------------
def _collect_all_context(self,
                          user_prompt: str,
                          api_string: str,
                          auth_api_string: str,
                          use_live_search: bool,
                          debug: bool = False):
    """
    Roept de free API's, live search en auth API's aan en combineert de resultaten.
    """
    live_snips, live_sources = [], []
    api_snips = []
    image_items = []

    # 1) Free API's
    try:
        free_cfg = json.loads(api_string) if api_string else {}
        # Live search
        if use_live_search and free_cfg.get("use_live_search", True):
            ls_snips, ls_sources = self.free_live_search(
                user_prompt,
                max_results=free_cfg.get("search_max_results", 5),
                timeout=free_cfg.get("search_timeout_s", 10),
                wiki_lang=free_cfg.get("wiki_lang", "en"),
                debug=debug
            )
            live_snips.extend(ls_snips)
            live_sources.extend(ls_sources)

        # Overige gratis API's
        if free_cfg.get("use_weather_apis", True):
            w = self.free_weather_wttr(user_prompt)
            if w:
                api_snips.append(w)
        if free_cfg.get("use_news_apis", True):
            n = self.free_news_spaceflight()
            if n:
                api_snips.append(n)

    except Exception as e:
        if debug:
            print("[AIO] Free API parse error:", e)

    # 2) Auth API's (image search)
    try:
        auth_cfg = json.loads(auth_api_string) if auth_api_string else {}
        provider = auth_cfg.get("image_search_provider", "off")
        if provider != "off":
            image_items = self.image_search(
                provider,
                user_prompt,
                max_results=auth_cfg.get("image_max_results", 4),
                debug=debug
            )
    except Exception as e:
        if debug:
            print("[AIO] Auth API parse error:", e)

    return live_snips, live_sources, api_snips, image_items
# ------------------------------------------------------------
# Blok 22/?? : Main Node.run() met volledige keten
# ------------------------------------------------------------
def run(self, url, model_choice, model_override,
        keep_alive, keep_alive_unit,
        refresh_connection, use_live_search, use_tool_prompt,
        debug_mode, apikeys_enabled,
        system_prompt, user_prompt,
        options_string, api_string, auth_api_string,
        optional_image_input=None):

    # 1) Toolprompt injectie
    system_prompt = self._inject_toolprompt(system_prompt, use_tool_prompt)

    # 2) Verzamel alle contextdata
    live_snips, live_sources, api_snips, image_items = self._collect_all_context(
        user_prompt, api_string, auth_api_string, use_live_search, debug=debug_mode
    )

    # 3) Bouw context v3
    opts = json.loads(options_string) if options_string else {}
    context_block, numbered_sources = self._build_context_v3(
        kb_hits=[],  # KB integratie kan hier later bij
        live_snips=live_snips,
        api_snips=api_snips,
        live_sources=live_sources,
        image_items=image_items,
        user_images_info=[],
        max_context_chars=opts.get("max_context_chars", 3600),
        debug=debug_mode
    )

    # 4) Bouw messages
    messages = self._build_messages(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        context_block=context_block,
        thinking=opts.get("thinking", False),
        multimodal=opts.get("detect_multimodal", True),
        images_b64_list=[],
        answer_lang=opts.get("language_override") or "nl",
        context_messages_json=opts.get("context_messages_json", "")
    )

    # 5) (Hier zou je de Ollama API-call doen)
    if debug_mode:
        print("[AIO] Messages prepared:", json.dumps(messages, indent=2, ensure_ascii=False))

    # Dummy model output
    dummy_output = {
        "response": f"Analyse gebaseerd op {len(live_snips)} live snippets, {len(api_snips)} API-snips en {len(image_items)} images."
    }

    # 6) Parse & sanitize
    thinking_out, final_out = self._extract_thinking_and_result(dummy_output, thinking_enabled=opts.get("thinking", False))
    thinking_out = self._sanitize_model_output(thinking_out)
    final_out = self._sanitize_model_output(final_out)

    # 7) Return
    return thinking_out, final_out, json.dumps(numbered_sources, indent=2, ensure_ascii=False)
# ------------------------------------------------------------
# Blok 23/?? : KB-indexering en caching - in AIOllamaMain
# ------------------------------------------------------------
def _kb_signature(self, kb_dir, chunk, overlap):
    """
    Maakt een hash van alle bestanden + instellingen om te zien of herindexeren nodig is.
    """
    items = []
    for path in sorted(glob.glob(os.path.join(kb_dir, "**/*.txt"), recursive=True) +
                       glob.glob(os.path.join(kb_dir, "**/*.md"), recursive=True)):
        try:
            st = os.stat(path)
            items.append(f"{path}|{int(st.st_mtime)}|{st.st_size}")
        except Exception:
            continue
    sig_str = "|".join(items) + f"|{chunk}|{overlap}"
    return hashlib.sha256(sig_str.encode("utf-8")).hexdigest()

def _read_textfile(self, path):
    try:
        with io.open(path, "r", encoding="utf-8", errors="ignore") as f:
            return f.read()
    except Exception:
        return ""

def _chunk_text(self, text, chunk_size=900, overlap=120):
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    chunks, i, n = [], 0, len(text)
    while i < n:
        end = min(i + chunk_size, n)
        seg = text[i:end]
        m = re.search(r".*[\.!?…](\s|$)", seg)
        if m and (i + m.end()) - i >= chunk_size * 0.6:
            end = i + m.end()
            seg = text[i:end]
        chunks.append(seg)
        if end >= n:
            break
        i = max(end - overlap, i + 1)
    return chunks

def _tokenize(self, s):
    return [t.lower() for t in re.findall(r"[a-zA-Z0-9\u00C0-\u024F]+", s)]

def _build_kb_index(self, kb_dir, chunk_chars, overlap_chars, debug=False):
    files = sorted(glob.glob(os.path.join(kb_dir, "**/*.txt"), recursive=True) +
                   glob.glob(os.path.join(kb_dir, "**/*.md"), recursive=True))
    chunks = []
    for path in files:
        txt = self._read_textfile(path)
        if not txt:
            continue
        title = os.path.basename(path)
        for c in self._chunk_text(txt, chunk_size=chunk_chars, overlap=overlap_chars):
            toks = self._tokenize(c)
            chunks.append({
                "title": title,
                "path": path,
                "text": c,
                "tf": Counter(toks),
                "len": len(toks)
            })
    df = defaultdict(int)
    for ch in chunks:
        for w in set(ch["tf"].keys()):
            df[w] += 1
    N = max(1, len(chunks))
    idf = {w: math.log((N + 1) / (dfw + 1)) + 1.0 for w, dfw in df.items()}
    self._kb_chunks, self._kb_idf, self._kb_ready = chunks, idf, True
    if debug:
        print(f"[AIO] KB index klaar: {len(chunks)} passages.")

def _ensure_kb(self, kb_dir, chunk_chars, overlap_chars, debug=False):
    if not kb_dir or not os.path.isdir(kb_dir):
        self._kb_ready = False
        return
    sig = self._kb_signature(kb_dir, chunk_chars, overlap_chars)
    if getattr(self, "_kb_cache_sig", None) != sig:
        self._kb_cache_sig = sig
        self._build_kb_index(kb_dir, chunk_chars, overlap_chars, debug=debug)

def _kb_search(self, query, k=6):
    if not getattr(self, "_kb_ready", False) or not getattr(self, "_kb_chunks", []):
        return []
    q_toks = self._tokenize(query)
    if not q_toks:
        return []
    q_tf = Counter(q_toks)

    def dot(tf1, tf2, idf):
        s = 0.0
        for w, c in tf1.items():
            if w in tf2:
                s += (c * idf.get(w, 1.0)) * (tf2[w] * idf.get(w, 1.0))
        return s

    def norm(tf, idf):
        s = 0.0
        for w, c in tf.items():
            v = c * idf.get(w, 1.0)
            s += v * v
        return math.sqrt(s) if s > 0 else 1.0

    qn = norm(q_tf, self._kb_idf)
    scored = []
    for ch in self._kb_chunks:
        d = dot(q_tf, ch["tf"], self._kb_idf)
        sim = d / (qn * norm(ch["tf"], self._kb_idf))
        sim += 0.05 * (1.0 / (1.0 + max(0, ch["len"] - 250) / 250.0))
        scored.append((sim, ch))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored[:k]]
# ------------------------------------------------------------
# Blok 24/?? : KB integratie in Main Node.run()
# ------------------------------------------------------------
def run(self, url, model_choice, model_override,
        keep_alive, keep_alive_unit,
        refresh_connection, use_live_search, use_tool_prompt,
        debug_mode, apikeys_enabled,
        system_prompt, user_prompt,
        options_string, api_string, auth_api_string,
        optional_image_input=None):

    # 1) Toolprompt injectie
    system_prompt = self._inject_toolprompt(system_prompt, use_tool_prompt)

    # 2) Parse opties
    opts = json.loads(options_string) if options_string else {}

    # 3) KB laden indien ingeschakeld
    kb_hits = []
    try:
        free_cfg = json.loads(api_string) if api_string else {}
        if free_cfg.get("use_knowledge_base", True) and free_cfg.get("knowledge_base_dir"):
            self._ensure_kb(free_cfg["knowledge_base_dir"],
                            free_cfg.get("kb_chunk_chars", 900),
                            free_cfg.get("kb_overlap_chars", 120),
                            debug=debug_mode)
            kb_hits = self._kb_search(user_prompt, k=free_cfg.get("kb_max_chunks", 6))
    except Exception as e:
        if debug_mode:
            print("[AIO] KB error:", e)

    # 4) Verzamel alle contextdata
    live_snips, live_sources, api_snips, image_items = self._collect_all_context(
        user_prompt, api_string, auth_api_string, use_live_search, debug=debug_mode
    )

    # 5) Bouw context v3 (nu met KB)
    context_block, numbered_sources = self._build_context_v3(
        kb_hits=kb_hits,
        live_snips=live_snips,
        api_snips=api_snips,
        live_sources=live_sources,
        image_items=image_items,
        user_images_info=[],
        max_context_chars=opts.get("max_context_chars", 3600),
        debug=debug_mode
    )

    # 6) Bouw messages
    messages = self._build_messages(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        context_block=context_block,
        thinking=opts.get("thinking", False),
        multimodal=opts.get("detect_multimodal", True),
        images_b64_list=[],
        answer_lang=opts.get("language_override") or "nl",
        context_messages_json=opts.get("context_messages_json", "")
    )

    if debug_mode:
        print("[AIO] Messages prepared:", json.dumps(messages, indent=2, ensure_ascii=False))

    # 7) Dummy model output
    dummy_output = {
        "response": f"Analyse gebaseerd op {len(kb_hits)} KB-hits, {len(live_snips)} live snippets, {len(api_snips)} API-snips en {len(image_items)} images."
    }

    # 8) Parse & sanitize
    thinking_out, final_out = self._extract_thinking_and_result(dummy_output, thinking_enabled=opts.get("thinking", False))
    thinking_out = self._sanitize_model_output(thinking_out)
    final_out = self._sanitize_model_output(final_out)

    return thinking_out, final_out, json.dumps(numbered_sources, indent=2, ensure_ascii=False)
# ------------------------------------------------------------
# Blok 25/?? : Glue helpers in AIOllamaMain (zodat _collect_all_context werkt)
# ------------------------------------------------------------
def _duckduckgo_instant(self, query, timeout=10):
    try:
        r = requests.get(
            "https://api.duckduckgo.com/",
            params={"q": query, "format": "json", "no_redirect": "1", "no_html": "1"},
            timeout=timeout
        )
        r.raise_for_status()
        return r.json()
    except Exception:
        return None

def _wiki_opensearch(self, query, limit=3, timeout=10, lang="en"):
    try:
        r = requests.get(
            f"https://{lang}.wikipedia.org/w/api.php",
            params={"action": "opensearch", "search": query, "limit": str(limit), "format": "json"},
            timeout=timeout
        )
        r.raise_for_status()
        return r.json()
    except Exception:
        return None

def _wiki_summary(self, title, timeout=10, lang="en"):
    try:
        safe = quote_plus(title.replace(" ", "_"))
        r = requests.get(
            f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{safe}",
            timeout=timeout
        )
        r.raise_for_status()
        return r.json()
    except Exception:
        return None

def free_live_search(self, query, max_results=5, timeout=10, wiki_lang="en", debug=False):
    snippets, sources = [], []
    ddg = self._duckduckgo_instant(query, timeout=timeout)
    if ddg:
        if ddg.get("AbstractText"):
            snippets.append(ddg["AbstractText"])
            if ddg.get("AbstractURL"):
                sources.append({"type": "duckduckgo", "title": "Instant Answer", "url": ddg["AbstractURL"]})
        for rt in (ddg.get("RelatedTopics") or [])[:max_results]:
            if isinstance(rt, dict) and rt.get("Text"):
                snippets.append(rt["Text"])
                if rt.get("FirstURL"):
                    sources.append({"type": "duckduckgo", "title": rt["Text"], "url": rt["FirstURL"]})
    wiki = self._wiki_opensearch(query, limit=max_results, timeout=timeout, lang=wiki_lang)
    if isinstance(wiki, list) and len(wiki) >= 4:
        titles, urls = wiki[1], wiki[3]
        for i, t in enumerate(titles[:max_results]):
            s = self._wiki_summary(t, timeout=timeout, lang=wiki_lang)
            if s and s.get("extract"):
                snippets.append(f"{s['title']}: {s['extract']}")
                sources.append({"type": "wikipedia", "title": s.get("title") or t, "url": s.get("url") or (urls[i] if i < len(urls) else None)})
    if debug:
        print(f"[AIO] Main.free_live_search → {len(snippets)} snippets, {len(sources)} sources")
    return snippets, sources

def free_weather_wttr(self, location, timeout=8):
    try:
        r = requests.get(f"https://wttr.in/{quote_plus(location)}?format=3", timeout=timeout)
        r.raise_for_status()
        return f"wttr.in: {r.text.strip()}"
    except Exception:
        return None

def free_news_spaceflight(self, timeout=6):
    try:
        r = requests.get("https://api.spaceflightnewsapi.net/v4/articles", timeout=timeout)
        r.raise_for_status()
        data = r.json()
        out = [f"{a.get('title')}: {a.get('summary')}" for a in data.get("results", [])[:3]]
        return " | ".join(out) if out else None
    except Exception:
        return None
# ------------------------------------------------------------
# Blok 26/?? : Echte Ollama /api/chat call - in AIOllamaMain
# ------------------------------------------------------------
def _ollama_chat(self, base_url: str, model: str, messages: list, options: dict, keep_alive: int, keep_alive_unit: str, timeout_s: int = 120, debug: bool = False):
    """
    Roept Ollama /api/chat aan. Valt terug op /api/generate als chat faalt.
    """
    base = (base_url or "http://127.0.0.1:11434").rstrip("/")
    keep_unit = 'h' if keep_alive_unit == 'hours' else 'm'
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "keep_alive": f"{keep_alive}{keep_unit}",
        "options": options or {}
    }
    try:
        r = requests.post(f"{base}/api/chat", json=payload, headers=_ua(), timeout=timeout_s)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        if debug:
            print(f"[AIO] /api/chat fout: {e} → fallback naar /api/generate")
        try:
            # Simpele fallback met system+user samengevoegd
            system = ""
            user = ""
            for m in messages:
                if m.get("role") == "system":
                    system += (m.get("content") or "") + "\n\n"
                elif m.get("role") == "user":
                    user += (m.get("content") or "") + "\n\n"
            gen_payload = {
                "model": model,
                "system": system.strip(),
                "prompt": user.strip(),
                "options": options or {},
                "stream": False,
                "keep_alive": f"{keep_alive}{keep_unit}"
            }
            r2 = requests.post(f"{base}/api/generate", json=gen_payload, headers=_ua(), timeout=timeout_s)
            r2.raise_for_status()
            return r2.json()
        except Exception as e2:
            return {"response": f"[AIO] Fout bij ophalen van antwoord (fallback): {e2}"}
# ------------------------------------------------------------
# Blok 27/?? : Multimodale image-afhandeling - in AIOllamaMain.run
# ------------------------------------------------------------
# Voeg dit toe in run(), vóór messages bouwen, na het parsen van opts:

images_b64_list = []
user_images_info = []

# Optionele UI-velden (als je ze al via Options Node aanlevert):
try:
    if opts.get("images_b64_json"):
        arr = json.loads(opts["images_b64_json"])
        if isinstance(arr, list):
            for it in arr:
                if isinstance(it, str) and len(it) > 24:
                    images_b64_list.append(it)
                    user_images_info.append("json image")
except Exception as e:
    if debug_mode:
        print("[AIO] images_b64_json parse error:", e)

if opts.get("optional_image_b64"):
    images_b64_list.append(opts["optional_image_b64"].strip())
    user_images_info.append("optional image b64")

# Batch image paths
try:
    arr = json.loads(opts.get("batch_image_paths", "[]"))
    if isinstance(arr, list):
        for path in arr:
            if isinstance(path, str) and os.path.isfile(path):
                with Image.open(path) as im:
                    im = im.convert("RGB")
                    buf = io.BytesIO()
                    im.save(buf, format="PNG")
                    images_b64_list.append(base64.b64encode(buf.getvalue()).decode("utf-8"))
                    user_images_info.append(f"batch image: {os.path.basename(path)}")
except Exception as e:
    if debug_mode:
        print("[AIO] batch_image_paths parse error:", e)

# Optional Comfy IMAGE input
if optional_image_input is not None:
    try:
        arr = np.array(optional_image_input)
        if arr.ndim == 3 and arr.shape[0] in (1,3,4) and arr.shape[0] < arr.shape[1]:
            arr = np.transpose(arr, (1,2,0))
        if arr.dtype != np.uint8:
            maxv = float(np.max(arr)) if arr.size else 1.0
            if maxv <= 1.01:
                arr = np.clip(arr, 0.0, 1.0) * 255.0
            arr = arr.astype(np.uint8)
        pil = Image.fromarray(arr)
        buf = io.BytesIO()
        pil.save(buf, format="PNG")
        images_b64_list.append(base64.b64encode(buf.getvalue()).decode("utf-8"))
        user_images_info.append("optional_image_input")
    except Exception as e:
        if debug_mode:
            print("[AIO] optional_image_input parse error:", e)
# ------------------------------------------------------------
# Blok 28/?? : Integreer Ollama-call in Main.run (vervang dummy-output)
# ------------------------------------------------------------
# Na het bouwen van messages:

# Bouw Ollama options (alleen de relevante uit options_string)
ollama_opts = {
    "temperature": float(opts.get("temperature", 0.7)),
    "num_predict": int(opts.get("num_predict", 1024)),
    "mirostat": int(opts.get("mirostat", 0)),
    "top_k": int(opts.get("top_k", 40)),
    "top_p": float(opts.get("top_p", 0.9)),
    "repeat_penalty": float(opts.get("repeat_penalty", 1.1)),
}

timeout_s = 120
data = self._ollama_chat(
    base_url=url,
    model=(model_override or model_choice or "").strip(),
    messages=messages,
    options=ollama_opts,
    keep_alive=int(keep_alive),
    keep_alive_unit=keep_alive_unit,
    timeout_s=timeout_s,
    debug=debug_mode
)

thinking_out, final_out = self._extract_thinking_and_result(
    data, thinking_enabled=opts.get("thinking", False)
)
thinking_out = self._sanitize_model_output(thinking_out)
final_out = self._sanitize_model_output(final_out)

return thinking_out, final_out, json.dumps(numbered_sources, indent=2, ensure_ascii=False)
# ------------------------------------------------------------
# Blok 29/?? : Robustness tweaks - in AIOllamaMain
# ------------------------------------------------------------
def _safe_bool(self, v, default=False):
    try:
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            return v.strip().lower() in ("1","true","yes","y","on")
        if isinstance(v, (int, float)):
            return v != 0
        return default
    except Exception:
        return default

def _safe_int(self, v, default=0):
    try:
        return int(v)
    except Exception:
        return default

def _safe_float(self, v, default=0.0):
    try:
        return float(v)
    except Exception:
        return default
# ------------------------------------------------------------
# Blok 30/?? : Fix collect context - image search via auth_api_string config (Main)
# ------------------------------------------------------------
# Vervang in AIOllamaMain._collect_all_context het image-search deel door dit:

    # 2) Auth API's (image search via config, zonder class-attributen)
    try:
        auth_cfg = json.loads(auth_api_string) if auth_api_string else {}
        provider = (auth_cfg.get("image_search_provider") or "off").lower()
        if provider != "off":
            image_items = self._image_search_with_cfg(
                provider=provider,
                query=user_prompt,
                auth_cfg=auth_cfg,
                max_results=int(auth_cfg.get("image_max_results", 4)),
                debug=debug
            )
    except Exception as e:
        if debug:
            print("[AIO] Auth API parse error:", e)
# ------------------------------------------------------------
# Blok 31/?? : Image search helper in Main (gebruikt auth_api_string keys)
# ------------------------------------------------------------
def _image_search_with_cfg(self, provider: str, query: str, auth_cfg: dict, max_results: int = 4, timeout: int = 8, debug: bool = False):
    provider = (provider or "off").lower()
    if provider == "off" or not query:
        return []
    try:
        if provider == "unsplash" and (auth_cfg.get("unsplash_key") or "").strip():
            key = auth_cfg["unsplash_key"].strip()
            r = requests.get(
                "https://api.unsplash.com/search/photos",
                params={"query": query, "per_page": max_results},
                headers={"Authorization": f"Client-ID {key}"},
                timeout=timeout
            )
            r.raise_for_status()
            data = r.json()
            return [{
                "title": it.get("description") or it.get("alt_description") or "Unsplash image",
                "image": it.get("urls", {}).get("regular"),
                "thumbnail": it.get("urls", {}).get("thumb"),
                "url": it.get("links", {}).get("html")
            } for it in (data.get("results") or [])[:max_results]]

        if provider == "bing" and (auth_cfg.get("bing_key") or "").strip():
            key = auth_cfg["bing_key"].strip()
            r = requests.get(
                "https://api.bing.microsoft.com/v7.0/images/search",
                params={"q": query, "count": max_results},
                headers={"Ocp-Apim-Subscription-Key": key},
                timeout=timeout
            )
            r.raise_for_status()
            data = r.json()
            return [{
                "title": it.get("name") or "Bing image",
                "image": it.get("contentUrl"),
                "thumbnail": it.get("thumbnailUrl"),
                "url": it.get("hostPageUrl")
            } for it in (data.get("value") or [])[:max_results]]

        if provider == "pexels" and (auth_cfg.get("pexels_key") or "").strip():
            key = auth_cfg["pexels_key"].strip()
            r = requests.get(
                "https://api.pexels.com/v1/search",
                params={"query": query, "per_page": max_results},
                headers={"Authorization": key},
                timeout=timeout
            )
            r.raise_for_status()
            data = r.json()
            return [{
                "title": it.get("alt") or "Pexels image",
                "image": it.get("src", {}).get("large"),
                "thumbnail": it.get("src", {}).get("tiny"),
                "url": it.get("url")
            } for it in (data.get("photos") or [])[:max_results]]

        # DuckDuckGo image search zonder key kan onstabiel zijn; intentionally weglaten voor stabiliteit
    except Exception as e:
        if debug:
            print(f"[AIO] Image search error ({provider}): {e}")
    return []
# ------------------------------------------------------------
# Blok 32/?? : Main.__init__ KB-state + defaults
# ------------------------------------------------------------
# Voeg toe in AIOllamaMain.__init__:
    def __init__(self):
        # KB state
        self._kb_chunks = []
        self._kb_idf = {}
        self._kb_ready = False
        self._kb_cache_sig = ""
# ------------------------------------------------------------
# Blok 33/?? : Sanity checks in Main.run()
# ------------------------------------------------------------
# Zet dit helemaal bovenaan in AIOllamaMain.run(), direct na de functieparameters:

    base_url = (url or "http://127.0.0.1:11434").strip().rstrip("/")
    model = (model_override or model_choice or "").strip()
    if not model:
        model = "llama3.1"  # defensieve default

    # Safety: options_string JSON parse
    try:
        opts = json.loads(options_string) if options_string else {}
    except Exception:
        opts = {}

    # Safety: context limit fallback
    ctx_limit = int(opts.get("max_context_chars", 3600))
    if ctx_limit < 1200:
        ctx_limit = 1200
    if ctx_limit > 700000:
        ctx_limit = 700000
    opts["max_context_chars"] = ctx_limit
# ------------------------------------------------------------
# Blok 34/?? : Quick-start helper (optioneel)
# ------------------------------------------------------------
def _quick_live_check(self, debug=False):
    """
    Kleine sanity-test voor live search pad.
    """
    snips, srcs = self.free_live_search("Weather Nijmegen", max_results=3, timeout=8, wiki_lang="en", debug=debug)
    if debug:
        print(f"[AIO] Quick live check → snips={len(snips)}, sources={len(srcs)}")
    return bool(snips or srcs)
# ------------------------------------------------------------
# Blok 35/?? : Node-registratie (als je deze nog niet had onderaan bestand)
# ------------------------------------------------------------
NODE_CLASS_MAPPINGS = {
    "AIOllamaMain": AIOllamaMain,
    "AIOllamaOptions": AIOllamaOptions,
    "AIOllamaAPIs": AIOllamaAPIs,
    "AIOllamaAuthAPIs": AIOllamaAuthAPIs
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AIOllamaMain": "AIOllama Main Node",
    "AIOllamaOptions": "AIOllama Options Node",
    "AIOllamaAPIs": "AIOllama API Node (Free)",
    "AIOllamaAuthAPIs": "AIOllama API Node (With Key)"
}
# Add in AIOllamaMain
def _health_check(self, base_url: str, debug: bool = False) -> bool:
    try:
        r = requests.get(f"{base_url.rstrip('/')}/api/tags", headers=_ua(), timeout=6)
        r.raise_for_status()
        return True
    except Exception as e:
        if debug:
            print(f"[AIO] Health check failed: {e}")
        return False
# Inside run(), early:
base_url = (url or "http://127.0.0.1:11434").strip().rstrip("/")
if refresh_connection:
    self._health_check(base_url, debug=debug_mode)
def _with_retry(self, func, tries=2, delay=0.35, *args, **kwargs):
    last = None
    for i in range(max(1, tries)):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            last = e
            time.sleep(delay)
    raise last
# Example inside free_live_search():
ddg = None
try:
    ddg = self._with_retry(lambda: self._duckduckgo_instant(query, timeout=timeout), tries=2, delay=0.25)
except Exception:
    ddg = None
def _parse_json_safe(self, s: str, default, dbg_label: str, debug: bool):
    if not s or not s.strip():
        return default
    try:
        return json.loads(s)
    except Exception as e:
        if debug:
            print(f"[AIO] JSON parse failed for {dbg_label}: {e}")
        return default
opts = self._parse_json_safe(options_string, {}, "options_string", debug_mode)
free_cfg = self._parse_json_safe(api_string, {}, "api_string", debug_mode)
auth_cfg = self._parse_json_safe(auth_api_string, {}, "auth_api_string", debug_mode)
def _harmonize_for_gptoss(self, model_name: str, messages: list, enabled: bool):
    """
    Wraps system/user into a GPT-OSS style prelude when enabled and model suggests OSS.
    Non-destructive: only applies if enabled and heuristic matches.
    """
    if not enabled:
        return messages
    name = (model_name or "").lower()
    if "gpt-oss" not in name:
        return messages

    sys = "\n".join([m["content"] for m in messages if m.get("role") == "system"]).strip()
    usr = "\n".join([m["content"] for m in messages if m.get("role") == "user"]).strip()
    new = [{"role": "system", "content": f"<|start|><|system|>{sys or 'You are a helpful assistant.'}<|user|>{usr}<|assistant|>"}]
    return new
messages = self._harmonize_for_gptoss(model, messages, enabled=True)  # or tie to a new toggle
# In _build_context_v3, keep what you have; ensure user_images_info is used as shown earlier.
# imports
import json

# class-definities
class OllamaAIOUltimateMultiAPITranslatedImage:
    # je hele node-code hier
    pass

# node-registratie ONDERAAN
NODE_CLASS_MAPPINGS = {
    "OllamaAIOUltimateMultiAPITranslatedImage": OllamaAIOUltimateMultiAPITranslatedImage
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "OllamaAIOUltimateMultiAPITranslatedImage": "Ollama AIO Ultimate (MultiAPI + KB + Translate + Image)"
}
