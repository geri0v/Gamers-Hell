# ollamanode.py
# Ollama AIO Ultimate (MultiAPI + KB + Translate + Image)
# Upgraded and cleaned: robust parsing, output sanitizing, enhanced live search (free-first), query cleaning, context clarity

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
    return {"User-Agent": "ComfyUI-OllamaAIO-Ultimate/1.6"}

def _clamp(s, limit):
    if not isinstance(s, str):
        try:
            s = str(s)
        except Exception:
            return ""
    if len(s) <= limit:
        return s
    return s[:limit].rsplit(" ", 1)[0] + "..."

def _png_b64_from_ndarray(arr: np.ndarray) -> str:
    if arr.ndim == 3 and arr.shape[0] in (1, 3, 4):
        arr = np.transpose(arr, (1, 2, 0))
    if arr.dtype != np.uint8:
        arr = np.clip(arr * 255.0, 0, 255).astype(np.uint8)
    pil = Image.fromarray(arr)
    buf = io.BytesIO()
    pil.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")

def _png_b64_from_bytes(img_bytes: bytes) -> str:
    pil = Image.open(io.BytesIO(img_bytes))
    if pil.mode not in ("RGB", "RGBA"):
        pil = pil.convert("RGBA")
    buf = io.BytesIO()
    pil.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("utf-8")

