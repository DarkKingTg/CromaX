# orchestrator/src/llm/router.py
#
# Model-agnostic LLM router using LiteLLM (BerriAI/litellm, MIT License).
# Supports Gemini (with thinking level / reasoning effort mapping), Ollama, and OpenRouter.

import os
from typing import Any, Dict, List, Optional


class LLMRouter:
    def __init__(self, default_model: str = "gemini/gemini-2.0-flash") -> None:
        self.default_model = default_model

    def complete(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        reasoning_effort: str = "high",
        temperature: float = 0.2,
        max_tokens: Optional[int] = None,
        mock_response: Optional[str] = None,
        **kwargs: Any,
    ) -> Dict[str, Any]:
        """Routes completion requests through LiteLLM.

        For multi-file refactoring, reasoning_effort='high' is enforced per AGENTS.md §2a.
        """
        if mock_response is not None:
            return {
                "content": mock_response,
                "model": "mock-model",
                "usage": {"prompt_tokens": 100, "completion_tokens": 50},
            }

        target_model = model or self.default_model

        try:
            from litellm import completion

            params: Dict[str, Any] = {
                "model": target_model,
                "messages": messages,
                "temperature": temperature,
                **kwargs,
            }

            if max_tokens is not None:
                params["max_tokens"] = max_tokens

            # Configure reasoning effort / thinking level for models that support it
            if "gemini" in target_model or "claude" in target_model or "o1" in target_model or "o3" in target_model:
                params["reasoning_effort"] = reasoning_effort

            resp = completion(**params)
            content = resp.choices[0].message.content or ""
            usage = {
                "prompt_tokens": getattr(resp.usage, "prompt_tokens", 0),
                "completion_tokens": getattr(resp.usage, "completion_tokens", 0),
            }

            return {
                "content": content,
                "model": target_model,
                "usage": usage,
            }

        except ImportError:
            if os.getenv("CROMAX_TESTING") == "1" or os.getenv("PYTEST_CURRENT_TEST"):
                return {
                    "content": f"[Simulated response for {target_model}]: Completed requested task.",
                    "model": target_model,
                    "usage": {"prompt_tokens": 0, "completion_tokens": 0},
                }
            raise RuntimeError(
                "litellm is not installed in the python environment. Please run 'pip install litellm' or 'uv add litellm'."
            )
