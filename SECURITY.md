# Security Policy

## Supported Versions

Ollie is a single-maintainer, actively developed project. Only the latest
released version is supported with security fixes.

| Version | Supported |
| ------- | --------- |
| Latest  | ✅ |
| Older   | ❌ |

## Reporting a Vulnerability

Please **do not** open a public issue for security vulnerabilities.

Instead, use GitHub's private vulnerability reporting:

1. Go to the [Security tab](https://github.com/MedGm/Ollie/security) of this repository
2. Click **"Report a vulnerability"**
3. Fill in as much detail as you can — steps to reproduce, affected version, potential impact

You'll get a response as soon as possible. If the report is confirmed, a fix
will be prioritized and a security advisory published once a patched release
is out.

## Scope

Ollie is a local-first desktop app. Things worth reporting here include, but
aren't limited to:

* API keys or credentials stored or logged insecurely
* Command injection or unsafe use of Tauri's shell/IPC surface
* Path traversal in file attachment or MCP handling
* Anything that lets a remote MCP server or provider response execute
  unintended code on the host

General bugs, crashes, or feature requests belong in
[Issues](https://github.com/MedGm/Ollie/issues), not here.
