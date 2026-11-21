# Security policy

## Supported versions

SharpCNC is a personal desktop / local-browser tool. Only the latest `main` branch is maintained.

## What this project talks to

- USB serial to a local GRBL controller (Demon Shield / Arduino)
- Optional localhost debug bridge on `127.0.0.1` only (when Debug mode is enabled)
- Optional Google Drive OAuth when a client ID is configured

There is no cloud multi-user backend.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security-sensitive reports.

Email the maintainer via the contact on the
[GitHub profile](https://github.com/cjsharp1) or open a
[private security advisory](https://github.com/cjsharp1/sharp-cnc/security/advisories/new)
on this repository.

Include:

- Affected commit / version if known
- Steps to reproduce
- Impact (e.g. unexpected serial commands, local bridge exposure)

You should receive an acknowledgement when practical. Fixes land on `main` as soon as they are verified.

## Safe use reminders

- Keep the debug bridge off unless you need it; it is read-oriented and bound to localhost.
- Never expose the machine PC’s serial or debug ports to the public internet.
- Treat E-Stop and soft limits as required — software cannot replace physical safety.
