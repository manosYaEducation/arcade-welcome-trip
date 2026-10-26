# Security Specification — Arcade Welcome Trip

## 1. Data Invariants
1. **Identity Integrity (`Attendee.authorUid`)**: An attendee registration can only be created if `incoming().authorUid == request.auth.uid` and the user has a verified email (`request.auth.token.email_verified == true`) or is the bootstrapped admin (`asus.alphadocere@gmail.com`).
2. **Admin-Only Tombola Prize Assignment (`Attendee.prizeWon`)**: During attendee creation, `prizeWon` must be `""` (empty string) unless created by an admin. During updates, a non-admin attendee owner can ONLY modify `['arcadeScore', 'maxCombo', 'playedArcade', 'updatedAt']` and is strictly forbidden from modifying `prizeWon`, `authorUid`, or `createdAt`. Only `isAdmin()` can update `prizeWon`.
3. **Admin-Only Event & Prize Inventory Management**: Only `isAdmin()` can create, update, or delete documents in `/eventConfig/{configId}`, `/prizes/{prizeId}`, and `/admins/{adminUid}`.
4. **Temporal & Immutable Field Integrity**: `createdAt` must equal `request.time` on creation and remain immutable (`incoming().createdAt == existing().createdAt`) on update. `updatedAt` must equal `request.time` on every write.
5. **Query Enforcer**: `allow list` on `/attendees` requires `resource.data.isPublic == true`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Attendee**: Adding `"isAdmin": true` to `/attendees/{id}` -> Blocked by `data.keys().hasOnly(...)`.
2. **Self-Assigned Prize on Create**: Attendee creating `/attendees/{id}` with `"prizeWon": "Pase VIP"` -> Blocked by `incoming().prizeWon == "" || isAdmin()`.
3. **Self-Assigned Prize on Update**: Attendee updating `/attendees/{id}` changing `prizeWon` -> Blocked by `affectedKeys().hasOnly(['arcadeScore', 'maxCombo', 'playedArcade', 'updatedAt'])`.
4. **UID Spoofing on Create**: Setting `authorUid: "someone_else"` -> Blocked by `incoming().authorUid == request.auth.uid`.
5. **Immutable Field Mutation**: Changing `authorUid` or `createdAt` during update -> Blocked by immutability checks and `affectedKeys().hasOnly(...)`.
6. **Timestamp Forgery**: Sending a past or future `updatedAt` timestamp -> Blocked by `incoming().updatedAt == request.time`.
7. **Denial-of-Wallet Oversized String**: Sending a 50,000-char string in `name` or `wordForCloud` -> Blocked by `.size() <= 100` and `.size() <= 60`.
8. **ID Poisoning**: Creating `/attendees/invalid id with spaces!` -> Blocked by `isValidId(attendeeId)`.
9. **Unverified Email Spoofing**: Attacker with `email: "asus.alphadocere@gmail.com"` and `email_verified: false` -> Blocked by `request.auth.token.email_verified == true`.
10. **Unauthorized Prize Stock Tampering**: Non-admin attempting to update `/prizes/{prizeId}` -> Blocked by `isAdmin()`.
11. **Unauthorized EventConfig Tampering**: Non-admin attempting to update `/eventConfig/current` -> Blocked by `isAdmin()`.
12. **Privilege Escalation via `/admins` Write**: Non-admin writing to `/admins/{uid}` -> Blocked by `isAdmin()`.
