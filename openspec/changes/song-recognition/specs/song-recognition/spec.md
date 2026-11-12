# Spec Delta

## Purpose

Defines how mdconnect finds the songs on a disc and turns them into track titles: by listening to the deck's output and asking Shazam or AcoustID, or by searching MusicBrainz by name, then letting the user review the titles and write them to the disc.

## ADDED Requirements

### Requirement: Identify action

The track toolbar SHALL offer Identify, in the desktop app and in the web app. It SHALL open the Identify dialog for the selected tracks, in disc order. Identify SHALL be unavailable, with the reason, when no track is selected, when the player cannot be used, or while a change, upload or recording is in progress. A write-protected disc SHALL NOT block it.

#### Scenario: Identify selected tracks

- **WHEN** tracks 2 and 5 are selected and the user chooses Identify
- **THEN** the Identify dialog opens listing tracks 2 and 5, in that order, with their current titles

#### Scenario: Nothing selected

- **WHEN** no track is selected
- **THEN** Identify is unavailable and says to select tracks

#### Scenario: During a recording

- **WHEN** a recording is in progress
- **THEN** Identify is unavailable and says that a recording is in progress

### Requirement: Identification methods

The Identify dialog SHALL offer three methods: Shazam, AcoustID and Search by name. The chosen method SHALL be remembered. In the web app Shazam SHALL be unavailable, saying that it works only in the desktop app, and AcoustID SHALL be chosen when Shazam was remembered. The dialog SHALL be operable with the keyboard alone.

#### Scenario: Remembered method

- **WHEN** the user identified tracks with AcoustID before and opens Identify again
- **THEN** AcoustID is already chosen

#### Scenario: Shazam in the web app

- **WHEN** the user opens Identify in the web app
- **THEN** Shazam is unavailable and says it works only in the desktop app, and AcoustID or Search by name can be chosen

### Requirement: Listening input

For Shazam and AcoustID, the dialog SHALL offer the same input choice, level meter, remembered input, permission and processing rules as the recording setup, and SHALL say that the deck's output must be connected to that input. Search by name SHALL NOT open any audio input.

#### Scenario: Same input as recording

- **WHEN** the user recorded from "Line In" and opens Identify with Shazam
- **THEN** "Line In" is already chosen and the level meter moves with its audio

#### Scenario: Search needs no input

- **WHEN** the user chooses Search by name
- **THEN** no input list or level meter is shown and the system is not asked for audio capture

### Requirement: Listening with Shazam

For each track, the app SHALL play the track on the deck from its beginning and capture the input for 12 seconds, then ask Shazam about that excerpt. When Shazam finds no song, the app SHALL keep listening to the next 12 seconds, up to three excerpts, and only while a whole excerpt still fits in the track. A track shorter than 12 seconds SHALL NOT be played and SHALL be marked too short.

#### Scenario: Found on the first excerpt

- **WHEN** Shazam finds a song in the first 12 seconds of track 2
- **THEN** the deck moves on to the next track without listening further, and track 2 shows the song found

#### Scenario: Found on a later excerpt

- **WHEN** Shazam finds nothing in seconds 0 to 12 of a track but finds a song in seconds 12 to 24
- **THEN** the track shows the song found, and the deck played the track without stopping between excerpts

#### Scenario: Excerpts stay within the track

- **WHEN** a selected track is 20 seconds long and Shazam finds nothing in its first 12 seconds
- **THEN** no second excerpt is taken, because it would run into the next track, and the track shows "Not recognised"

#### Scenario: Not found

- **WHEN** Shazam finds nothing in three excerpts
- **THEN** the track shows "Not recognised" and keeps its current title

#### Scenario: Too short

- **WHEN** a selected track is 9 seconds long
- **THEN** it is not played and shows "Too short to identify"

### Requirement: Listening with AcoustID

