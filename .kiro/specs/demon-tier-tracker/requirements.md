# Requirements Document

## Introduction

The Demon Tier Tracker is a private, automated system that collects Geometry Dash demon-level completion data from a closed community of approximately 20 players and presents it as a ranked demon tier list on a public-facing website. The system has four cooperating components:

1. A **Geode Mod** (C++ / Geode Framework) running inside each player's Geometry Dash client that automatically extracts demon completion data from local game memory and reports it to a backend.
2. A **Backend API** (Vercel serverless functions) that authenticates players, validates incoming records, and persists them using upsert logic that keeps only each player's highest percentage per level.
3. A **Database** (Supabase Postgres) that stores players, demons, and records.
4. A **Tier List Website** (the existing React/TypeScript BroskiWebSite) that publicly displays the demon leaderboard.

This requirements document captures the WHAT and WHY (functional behavior, authentication, anti-cheat, and data integrity rules). Implementation details (specific Geode hooks, memory offsets, serverless code, ER schema realization) are deferred to the design phase.

## Glossary

- **Tracker_Mod**: The Geode mod component running inside the player's Geometry Dash client.
- **Initial_Sync**: The bootstrapping phase in which the Tracker_Mod reads all locally stored demon completions and submits them in a single batch after game launch.
- **Live_Tracking**: The runtime phase in which the Tracker_Mod submits an individual record immediately after the player achieves a new personal best or beats a demon.
- **Records_API**: The backend HTTP endpoint that receives, authenticates, and persists demon records.
- **Database**: The Supabase Postgres datastore containing the players, demons, and records tables.
- **Tier_List_Site**: The public-facing React/TypeScript website that displays the demon leaderboard.
- **Secret_Player_Token**: A unique alphanumeric string assigned to each player and used to authenticate the player's identity to the Records_API.
- **Record**: A single data item describing one player's best result on one demon level, consisting of Level ID, Best Percentage, and supporting metadata.
- **Personal_Best**: The highest completion percentage a player has achieved on a specific demon level.
- **Demon**: A Geometry Dash level classified as a demon-difficulty level, identified by a Level ID and assigned a difficulty tier.
- **Level_ID**: The Geometry Dash numeric identifier that uniquely identifies a level.
- **Best_Percentage**: An integer from 0 to 100 representing the highest completion percentage a player has reached on a level.
- **Player**: A member of the closed community whose completions are tracked, identified in the Database by a player identifier.

## Requirements

### Requirement 1: Initial Sync on Game Launch

**User Story:** As a community player, I want my full demon completion history uploaded automatically when I launch the game, so that the tier list reflects my historical progress without manual entry.

#### Acceptance Criteria

1. WHEN Geometry Dash completes its post-load sequence AND a Secret_Player_Token is configured AND the Initial_Sync flag is unset for the current session, THE Tracker_Mod SHALL read all locally stored demon-level completions from game memory.
2. WHEN the Tracker_Mod reads a demon-level completion, THE Tracker_Mod SHALL extract the Level_ID, level name (1 to 128 characters), and Best_Percentage (integer from 0 to 100 inclusive) for that completion.
3. IF a demon-level completion is missing the Level_ID, the level name, or the Best_Percentage, or has a Best_Percentage outside 0 to 100, THEN THE Tracker_Mod SHALL exclude that completion from the upload set and record that it was skipped as invalid.
4. WHEN the Tracker_Mod has collected all valid local demon completions, THE Tracker_Mod SHALL serialize the completions into a single JSON array containing up to 100,000 entries, including an empty array when no valid completions exist.
5. WHEN the JSON array of completions is serialized, THE Tracker_Mod SHALL send the array to the Records_API in a single HTTP POST request and wait up to 30 seconds for a response.
6. WHEN the Initial_Sync HTTP POST returns a success response within the 30-second timeout, THE Tracker_Mod SHALL set an internal flag indicating that Initial_Sync has completed for the current session.
7. IF no Secret_Player_Token is configured, THEN THE Tracker_Mod SHALL skip Initial_Sync and record that the sync was not attempted.
8. IF the Initial_Sync HTTP POST returns a failure response or no response is received within the 30-second timeout, THEN THE Tracker_Mod SHALL leave the Initial_Sync flag unset and record a sync-failure indication so that Initial_Sync is retried on the next game launch.

### Requirement 2: Live Tracking at Runtime

