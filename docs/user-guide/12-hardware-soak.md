# 12. Hardware soak (Demon Shield)

Before cutting wood, run the **hardware soak** once on the real machine (and again after wiring or travel changes).

**Very first connection?** Do [First real connection](14-first-real-connection.md) before this; it records results in the [hardware checklist](../hardware-checklist.md).

Full checklist (home, `$3`, soft limits, Z probe, Abort/Hold/Resume, PWM):

→ **[Demon Shield soak playbook](../demon-shield-soak-playbook.md)**

Vendor board notes: [Designs By Phil — Demon Shield](https://www.designsbyphil.com/demon-shield-1.html) · button mapping: [external controls](../demon-shield-controls.md)

## Short version

1. Connect SharpCNC over USB (115200) → **Linked**.  
2. **Home** to the zero-side limit switches only.  
3. Confirm jog directions (`$3`).  
4. Set measured soft travel (`$130`–`$132`, `$20=1`).  
5. Run Z probe with correct plate thickness; remove the plate.  
6. Prove enclosure **Abort / Hold / Resume** match soft reset / hold / cycle start.  
7. Prove PWM spindle on/off and overrides with the bit clear.  
8. **Simulate**, then scrap cut, then the real part.

For the beginner pass/fail ladder (connect only → jog in air → no-tool raised Z → scrap), use **[First-test stages](13-first-test-stages.md)**.

Stay at the machine. Soft limits replace far-end mechanical switches on this build.

Back to the [guide index](README.md).