class OllamaAIOUltimateMultiAPITranslatedImage:
    CATEGORY = "Ollama"
    RETURN_TYPES = ("STRING", "STRING", "STRING",)
    RETURN_NAMES = ("thinking_output", "result", "sources_json",)
    FUNCTION = "run"

    _cached_model_choices = None
    _cached_model_fetch_ts = 0

    def __init__(self):
        # KB caches
        self._kb_chunks: List[Dict[str, Any]] = []
        self._kb_idf: Dict[str, float] = {}
        self._kb_ready: bool = False
        self._kb_cache_sig: str = ""

    @classmethod
    def _bootstrap_models_for_dropdown(cls):
        if cls._cached_model_choices and (time.time() - cls._cached_model_fetch_ts) < 120:
            return cls._cached_model_choices
        try:
            data = requests.get("http://127.0.0.1:11434/api/tags", headers=_ua(), timeout=2).json()
            models = [m.get("name") for m in data.get("models", []) if isinstance(m, dict) and m.get("name")]
            models = models or ["llama3.1", "mistral", "qwen2.5-vl", "llava", "deepseek-r1"]
        except Exception:
            models = ["llama3.1", "mistral", "qwen2.5-vl", "llava", "deepseek-r1"]
        cls._cached_model_choices = models
        cls._cached_model_fetch_ts = time.time()
        return models

    @classmethod
    def INPUT_TYPES(cls):
        choices = cls._bootstrap_models_for_dropdown()
        return {
            "required": {
                "url": ("STRING", {"default": "http://127.0.0.1:11434"}),
                "model_choice": (choices, {"default": choices[0] if choices else ""}),
                "model_override": ("STRING", {"default": ""}),
                "keep_alive": ("INT", {"default": 10, "min": -1, "max": 240}),
                "keep_alive_unit": (["minutes", "hours"], {"default": "minutes"}),

                "system_prompt": ("STRING", {"multiline": True, "default": "Je bent een precieze, nuchtere assistent..."}),
                "prompt": ("STRING", {"multiline": True, "default": "Wat is het weer in Nijeveen?"}),

                "temperature": ("FLOAT", {"default": 0.7, "min": 0.0, "max": 2.0}),
                "num_predict": ("INT", {"default": 1024, "min": -1, "max": 8192}),
                "mirostat": ("INT", {"default": 0, "min": 0, "max": 2}),
                "top_k": ("INT", {"default": 40, "min": 0, "max": 400}),
                "top_p": ("FLOAT", {"default": 0.9, "min": 0.0, "max": 1.0}),
                "repeat_penalty": ("FLOAT", {"default": 1.1, "min": 0.0, "max": 2.0}),
                "thinking": ("BOOLEAN", {"default": False}),

                "use_knowledge_base": ("BOOLEAN", {"default": True}),
                "knowledge_base_dir": ("STRING", {"default": ""}),
                "kb_max_chunks": ("INT", {"default": 6, "min": 1, "max": 20}),
                "kb_chunk_chars": ("INT", {"default": 900, "min": 300, "max": 2000}),
                "kb_overlap_chars": ("INT", {"default": 120, "min": 0, "max": 800}),

                "use_live_search": ("BOOLEAN", {"default": True}),
                "wiki_lang": (["en", "nl"], {"default": "en"}),
                "search_query_override": ("STRING", {"default": ""}),
                "search_max_results": ("INT", {"default": 5, "min": 1, "max": 10}),
                "search_timeout_s": ("INT", {"default": 10, "min": 2, "max": 60}),
                "disable_primary_live": ("BOOLEAN", {"default": False}),
                "force_context_if_empty": ("BOOLEAN", {"default": True}),
                "enhanced_live_fallbacks": ("BOOLEAN", {"default": True}),

                "use_multi_api_router": ("BOOLEAN", {"default": True}),
                "use_weather_apis": ("BOOLEAN", {"default": True}),
                "use_nature_apis": ("BOOLEAN", {"default": True}),
                "use_finance_apis": ("BOOLEAN", {"default": True}),
                "use_news_apis": ("BOOLEAN", {"default": True}),
                "use_general_apis": ("BOOLEAN", {"default": True}),
                "use_media_apis": ("BOOLEAN", {"default": True}),
                "use_scraping_fallback": ("BOOLEAN", {"default": False}),

                "translate_before_api": ("BOOLEAN", {"default": True}),
                "translate_back_results": ("BOOLEAN", {"default": True}),
                "language_override": ("STRING", {"default": ""}),
                "max_context_chars": ("INT", {"default": 3600, "min": 1200, "max": 12000}),

                "image_search_provider": (["off", "duckduckgo", "unsplash", "bing", "pexels"], {"default": "off"}),
                "image_max_results": ("INT", {"default": 4, "min": 1, "max": 12}),
                "unsplash_key": ("STRING", {"default": ""}),
                "bing_key": ("STRING", {"default": ""}),
                "pexels_key": ("STRING", {"default": ""}),

                "images_b64_json": ("STRING", {"multiline": True, "default": ""}),
                "optional_image_b64": ("STRING", {"multiline": True, "default": ""}),
                "batch_image_paths": ("STRING", {"multiline": True, "default": "[]"}),

                "context_messages_json": ("STRING", {"multiline": True, "default": ""}),
                "list_models_on_run": ("BOOLEAN", {"default": True}),
                "detect_multimodal": ("BOOLEAN", {"default": True}),

                # Optional extra live-search keys (not required)
                "brave_key": ("STRING", {"default": ""}),
                "serper_key": ("STRING", {"default": ""}),
                "google_cse_key": ("STRING", {"default": ""}),
                "google_cse_cx": ("STRING", {"default": ""}),

                "api_timeout_override_s": ("INT", {"default": 0, "min": 0, "max": 300}),
                "debug": ("BOOLEAN", {"default": False}),
            },
            "optional": {
                "optional_image_input": ("IMAGE", {"default": None}),
            }
        }

    # Verbeterde optionele IMAGE input (Torch/NumPy)
    def _process_optional_image_input(self, optional_image_input, is_multimodal, images_b64_list, user_images_info, debug=False):
        if optional_image_input is None:
            return
        try:
            try:
                import torch
                if isinstance(optional_image_input, torch.Tensor):
                    arr = optional_image_input.detach().cpu().numpy()
                else:
                    arr = optional_image_input
            except Exception:
                arr = optional_image_input

            if not isinstance(arr, np.ndarray):
                if debug:
                    print("[AIO] optional_image_input is geen ndarray/tensor; genegeerd")
                return

            if arr.ndim == 3:
                arr = arr[None, ...]

            for i, img in enumerate(arr):
                b64 = _png_b64_from_ndarray(img)
                if is_multimodal:
                    images_b64_list.append(b64)
                    user_images_info.append(f"optional_image_input[{i+1}]")
                elif debug:
                    print("[AIO] detect_multimodal=False → IMAGE genegeerd")
        except Exception as e:
            print(f"[AIO] Fout bij verwerken IMAGE: {e}")

    # Robuuste thinking/result parser
    def _extract_thinking_and_result(self, data, thinking_enabled=False):
        text = ""
        think_out = ""

        if thinking_enabled and isinstance(data, dict) and data.get("thinking"):
            think_out = str(data.get("thinking")).strip()

        if isinstance(data, dict):
            for key in ["response", "display_text", "output"]:
                if data.get(key):
                    text = data[key]
                    break
            if not text and "message" in data:
                if isinstance(data["message"], dict):
                    text = data["message"].get("content", "") or ""
                elif isinstance(data["message"], str):
                    text = data["message"]
            if not text and "choices" in data and isinstance(data["choices"], list) and data["choices"]:
                choice = data["choices"][0]
                if isinstance(choice, dict):
                    if "message" in choice and isinstance(choice["message"], dict):
                        text = choice["message"].get("content", "")
                    elif "text" in choice:
                        text = choice["text"]

        if not text and isinstance(data, str):
            text = data
        if not text and isinstance(data, dict):
            try:
                text = json.dumps(data, ensure_ascii=False)
            except Exception:
                pass

        text = (text or "").strip()
        final_out = text

        if thinking_enabled:
            m1 = re.search(r"<think>(.*?)</think>", text, flags=re.DOTALL | re.IGNORECASE)
            m2 = re.search(r"<final>(.*?)</final>", text, flags=re.DOTALL | re.IGNORECASE)

            if m1:
                think_tag_content = m1.group(1).strip()
                think_out = (think_out + "\n" + think_tag_content).strip() if think_out else think_tag_content
            if m2:
                final_out = m2.group(1).strip()
            elif m1:
                final_out = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE).strip()

            if not think_out and text:
                parts = re.split(r"(?<=\.)\s+(?=[A-Z])", text, maxsplit=1)
                if len(parts) == 2:
                    think_out = parts[0].strip()
                    final_out = parts[1].strip()
                else:
                    think_out = "[Model stuurde geen apart denkproces terug]"

        return think_out, final_out

    # Extra sanitation voor 'garbage' patronen (GPT-OSS e.d.)
    def _sanitize_model_output(self, s: str) -> str:
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

        # Normaliseer lege regels: max 1 achter elkaar
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

    # Ollama generate (fallback)
    def ollama_generate_v2(self, base_url, model, system, prompt, options,
                           context=None, images_b64=None,
                           keep_alive=10, keep_alive_unit="minutes",
                           debug=False):
        url = (base_url or "http://127.0.0.1:11434").rstrip("/") + "/api/generate"
        if isinstance(keep_alive, int):
            unit = "m" if keep_alive_unit == "minutes" else "h"
            keep_alive_val = f"{keep_alive}{unit}" if keep_alive >= 0 else keep_alive
        else:
            keep_alive_val = keep_alive

        payload = {
            "model": model or "llama3.1",
            "system": system or "",
            "prompt": prompt or "",
            "options": options or {},
            "stream": False,
            "keep_alive": keep_alive_val
        }
        if context is not None:
            payload["context"] = context
        if images_b64:
            payload["images"] = images_b64

        if debug:
            print(f"[AIO] POST {url}")
            try:
                print(f"[AIO] model={payload['model']}, images={len(payload.get('images', [])) if payload.get('images') else 0}")
            except Exception:
                pass

        try:
            resp = requests.post(url, json=payload, headers=_ua(), timeout=120)
            resp.raise_for_status()
            data = resp.json()
            text = data.get("response", "") or data.get("message", "") or ""
            return (text, [])
        except Exception as e:
            err = f"Fout bij Ollama generate: {e}"
            if debug:
                print("[AIO]", err)
            return (err, [])

    # ComfyUI entrypoint
    def run(self,
            url, model_choice, model_override,
            keep_alive, keep_alive_unit,
            system_prompt, prompt,
            temperature, num_predict, mirostat, top_k, top_p, repeat_penalty,
            thinking,
            use_knowledge_base, knowledge_base_dir, kb_max_chunks, kb_chunk_chars, kb_overlap_chars,
            use_live_search, wiki_lang, search_query_override, search_max_results, search_timeout_s, disable_primary_live, force_context_if_empty, enhanced_live_fallbacks,
            use_multi_api_router, use_weather_apis, use_nature_apis, use_finance_apis, use_news_apis, use_general_apis, use_media_apis, use_scraping_fallback,
            translate_before_api, translate_back_results, language_override,
            max_context_chars,
            image_search_provider, image_max_results, unsplash_key, bing_key, pexels_key,
            images_b64_json, optional_image_b64, batch_image_paths,
            context_messages_json, list_models_on_run, detect_multimodal,
            brave_key, serper_key, google_cse_key, google_cse_cx,
            api_timeout_override_s, debug,
            optional_image_input=None):
        return self._run_impl(
            url, model_choice, model_override,
            keep_alive, keep_alive_unit,
            system_prompt, prompt,
            temperature, num_predict, mirostat, top_k, top_p, repeat_penalty,
            thinking,
            use_knowledge_base, knowledge_base_dir, kb_max_chunks, kb_chunk_chars, kb_overlap_chars,
            use_live_search, wiki_lang, search_query_override, search_max_results, search_timeout_s, disable_primary_live, force_context_if_empty, enhanced_live_fallbacks,
            use_multi_api_router, use_weather_apis, use_nature_apis, use_finance_apis, use_news_apis, use_general_apis, use_media_apis, use_scraping_fallback,
            translate_before_api, translate_back_results, language_override,
            max_context_chars,
            image_search_provider, image_max_results, unsplash_key, bing_key, pexels_key,
            images_b64_json, optional_image_b64, batch_image_paths,
            context_messages_json, list_models_on_run, detect_multimodal,
            brave_key, serper_key, google_cse_key, google_cse_cx,
            api_timeout_override_s, debug,
            optional_image_input=optional_image_input
        )

    # Interne implementatie van run (leesbaarder)
    def _run_impl(self,
                  url, model_choice, model_override,
                  keep_alive, keep_alive_unit,
                  system_prompt, prompt,
                  temperature, num_predict, mirostat, top_k, top_p, repeat_penalty,
                  thinking,
                  use_knowledge_base, knowledge_base_dir, kb_max_chunks, kb_chunk_chars, kb_overlap_chars,
                  use_live_search, wiki_lang, search_query_override, search_max_results, search_timeout_s, disable_primary_live, force_context_if_empty, enhanced_live_fallbacks,
                  use_multi_api_router, use_weather_apis, use_nature_apis, use_finance_apis, use_news_apis, use_general_apis, use_media_apis, use_scraping_fallback,
                  translate_before_api, translate_back_results, language_override,
                  max_context_chars,
                  image_search_provider, image_max_results, unsplash_key, bing_key, pexels_key,
                  images_b64_json, optional_image_b64, batch_image_paths,
                  context_messages_json, list_models_on_run, detect_multimodal,
                  brave_key, serper_key, google_cse_key, google_cse_cx,
                  api_timeout_override_s, debug,
                  optional_image_input=None):

        numbered_sources: List[Dict[str, Any]] = []
        base_url = (url or "").rstrip("/")
        model = (model_override.strip() or model_choice or "").strip()

        if list_models_on_run:
            models = self._list_ollama_models(base_url, timeout=6)
            if debug:
                print(f"[AIO] Beschikbare modellen: {models or 'geen'}")

        is_multimodal = self._is_probably_multimodal(base_url, model, allow_probe=True) if detect_multimodal else False

        images_b64_list, user_images_info = [], []

        # JSON array van base64-afbeeldingen
        if images_b64_json and images_b64_json.strip():
            try:
                arr = json.loads(images_b64_json)
                if isinstance(arr, list):
                    for it in arr:
                        if isinstance(it, str) and len(it) > 24:
                            images_b64_list.append(it)
                            user_images_info.append("json image")
            except Exception as e:
                if debug:
                    print(f"[AIO] images_b64_json parse error: {e}")

        # Losse base64-afbeelding
        if optional_image_b64 and optional_image_b64.strip():
            if is_multimodal:
                images_b64_list.append(optional_image_b64.strip())
                user_images_info.append("optional image b64")
            elif debug:
                print("[AIO] Optionele base64-afbeelding genegeerd (model is niet multimodaal)")

        # Optionele IMAGE input
        self._process_optional_image_input(optional_image_input, is_multimodal, images_b64_list, user_images_info, debug=debug)

        # Batch image paths
        try:
            arr = json.loads(batch_image_paths)
            if isinstance(arr, list):
                for path in arr:
                    if isinstance(path, str) and os.path.isfile(path):
                        b64 = self._image_to_b64_from_path(path)
                        images_b64_list.append(b64)
                        user_images_info.append(f"batch image: {os.path.basename(path)}")
        except Exception as e:
            if debug:
                print(f"[AIO] batch_image_paths parse error: {e}")

        # Prompt vertalen naar Engels voor API's
        prompt_translated, lang_detected, was_translated = self._translate_if_needed(
            prompt, target="en", enable=translate_before_api, debug=debug
        )

        # Knowledge base
        kb_hits = []
        if use_knowledge_base and knowledge_base_dir.strip():
            self._ensure_kb(knowledge_base_dir.strip(), kb_chunk_chars, kb_overlap_chars, debug=debug)
            kb_hits = self._kb_search(prompt_translated, k=kb_max_chunks)

        # Live search (basic of enhanced)
        live_snips, live_sources, related_terms = [], [], []
        if use_live_search and not disable_primary_live:
            q = search_query_override.strip() or prompt_translated
            if enhanced_live_fallbacks:
                live_snips, live_sources, related_terms = self._collect_live_enhanced(
                    q, max_results=search_max_results, timeout=search_timeout_s, wiki_lang=wiki_lang,
                    brave_key=brave_key, serper_key=serper_key, google_cse_key=google_cse_key, google_cse_cx=google_cse_cx,
                    debug=debug
                )
            else:
                live_snips, live_sources, related_terms = self._collect_live_once(
                    q, max_results=search_max_results, timeout=search_timeout_s, wiki_lang=wiki_lang, debug=debug
                )

        # Multi-API router (gratis eerst)
        api_snips = []
        if use_multi_api_router:
            api_snips = self._multi_api_router2(
                prompt_translated, lang="en", timeout=search_timeout_s,
                use_weather=use_weather_apis, use_nature=use_nature_apis,
                use_finance=use_finance_apis, use_news=use_news_apis,
                use_general=use_general_apis, use_media=use_media_apis,
                use_scrape=use_scraping_fallback, debug=debug
            )

        # Resultaten terugvertalen
        if translate_back_results and lang_detected and lang_detected != "en":
            live_snips, _ = self._translate_back_if_needed(live_snips, target_lang=lang_detected, enable=True, debug=debug)
            api_snips, _ = self._translate_back_if_needed(api_snips, target_lang=lang_detected, enable=True, debug=debug)

        # Image search
        image_items = self._image_search(
            image_search_provider, prompt_translated, image_max_results,
            timeout=search_timeout_s,
            keys={"unsplash": unsplash_key, "bing": bing_key, "pexels": pexels_key},
            debug=debug
        )

        # Context bouwen (v2: apart kopje voor Multi-API)
        context_block, numbered_sources = self._build_context_v2(
            kb_hits, live_snips, api_snips, live_sources, image_items, user_images_info, budget_chars=max_context_chars
        )
        if not context_block and force_context_if_empty:
            context_block = "Geen externe context gevonden. Beantwoord de vraag toch zo goed en kort mogelijk."

        # Messages bouwen
        messages = self._build_messages(
            system_prompt, prompt_translated, context_messages_json, context_block,
            thinking=thinking, multimodal=is_multimodal, images_b64_list=images_b64_list,
            answer_lang=(language_override or lang_detected or "en")
        )

        # Payload voor Ollama
        keep_unit = 'h' if keep_alive_unit == 'hours' else 'm'
        payload = {
            "model": model,
            "stream": False,
            "keep_alive": f"{keep_alive}{keep_unit}",
            "options": {
                "temperature": temperature,
                "num_predict": num_predict,
                "mirostat": mirostat,
                "top_k": top_k,
                "top_p": top_p,
                "repeat_penalty": repeat_penalty
            },
            "messages": messages
        }

        # Timeout override (optioneel)
        chat_timeout = max(30, min(180, search_timeout_s * 12))
        if isinstance(api_timeout_override_s, int) and api_timeout_override_s > 0:
            chat_timeout = api_timeout_override_s

        # Call Ollama chat API met fallback naar generate
        try:
            r = requests.post(f"{base_url}/api/chat", json=payload, timeout=chat_timeout)
            r.raise_for_status()
            data = r.json()
        except Exception as e:
            if debug:
                print(f"[AIO] /api/chat fout: {e}")
            try:
                result_text, sources = self.ollama_generate_v2(
                    base_url=url,
                    model=model,
                    system=system_prompt,
                    prompt=prompt,
                    options=payload["options"],
                    context=None,
                    images_b64=images_b64_list if detect_multimodal else None,
                    keep_alive=keep_alive,
                    keep_alive_unit=keep_alive_unit,
                    debug=debug
                )
                data = result_text
                numbered_sources = sources
            except Exception as e2:
                data = f"[AIO] Fout bij ophalen van antwoord (fallback): {e2}"

        # Thinking/Final via parser
        thinking_output, result_text = self._extract_thinking_and_result(
            data, thinking_enabled=thinking
        )

        # Sanitize (filter bekende rommel)
        thinking_output = self._sanitize_model_output(thinking_output)
        result_text = self._sanitize_model_output(result_text)

        # Sources JSON
        sources_json = json.dumps(numbered_sources, indent=2, ensure_ascii=False)

        return (thinking_output, result_text, sources_json)

    # HTTP helpers
    def _http_get_json(self, url, params=None, timeout=10, headers=None):
        headers = headers or _ua()
        r = requests.get(url, params=params, timeout=timeout, headers=headers)
        r.raise_for_status()
        return r.json()

    def _http_get_text(self, url, params=None, timeout=10, headers=None):
        headers = headers or _ua()
        r = requests.get(url, params=params, timeout=timeout, headers=headers)
        r.raise_for_status()
        return r.text

    def _http_post_json(self, url, data=None, timeout=10, headers=None):
        headers = headers or _ua()
        r = requests.post(url, json=data, timeout=timeout, headers=headers)
        r.raise_for_status()
        return r.json()

    # Ollama model helpers
    def _list_ollama_models(self, base_url, timeout=6):
        try:
            data = self._http_get_json(f"{base_url}/api/tags", timeout=timeout)
            return [m.get("name") for m in data.get("models", []) if isinstance(m, dict) and m.get("name")]
        except Exception as e:
            print(f"[AIO] Modellees fout: {e}")
            return []

    def _show_ollama_model(self, base_url, model, timeout=6):
        try:
            return self._http_get_json(f"{base_url}/api/show", params={"name": model}, timeout=timeout)
        except Exception:
            return None

    def _is_probably_multimodal(self, base_url, model, allow_probe=True):
        name = (model or "").lower()
        if any(k in name for k in ["-vl", " vision", "vision-", "vl-", "mm", "multimodal", "llava", "qwen-vl", "minicpm-v"]):
            return True
        if not allow_probe:
            return False
        info = self._show_ollama_model(base_url, model)
        if not info:
            return False
        js = json.dumps(info).lower()
        return any(tag in js for tag in ["vision","images","mmproj","clip","q_former"])

    # KB (TF-IDF)
    def _kb_signature(self, kb_dir, chunk, overlap):
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
        if sig != self._kb_cache_sig:
            self._kb_cache_sig = sig
            self._build_kb_index(kb_dir, chunk_chars, overlap_chars, debug=debug)

    def _kb_search(self, query, k=6):
        if not self._kb_ready or not self._kb_chunks:
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

    # Live: DuckDuckGo + Wikipedia
    def _duckduckgo_instant(self, query, timeout=10):
        try:
            return self._http_get_json(
                "https://api.duckduckgo.com/",
                params={"q": query, "format": "json", "no_redirect": "1", "no_html": "1"},
                timeout=timeout
            )
        except Exception as e:
            print(f"[AIO] DDG fout: {e}")
            return None

    def _wiki_opensearch(self, query, limit=3, timeout=10, lang="en"):
        try:
            return self._http_get_json(
                f"https://{lang}.wikipedia.org/w/api.php",
                params={
                    "action": "opensearch",
                    "search": query,
                    "limit": str(limit),
                    "namespace": "0",
                    "format": "json"
                },
                timeout=timeout
            )
        except Exception as e:
            print(f"[AIO] Wikipedia OS fout: {e}")
            return None

    def _wiki_summary(self, title, timeout=10, lang="en"):
        try:
            safe = quote_plus(title.replace(" ", "_"))
            data = self._http_get_json(
                f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/{safe}",
                timeout=timeout
            )
            return {
                "title": data.get("title") or title,
                "extract": data.get("extract") or "",
                "url": data.get("content_urls", {}).get("desktop", {}).get("page")
                       or f"https://{lang}.wikipedia.org/wiki/{safe}"
            }
        except Exception as e:
            print(f"[AIO] Wikipedia summary fout: {e}")
            return None

    def _rank_live_snippet(self, txt):
        if not txt:
            return 0
        score = min(len(txt), 800)
        for t in ["today","month","year","update","announced","results","news",
                  "vandaag","maand","jaar","nieuw","aangekondigd","resultaten"]:
            if t in txt.lower():
                score += 150
        return score

    def _collect_live_once(self, query, max_results=5, timeout=10, wiki_lang="en", debug=False):
        sources, snippets, related = [], [], []
        ddg = None if query.strip() == "" else self._duckduckgo_instant(query, timeout=timeout)
        if ddg:
            abs_txt = (ddg.get("AbstractText") or "").strip()
            abs_url = (ddg.get("AbstractURL") or "").strip()
            if abs_txt:
                snippets.append(abs_txt)
                if abs_url:
                    sources.append({"type": "duckduckgo", "title": "Instant Answer", "url": abs_url})
            for rt in (ddg.get("RelatedTopics") or [])[:max_results]:
                if isinstance(rt, dict):
                    txt = (rt.get("Text") or "").strip()
                    url = rt.get("FirstURL")
                    if txt:
                        snippets.append(txt)
                        head = txt.split(" - ")[0].strip()
                        if head:
                            related.append(head)
                    if url:
                        sources.append({"type": "duckduckgo", "title": "Related", "url": url})

        wiki = self._wiki_opensearch(query, limit=max_results, timeout=timeout, lang=wiki_lang)
        if isinstance(wiki, list) and len(wiki) >= 4:
            titles, urls = wiki[1] or [], wiki[3] or []
            for i, t in enumerate(titles[:max_results]):
                s = self._wiki_summary(t, timeout=timeout, lang=wiki_lang)
                if s and s.get("extract"):
                    snippets.append(f"{s['title']}: {s['extract']}")
                    sources.append({
                        "type": "wikipedia",
                        "title": s.get("title") or t,
                        "url": s.get("url") or (urls[i] if i < len(urls) else None)
                    })

        seen, dedup_sources = set(), []
        for s in sources:
            u = s.get("url")
            if not u or u in seen:
                continue
            dedup_sources.append(s)
            seen.add(u)

        sn_sorted = sorted((x for x in snippets if x.strip()), key=self._rank_live_snippet, reverse=True)
        if debug:
            print(f"[AIO] Live primary: {len(sn_sorted)} snippets, {len(dedup_sources)} sources")
        return sn_sorted, dedup_sources, related

    # Extra live-search providers (optioneel via keys)
    def _search_brave(self, query, key, max_results=5, timeout=8):
        if not key:
            return [], []
        try:
            r = requests.get(
                "https://api.search.brave.com/res/v1/web/search",
                params={"q": query, "count": max_results},
                headers={**_ua(), "Accept": "application/json", "X-Subscription-Token": key},
                timeout=timeout
            )
            r.raise_for_status()
            data = r.json()
            snips, srcs = [], []
            for it in (data.get("web", {}).get("results", []) or [])[:max_results]:
                title = it.get("title") or ""
                desc = it.get("description") or ""
                url = it.get("url") or ""
                if desc:
                    snips.append(f"{title}: {desc}" if title else desc)
                if url:
                    srcs.append({"type": "brave", "title": title or url, "url": url})
            return snips, srcs
        except Exception:
            return [], []

    def _search_serper(self, query, key, max_results=5, timeout=8):
        if not key:
            return [], []
        try:
            r = requests.post(
                "https://google.serper.dev/search",
                json={"q": query, "num": max_results},
                headers={**_ua(), "X-API-KEY": key, "Content-Type": "application/json"},
                timeout=timeout
            )
            r.raise_for_status()
            data = r.json()
            snips, srcs = [], []
            for it in (data.get("organic", []) or [])[:max_results]:
                title = it.get("title") or ""
                desc = it.get("snippet") or ""
                url = it.get("link") or ""
                if desc:
                    snips.append(f"{title}: {desc}" if title else desc)
                if url:
                    srcs.append({"type": "serper", "title": title or url, "url": url})
            return snips, srcs
        except Exception:
            return [], []

    def _search_google_cse(self, query, key, cx, max_results=5, timeout=8):
        if not key or not cx:
            return [], []
        try:
            r = requests.get(
                "https://www.googleapis.com/customsearch/v1",
                params={"q": query, "key": key, "cx": cx, "num": max_results},
                headers=_ua(), timeout=timeout
            )
            r.raise_for_status()
            data = r.json()
            snips, srcs = [], []
            for it in (data.get("items", []) or [])[:max_results]:
                title = it.get("title") or ""
                desc = it.get("snippet") or ""
                url = it.get("link") or ""
                if desc:
                    snips.append(f"{title}: {desc}" if title else desc)
                if url:
                    srcs.append({"type": "google_cse", "title": title or url, "url": url})
            return snips, srcs
        except Exception:
            return [], []

    # Enhanced live search: eerst DDG/Wiki, daarna (optioneel) Brave/Serper/Google CSE
    def _collect_live_enhanced(self, query, max_results=5, timeout=10, wiki_lang="en",
                               brave_key="", serper_key="", google_cse_key="", google_cse_cx="",
                               debug=False):
        snips, srcs, related = self._collect_live_once(query, max_results=max_results, timeout=timeout, wiki_lang=wiki_lang, debug=debug)
        if snips and srcs:
            return snips, srcs, related

        extra_snips, extra_srcs = [], []
        s1, c1 = self._search_brave(query, key=brave_key, max_results=max_results, timeout=timeout)
        extra_snips += s1; extra_srcs += c1
        s2, c2 = self._search_serper(query, key=serper_key, max_results=max_results, timeout=timeout)
        extra_snips += s2; extra_srcs += c2
        s3, c3 = self._search_google_cse(query, key=google_cse_key, cx=google_cse_cx, max_results=max_results, timeout=timeout)
        extra_snips += s3; extra_srcs += c3

        extra_snips = [x for x in extra_snips if x and x.strip()]
        extra_srcs_seen, extra_srcs_dedup = set(), []
        for s in extra_srcs:
            u = s.get("url")
            if not u or u in extra_srcs_seen:
                continue
            extra_srcs_dedup.append(s)
            extra_srcs_seen.add(u)

        if debug:
            print(f"[AIO] Live enhanced fallback: {len(extra_snips)} snippets, {len(extra_srcs_dedup)} sources")
        return (snips or extra_snips), (srcs or extra_srcs_dedup), related

    # Image search (keys optioneel)
    def _image_search(self, provider, query, max_results, timeout, keys, debug=False):
        provider = (provider or "off").lower()
        if provider == "off" or not query:
            return []
        try:
            if provider == "duckduckgo":
                headers = {"User-Agent": "Mozilla/5.0", "Referer": "https://duckduckgo.com/"}
                s = requests.Session()
                s.get("https://duckduckgo.com/", headers=headers, timeout=5)
                r = s.get("https://duckduckgo.com/i.js",
                          params={"q": query, "o": "json"}, headers=headers, timeout=timeout)
                r.raise_for_status()
                data = r.json()
                out = []
                for it in data.get("results", [])[:max_results]:
                    out.append({
                        "title": it.get("title") or "Image",
                        "image": it.get("image"),
                        "thumbnail": it.get("thumbnail"),
                        "url": it.get("url") or it.get("source")
                    })
                return out

            if provider == "unsplash":
                key = (keys or {}).get("unsplash") or ""
                if not key:
                    return []
                r = requests.get("https://api.unsplash.com/search/photos",
                                 params={"query": query, "per_page": max_results},
                                 headers={"Authorization": f"Client-ID {key}", "Accept-Version": "v1"},
                                 timeout=timeout)
                r.raise_for_status()
                data = r.json()
                out = []
                for it in data.get("results", [])[:max_results]:
                    out.append({
                        "title": it.get("description") or it.get("alt_description") or "Unsplash image",
                        "image": it.get("urls", {}).get("regular"),
                        "thumbnail": it.get("urls", {}).get("thumb"),
                        "url": it.get("links", {}).get("html")
                    })
                return out

            if provider == "bing":
                key = (keys or {}).get("bing") or ""
                if not key:
                    return []
                r = requests.get("https://api.bing.microsoft.com/v7.0/images/search",
                                 params={"q": query, "count": max_results},
                                 headers={"Ocp-Apim-Subscription-Key": key},
                                 timeout=timeout)
                r.raise_for_status()
                data = r.json()
                out = []
                for it in data.get("value", [])[:max_results]:
                    out.append({
                        "title": it.get("name") or "Bing image",
                        "image": it.get("contentUrl"),
                        "thumbnail": it.get("thumbnailUrl"),
                        "url": it.get("hostPageUrl")
                    })
                return out

            if provider == "pexels":
                key = (keys or {}).get("pexels") or ""
                if not key:
                    return []
                r = requests.get("https://api.pexels.com/v1/search",
                                 params={"query": query, "per_page": max_results},
                                 headers={"Authorization": key},
                                 timeout=timeout)
                r.raise_for_status()
                data = r.json()
                out = []
                for it in data.get("photos", [])[:max_results]:
                    out.append({
                        "title": it.get("alt") or "Pexels image",
                        "image": it.get("src", {}).get("large"),
                        "thumbnail": it.get("src", {}).get("tiny"),
                        "url": it.get("url")
                    })
                return out

        except Exception as e:
            print(f"[AIO] Image search fout ({provider}): {e}")
            return []
        return []

    # Translate helpers (DeepL optioneel via env var)
    def _detect_language_simple(self, text):
        s = (text or "").strip()
        if not s:
            return "en"
        if re.search(r"[àáâäèéêëìíîïòóôöùúûüçñß]", s, flags=re.I) or \
           re.search(r"\b(het|de|een|weer|vandaag|morgen|kikker)\b", s, flags=re.I):
            return "nl"
        return "en"

    def _libre_detect(self, text, timeout=6):
        try:
            r = requests.post("https://libretranslate.com/detect",
                              data={"q": text},
                              timeout=timeout,
                              headers={**_ua(), "Accept": "application/json"})
            r.raise_for_status()
            arr = r.json()
            if isinstance(arr, list) and arr:
                return arr[0].get("language", "en")
        except Exception:
            pass
        return None

    def _translate_deepl(self, text, target="EN", timeout=8):
        api_key = os.environ.get("DEEPL_API_KEY", "").strip()
        if not api_key or not text:
            return None
        try:
            r = requests.post(
                "https://api-free.deepl.com/v2/translate",
                data={"auth_key": api_key, "text": text, "target_lang": target.upper()},
                timeout=timeout,
                headers=_ua()
            )
            r.raise_for_status()
            data = r.json()
            trs = data.get("translations", [])
            if trs:
                return trs[0].get("text")
        except Exception:
            return None
        return None

    def _translate_libre(self, text, target="en", timeout=8):
        try:
            r = requests.post("https://libretranslate.com/translate",
                              data={"q": text, "source": "auto", "target": target, "format": "text"},
                              timeout=timeout,
                              headers={**_ua(), "Accept": "application/json"})
            r.raise_for_status()
            data = r.json()
            return data.get("translatedText")
        except Exception:
            return None

    def _translate_lingva(self, text, target="en", source="auto", timeout=8):
        try:
            src = source if source != "auto" else "auto"
            url = f"https://lingva.ml/api/v1/{src}/{target}/{quote_plus(text)}"
            r = requests.get(url, headers=_ua(), timeout=timeout)
            r.raise_for_status()
            data = r.json()
            return data.get("translation")
        except Exception:
            return None

    def _translate_mymemory(self, text, target="en", timeout=8):
        try:
            url = "https://api.mymemory.translated.net/get"
            r = requests.get(url, params={"q": text, "langpair": f"auto|{target}"},
                             headers=_ua(), timeout=timeout)
            r.raise_for_status()
            data = r.json()
            return data.get("responseData", {}).get("translatedText")
        except Exception:
            return None

    def _translate_if_needed(self, text, target="en", enable=True, debug=False):
        if not enable:
            return text, None, False
        src_guess = self._libre_detect(text) or self._detect_language_simple(text)
        if debug:
            print(f"[AIO] Lang detect: {src_guess}")
        if (src_guess or "en").lower().startswith(target.lower()):
            return text, src_guess or "en", False

        out = self._translate_deepl(text, target=target) or \
              self._translate_libre(text, target=target) or \
              self._translate_lingva(text, target=target, source="auto") or \
              self._translate_mymemory(text, target=target)

        if debug:
            used = "DeepL/Libre/Lingva/MyMemory" if out else "none"
            print(f"[AIO] Translate used: {used}")
        return (out or text), (src_guess or "auto"), bool(out)

    def _translate_back_if_needed(self, snippets, target_lang, enable=True, debug=False):
        if not enable or not snippets or not target_lang:
            return snippets, None
        back = []
        used = None
        for s in snippets:
            t = self._translate_deepl(s, target=target_lang) \
                or self._translate_libre(s, target=target_lang) \
                or self._translate_lingva(s, target=target_lang, source="en") \
                or self._translate_mymemory(s, target=target_lang)
            if t and not used:
                used = "DeepL/Libre/Lingva/MyMemory"
            back.append(t or s)
        if debug:
            print(f"[AIO] Translate back used: {used or 'none'}")
        return back, used

    # Query cleaner: haal plaatsnaam uit vraagzin
    def _clean_location_query(self, q: str) -> str:
        if not q:
            return ""
        s = q.strip()
        tokens = re.findall(r"[A-Z][a-zA-ZÀ-ÖØ-öø-ÿ\-']+", s)
        if tokens:
            return " ".join(tokens[:3])
        m = re.search(r"in\s+([A-Za-zÀ-ÖØ-öø-ÿ\-'\s]+)", s, flags=re.I)
        if m:
            return m.group(1).strip().split("?")[0]
        return s

    # Weather wrappers met cleaned query (oude functies blijven bestaan)
    def _weather_open_meteo2(self, query, timeout=8):
        return self._weather_open_meteo(self._clean_location_query(query), timeout=timeout)

    def _weather_wttr2(self, query, timeout=8):
        try:
            loc = self._clean_location_query(query)
            r = requests.get(f"https://wttr.in/{quote_plus(loc)}?format=3", timeout=timeout)
            r.raise_for_status()
            return f"wttr.in: {r.text.strip()}"
        except Exception as e:
            print(f"[AIO] wttr.in fout: {e}")
            return None

    def _weather_openaq2(self, query, timeout=8):
        try:
            city = self._clean_location_query(query)
            r = requests.get("https://api.openaq.org/v2/latest",
                             params={"limit": 1, "page": 1, "offset": 0, "sort": "desc",
                                     "radius": 10000, "country_id": "NL", "city": city},
                             timeout=timeout)
            r.raise_for_status()
            data = r.json()
            m = data.get("results", [{}])[0].get("measurements", [])
            if not m:
                return None
            out = ", ".join(f"{x['parameter']}: {x['value']} {x['unit']}" for x in m[:3])
            return f"OpenAQ luchtkwaliteit: {out}"
        except Exception as e:
            print(f"[AIO] OpenAQ fout: {e}")
            return None

    # Multi-API router v2: gratis eerst
    def _multi_api_router2(self, query, lang="en", timeout=8,
                           use_weather=True, use_nature=True, use_finance=True,
                           use_news=True, use_general=True, use_media=True,
                           use_scrape=False, debug=False):
        out = []
        if use_weather:
            for fn in [self._weather_wttr2, self._weather_open_meteo2, self._weather_openaq2]:
                r = fn(query, timeout=timeout)
                if r:
                    out.append(r)
        if use_nature:
            for fn in [self._nature_gbif_species, self._nature_catfact, self._nature_dogceo]:
                r = fn(query, timeout=timeout)
                if r:
                    out.append(r)
        if use_finance:
            for fn in [self._finance_coingecko, self._finance_exchangerate]:
                r = fn(query, timeout=timeout)
                if r:
                    out.append(r)
        if use_news:
            r = self._news_spaceflight(query, timeout=timeout)
            if r:
                out.append(r)
        if use_media:
            r = self._art_chicago(query, timeout=timeout)
            if r:
                out.append(r)
        if use_general and not out:
            r = self._scrape_fallback(query, timeout=timeout) if use_scrape else None
            if r:
                out.append(r)
        if debug:
            print(f"[AIO] Multi-API router output: {len(out)} items")
        return out

    # Context builder v2: scheid live en multi-API
    def _build_context_v2(self, kb_hits, live_snips, api_snips, live_sources, image_items, user_images_info, budget_chars=3600):
        lines, all_sources = [], []

        kb_lines = []
        for ch in kb_hits:
            kb_lines.append(f"{ch['title']}: {_clamp(ch['text'], 600)}")
            all_sources.append({"type": "kb", "title": ch["title"], "url": ch["path"], "extra": None})

        live_lines = [_clamp(s, 600) for s in (live_snips or [])]
        api_lines = [_clamp(s, 600) for s in (api_snips or [])]

        img_lines = []
        for it in image_items:
            cap = f"Image: {it.get('title', 'Image')} ({it.get('url', '')})"
            img_lines.append(_clamp(cap, 220))
            all_sources.append({"type": "image", "title": it.get("title") or "Image", "url": it.get("url"), "extra": it})

        usr_img_lines = []
        if user_images_info:
            usr_img_lines.append(f"User provided images: {len(user_images_info)} item(s).")
            for i, it in enumerate(user_images_info[:6], 1):
                usr_img_lines.append(f"- Image {i}: {_clamp(it, 140)}")

        seen, dedup_sources = set(), []
        for s in all_sources + (live_sources or []):
            key = (s.get("type"), s.get("title"), s.get("url"))
            if not s.get("url") or key in seen:
                continue
            dedup_sources.append(s)
            seen.add(key)

        kb_budget = int(budget_chars * 0.38)
        live_budget = int(budget_chars * 0.32)
        api_budget = int(budget_chars * 0.18)
        img_budget = int(budget_chars * 0.06)
        usr_budget = budget_chars - kb_budget - live_budget - api_budget - img_budget

        def take(items, budget):
            out, used = [], 0
            for x in items:
                if used + len(x) + 2 > budget:
                    break
                out.append(x)
                used += len(x) + 2
            return out

        kb_take = take(kb_lines, kb_budget)
        live_take = take(live_lines, live_budget)
        api_take = take(api_lines, api_budget)
        img_take = take(img_lines, img_budget)
        usr_take = take(usr_img_lines, usr_budget)

        if kb_take:
            lines.append("Knowledge base context:")
            for m in kb_take:
                lines.append(f"- {m}")
            lines.append("")
        if live_take:
            lines.append("Retrieved context (live search):")
            for m in live_take:
                lines.append(f"- {m}")
            lines.append("")
        if api_take:
            lines.append("Multi-API context:")
            for m in api_take:
                lines.append(f"- {m}")
            lines.append("")
        if img_take:
            lines.append("Image context (captions):")
            for m in img_take:
                lines.append(f"- {m}")
            lines.append("")
        if usr_take:
            lines.append("User images (text-only mode):")
            for m in usr_take:
                lines.append(f"- {m}")
            lines.append("")

        numbered, n = [], 1
        if dedup_sources:
            lines.append("Sources (numbered):")
            for s in dedup_sources:
                title = s.get("title") or s.get("url") or "Source"
                url = s.get("url") or ""
                lines.append(f"[{n}] {title} — {url}")
                numbered.append({"n": n, **s})
                n += 1

        context_block = "\n".join(l for l in lines if l is not None).strip()
        return context_block, numbered

    # Message builder
    def _build_messages(self, system_prompt, user_prompt, context_messages_json, context_block, thinking,
                        multimodal, images_b64_list, answer_lang=None):
        msgs = []
        sys = (system_prompt or "").strip()
        if sys:
            if answer_lang:
                sys += f"\nBeantwoord in taalcode '{answer_lang}' tenzij de gebruiker anders vraagt."
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
                msgs.append({"role": "system", "content": f"Note: failed to parse previous context: {e}"})

        if context_block is not None:
            if context_block:
                msgs.append({"role": "system", "content": "Gebruik de volgende context en citeer als [n] waar van toepassing.\n\n" + context_block})
            else:
                msgs.append({"role": "system", "content": "Opmerking: contextblok is leeg; geef geen standaard 'geen live data'-antwoord."})

        user_content = user_prompt
        if thinking:
            user_content = "Geef eerst je denkproces tussen <think>...</think> en daarna het eindresultaat tussen <final>...</final>.\n\n" + user_prompt

        if multimodal and images_b64_list:
            msgs.append({"role": "user", "content": user_content, "images": images_b64_list})
        else:
            msgs.append({"role": "user", "content": user_content})
        return msgs

    # IMAGE utilities
    def _image_to_b64_from_ndarray(self, img_nd):
        arr = np.array(img_nd)
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
        return base64.b64encode(buf.getvalue()).decode("utf-8")

    def _image_to_b64_from_path(self, path):
        with Image.open(path) as im:
            im = im.convert("RGB")
            buf = io.BytesIO()
            im.save(buf, format="PNG")
            return base64.b64encode(buf.getvalue()).decode("utf-8")

    # Weather APIs (legacy, blijven bestaan)
    def _weather_open_meteo(self, query, timeout=8):
        try:
            r = requests.get("https://geocoding-api.open-meteo.com/v1/search",
                             params={"name": query, "count": 1}, timeout=timeout)
            r.raise_for_status()
            geo = r.json()
            if not geo.get("results"):
                return None
            lat = geo["results"][0]["latitude"]
            lon = geo["results"][0]["longitude"]
            r2 = requests.get("https://api.open-meteo.com/v1/forecast",
                              params={"latitude": lat, "longitude": lon,
                                      "current_weather": "true", "timezone": "auto"},
                              timeout=timeout)
            r2.raise_for_status()
            data = r2.json()
            cw = data.get("current_weather", {})
            return f"Open-Meteo: {cw.get('temperature')}°C, windsnelheid {cw.get('windspeed')} km/u, code {cw.get('weathercode')}"
        except Exception as e:
            print(f"[AIO] Open-Meteo fout: {e}")
            return None

    def _weather_wttr(self, query, timeout=8):
        try:
            r = requests.get(f"https://wttr.in/{quote_plus(query)}?format=3", timeout=timeout)
            r.raise_for_status()
            return f"wttr.in: {r.text.strip()}"
        except Exception as e:
            print(f"[AIO] wttr.in fout: {e}")
            return None

    def _weather_openaq(self, query, timeout=8):
        try:
            r = requests.get("https://api.openaq.org/v2/latest",
                             params={"limit": 1, "page": 1, "offset": 0, "sort": "desc",
                                     "radius": 10000, "country_id": "NL", "city": query},
                             timeout=timeout)
            r.raise_for_status()
            data = r.json()
            m = data.get("results", [{}])[0].get("measurements", [])
            if not m:
                return None
            out = ", ".join(f"{x['parameter']}: {x['value']} {x['unit']}" for x in m[:3])
            return f"OpenAQ luchtkwaliteit: {out}"
        except Exception as e:
            print(f"[AIO] OpenAQ fout: {e}")
            return None

    # Nature APIs
    def _nature_gbif_species(self, query, timeout=8):
        try:
            r = requests.get("https://api.gbif.org/v1/species/search",
                             params={"q": query, "limit": 1}, timeout=timeout)
            r.raise_for_status()
            data = r.json()
            if not data.get("results"):
                return None
            sp = data["results"][0]
            return f"GBIF soort: {sp.get('scientificName')} ({sp.get('canonicalName')}) — rank: {sp.get('rank')}"
        except Exception as e:
            print(f"[AIO] GBIF fout: {e}")
            return None

    def _nature_catfact(self, query, timeout=6):
        try:
            r = requests.get("https://catfact.ninja/fact", timeout=timeout)
            r.raise_for_status()
            data = r.json()
            return f"CatFact: {data.get('fact')}"
        except Exception as e:
            print(f"[AIO] CatFact fout: {e}")
            return None

    def _nature_dogceo(self, query, timeout=6):
        try:
            r = requests.get("https://dog.ceo/api/breeds/image/random", timeout=timeout)
            r.raise_for_status()
            data = r.json()
            return f"DogCEO afbeelding: {data.get('message')}"
        except Exception as e:
            print(f"[AIO] DogCEO fout: {e}")
            return None

    # Finance APIs
    def _finance_coingecko(self, query, timeout=6):
        coin = (query or "bitcoin").strip().lower()
        try:
            r = requests.get("https://api.coingecko.com/api/v3/simple/price",
                             params={"ids": coin, "vs_currencies": "eur"}, timeout=timeout)
            r.raise_for_status()
            data = r.json()
            eur = data.get(coin, {}).get("eur")
            return f"CoinGecko: {coin} prijs is €{eur}" if eur else None
        except Exception as e:
            print(f"[AIO] CoinGecko fout: {e}")
            return None

    def _finance_exchangerate(self, query, timeout=6):
        base, target = ("USD", "EUR")
        try:
            r = requests.get(f"https://open.er-api.com/v6/latest/{base}", timeout=timeout)
            r.raise_for_status()
            data = r.json()
            rate = data.get("rates", {}).get(target)
            return f"ExchangeRate: 1 {base} = {rate} {target}" if rate else None
        except Exception as e:
            print(f"[AIO] ExchangeRate fout: {e}")
            return None

    # News API
    def _news_spaceflight(self, query, timeout=6):
        try:
            r = requests.get("https://api.spaceflightnewsapi.net/v4/articles", timeout=timeout)
            r.raise_for_status()
            data = r.json()
            out = []
            for a in data.get("results", [])[:3]:
                out.append(f"{a.get('title')}: {a.get('summary')}")
            return " | ".join(out) if out else None
        except Exception as e:
            print(f"[AIO] Spaceflight News fout: {e}")
            return None

    # Art API
    def _art_chicago(self, query, timeout=6):
        try:
            r = requests.get("https://api.artic.edu/api/v1/artworks/search",
                             params={"q": query, "limit": 2}, timeout=timeout)
            r.raise_for_status()
            data = r.json()
            out = []
            for a in data.get("data", []):
                title = a.get('title')
                artist = a.get('artist_display')
                if title or artist:
                    out.append(f"{title} door {artist}".strip())
            return " | ".join(out) if out else None
        except Exception as e:
            print(f"[AIO] Art Institute fout: {e}")
            return None

    # Scraping fallback
    def _scrape_fallback(self, query, timeout=8):
        try:
            r = requests.get(
                "https://api.duckduckgo.com/",
                params={"q": query, "format": "json", "no_redirect": "1", "no_html": "1"},
                timeout=timeout
            )
            r.raise_for_status()
            data = r.json()
            txt = data.get("AbstractText") or ""
            return txt.strip() if txt else None
        except Exception as e:
            print(f"[AIO] Scrape fallback fout: {e}")
            return None

    # Legacy multi-API (blijft beschikbaar)
    def _multi_api_router(self, query, lang="en", timeout=8,
                          use_weather=True, use_nature=True, use_finance=True,
                          use_news=True, use_general=True, use_media=True,
                          use_scrape=False, debug=False):
        out = []
        if use_weather:
            for fn in [self._weather_open_meteo, self._weather_wttr, self._weather_openaq]:
                r = fn(query, timeout=timeout)
                if r:
                    out.append(r)
        if use_nature:
            for fn in [self._nature_gbif_species, self._nature_catfact, self._nature_dogceo]:
                r = fn(query, timeout=timeout)
                if r:
                    out.append(r)
        if use_finance:
            for fn in [self._finance_coingecko, self._finance_exchangerate]:
                r = fn(query, timeout=timeout)
                if r:
                    out.append(r)
        if use_news:
            r = self._news_spaceflight(query, timeout=timeout)
            if r:
                out.append(r)
        if use_media:
            r = self._art_chicago(query, timeout=timeout)
            if r:
                out.append(r)
        if use_general and not out:
            r = self._scrape_fallback(query, timeout=timeout) if use_scrape else None
            if r:
                out.append(r)
        if debug:
            print(f"[AIO] Multi-API router output: {len(out)} items")
        return out


# Node-registratie voor ComfyUI
NODE_CLASS_MAPPINGS = {
    "OllamaAIOUltimateMultiAPITranslatedImage": OllamaAIOUltimateMultiAPITranslatedImage
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "OllamaAIOUltimateMultiAPITranslatedImage": "Ollama AIO Ultimate (MultiAPI + KB + Translate + Image)"
}