**User Story:** As a community player, I want my new demon achievements reported in real time, so that the tier list stays current during play sessions.

#### Acceptance Criteria

1. WHILE the Initial_Sync flag is set for the current session, THE Tracker_Mod SHALL monitor level completion and progress-update events and evaluate each event within 1 second of its occurrence.
2. WHEN a player achieves a Best_Percentage (an integer from 1 to 100) on a demon level that is higher than the player's previously reported value for that Level_ID, THE Tracker_Mod SHALL send exactly one Record for that Level_ID to the Records_API via an HTTP POST request within 2 seconds of the event.
3. WHEN a player completes a demon level (Best_Percentage equal to 100) for the first time with no previously reported value for that Level_ID, THE Tracker_Mod SHALL send exactly one Record for that Level_ID to the Records_API via an HTTP POST request within 2 seconds of the event.
4. IF a level completion or progress-update event reports a Best_Percentage that is less than or equal to the player's previously reported Best_Percentage for that Level_ID, THEN THE Tracker_Mod SHALL withhold the HTTP POST for that event and retain the previously reported value unchanged.
5. WHILE the Initial_Sync flag is unset for the current session, THE Tracker_Mod SHALL withhold all Live_Tracking submissions and retain pending Records for later submission.
6. IF a Live_Tracking HTTP POST does not receive a success confirmation from the Records_API within 10 seconds, THEN THE Tracker_Mod SHALL queue the unsent Record, persist it across game launches, and retry submission on the next qualifying event or game launch.
7. WHEN the Records_API confirms successful receipt of a queued Record, THE Tracker_Mod SHALL remove that Record from the retry queue.
8. WHILE the retry queue contains unsent Records, THE Tracker_Mod SHALL retain at most one Record per Level_ID, replacing any queued Record for that Level_ID with the one holding the highest Best_Percentage value.

### Requirement 3: Non-Blocking Networking

**User Story:** As a community player, I want data uploads to happen in the background, so that my gameplay is never interrupted or slowed.

#### Acceptance Criteria

1. WHEN the Tracker_Mod sends any HTTP request to the Records_API, THE Tracker_Mod SHALL execute the request on a thread separate from the game's main thread so that the main thread is stalled for no more than 1 millisecond as a direct result of initiating the request.
2. WHILE an asynchronous request to the Records_API is in progress, THE Tracker_Mod SHALL keep every operation in the request-handling pipeline off the game's main thread, such that the main thread's per-frame processing time does not increase by more than 1 millisecond compared to its time when no request is in progress.
3. IF an HTTP request to the Records_API does not complete within 30 seconds of being sent, THEN THE Tracker_Mod SHALL cancel the request, record a local log entry indicating the timeout, and continue normal game operation without modifying gameplay state.
4. IF an HTTP request to the Records_API fails or returns a non-success response, THEN THE Tracker_Mod SHALL record a local log entry indicating the failure cause and continue normal game operation without modifying gameplay state.
5. IF no network connection to the Records_API can be established, THEN THE Tracker_Mod SHALL record a local log entry indicating the connection was unavailable, retry the request up to 3 times, and continue normal game operation if all retries are exhausted.

### Requirement 4: Mod Configuration

**User Story:** As a community player, I want to enter my personal token in the mod settings, so that my uploads are attributed to my account.

#### Acceptance Criteria

1. THE Tracker_Mod SHALL provide a settings field in which the player enters a Secret_Player_Token of 1 to 256 characters.
2. WHEN the player saves a non-empty Secret_Player_Token in the settings field, THE Tracker_Mod SHALL persist the Secret_Player_Token so that it remains available after the game is closed and reopened.
3. IF the player saves the settings field while it is empty or contains only whitespace characters, THEN THE Tracker_Mod SHALL reject the save, retain the previously persisted Secret_Player_Token unchanged, and display an indication that a valid token is required.
4. WHEN the Tracker_Mod sends any HTTP request to the Records_API and a Secret_Player_Token is configured, THE Tracker_Mod SHALL include the configured Secret_Player_Token in the request for authentication.
5. IF the Tracker_Mod attempts to send an HTTP request to the Records_API while no Secret_Player_Token is configured, THEN THE Tracker_Mod SHALL abort the request and display an indication that a token must be configured before uploads can be attributed.

### Requirement 5: Record Submission Authentication

