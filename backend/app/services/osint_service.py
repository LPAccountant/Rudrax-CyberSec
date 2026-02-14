import asyncio
import socket
import json
import httpx
from app.services.ollama_service import query_ollama


async def deep_osint(target: str, model: str = "llama3") -> dict:
    results = {}
    tasks_list = [
        ("whois", whois_lookup(target)),
        ("dns", dns_enumeration(target)),
        ("subdomains", subdomain_enumeration(target)),
        ("headers", http_recon(target)),
        ("emails", email_harvester(target)),
        ("tech_stack", tech_stack_detection(target)),
    ]
    for name, coro in tasks_list:
        try:
            results[name] = await coro
        except Exception as e:
            results[name] = {"error": str(e)}

    analysis_prompt = f"""Analyze this OSINT data for target: {target}
{json.dumps(results, indent=2, default=str)[:4000]}

Provide:
1. Target profile summary
2. Attack surface assessment
3. Potential entry points
4. Risk rating (Critical/High/Medium/Low)
5. Recommendations for hardening"""

    ai_analysis = await query_ollama(analysis_prompt, model=model,
        system="You are an OSINT analyst. Provide thorough intelligence analysis.")
    results["ai_analysis"] = ai_analysis
    return results


async def whois_lookup(target: str) -> dict:
    domain = target.replace("https://", "").replace("http://", "").split("/")[0]
    try:
        proc = await asyncio.create_subprocess_exec(
            "whois", domain,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=15)
        output = stdout.decode()
        info = {}
        for line in output.split("\n"):
            if ":" in line and not line.strip().startswith("%"):
                key, _, value = line.partition(":")
                key = key.strip().lower().replace(" ", "_")
                value = value.strip()
                if key and value and key not in info:
                    info[key] = value
        return {"raw": output[:3000], "parsed": info}
    except FileNotFoundError:
        return {"error": "whois command not found. Install: apt install whois"}
    except Exception as e:
        return {"error": str(e)}


async def dns_enumeration(target: str) -> dict:
    domain = target.replace("https://", "").replace("http://", "").split("/")[0]
    results = {}
    record_types = ["A", "AAAA", "MX", "NS", "TXT", "SOA", "CNAME", "SRV"]
    for rtype in record_types:
        try:
            proc = await asyncio.create_subprocess_exec(
                "dig", "+short", domain, rtype,
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
            )
            stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=10)
            output = stdout.decode().strip()
            if output:
                results[rtype] = output.split("\n")
        except FileNotFoundError:
            try:
                if rtype == "A":
                    addrs = socket.getaddrinfo(domain, None, socket.AF_INET)
                    results["A"] = list(set(addr[4][0] for addr in addrs))
                elif rtype == "AAAA":
                    addrs = socket.getaddrinfo(domain, None, socket.AF_INET6)
                    results["AAAA"] = list(set(addr[4][0] for addr in addrs))
            except Exception:
                pass
        except Exception:
            pass
    return results


async def subdomain_enumeration(target: str) -> dict:
    domain = target.replace("https://", "").replace("http://", "").split("/")[0]
    subdomains_list = [
        "www", "mail", "ftp", "localhost", "webmail", "smtp", "pop", "ns1", "ns2",
        "dns", "dns1", "dns2", "mx", "mx1", "mx2", "api", "dev", "staging", "test",
        "admin", "portal", "blog", "shop", "store", "app", "m", "mobile", "cdn",
        "static", "assets", "img", "images", "media", "vpn", "remote", "git",
        "gitlab", "jenkins", "ci", "monitor", "status", "docs", "wiki", "help",
        "support", "forum", "chat", "irc", "ftp2", "ns3", "ns4", "webdisk",
        "cpanel", "whm", "autodiscover", "autoconfig", "sip", "lyncdiscover",
        "enterpriseregistration", "enterpriseenrollment", "gc", "gc._msdcs",
        "owa", "exchange", "mail2", "mail3", "smtp2", "intranet", "extranet",
        "internal", "external", "proxy", "gateway", "firewall", "router", "switch",
        "backup", "db", "database", "mysql", "postgres", "redis", "elastic",
        "kibana", "grafana", "prometheus", "nagios", "zabbix", "splunk",
        "siem", "soc", "ids", "ips", "waf", "lb", "loadbalancer",
    ]
    found = []
    for sub in subdomains_list:
        full = f"{sub}.{domain}"
        try:
            answers = socket.getaddrinfo(full, None, socket.AF_INET)
            if answers:
                ip = answers[0][4][0]
                found.append({"subdomain": full, "ip": ip})
        except (socket.gaierror, OSError):
            pass
    return {"domain": domain, "found": found, "total_checked": len(subdomains_list)}


