import asyncio
import socket
import json
import hashlib
import re
import httpx


async def nmap_scan(target: str, scan_type: str = "basic", ports: str = "") -> dict:
    cmd = ["nmap"]
    if scan_type == "basic":
        cmd.extend(["-sT", "-T4"])
    elif scan_type == "stealth":
        cmd.extend(["-sS", "-T4"])
    elif scan_type == "aggressive":
        cmd.extend(["-A", "-T4"])
    elif scan_type == "vuln":
        cmd.extend(["--script", "vuln", "-T4"])
    elif scan_type == "os_detect":
        cmd.extend(["-O", "-T4"])
    elif scan_type == "service":
        cmd.extend(["-sV", "-T4"])
    elif scan_type == "full":
        cmd.extend(["-sV", "-sC", "-O", "-T4"])

    if ports:
        cmd.extend(["-p", ports])
    else:
        cmd.extend(["-p", "1-1024"])

    cmd.extend(["-oX", "-", target])

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
        output = stdout.decode()
        return {
            "tool": "nmap", "target": target, "scan_type": scan_type,
            "raw_output": output[:10000],
            "parsed": _parse_nmap_xml(output),
            "status": "completed",
        }
    except FileNotFoundError:
        return await _fallback_port_scan(target, ports)
    except asyncio.TimeoutError:
        return {"tool": "nmap", "target": target, "status": "timeout", "error": "Scan timed out after 300s"}
    except Exception as e:
        return {"tool": "nmap", "target": target, "status": "error", "error": str(e)}


def _parse_nmap_xml(xml_output: str) -> dict:
    hosts = []
    port_pattern = re.compile(
        r'<port protocol="(\w+)" portid="(\d+)".*?<state state="(\w+)".*?(?:<service name="([^"]*)")?',
        re.DOTALL,
    )
    for match in port_pattern.finditer(xml_output):
        hosts.append({
            "protocol": match.group(1), "port": int(match.group(2)),
            "state": match.group(3), "service": match.group(4) or "unknown",
        })
    os_pattern = re.compile(r'<osmatch name="([^"]*)".*?accuracy="(\d+)"')
    os_matches = [{"name": m.group(1), "accuracy": m.group(2)} for m in os_pattern.finditer(xml_output)]
    return {"ports": hosts, "os_detection": os_matches}


async def _fallback_port_scan(target: str, ports: str) -> dict:
    if ports:
        port_list = [int(p.strip()) for p in ports.split(",") if p.strip().isdigit()]
    else:
        port_list = [21, 22, 23, 25, 53, 80, 110, 143, 443, 993, 995, 3306, 3389, 5432, 8080, 8443]
    results = []
    for port in port_list:
        try:
            reader, writer = await asyncio.wait_for(asyncio.open_connection(target, port), timeout=2.0)
            service = _get_service(port)
            banner = ""
            try:
                data = await asyncio.wait_for(reader.read(1024), timeout=2.0)
                banner = data.decode(errors="ignore").strip()
            except Exception:
                pass
            results.append({"port": port, "state": "open", "service": service, "banner": banner})
            writer.close()
            await writer.wait_closed()
        except (asyncio.TimeoutError, ConnectionRefusedError, OSError):
            pass
    return {
        "tool": "port_scanner_fallback", "target": target,
        "parsed": {"ports": results, "os_detection": []},
        "note": "nmap not installed, using fallback scanner",
        "status": "completed",
    }


def _get_service(port: int) -> str:
    services = {
        21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 53: "DNS", 80: "HTTP",
        110: "POP3", 111: "RPCBind", 135: "MSRPC", 139: "NetBIOS", 143: "IMAP",
        443: "HTTPS", 445: "SMB", 993: "IMAPS", 995: "POP3S", 1433: "MSSQL",
        1521: "Oracle", 3306: "MySQL", 3389: "RDP", 5432: "PostgreSQL",
        5900: "VNC", 6379: "Redis", 8080: "HTTP-Alt", 8443: "HTTPS-Alt",
        27017: "MongoDB", 9200: "Elasticsearch",
    }
    return services.get(port, "Unknown")


async def nikto_scan(target: str) -> dict:
    url = target if target.startswith("http") else f"http://{target}"
    try:
        proc = await asyncio.create_subprocess_exec(
            "nikto", "-h", url, "-Format", "json", "-output", "/dev/stdout",
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=300)
        output = stdout.decode()
        try:
            parsed = json.loads(output)
        except json.JSONDecodeError:
            parsed = {"raw": output[:5000]}
        return {"tool": "nikto", "target": target, "results": parsed, "status": "completed"}
    except FileNotFoundError:
        return await _nikto_fallback(target)
    except asyncio.TimeoutError:
        return {"tool": "nikto", "target": target, "status": "timeout"}
    except Exception as e:
        return {"tool": "nikto", "target": target, "status": "error", "error": str(e)}