**User Story:** As a community administrator, I want every submission authenticated, so that only known players can post records.

#### Acceptance Criteria

1. WHEN the Records_API receives a request, THE Records_API SHALL extract the Secret_Player_Token from the request.
2. WHEN the Records_API extracts a Secret_Player_Token that is empty or exceeds 512 characters, THE Records_API SHALL treat the Secret_Player_Token as missing.
3. WHEN the Records_API extracts a non-empty Secret_Player_Token of 512 characters or fewer, THE Records_API SHALL validate the Secret_Player_Token against the players stored in the Database to identify the associated Player within 2 seconds.
4. IF the Secret_Player_Token is missing, THEN THE Records_API SHALL reject the request with an authentication error and persist no data, regardless of how far request processing has progressed.
5. IF the Secret_Player_Token does not match any Player in the Database, THEN THE Records_API SHALL reject the request with an authentication error and persist no data.
6. IF the Database is unavailable or does not return a validation result within 2 seconds, THEN THE Records_API SHALL reject the request with a service-unavailable error indicating that authentication could not be completed and persist no data.
7. WHEN a request is rejected for an authentication error, THE Records_API SHALL return an HTTP 401 Unauthorized status.
8. WHEN the Secret_Player_Token matches exactly one Player in the Database, THE Records_API SHALL allow the request to proceed to payload processing and data persistence.

### Requirement 6: Record Payload Handling

**User Story:** As a community player, I want the API to accept both my bulk sync and my single live updates, so that one endpoint serves both phases.

#### Acceptance Criteria

1. WHEN the Records_API receives an authenticated request whose payload is a single Record object, THE Records_API SHALL process that single Record.
2. WHEN the Records_API receives an authenticated request whose payload is a non-empty array of 1 to 1000 Record objects inclusive, THE Records_API SHALL process each Record in the array in the order received.
3. WHEN the Records_API processes a Record, THE Records_API SHALL validate that the Record contains a non-empty Level_ID and a numeric Best_Percentage that is greater than or equal to 0 and less than or equal to 100.
4. IF a Record is missing a required field, contains a non-numeric Best_Percentage, or contains a Best_Percentage less than 0 or greater than 100, THEN THE Records_API SHALL reject the request without persisting any Record from that request and SHALL return an HTTP 400 Bad Request status with an error response indicating which field failed validation.
5. IF the request payload is neither a single Record object nor an array of Record objects, or is an empty array, or is an array containing more than 1000 Record objects, THEN THE Records_API SHALL reject the request without persisting any Record and SHALL return an HTTP 400 Bad Request status with an error response indicating the payload is invalid.
6. WHEN the Records_API has completed validation and persisted every Record in a valid request, THE Records_API SHALL return an HTTP 200 success status.

### Requirement 7: Upsert and Idempotency

**User Story:** As a community administrator, I want stored records to keep only each player's best result per level, so that the data stays accurate and free of duplicates.

#### Acceptance Criteria

1. WHEN the Records_API processes a Record for a Player and Level_ID that has no existing stored record in the Database, THE Records_API SHALL insert a new record containing the Player identifier, Level_ID, and the submitted Best_Percentage, where Best_Percentage is a value between 0.00 and 100.00 inclusive.
2. WHEN the Records_API processes a Record for a Player and Level_ID whose submitted Best_Percentage is strictly greater than the stored Best_Percentage, THE Records_API SHALL update the stored record so that its Best_Percentage equals the submitted Best_Percentage.
3. IF the Records_API processes a Record for a Player and Level_ID whose submitted Best_Percentage is less than or equal to the stored Best_Percentage, THEN THE Records_API SHALL leave the stored record unchanged and return a response indicating no update was applied.
4. IF the Records_API processes a Record whose Best_Percentage is missing, non-numeric, or outside the range 0.00 to 100.00 inclusive, or whose Player identifier or Level_ID is missing, THEN THE Records_API SHALL reject the Record, leave any existing stored record unchanged, and return an error response indicating the validation failure.
5. THE Database SHALL enforce a unique constraint on the combination of Player identifier and Level_ID such that at most one stored record exists per Player per Level_ID.
6. WHEN the Records_API processes the same Record one or more times, including concurrent processing by parallel API instances, THE Records_API SHALL produce a final stored result for that Player and Level_ID identical to the result produced by processing the Record exactly once, retaining exactly one record that holds the highest submitted Best_Percentage.
7. IF a Database insert or update operation fails while the Records_API is processing a Record, THEN THE Records_API SHALL leave the stored record in its prior state and return an error response indicating the operation did not complete.

