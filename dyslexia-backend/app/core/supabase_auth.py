"""Helpers for Supabase Auth integration.

This module keeps Supabase as the source of truth for identity/session while
preserving local SQL rows for app-specific relationships.
"""

from __future__ import annotations

import os
from typing import Any

import httpx


class SupabaseAuthError(Exception):
    """Expected auth error returned to API callers."""


def _required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SupabaseAuthError(f"Missing required environment variable: {name}")
    return value


def _base_headers() -> dict[str, str]:
    anon_key = _required_env("SUPABASE_ANON_KEY")
    return {
        "apikey": anon_key,
        "Content-Type": "application/json",
    }


def _service_headers() -> dict[str, str]:
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not service_key:
        raise SupabaseAuthError("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY")
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }


def _auth_url(path: str) -> str:
    base = _required_env("SUPABASE_URL").rstrip("/")
    return f"{base}/auth/v1{path}"


def _parse_error(response: httpx.Response) -> str:
    try:
        payload = response.json()
    except Exception:
        text = response.text.strip()
        return text or "Supabase request failed"
    for key in ("msg", "message", "error_description", "error"):
        value = payload.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return "Supabase request failed"


def supabase_signup(*, email: str, password: str, name: str, role: str) -> dict[str, Any]:
    payload = {
        "email": email,
        "password": password,
        "data": {
            "name": name,
            "role": role,
        },
    }
    headers = _base_headers()
    headers["Authorization"] = f"Bearer {headers['apikey']}"
    with httpx.Client(timeout=15.0) as client:
        response = client.post(_auth_url("/signup"), headers=headers, json=payload)
    if response.status_code >= 400:
        raise SupabaseAuthError(_parse_error(response))
    return response.json()


def supabase_admin_create_user(*, email: str, password: str, name: str, role: str) -> dict[str, Any]:
    payload = {
        "email": email,
        "password": password,
        "email_confirm": True,
        "user_metadata": {
            "name": name,
            "role": role,
        },
    }
    with httpx.Client(timeout=15.0) as client:
        response = client.post(_auth_url("/admin/users"), headers=_service_headers(), json=payload)
    if response.status_code >= 400:
        raise SupabaseAuthError(_parse_error(response))
    return response.json()


def supabase_admin_enabled() -> bool:
    return bool(os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip())


def supabase_login(*, email: str, password: str) -> dict[str, Any]:
    payload = {
        "email": email,
        "password": password,
    }
    headers = _base_headers()
    headers["Authorization"] = f"Bearer {headers['apikey']}"
    with httpx.Client(timeout=15.0) as client:
        response = client.post(
            _auth_url("/token?grant_type=password"),
            headers=headers,
            json=payload,
        )
    if response.status_code >= 400:
        raise SupabaseAuthError(_parse_error(response))
    return response.json()


def supabase_get_user(access_token: str) -> dict[str, Any]:
    headers = _base_headers()
    headers["Authorization"] = f"Bearer {access_token}"
    with httpx.Client(timeout=15.0) as client:
        response = client.get(_auth_url("/user"), headers=headers)
    if response.status_code >= 400:
        raise SupabaseAuthError(_parse_error(response))
    payload = response.json()
    if not isinstance(payload, dict):
        raise SupabaseAuthError("Invalid Supabase user payload")
    return payload


def supabase_logout(access_token: str) -> None:
    headers = _base_headers()
    headers["Authorization"] = f"Bearer {access_token}"
    with httpx.Client(timeout=15.0) as client:
        response = client.post(_auth_url("/logout"), headers=headers)
    if response.status_code >= 400:
        raise SupabaseAuthError(_parse_error(response))