async def http_recon(target: str) -> dict:
    url = target if target.startswith("http") else f"https://{target}"
    results = {}
    try:
        async with httpx.AsyncClient(timeout=15.0, verify=False, follow_redirects=True) as client:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) RudraX-OSINT/2.0"
            })
            results["status_code"] = resp.status_code
            results["headers"] = dict(resp.headers)
            results["server"] = resp.headers.get("server", "Unknown")
            results["technologies"] = _detect_technologies(resp.text, resp.headers)
    except Exception as e:
        results["error"] = str(e)
    return results


async def email_harvester(target: str) -> dict:
    domain = target.replace("https://", "").replace("http://", "").split("/")[0]
    emails = set()
    url = target if target.startswith("http") else f"https://{target}"
    try:
        async with httpx.AsyncClient(timeout=15.0, verify=False, follow_redirects=True) as client:
            resp = await client.get(url)
            import re
            found = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', resp.text)
            emails.update(found)

            for path in ["/contact", "/about", "/team", "/contact-us"]:
                try:
                    r = await client.get(f"{url}{path}")
                    found = re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', r.text)
                    emails.update(found)
                except Exception:
                    pass
    except Exception as e:
        return {"domain": domain, "error": str(e)}
    return {"domain": domain, "emails": list(emails)}


async def tech_stack_detection(target: str) -> dict:
    url = target if target.startswith("http") else f"https://{target}"
    try:
        async with httpx.AsyncClient(timeout=15.0, verify=False, follow_redirects=True) as client:
            resp = await client.get(url)
            techs = _detect_technologies(resp.text, resp.headers)
            return {"url": url, "technologies": techs}
    except Exception as e:
        return {"url": url, "error": str(e)}


def _detect_technologies(html: str, headers) -> list[dict]:
    techs = []
    html_lower = html.lower()
    header_dict = {k.lower(): v for k, v in headers.items()} if headers else {}

    checks = [
        ("WordPress", lambda: "wp-content" in html_lower or "wordpress" in html_lower),
        ("React", lambda: "react" in html_lower or "_reactroot" in html_lower),
        ("Vue.js", lambda: "vue" in html_lower or "__vue" in html_lower),
        ("Angular", lambda: "ng-" in html_lower or "angular" in html_lower),
        ("jQuery", lambda: "jquery" in html_lower),
        ("Bootstrap", lambda: "bootstrap" in html_lower),
        ("Nginx", lambda: header_dict.get("server", "").lower().startswith("nginx")),
        ("Apache", lambda: header_dict.get("server", "").lower().startswith("apache")),
        ("Cloudflare", lambda: "cloudflare" in header_dict.get("server", "").lower() or "cf-ray" in header_dict),
        ("PHP", lambda: "x-powered-by" in header_dict and "php" in header_dict["x-powered-by"].lower()),
        ("ASP.NET", lambda: "x-powered-by" in header_dict and "asp" in header_dict["x-powered-by"].lower()),
        ("Node.js", lambda: "x-powered-by" in header_dict and "express" in header_dict["x-powered-by"].lower()),
        ("Django", lambda: "csrfmiddlewaretoken" in html_lower),
        ("Laravel", lambda: "laravel" in html_lower),
        ("Next.js", lambda: "__next" in html_lower or "_next" in html_lower),
        ("Tailwind CSS", lambda: "tailwind" in html_lower),
        ("Google Analytics", lambda: "google-analytics" in html_lower or "gtag" in html_lower),
        ("Google Tag Manager", lambda: "googletagmanager" in html_lower),
    ]
    for name, check in checks:
        try:
            if check():
                techs.append({"name": name, "confidence": "high"})
        except Exception:
            pass
    return techs