### Requirement 8: Data Persistence Schema

**User Story:** As a community administrator, I want a structured datastore for players, demons, and records, so that the system can attribute and rank completions reliably.

#### Acceptance Criteria

1. THE Database SHALL store each Player with a unique player identifier, a unique username between 1 and 255 characters, a non-empty Secret_Player_Token, and a creation timestamp recorded in UTC.
2. THE Database SHALL store each Demon with a unique Level_ID, a non-empty name between 1 and 255 characters, and a difficulty tier whose value is one of the predefined difficulty tiers.
3. THE Database SHALL store each Record with a unique record identifier, a player identifier that references an existing Player, a Level_ID that references an existing Demon, a Best_Percentage between 0 and 100 inclusive, and a last-updated timestamp recorded in UTC.
4. WHEN the Records_API updates or inserts a record, THE Database SHALL set the record's last-updated timestamp to the UTC time of the change.
5. IF a Player, Demon, or Record is submitted with a duplicate value for a field required to be unique, or with a missing or out-of-range required field, THEN THE Database SHALL reject the write, retain the existing stored data unchanged, and return an error indication identifying the violated constraint.
6. IF a Record is submitted with a player identifier or Level_ID that does not reference an existing Player or Demon, THEN THE Database SHALL reject the write, retain existing stored data unchanged, and return an error indication identifying the unresolved reference.

### Requirement 9: Tier List Display

**User Story:** As a community member, I want to view a public demon tier list, so that I can see how players rank across demons.

#### Acceptance Criteria

1. WHEN a visitor opens the Tier_List_Site, THE Tier_List_Site SHALL display all Demons grouped by difficulty tier, with tiers presented in order from highest difficulty to lowest difficulty.
2. IF no Demons exist in the Database when a visitor opens the Tier_List_Site, THEN THE Tier_List_Site SHALL display an empty-state message indicating that no demons are available.
3. WHEN the Tier_List_Site displays a Demon, THE Tier_List_Site SHALL display each Player who has a record for that Demon together with that Player's Best_Percentage expressed as an integer value from 0 to 100.
4. IF a displayed Demon has no Player records, THEN THE Tier_List_Site SHALL display an indication that the Demon has no records rather than display an empty record list.
5. WHEN the Tier_List_Site displays records for a Demon, THE Tier_List_Site SHALL order the records by Best_Percentage from highest to lowest, and SHALL order records that share an equal Best_Percentage alphabetically by Player name.
6. WHERE a Player has completed a Demon at exactly 100 percent, THE Tier_List_Site SHALL display that completion with a visual indicator that is not applied to completions below 100 percent.
7. IF the Tier_List_Site cannot apply the visual indicator for a 100 percent completion, THEN THE Tier_List_Site SHALL omit that completion from display rather than display it without the indicator.
8. WHEN a visitor loads a Tier_List_Site page after the underlying records in the Database have changed, THE Tier_List_Site SHALL display the updated records reflecting all committed changes as of the time the page load begins.

### Requirement 10: Anti-Cheat and Data Integrity

**User Story:** As a community administrator, I want safeguards against bogus submissions, so that the tier list remains trustworthy within the community.

#### Acceptance Criteria

1. WHEN the Records_API processes a Record submitted with a validated Secret_Player_Token, THE Records_API SHALL attribute the Record only to the Player identified by the validated Secret_Player_Token, ignoring any player identifier supplied in the payload.
2. IF the Secret_Player_Token accompanying a Record is missing, malformed, or does not match a Player, THEN THE Records_API SHALL reject the request, persist no Record data, and return an authentication error response.
3. IF a Record references a Level_ID that is not present in the demons table, THEN THE Records_API SHALL reject that Record, persist no Record data from that request, and return an HTTP 400 Bad Request status.
4. IF a request exceeds a maximum payload size of 64 kilobytes, THEN THE Records_API SHALL reject the request, persist no Record data, and return an HTTP 413 Payload Too Large status.
5. WHEN the Tier_List_Site requests records from the Database, THE Tier_List_Site SHALL use a read-only data access path that performs no insert, update, or delete operations.