For each track, the app SHALL play the track on the deck from its beginning and capture the input for two minutes, or the whole track when it is shorter, then look up a fingerprint of that audio with the track's length on AcoustID. The best match SHALL be taken when its score is at least 0.5. A track shorter than 10 seconds SHALL be marked too short.

#### Scenario: Match

- **WHEN** AcoustID returns a recording with score 0.9 for track 4
- **THEN** track 4 shows that recording's title, artist and album

#### Scenario: Weak or no match

- **WHEN** AcoustID returns no recording, or only recordings scored below 0.5
- **THEN** the track shows "Not recognised" and keeps its current title

#### Scenario: Short track listened to whole

- **WHEN** a selected track is 1:30 long
- **THEN** the app listens to the whole track before looking it up

### Requirement: Search by name

For each track, the user SHALL be able to search MusicBrainz with text that starts as the track's current title, and pick one recording from up to 10 results, each showing title, artist, album, year and length. A search SHALL run only when the user asks for it. The picked recording SHALL become the track's result.

#### Scenario: Pick a result

- **WHEN** the user searches "Dawn" for track 3 and picks the result "Dawn — Eleni Karaindrou, Eternity and a Day, 1998, 3:41"
- **THEN** track 3's result becomes that recording

#### Scenario: No results

- **WHEN** a search returns nothing
- **THEN** the dialog says no recording was found and the track keeps its current title

#### Scenario: Untitled track

- **WHEN** track 7 has no title
- **THEN** its search text starts empty and Search is unavailable until the user types something

### Requirement: Recognition service consent

Before the first request to Shazam, to AcoustID or to MusicBrainz, the app SHALL say what will be sent to that service and ask the user to confirm. Each service's consent SHALL be remembered separately. When the user declines, nothing SHALL be sent to that service.

#### Scenario: First use of AcoustID

- **WHEN** the user starts identifying with AcoustID for the first time
- **THEN** the app explains that an audio fingerprint and each track's length are sent to AcoustID, and plays the first track only after the user confirms

#### Scenario: Declined

- **WHEN** the user declines the Shazam notice
- **THEN** no track is played and nothing is sent to Shazam

#### Scenario: Consent per service

- **WHEN** the user agreed to AcoustID and then chooses Search by name for the first time
- **THEN** the app asks for consent to MusicBrainz

### Requirement: What recognition sends

The app SHALL send Shazam only signatures of the captured excerpts and their lengths, AcoustID only a fingerprint and the track's length, and MusicBrainz only the search text. Audio, file names, the disc's other titles and device details SHALL NOT be sent.

#### Scenario: Shazam request

- **WHEN** the app asks Shazam about an excerpt
- **THEN** the request carries the excerpt's signature and length, and no audio samples

#### Scenario: Search request

- **WHEN** the user searches "Dawn"
- **THEN** the only text sent to MusicBrainz is "Dawn"

### Requirement: Service failures

When a service cannot be reached, refuses a request or limits how often it may be asked, the app SHALL try that request once more after a pause, then mark the track "The service could not be reached" and go on with the next track.

#### Scenario: Service down

- **WHEN** AcoustID cannot be reached for track 2 on both attempts
- **THEN** track 2 shows "The service could not be reached" and track 3 is identified next

### Requirement: Identification progress and cancel

While listening, a dialog SHALL show which track is being identified out of how many, its title, and whether the app is listening or asking the service. It SHALL offer Cancel, which stops the deck and the capture at once and keeps the results found so far. When the deck is disconnected, identification SHALL stop the same way and say so.

#### Scenario: Progress

- **WHEN** track 2 of 3 is being listened to
- **THEN** the dialog shows "Track 2 of 3", the track's title and that it is listening

#### Scenario: Cancel

- **WHEN** the user cancels while track 3 of 4 is being listened to
- **THEN** the deck stops, tracks 1 and 2 keep their results, and tracks 3 and 4 show no result

#### Scenario: Deck unplugged

