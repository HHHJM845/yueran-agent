# SOP5 Setting Image Card A2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SOP5 production setup candidate-image strip with the confirmed A2 layout: left entity info, center swipeable main candidate canvas, right prompt/generation controls, and double-click zoom.

**Architecture:** Keep the change local to the existing `ScriptProductionSetupCard` in `src/components/workspace/workspace-shell.tsx`. Reuse existing data and actions: `saveProductionReferencePrompt`, `generateProductionReferenceImages`, and `selectProductionReferenceImage`. Add only local UI state for the zoom viewer and active canvas candidate.

**Tech Stack:** Next.js, React, TypeScript, Tailwind utility classes, existing shadcn/base UI primitives, existing workspace API helpers.

## Global Constraints

- Do not change database schema or backend API contracts.
- Do not add mock or static fake image data.
- Do not refactor unrelated SOP5 flows.
- Preserve existing entity list editing, prompt saving, image generation, and selected-image persistence behavior.
- Every loading, empty, failed, locked, and disabled state must remain visible in natural Chinese copy.
- UI must avoid overlapping cards, text overflow, and page-level horizontal scrolling at desktop widths around 1280px.

---

## File Structure

- Modify `src/components/workspace/workspace-shell.tsx`
  - Add local state for zoom viewer.
  - Replace the current thumbnail-strip candidate area inside `ScriptProductionSetupCard`.
  - Add a small inline zoom overlay inside the same component.
  - Keep existing helper functions such as `imageStatusLabel`, `referenceDepthLabel`, `getReferencePrompt`, `getReferenceRatio`, and `getReferenceCount`.
- Modify `src/components/workspace/workspace-shell-project-actions.test.mjs`
  - Update the SOP5 production setup source assertions for A2 copy/classes.
  - Assert old thumbnail-strip-specific layout is no longer the primary pattern.

No new reusable component file is required for this pass; the surrounding workspace shell is already a large single-file pattern, and this is a local layout replacement.

---

### Task 1: Add A2 Source-Level Regression Tests

**Files:**
- Modify: `src/components/workspace/workspace-shell-project-actions.test.mjs`

**Interfaces:**
- Consumes: The source text of `workspace-shell.tsx`.
- Produces: Failing tests that require A2 layout copy and remove the old small-thumbnail strip expectations.

- [ ] **Step 1: Replace the existing SOP5 candidate-pool assertions**

In `src/components/workspace/workspace-shell-project-actions.test.mjs`, update the test named `SOP 5 production setup uses confirmed lists editable prompts and horizontal candidate pools` to this exact version:

