"""
Generates a short, structured triage summary + suggested next action for a
delivery exception, using an LLM. This is the piece the triage-time metric
(app/../scripts/compute_metrics.py) is modeling: instead of an analyst
opening the PO, shipment, inventory, and supplier-email records separately,
they read one generated summary that already cross-references them.

Supports either Anthropic (Claude) or OpenAI, auto-detected from whichever
API key is set in the environment -- OPENAI_API_KEY takes priority if both
are present. Falls back to a deterministic, template-based summary if
neither is set, so the API is fully usable in a demo/local environment with
zero external calls.
"""
import json
import logging

from app.config import get_settings
from app.services import cache

logger = logging.getLogger("chainflow.llm")
settings = get_settings()

_provider = None  # "openai" | "anthropic" | None
_client = None

if settings.openai_api_key:
    try:
        from openai import OpenAI

        _client = OpenAI(api_key=settings.openai_api_key)
        _provider = "openai"
    except Exception as e:  # noqa: BLE001
        logger.warning("OpenAI client unavailable: %s", e)
elif settings.anthropic_api_key:
    try:
        import anthropic

        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
        _provider = "anthropic"
    except Exception as e:  # noqa: BLE001
        logger.warning("Anthropic client unavailable: %s", e)

SYSTEM_PROMPT = """You are ChainFlow's exception-triage assistant. Given a \
delivery exception and its related purchase order, shipment, and supplier \
email context, produce a thorough triage brief for a human operations \
analyst who has NOT already read the related records themselves.

Reference the specific details you were given -- supplier, carrier, ETA, \
cost center, related SKU, relevant supplier email content -- rather than \
generically restating the exception type. If a required field is missing, \
say so explicitly and note how it limits your confidence.

Respond ONLY with JSON of this exact shape, no prose, no markdown fences:
{"summary": "<4-6 sentence plain-English brief covering what happened, the \
relevant context pulled from the related PO/shipment/email records, and \
any likely business impact>",
 "suggested_action": "<one specific, detailed recommended next step -- name \
who should do what>",
 "confidence": <float 0.0-1.0, your confidence the suggested action is correct>}
"""


def _fallback_summary(context: dict) -> dict:
    """Deterministic, template-based stand-in used when no API key is
    configured. Pulls in whatever related PO/shipment/email context is
    already available so the brief is substantive even with zero external
    calls -- not just a restatement of the exception's own fields."""
    exc = context.get("exception", {})
    related = context.get("related", {})
    po = related.get("purchase_order") or {}
    shipment = related.get("shipment") or {}
    emails = related.get("supplier_emails") or []

    etype = exc.get("exception_type", "exception")
    severity = exc.get("severity", "unspecified severity")
    missing = exc.get("missing_fields") or []
    po_number = exc.get("po_number")
    shp_id = exc.get("shipment_id")
    related_sku = exc.get("related_sku")

    sentences = []

    opener = f"A {severity}-severity {etype.replace('_', ' ')} was detected"
    if po_number:
        opener += f" on {po_number}"
    if shp_id:
        opener += f" (shipment {shp_id})"
    sentences.append(opener + ".")

    if related_sku:
        sentences.append(f"The affected item is {related_sku}.")

    if po.get("supplier_id"):
        bit = f"This order was placed with supplier {po['supplier_id']}"
        if po.get("cost_center"):
            bit += f" against cost center {po['cost_center']}"
        sentences.append(bit + ".")

    ship_bits = []
    if shipment.get("carrier"):
        ship_bits.append(f"shipped via {shipment['carrier']}")
    if shipment.get("status"):
        ship_bits.append(f"currently marked '{shipment['status'].replace('_', ' ')}'")
    if shipment.get("eta"):
        ship_bits.append(f"with an ETA of {str(shipment['eta'])[:10]}")
    if ship_bits:
        sentences.append("The shipment is " + ", ".join(ship_bits) + ".")

    if emails:
        subj = emails[0].get("subject")
        if subj:
            sentences.append(f'A related supplier email ("{subj}") is on file and may contain additional context worth reviewing before deciding.')

    if missing:
        sentences.append(
            f"{len(missing)} required field(s) are missing on this record ({', '.join(missing)}), "
            "which limits how confidently this can be assessed."
        )

    summary = " ".join(sentences)

    if missing:
        action = f"Request the missing field(s) — {', '.join(missing)} — from the source system or supplier before making a final disposition."
        confidence = 0.5
    elif etype in ("damaged", "wrong_item", "quantity_mismatch"):
        action = "Escalate to the supplier quality team"
        if related_sku:
            action += f" regarding {related_sku}"
        action += " and hold related inventory pending inspection."
        confidence = 0.7
    elif etype == "late_arrival":
        action = "Notify downstream planning of the revised ETA and confirm there's no production impact."
        confidence = 0.75
    elif etype == "customs_hold":
        action = "Follow up with the customs broker for the specific documentation being requested and provide an updated commercial invoice if needed."
        confidence = 0.65
    elif etype == "missing_docs":
        action = "Request the missing compliance documentation from the supplier before this shipment can be reconciled or released."
        confidence = 0.65
    else:
        action = "Route to the standard ops review queue for manual disposition."
        confidence = 0.6

    return {"summary": summary, "suggested_action": action, "confidence": confidence}


def _call_anthropic(context: dict) -> dict:
    resp = _client.messages.create(
        model=settings.llm_model,
        max_tokens=600,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": json.dumps(context, default=str)}],
    )
    text = "".join(b.text for b in resp.content if b.type == "text").strip()
    text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(text)


def _call_openai(context: dict) -> dict:
    resp = _client.chat.completions.create(
        model=settings.openai_model,
        max_tokens=600,
        response_format={"type": "json_object"},  # requires "json" to appear in the prompt -- it does, in SYSTEM_PROMPT
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": json.dumps(context, default=str)},
        ],
    )
    text = resp.choices[0].message.content.strip()
    text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(text)


def generate_triage_brief(context: dict) -> dict:
    """context: {"exception": {...}, "related": {"purchase_order": {...}|None,
    "shipment": {...}|None, "supplier_emails": [...]}}
    Returns {"summary", "suggested_action", "confidence", "cache_hit": bool,
    "source": "openai"|"anthropic"|"fallback"}
    """
    key = cache.cache_key(context)
    cached = cache.get(key)
    if cached:
        data = json.loads(cached)
        data["cache_hit"] = True
        return data

    if _client is None:
        result = _fallback_summary(context)
        result["source"] = "fallback"
    else:
        try:
            result = _call_openai(context) if _provider == "openai" else _call_anthropic(context)
            result["source"] = _provider
        except Exception as e:  # noqa: BLE001
            logger.warning("%s call failed, using fallback: %s", _provider, e)
            result = _fallback_summary(context)
            result["source"] = "fallback"

    result["cache_hit"] = False
    cache.set(key, json.dumps({k: v for k, v in result.items() if k != "cache_hit"}))
    return result