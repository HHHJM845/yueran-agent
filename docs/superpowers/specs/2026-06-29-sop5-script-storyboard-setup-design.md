# SOP 5 Script Storyboard Setup Design

## Objective

SOP 5 turns a signed project into production-ready inputs for storyboard image generation. The stage must normalize and confirm the full script, split it into detailed text storyboard shots, generate all required character and scene setting images, and lock those assets before SOP 6 can start.

## Confirmed Business Flow

1. After contract signing, the project enters SOP 5.
2. The writer has already completed a full script. The workspace provides a clear paste area for importing the full script.
3. The system saves both the original script and a standardized script.
4. AI formats and validates the script against the required standard script format.
5. Internal users review the standardized script and fix missing required fields.
6. The complete standardized script is submitted to client review.
7. After client approval, the system runs two production-prep tracks in parallel:
   - Split the approved script into detailed text storyboard shots.
   - Extract all required characters and scenes, then generate setting image candidates.
8. Character and scene setting images are submitted to client review.
9. Character and scene setting reviews support up to three revision rounds, but can be approved early.
10. SOP 6 can only start after the script, text storyboard, and all required character/scene setting images are complete and locked.

## Standard Script Format

The script normalization step must preserve or generate the following structure.

### Front Matter

- Required: title, wrapped in Chinese book-title brackets, for example `《重生之还是她》`.
- Optional but recommended: plot summary, one to three concise sentences.
- Optional but recommended: character bios for major characters, including identity, age, background, and personality notes.

### Scene Content

Each scene must contain:

- Required: episode number, for example `第一集` or `第 1 集`.
- Required: scene number in episode-scene format, for example `1-1` or `第 1-1 场`.
- Required: location/time/interior-exterior scene line. The three elements must be present, order can vary, for example `江边广场 日 外`.
- Required: characters appearing in the scene. Use comma or Chinese dunhao separators.
- Required: visual action description. Paragraphs can start with `△`.
- Required: dialogue. Speaker name and colon are required; emotion tags are optional, for example `小帅（开心）：没想到在这里遇见了你。`.

### Supported Symbols

- `△`: visual action or expression description.
- `OS`: inner monologue.
- `VO`: voice-over where the speaker is not on screen.
- `【闪回】` and `【闪出】`: flashback markers. They must appear in pairs.

## Script Validation Rules

The system should mark required missing fields before client review:

- Missing title.
- Missing episode number.
- Missing scene number.
- Missing scene location/time/interior-exterior elements.
- Missing character list.
- Missing visual action paragraphs.
- Missing dialogue speaker or colon.
- Unpaired flashback markers.

AI may suggest fixes, but internal users must explicitly confirm the standardized script version before it is sent to the client.

## Text Storyboard Output

After client approval of the standardized script, the storyboard split produces scenes and shots. Each shot must include:

- Episode, scene, and shot number.
- Visual description.
- Appearing characters.
- Scene reference.
- Action and performance notes.
- Camera movement.
- Image generation prompt.
- Video generation prompt.
- Required character setting image references.
- Required scene setting image references.

These references become the mapping used by SOP 6 to inject the correct character and scene images into each storyboard image generation task.

## Character And Scene Setting Images

The system extracts required production entities from the approved script and text storyboard.

### Character Rules

- Generate setting images for all major and effective appearing characters.
- Do not create standalone setting images for extras, crowds, passers-by, or generic background people.

### Scene Rules

- Generate setting images for every scene that appears in the script.

### Candidate Quantity

For each character and scene, the first generation creates four image candidates. Internal users select one candidate as the locked setting image. If none are suitable, they can generate additional candidates.

## Internal Workspace UI

The SOP 5 workspace should be organized as a production-prep surface, not as a long form. It should make the sequence clear: script first, extraction second, candidate images third, review and lock last.

### 1. Script Import And Format Check

The first section contains:

- A large paste area for the complete script.
- The raw imported script.
- The AI-standardized script.
- Format validation issues, grouped by missing required fields and warning-level suggestions.
- A primary action to confirm the standardized script and submit it to client review.

Required fields with validation errors should be visually obvious. AI can suggest fixes, but internal users must explicitly confirm the standardized script.

### 2. Character And Scene Extraction Confirmation

After the script is approved, the system should first show the extracted production list before generating images.

Use two clear tabs or paired sections:

- Characters.
- Scenes.

Each extracted item should show:

- Name.
- Type.
- Source scenes or episode-scene references.
- Short description.
- Whether this item needs a setting image.
- An exclude action for passers-by, crowds, background people, or false positives.

The next step is a clear action: confirm the extraction list and generate setting images.

### 3. Character Candidate Image Cards

After the extraction list is confirmed, each character appears as one horizontal card.

Left side:

- Character name.
- Short description.
- Source scenes.
- Status, such as pending generation, generated, selected, waiting client review, or locked.

Right side:

- Four image candidates laid out horizontally.
- Click a candidate to select the current setting image.
- Show a strong selected state.
- Provide regenerate or add-candidate actions when none of the four are suitable.

### 4. Scene Candidate Image Cards

Scenes use the same card pattern as characters.

Left side:

- Scene name.
- Location/time/interior-exterior information.
- Source scenes.
- Status.

Right side:

- Four scene image candidates laid out horizontally.
- Click a candidate to select the locked scene setting image.
- Support regenerate or add-candidate actions.

### 5. Client Review And Locking

After every required character and scene has one selected candidate, the bottom of the workspace shows the review section:

- Submit character and scene setting image review.
- Review round history.
- Round 1, round 2, round 3 statuses.
- Client rejection feedback.
- Approved and locked state.

The review does not need to run all three rounds. If the client approves earlier, the setting images lock immediately.

### 6. SOP 6 Gate Checklist

The final section shows an explicit gate checklist:

- Standardized script confirmed.
- Script passed client review.
- Text storyboard generated.
- Character setting images locked.
- Scene setting images locked.
- Every storyboard shot maps to required locked character and scene setting images.

Only when all checks pass can the project proceed to storyboard image generation.

## Client Review Rules

There are two client review points in SOP 5:

1. Complete script review.
2. Character and scene setting image review.

The character/scene review supports up to three rounds by default. The process can complete early if all setting images are approved before round three.

On rejection, feedback is written back to the internal workspace and the related setting image remains editable or regeneratable. On approval, the setting image is locked.

## SOP 6 Entry Gate

SOP 6 cannot start unless all conditions are true:

- The standardized complete script is saved.
- The complete script has passed client review.
- The detailed text storyboard has been generated and saved.
- All required character setting images exist.
- All required scene setting images exist.
- Character and scene setting images have passed client review and are locked.
- Every text storyboard shot maps to the required locked character and scene setting images.

## Required Product Changes From Current Implementation

- Rename the current "script direction package review" concept to "complete script review".
- Add a script paste/import area focused on complete script content.
- Add AI script normalization and validation against the standard format.
- Save both original script and standardized script versions.
- Remove the fixed "3 character references and 2 scene references" assumption.
- Extract all required characters and scenes from the script/storyboard.
- Generate real setting image candidates for characters and scenes.
- Support setting image selection, regeneration, review rounds, and locking.
- Persist the shot-to-character/scene setting-image mapping for SOP 6.

## Out Of Scope

- SOP 6 image generation UI changes beyond consuming the locked reference mapping.
- Final video generation logic.
- Contract, quote, or Feishu delivery changes outside SOP 5 review links and state gates.