- **WHEN** the device is disconnected during identification
- **THEN** listening stops and the app says the device was disconnected

### Requirement: Controls blocked while listening

While the app listens to the deck, editing, uploads, recording, Identify and the player controls SHALL be unavailable and say that identification is in progress. The deck SHALL be stopped when listening ends, however it ends.

#### Scenario: Blocked controls

- **WHEN** identification is listening to a track
- **THEN** Rename, Add tracks, Record and Play are unavailable and say that identification is in progress

#### Scenario: Deck stopped at the end

- **WHEN** the last track has been listened to
- **THEN** the deck is stopped

### Requirement: Title format

The dialog SHALL build each new title from the song found in the format the user chooses: Title, Artist - Title, Title - Artist, Album - Title, or Artist - Album - Title. The format SHALL be remembered. A part the service did not return SHALL be left out with its separator.

#### Scenario: Artist - Title

- **WHEN** the format is Artist - Title and the song found is "Dawn" by "Eleni Karaindrou"
- **THEN** the new title is "Eleni Karaindrou - Dawn"

#### Scenario: Album unknown

- **WHEN** the format is Album - Title and the service returned no album for "Dawn"
- **THEN** the new title is "Dawn"

### Requirement: Results review

The dialog SHALL list each track with its number, current title and new title, or why it has none. The user SHALL be able to edit a new title, leave a track out, and identify the remaining tracks again with any method. A track left out or without a result SHALL keep its current title.

#### Scenario: Edit a new title

- **WHEN** the new title for track 2 is "Eleni Karaindrou - Dawn" and the user edits it to "Dawn"
- **THEN** "Dawn" is the title applied to track 2

#### Scenario: Leave a track out

- **WHEN** the user unticks track 5 before applying
- **THEN** track 5 keeps its current title

#### Scenario: Try the rest another way

- **WHEN** Shazam did not recognise track 4 and the user switches to Search by name
- **THEN** the user can search for track 4 while the other tracks keep their results

### Requirement: Applying new titles

Apply new titles SHALL change only the titles of the ticked tracks, leaving groups and every other title as they are, with the same title conversion and title-space rules as renaming a track, and SHALL show the converted titles before applying. Apply SHALL be unavailable, with the reason, on a write-protected disc or when the titles do not fit.

#### Scenario: Apply

- **WHEN** tracks 2 and 3 have new titles and the user chooses Apply new titles
- **THEN** both tracks show their new titles after the disc is read again

#### Scenario: Accented title

- **WHEN** the new title is "Te Lloré un Río"
- **THEN** the dialog shows that "Te Llore un Rio" will be saved

#### Scenario: Groups unchanged

- **WHEN** tracks 1 to 3 form the group "Side A" and the user applies a new title to track 5 only
- **THEN** only track 5's title changes, and "Side A" keeps its name and its tracks

#### Scenario: Write-protected disc

- **WHEN** the disc is write-protected
- **THEN** tracks can be identified, but Apply new titles is unavailable and says the disc is write-protected

### Requirement: Full-width titles from results

When full-width titles are on, applying a new title SHALL also save its full-width form, unless that form reads the same as the half-width title once converted back. Otherwise, and when full-width titles are off, the track's full-width title SHALL be emptied, so an old one does not stay.

#### Scenario: Full-width title

- **WHEN** full-width titles are on and the new title is "夜明け"
- **THEN** the track's full-width title is set to "夜明け"

#### Scenario: Full-width letters only

- **WHEN** full-width titles are on and the new title is "ＡＢＣ"
- **THEN** the track's title is "ABC" and its full-width title is empty, since "ＡＢＣ" reads as "ABC"

#### Scenario: Old full-width title cleared

- **WHEN** track 4 has the full-width title "夜明け" and the new title applied is "Dawn"
- **THEN** track 4's full-width title is cleared, so the disc shows "Dawn"