```js
test("SOP 5 production setup uses confirmed lists editable prompts and A2 candidate canvas", () => {
  assert.match(source, /清单确认区/);
  assert.match(source, /新增人物/);
  assert.match(source, /新增场景/);
  assert.match(source, /移入忽略列表/);
  assert.match(source, /恢复到清单/);
  assert.match(source, /确认清单/);
  assert.match(source, /设定图生成区/);
  assert.match(source, /主候选画布/);
  assert.match(source, /候选 \{activeCanvasIndex \+ 1\} \/ \{Math\.max\(referenceImages\.length, 1\)\}/);
  assert.match(source, /双击放大查看/);
  assert.match(source, /onDoubleClick=/);
  assert.match(source, /setReferenceImagePreview/);
  assert.match(source, /snap-x snap-mandatory/);
  assert.match(source, /按当前提示词生成/);
  assert.match(source, /生成数量/);
  assert.match(source, /比例/);
  assert.match(source, /设为采用/);
  assert.match(source, /selectProductionReferenceImage/);
  assert.match(source, /saveProductionReferencePrompt/);
  assert.match(source, /confirmProductionEntityList/);
  assert.doesNotMatch(source, /候选 \{referenceImages\.length\}\/4/);
  assert.doesNotMatch(source, /生成此设定图/);
  assert.doesNotMatch(source, /补图/);
});
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run:

```bash
node --test src/components/workspace/workspace-shell-project-actions.test.mjs
```

Expected: FAIL because `主候选画布`, `双击放大查看`, and `snap-x snap-mandatory` are not implemented yet.

---

### Task 2: Add Zoom Viewer State and A2 Candidate Canvas

**Files:**
- Modify: `src/components/workspace/workspace-shell.tsx`

**Interfaces:**
- Consumes:
  - `referenceImages: GeneratedImageView[]`
  - `activeReference: ProductionReferenceSetView | null`
  - `selectedImageId: string | null`
  - `handleSelectReferenceImage(referenceSetId: string, imageId: string): Promise<void>`
- Produces:
  - `referenceImagePreview` state object for the zoom overlay.
  - A center canvas that uses `snap-x snap-mandatory` and renders one full-width candidate page per image.

- [ ] **Step 1: Add local preview state near existing reference image state**

In `ScriptProductionSetupCard`, near:

```ts
const [reviewingReferenceImageId, setReviewingReferenceImageId] = useState<string | null>(null);
```

add:

```ts
const [referenceImagePreview, setReferenceImagePreview] = useState<{
  entityName: string;
  referenceSetId: string;
  selectedImageId: string | null;
  images: GeneratedImageView[];
  index: number;
} | null>(null);
```

- [ ] **Step 2: Replace the old three-column entity card class**

Replace:

```tsx
<div key={entity.id} className="grid gap-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 xl:grid-cols-[14rem_minmax(18rem,1fr)_minmax(20rem,1.2fr)]">
```

with:

```tsx
<div key={entity.id} className="grid gap-3 rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-soft)] p-3 xl:grid-cols-[13rem_minmax(24rem,1fr)_minmax(17rem,0.76fr)]">
```

- [ ] **Step 3: Move the Prompt/control block to the right column**

Keep the existing textarea, generation count input, ratio select, save button, and generate button behavior, but wrap that block with:

```tsx
<div className="grid min-w-0 content-start gap-2">
```

Use this control grid so the buttons do not overlap:

```tsx
<div className="grid gap-2 sm:grid-cols-2">
```

Then render save and generate buttons in a second row:

```tsx
<div className="grid gap-2 sm:grid-cols-[6rem_minmax(0,1fr)]">
```

- [ ] **Step 4: Replace the old thumbnail strip with the A2 center canvas**

Replace the old candidate area:

```tsx
<div className="min-w-0">
  {referenceImages.length === 0 ? (
    ...
  ) : (
    <div className="flex gap-2 overflow-x-auto pb-2">
      ...
    </div>
  )}