async def _nikto_fallback(target: str) -> dict:
    url = target if target.startswith("http") else f"https://{target}"
    findings = []
    async with httpx.AsyncClient(timeout=15.0, verify=False, follow_redirects=True) as client:
        try:
            resp = await client.get(url)
            headers = {k.lower(): v for k, v in resp.headers.items()}
            checks = [
                ("server" in headers, "Server header present", headers.get("server", ""), "info"),
                ("x-powered-by" in headers, "X-Powered-By exposed", headers.get("x-powered-by", ""), "medium"),
                ("x-frame-options" not in headers, "Missing X-Frame-Options", "", "medium"),
                ("content-security-policy" not in headers, "Missing Content-Security-Policy", "", "medium"),
                ("strict-transport-security" not in headers, "Missing HSTS", "", "medium"),
                ("x-content-type-options" not in headers, "Missing X-Content-Type-Options", "", "low"),
            ]
            for condition, msg, detail, severity in checks:
                if condition:
                    findings.append({"finding": msg, "detail": detail, "severity": severity})
            sensitive_paths = [
                "/.env", "/.git/config", "/wp-config.php", "/phpinfo.php",
                "/server-status", "/server-info", "/.htaccess", "/web.config",
                "/robots.txt", "/sitemap.xml", "/.well-known/security.txt",
                "/admin", "/login", "/api/docs", "/swagger.json", "/graphql",
            ]
            for path in sensitive_paths:
                try:
                    r = await client.get(f"{url}{path}", follow_redirects=False)
                    if r.status_code == 200:
                        sev = "high" if path.startswith("/.") else "info"
                        findings.append({"finding": f"Accessible: {path}", "detail": f"Status {r.status_code}", "severity": sev})
                except Exception:
                    pass
        except Exception as e:
            return {"tool": "nikto_fallback", "target": target, "status": "error", "error": str(e)}
    return {
        "tool": "nikto_fallback", "target": target, "results": findings,
        "note": "nikto not installed, using built-in checks", "status": "completed",
    }


async def traceroute(target: str) -> dict:
    hostname = target.replace("https://", "").replace("http://", "").split("/")[0]
    try:
        proc = await asyncio.create_subprocess_exec(
            "traceroute", "-m", "20", hostname,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=60)
        output = stdout.decode()
        hops = []
        for line in output.strip().split("\n")[1:]:
            parts = line.strip().split()
            if len(parts) >= 2:
                hops.append({"hop": parts[0], "host": parts[1], "details": " ".join(parts[2:])})
        return {"tool": "traceroute", "target": hostname, "hops": hops, "raw": output, "status": "completed"}
    except FileNotFoundError:
        return {"tool": "traceroute", "target": hostname, "status": "error", "error": "traceroute not installed"}
    except Exception as e:
        return {"tool": "traceroute", "target": hostname, "status": "error", "error": str(e)}


async def banner_grab(target: str, port: int = 80) -> dict:
    try:
        reader, writer = await asyncio.wait_for(asyncio.open_connection(target, port), timeout=5.0)
        if port in (80, 8080, 443, 8443):
            writer.write(f"HEAD / HTTP/1.1\r\nHost: {target}\r\n\r\n".encode())
            await writer.drain()
        data = await asyncio.wait_for(reader.read(4096), timeout=5.0)
        banner = data.decode(errors="ignore").strip()
        writer.close()
        await writer.wait_closed()
        return {"tool": "banner_grab", "target": target, "port": port, "banner": banner, "status": "completed"}
    except Exception as e:
        return {"tool": "banner_grab", "target": target, "port": port, "status": "error", "error": str(e)}


async def waf_detect(target: str) -> dict:
    url = target if target.startswith("http") else f"https://{target}"
    waf_signatures = {
        "Cloudflare": ["cf-ray", "cloudflare", "__cfduid"],
        "AWS WAF": ["x-amzn-requestid", "x-amz-cf-id"],
        "Akamai": ["akamai", "x-akamai"],
        "Imperva/Incapsula": ["incap_ses", "visid_incap", "x-cdn"],
        "Sucuri": ["x-sucuri-id", "sucuri"],
        "ModSecurity": ["mod_security", "modsecurity"],
        "F5 BIG-IP": ["bigipserver", "x-cnection"],
        "Barracuda": ["barra_counter_session"],
        "Fortinet/FortiWeb": ["fortiwafsid"],
    }
    detected = []
    try:
        async with httpx.AsyncClient(timeout=15.0, verify=False, follow_redirects=True) as client:
            resp = await client.get(url)
            headers_str = json.dumps(dict(resp.headers)).lower()
            cookies_str = str(resp.cookies).lower()
            for waf_name, signatures in waf_signatures.items():
                for sig in signatures:
                    if sig in headers_str or sig in cookies_str:
                        detected.append({"waf": waf_name, "signature": sig, "confidence": "high"})
                        break
            xss_resp = await client.get(f"{url}/?test=<script>alert(1)</script>")
            if xss_resp.status_code in (403, 406, 501):
                detected.append({"waf": "Generic WAF", "signature": "XSS payload blocked", "confidence": "medium"})
    except Exception as e:
        return {"tool": "waf_detect", "target": target, "status": "error", "error": str(e)}
    return {
        "tool": "waf_detect", "target": target,
        "waf_detected": len(detected) > 0, "detections": detected,
        "status": "completed",
    }


