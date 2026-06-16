# NIP-29 Specification: Relay-Based Groups

> **Why this reference exists:** NIP-29 introduces a fundamentally different trust model from standard Nostr. The relay enforces group membership and permissions rather than just storing and forwarding events. Agents need to understand this authority model, the event kinds involved, the h tag requirement, and the permissions system to participate correctly in relay-based groups.

## Relay-as-Authority Model

In standard Nostr, relays are passive storage -- they accept signed events from anyone and forward them to subscribers. NIP-29 inverts this relationship. The relay hosting a group:

- **Validates membership** before accepting group-scoped events (kind:9, kind:11)
- **Manages group state** by maintaining replaceable events for metadata, admins, and members
- **Enforces permissions** by checking whether the sender has the required permission for admin actions
- **Can delete events** and remove members unilaterally
- **Is the authoritative source** for all group state -- there is no consensus mechanism across relays

This means group events are only valid on the relay that hosts the group. Sending a group event to a different relay will be rejected because that relay has no knowledge of the group's membership.

## The h Tag

All group-scoped events must include an `h` tag identifying the group:

```
["h", "<group-id>"]
```

The group ID is an arbitrary string chosen by the relay when the group is created (via kind:9007). It is not a hash or derived value -- the relay assigns it. Examples: `"general"`, `"dev-chat"`, `"announcements"`.

Events without a valid `h` tag targeting a group on that relay are rejected. The `h` tag scopes the event to a specific group, enabling subscription filtering.

## Group Message Events

### kind:9 -- Group Chat Message

A short message posted within a group. Equivalent to kind:1 notes but scoped to a group audience.

**Required tags:**
- `["h", "<group-id>"]` -- Identifies the target group

**Content field:** The message text (plain text or markdown).

**Behavior:** The relay validates that the sender is a member of the specified group before accepting the event. Non-members are rejected.

### kind:11 -- Group Thread

A threaded discussion message within a group. Enables structured conversation threads.

**Required tags:**
- `["h", "<group-id>"]` -- Identifies the target group
- `["e", "<parent-event-id>"]` -- For replies within the thread (optional for top-level thread starters)

**Content field:** The thread message text.

**Behavior:** Same membership validation as kind:9. Threading uses `e` tags to build reply chains within the group.

## Admin and Moderation Events (kind:9000-9009)

All admin events require the `h` tag and the sender must have the appropriate permission.

### kind:9000 -- Add User

Adds a member to the group.

**Tags:** `["h", "<group-id>"]`, `["p", "<pubkey-to-add>"]`
**Permission required:** `add-user`

### kind:9001 -- Remove User

Removes a member from the group.

**Tags:** `["h", "<group-id>"]`, `["p", "<pubkey-to-remove>"]`
**Permission required:** `remove-user`

### kind:9002 -- Edit Metadata

Changes group metadata (name, about, picture, etc.).

**Tags:** `["h", "<group-id>"]` plus metadata tags (e.g., `["name", "New Name"]`, `["about", "Description"]`, `["picture", "https://..."]`)
**Permission required:** `edit-metadata`

### kind:9003 -- Add Permission

Grants a permission to a member.

**Tags:** `["h", "<group-id>"]`, `["p", "<pubkey>"]`, `["permission", "<permission-name>"]`
**Permission required:** `add-permission`

### kind:9004 -- Remove Permission

Revokes a permission from a member.

**Tags:** `["h", "<group-id>"]`, `["p", "<pubkey>"]`, `["permission", "<permission-name>"]`
**Permission required:** `remove-permission`

### kind:9005 -- Delete Event

Removes an event from the group.

**Tags:** `["h", "<group-id>"]`, `["e", "<event-id-to-delete>"]`
**Permission required:** `delete-event`

### kind:9006 -- Edit Group Status

Toggles the group between open and closed status.

**Tags:** `["h", "<group-id>"]` plus status indicator (e.g., `["open"]` or `["closed"]`)
**Permission required:** `edit-group-status`

When a group is **open**, anyone can join by posting. When **closed**, new members must be added by an admin (kind:9000) or use an invite code (kind:9009).

### kind:9007 -- Create Group

Creates a new group on the relay.

**Tags:** `["h", "<desired-group-id>"]` (relay may assign a different ID)
**Note:** The relay decides whether to honor the requested group ID or assign its own.

### kind:9008 -- Delete Group

Deletes a group entirely.

**Tags:** `["h", "<group-id>"]`
**Note:** Typically restricted to the group creator or relay operator.

### kind:9009 -- Create Invite

Generates an invite code for joining a closed group.

**Tags:** `["h", "<group-id>"]`, `["code", "<invite-code>"]`
**Permission required:** `add-user` (typically)

The invite code can be shared out-of-band. Recipients use it to join the closed group.

## Group State Events (Replaceable)

The relay maintains these as replaceable events, updating them in response to admin actions. The `d` tag on each contains the group ID.

### kind:39000 -- Group Metadata

Contains the group's public information.

**Tags:**
- `["d", "<group-id>"]` -- Identifier
- `["name", "Group Name"]` -- Display name
- `["about", "Group description"]` -- Description
- `["picture", "https://..."]` -- Avatar URL
- `["note", "<pinned-event-id>"]` -- Pinned notes (repeatable)

### kind:39001 -- Group Admins

Lists group administrators with their roles.

**Tags:**
- `["d", "<group-id>"]` -- Identifier
- `["p", "<admin-pubkey>", "<relay-url>", "<role-name>"]` -- Admin entry with role (repeatable)

Roles describe the admin's function (e.g., "moderator", "owner") but permissions are what control actual capabilities.

### kind:39002 -- Group Members

Lists group members.

**Tags:**
- `["d", "<group-id>"]` -- Identifier
- `["p", "<member-pubkey>"]` -- Member entry (repeatable)

## Permissions Model

NIP-29 defines granular permissions that admins can grant or revoke per member:

| Permission | Controls |
|-----------|----------|
| `add-user` | Can add new members (kind:9000) |
| `edit-metadata` | Can modify group name/about/picture (kind:9002) |
| `delete-event` | Can remove events from the group (kind:9005) |
| `remove-user` | Can remove members (kind:9001) |
| `add-permission` | Can grant permissions to others (kind:9003) |
| `remove-permission` | Can revoke permissions from others (kind:9004) |
| `edit-group-status` | Can change open/closed status (kind:9006) |

Permissions are managed via kind:9003 (grant) and kind:9004 (revoke). The relay enforces these -- an admin without `delete-event` permission cannot submit kind:9005 events.

## Open vs Closed Groups

- **Open groups:** Anyone can join by posting a group-scoped event. The relay automatically adds them as a member. No invite needed.
- **Closed groups:** Only existing members can post. New members must be added via kind:9000 (admin adds user) or by using an invite code generated via kind:9009.

The group status is toggled via kind:9006. A group can transition between open and closed states.

## Subscription Filtering

To subscribe to a specific group's events, use the `h` tag as a filter:

- Group messages: `kinds: [9, 11]` with `#h: ["<group-id>"]`
- Group metadata: `kinds: [39000]` with `#d: ["<group-id>"]`
- Group admins: `kinds: [39001]` with `#d: ["<group-id>"]`
- Group members: `kinds: [39002]` with `#d: ["<group-id>"]`
- Admin actions: `kinds: [9000, 9001, 9002, 9003, 9004, 9005, 9006, 9007, 9008, 9009]` with `#h: ["<group-id>"]`

Note: Group state events (kind:39000-39002) use the `d` tag (parameterized replaceable event identifier) rather than the `h` tag for filtering, but the `d` tag value matches the group ID.