</div>
```

with this structure:

```tsx
<div className="min-w-0">
  <div className="relative min-h-[21rem] overflow-hidden rounded-card-sm border border-[var(--border-soft)] bg-[var(--surface-card)]" aria-label={`${entity.name} 主候选画布`}>
    {referenceImages.length === 0 ? (
      <div className="flex h-full min-h-[21rem] items-center justify-center p-5 text-center text-xs leading-5 text-[var(--text-secondary)]">
        还没有候选图。确认提示词后点击“按当前提示词生成”。
      </div>
    ) : (
      <>
        <div className="flex h-full min-h-[21rem] snap-x snap-mandatory overflow-x-auto scroll-smooth">
          {referenceImages.map((image, index) => {
            const isSelected = selectedImageId === image.id;
            const isSelectable = image.status === "succeeded";
            return (
              <button
                key={image.id}
                type="button"
                className="grid min-w-full snap-start place-items-center bg-[var(--surface-soft)] p-4 text-left"
                onClick={() => setReferenceImagePreview((current) => current?.referenceSetId === activeReference?.id ? { ...current, index } : current)}
                onDoubleClick={() => currentCanvasImage && setReferenceImagePreview({
                  entityName: entity.name,
                  referenceSetId: activeReference.id,
                  selectedImageId,
                  images: referenceImages,
                  index,
                })}
                disabled={!activeReference}
              >
                <div className={cn(
                  "relative grid max-h-[18rem] min-h-[15rem] w-full max-w-[15rem] place-items-center overflow-hidden rounded-card-sm border bg-[var(--surface-card)]",
                  entity.entityType === "scene" ? "aspect-video max-w-[28rem]" : "aspect-[3/4]",
                  isSelected ? "border-[var(--accent)] shadow-[0_0_0_3px_color-mix(in_oklch,var(--accent)_18%,transparent)]" : "border-[var(--border-soft)]"
                )}>
                  {image.ossUrl ? (
                    <Image src={image.ossUrl} alt={`${entity.name} 设定图候选 ${index + 1}`} width={520} height={680} sizes="(min-width: 1280px) 440px, 80vw" unoptimized className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-4 text-center text-xs leading-5 text-[var(--text-secondary)]">{imageStatusLabel(image.status)}</div>
                  )}
                  {!isSelectable && (
                    <span className="absolute bottom-3 rounded-full bg-[var(--surface-card)]/90 px-3 py-1 text-xs text-[var(--text-secondary)]">
                      {imageStatusLabel(image.status)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <div className="pointer-events-none absolute left-3 right-3 top-3 flex items-center justify-between gap-2">
          <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-card)]/90 px-3 py-1 text-xs text-[var(--text-secondary)] shadow-sm">候选 {activeCanvasIndex + 1} / {Math.max(referenceImages.length, 1)}</span>
          <span className="rounded-full border border-[var(--border-soft)] bg-[var(--surface-card)]/90 px-3 py-1 text-xs text-[var(--text-secondary)] shadow-sm">双击放大查看</span>
        </div>
        <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
          {referenceImages.map((image, index) => (
            <span key={image.id} className={cn("h-1.5 rounded-full bg-[var(--text-tertiary)]/35 transition-all", index === activeCanvasIndex ? "w-5 bg-[var(--accent)]" : "w-1.5")} />
          ))}
        </div>
      </>
    )}
  </div>
  {activeReference && currentCanvasImage && (
    <Button
      type="button"
      size="sm"
      className="mt-2 w-full"
      disabled={!canEdit || currentCanvasImage.status !== "succeeded" || reviewingReferenceImageId === currentCanvasImage.id || entity.status === "locked"}
      onClick={() => void handleSelectReferenceImage(activeReference.id, currentCanvasImage.id)}
    >
      {reviewingReferenceImageId === currentCanvasImage.id ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
      {selectedImageId === currentCanvasImage.id ? "已采用" : "设为采用"}
    </Button>
  )}
</div>
```

Before returning JSX for each entity, define:

```ts
const selectedImageIndex = Math.max(0, referenceImages.findIndex((image) => image.id === selectedImageId));
const activeCanvasIndex = selectedImageIndex >= 0 ? selectedImageIndex : 0;
const currentCanvasImage = referenceImages[activeCanvasIndex] ?? referenceImages[0] ?? null;
```

Note: use `currentCanvasImage` inside `onDoubleClick` by setting the clicked `image` directly if TypeScript complains about closure narrowing:

```tsx
onDoubleClick={() => activeReference && setReferenceImagePreview({
  entityName: entity.name,
  referenceSetId: activeReference.id,
  selectedImageId,
  images: referenceImages,
  index,
})}
```

- [ ] **Step 5: Run focused test and TypeScript**

Run:

```bash
node --test src/components/workspace/workspace-shell-project-actions.test.mjs
npm run typecheck
```

Expected: source test PASS; typecheck may still reveal JSX/TypeScript issues to fix inside `workspace-shell.tsx`.

---

### Task 3: Add Double-Click Zoom Overlay

**Files:**
- Modify: `src/components/workspace/workspace-shell.tsx`

**Interfaces:**
- Consumes: `referenceImagePreview` state from Task 2.
- Produces: A fixed overlay for candidate image preview with previous/next, set selected, and close.

- [ ] **Step 1: Add preview helper variables before the main return**

Inside `ScriptProductionSetupCard`, after handler functions and before `return`, add:

```ts
const previewImage = referenceImagePreview
  ? referenceImagePreview.images[referenceImagePreview.index] ?? null
  : null;
```

- [ ] **Step 2: Render the overlay at the end of the component JSX**

Before the closing fragment of `ScriptProductionSetupCard`, render:

```tsx
{referenceImagePreview && previewImage && (
  <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/55 p-4" role="dialog" aria-modal="true" aria-label={`${referenceImagePreview.entityName} 候选图放大查看`}>
    <div className="grid max-h-[92vh] w-full max-w-5xl gap-3 rounded-card bg-[var(--surface-card)] p-4 shadow-[0_30px_90px_-45px_rgb(15_23_42/0.55)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">{referenceImagePreview.entityName} · 候选 {referenceImagePreview.index + 1} / {referenceImagePreview.images.length}</p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">{imageStatusLabel(previewImage.status)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" disabled={referenceImagePreview.index === 0} onClick={() => setReferenceImagePreview((current) => current ? { ...current, index: Math.max(0, current.index - 1) } : current)}>
            上一张
          </Button>
          <Button type="button" size="sm" variant="outline" disabled={referenceImagePreview.index >= referenceImagePreview.images.length - 1} onClick={() => setReferenceImagePreview((current) => current ? { ...current, index: Math.min(current.images.length - 1, current.index + 1) } : current)}>
            下一张
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canEdit || previewImage.status !== "succeeded" || reviewingReferenceImageId === previewImage.id}
            onClick={() => void handleSelectReferenceImage(referenceImagePreview.referenceSetId, previewImage.id)}
          >
            {reviewingReferenceImageId === previewImage.id ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
            {referenceImagePreview.selectedImageId === previewImage.id ? "已采用" : "设为采用"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setReferenceImagePreview(null)}>
            关闭
          </Button>
        </div>
      </div>
      <div className="grid max-h-[72vh] place-items-center overflow-hidden rounded-card-sm bg-[var(--surface-soft)] p-3">
        {previewImage.ossUrl ? (
          <Image src={previewImage.ossUrl} alt={`${referenceImagePreview.entityName} 候选图放大查看`} width={1200} height={900} sizes="90vw" unoptimized className="max-h-[68vh] w-auto max-w-full rounded-card-sm object-contain" />
        ) : (
          <div className="flex min-h-[24rem] items-center justify-center text-sm text-[var(--text-secondary)]">{imageStatusLabel(previewImage.status)}</div>
        )}
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Keep preview selected state in sync after selecting**

In `handleSelectReferenceImage`, after a successful API result, add:

```ts
setReferenceImagePreview((current) => current ? { ...current, selectedImageId: imageId } : current);
```

This ensures the overlay button changes to `已采用` without waiting for the workspace refresh.

- [ ] **Step 4: Run focused test and typecheck**

Run:

```bash
node --test src/components/workspace/workspace-shell-project-actions.test.mjs
npm run typecheck
```

Expected: PASS.

---

### Task 4: Polish Responsive Behavior and Browser Verify

**Files:**
- Modify: `src/components/workspace/workspace-shell.tsx`
- Modify: `src/components/workspace/workspace-shell-project-actions.test.mjs` only if class/copy names changed during implementation.

**Interfaces:**
- Consumes: A2 layout from Tasks 2-3.
- Produces: Verified no-overlap behavior in the running app.

- [ ] **Step 1: Adjust responsive classes if 1280px still feels cramped**

If browser inspection shows the right Prompt panel is too narrow at 1280px, change the card grid from:

```tsx
xl:grid-cols-[13rem_minmax(24rem,1fr)_minmax(17rem,0.76fr)]
```

to:

```tsx
2xl:grid-cols-[13rem_minmax(24rem,1fr)_minmax(17rem,0.76fr)]
```

and for `xl` use:

```tsx
xl:grid-cols-[13rem_minmax(0,1fr)]
```

with the right control panel spanning both columns:

```tsx
xl:col-span-2 2xl:col-span-1
```

Only apply this if visual verification shows the three-column layout is cramped.

- [ ] **Step 2: Run validation commands**

Run:

```bash
node --test src/components/workspace/workspace-shell-project-actions.test.mjs
npm run typecheck
npm run lint -- --ignore-pattern '.worktrees/**' --ignore-pattern '.next/**'
```

Expected:
- Source test PASS.
- Typecheck PASS.
- Lint PASS or only existing unrelated warnings noted in final response.

- [ ] **Step 3: Browser check**

Use the in-app browser at `http://localhost:3001/` and inspect SOP5 `人物场景设定` -> `设定图生成区`.

Verify:
- Cards do not overlap.
- Center area is a single main candidate canvas.
- Candidate images are not laid out as many separate narrow cards.
- Right panel shows Prompt, quantity, ratio, save, generate, and set-selected actions.
- Double-clicking a candidate opens the preview overlay.
- Closing the overlay returns to the card.

- [ ] **Step 4: Final report**

Report:
- Root cause: old three-column thumbnail strip could overflow and overlap controls.
- Changed: A2 main candidate canvas and zoom overlay in `workspace-shell.tsx`; source regression test updated.
- Verification: list exact commands and browser check result.
