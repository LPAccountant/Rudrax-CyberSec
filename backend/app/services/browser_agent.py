import asyncio
import json
import httpx
from app.services.ollama_service import query_ollama


async def browse_url(url: str, extract_type: str = "text") -> dict:
    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True, verify=False) as client:
            response = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) RudraX-CyberSec/2.0"
            })
            if extract_type == "headers":
                return {
                    "url": url, "status": response.status_code,
                    "headers": dict(response.headers), "type": "headers",
                }
            elif extract_type == "links":
                import re
                links = re.findall(r'href=["\']([^"\']+)["\']', response.text)
                return {"url": url, "status": response.status_code, "links": links[:100], "type": "links"}
            elif extract_type == "forms":
                import re
                forms = re.findall(r'<form[^>]*>(.*?)</form>', response.text, re.DOTALL)
                inputs = []
                for form in forms:
                    form_inputs = re.findall(r'<input[^>]*>', form)
                    inputs.extend(form_inputs)
                return {"url": url, "status": response.status_code, "forms_count": len(forms), "inputs": inputs[:50], "type": "forms"}
            else:
                text = response.text[:10000]
                import re
                text = re.sub(r'<script[^>]*>.*?</script>', '', text, flags=re.DOTALL)
                text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
                text = re.sub(r'<[^>]+>', ' ', text)
                text = re.sub(r'\s+', ' ', text).strip()
                return {"url": url, "status": response.status_code, "text": text[:5000], "type": "text"}
    except Exception as e:
        return {"url": url, "error": str(e), "type": extract_type}


async def crawl_site(url: str, max_pages: int = 10) -> dict:
    visited = set()
    to_visit = [url]
    results = []
    base_domain = url.split("//")[-1].split("/")[0]

    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True, verify=False) as client:
        while to_visit and len(visited) < max_pages:
            current = to_visit.pop(0)
            if current in visited:
                continue
            visited.add(current)
            try:
                resp = await client.get(current, headers={
                    "User-Agent": "Mozilla/5.0 RudraX-CyberSec/2.0"
                })
                import re
                links = re.findall(r'href=["\']([^"\']+)["\']', resp.text)
                page_links = []
                for link in links:
                    if link.startswith("/"):
                        link = f"{url.rstrip('/')}{link}"
                    if base_domain in link and link not in visited:
                        page_links.append(link)
                        to_visit.append(link)
                results.append({
                    "url": current, "status": resp.status_code,
                    "title": _extract_title(resp.text),
                    "links_found": len(page_links),
                })
            except Exception as e:
                results.append({"url": current, "error": str(e)})

    return {"base_url": url, "pages_crawled": len(results), "results": results}


def _extract_title(html: str) -> str:
    import re
    match = re.search(r'<title[^>]*>(.*?)</title>', html, re.IGNORECASE | re.DOTALL)
    return match.group(1).strip() if match else "No title"


async def screenshot_url(url: str) -> dict:
    return {
        "url": url,
        "message": "Screenshot capability requires Playwright. Install with: pip install playwright && playwright install chromium",
        "status": "requires_setup",
    }


async def api_request(
    url: str, method: str = "GET", headers: dict | None = None,
    body: str | None = None, auth_type: str | None = None,
    auth_value: str | None = None,
) -> dict:
    req_headers = headers or {}
    if auth_type == "bearer" and auth_value:
        req_headers["Authorization"] = f"Bearer {auth_value}"
    elif auth_type == "api_key" and auth_value:
        req_headers["X-API-Key"] = auth_value

    try:
        async with httpx.AsyncClient(timeout=30.0, verify=False) as client:
            kwargs = {"headers": req_headers}
            if body and method in ("POST", "PUT", "PATCH"):
                try:
                    kwargs["json"] = json.loads(body)
                except json.JSONDecodeError:
                    kwargs["content"] = body

            response = await getattr(client, method.lower())(url, **kwargs)
            try:
                resp_json = response.json()
            except Exception:
                resp_json = None

            return {
                "url": url, "method": method,
                "status_code": response.status_code,
                "headers": dict(response.headers),
                "body": resp_json if resp_json else response.text[:5000],
                "elapsed_ms": response.elapsed.total_seconds() * 1000 if hasattr(response, 'elapsed') else None,
            }
    except Exception as e:
        return {"url": url, "method": method, "error": str(e)}


async def analyze_api(url: str, model: str = "llama3") -> dict:
    result = await api_request(url)
    if "error" in result:
        return result

    analysis_prompt = f"""Analyze this API response and provide security observations:
URL: {url}
Status: {result['status_code']}
Headers: {json.dumps(result['headers'], indent=2)[:2000]}
Body preview: {str(result['body'])[:2000]}

Provide:
1. API type detection (REST, GraphQL, etc.)
2. Authentication requirements
3. Security headers analysis
4. Potential vulnerabilities
5. Recommendations"""

    analysis = await query_ollama(analysis_prompt, model=model,
        system="You are an API security analyst. Analyze APIs for security issues.")
    result["ai_analysis"] = analysis
    return result