async def cms_detect(target: str) -> dict:
    url = target if target.startswith("http") else f"https://{target}"
    detected = []
    try:
        async with httpx.AsyncClient(timeout=15.0, verify=False, follow_redirects=True) as client:
            resp = await client.get(url)
            html = resp.text.lower()
            cms_checks = [
                ("WordPress", ["/wp-content/", "/wp-includes/", "wp-json"]),
                ("Joomla", ["/media/jui/", "joomla", "/administrator/"]),
                ("Drupal", ["drupal", "/sites/default/", "drupal.js"]),
                ("Magento", ["magento", "/skin/frontend/", "mage/"]),
                ("Shopify", ["shopify", "cdn.shopify.com"]),
                ("Wix", ["wix.com", "wixstatic.com"]),
                ("Squarespace", ["squarespace", "static.squarespace"]),
                ("Ghost", ["ghost", "ghost-url"]),
                ("Hugo", ["hugo", "gohugo"]),
                ("Next.js", ["__next", "_next/static"]),
                ("Gatsby", ["gatsby", "__gatsby"]),
            ]
            for cms_name, signatures in cms_checks:
                for sig in signatures:
                    if sig in html:
                        detected.append({"cms": cms_name, "confidence": "high"})
                        break
    except Exception as e:
        return {"tool": "cms_detect", "target": target, "status": "error", "error": str(e)}
    return {"tool": "cms_detect", "target": target, "detected": detected, "status": "completed"}


async def network_discovery(target_range: str) -> dict:
    try:
        proc = await asyncio.create_subprocess_exec(
            "nmap", "-sn", target_range,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
        output = stdout.decode()
        hosts = re.findall(r'Nmap scan report for ([^\n]+)', output)
        return {"tool": "network_discovery", "target": target_range, "hosts": hosts, "raw": output[:5000], "status": "completed"}
    except FileNotFoundError:
        return {"tool": "network_discovery", "target": target_range, "status": "error", "error": "nmap not installed"}
    except Exception as e:
        return {"tool": "network_discovery", "target": target_range, "status": "error", "error": str(e)}


async def password_audit(hash_value: str, hash_type: str = "auto") -> dict:
    common_passwords = [
        "password", "123456", "12345678", "qwerty", "abc123", "password1",
        "admin", "letmein", "welcome", "monkey", "dragon", "master",
        "login", "princess", "passw0rd", "shadow", "sunshine", "trustno1",
    ]
    hash_funcs = {
        "md5": hashlib.md5, "sha1": hashlib.sha1,
        "sha256": hashlib.sha256, "sha512": hashlib.sha512,
    }
    if hash_type == "auto":
        hash_len = len(hash_value)
        if hash_len == 32:
            hash_type = "md5"
        elif hash_len == 40:
            hash_type = "sha1"
        elif hash_len == 64:
            hash_type = "sha256"
        elif hash_len == 128:
            hash_type = "sha512"
        else:
            return {"tool": "password_audit", "status": "error", "error": f"Cannot auto-detect hash type for length {hash_len}"}

    hash_func = hash_funcs.get(hash_type)
    if not hash_func:
        return {"tool": "password_audit", "status": "error", "error": f"Unsupported hash type: {hash_type}"}

    for pwd in common_passwords:
        if hash_func(pwd.encode()).hexdigest() == hash_value.lower():
            return {
                "tool": "password_audit", "hash": hash_value, "hash_type": hash_type,
                "cracked": True, "password": pwd, "strength": "very_weak",
                "status": "completed",
            }
    return {
        "tool": "password_audit", "hash": hash_value, "hash_type": hash_type,
        "cracked": False, "status": "completed",
        "note": "Not found in common password list. Use larger wordlists for thorough audit.",
    }


async def password_strength_check(password: str) -> dict:
    score = 0
    feedback = []
    if len(password) >= 8:
        score += 1
    else:
        feedback.append("Password should be at least 8 characters")
    if len(password) >= 12:
        score += 1
    if len(password) >= 16:
        score += 1
    if re.search(r'[a-z]', password):
        score += 1
    else:
        feedback.append("Add lowercase letters")
    if re.search(r'[A-Z]', password):
        score += 1
    else:
        feedback.append("Add uppercase letters")
    if re.search(r'[0-9]', password):
        score += 1
    else:
        feedback.append("Add numbers")
    if re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        score += 1
    else:
        feedback.append("Add special characters")
    common = ["password", "123456", "qwerty", "admin", "letmein", "welcome"]
    if password.lower() in common:
        score = 0
        feedback = ["This is a commonly used password"]

    strength_map = {0: "very_weak", 1: "very_weak", 2: "weak", 3: "weak", 4: "medium", 5: "strong", 6: "very_strong", 7: "excellent"}
    return {
        "tool": "password_strength", "score": score, "max_score": 7,
        "strength": strength_map.get(score, "excellent"),
        "feedback": feedback, "status": "completed",
    }
