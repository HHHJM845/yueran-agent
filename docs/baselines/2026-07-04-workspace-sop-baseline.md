# 2026-07-04 Workspace SOP Baseline

This checkpoint freezes the currently verified workspace behavior for SOP1 Brief polish, SOP2 order-risk assessment naming/layout, external review-link handling, SOP3 creative proposal hierarchy/history previews, SOP4 commercial workspace hierarchy, and the wider SOP baseline before further workspace changes.

## Baseline Target

Protect the existing front-end and back-end behavior for:

- SOP1 Brief intake, normalized Brief confirmation, client Brief review link, and risk-check handoff.
- SOP1 Brief workspace compactness: no top `SOP 1 · Brief 收集与需求结构化` card, no extra explanatory microcopy, one external-facing Brief confirmation flow, and one visible version time.
- SOP1 visual hierarchy: Brief card titles stay stronger, the child tab label stays `Brief 需求结构化` without the slash, and the standardized Brief table keeps stable field emphasis.
- SOP1 standardized Brief field emphasis stays field-based, with the highlighted labels limited to `产品/服务`, `视频目标`, `核心卖点`, `时间节点`, and `预算/报价`.
- SOP2 user-facing risk work area is named `接单风险评估`; internal stage keys and risk-check contracts remain unchanged.
- SOP2 `接单风险评估` follows the standardized Brief table hierarchy: clearer title, bold field labels, compact body text, grouped summary fields, and at most five concise order-impact issues.
- SOP2 completed assessment does not show a `重新生成` button; regeneration is only available as a recovery path before an assessment exists or after automatic generation fails.
- SOP2 accept/reject decision rules and risk issue ordering remain protected.
- SOP3 creative proposal flow, including bundled Round 1 story outlines, full-card direction selection, Round 1 style images, client review payloads, Round 2 deepening story/script/storyboard split/image flow, and final confirmation.
- SOP3 creative proposal UI keeps the standardized Brief-style visual hierarchy: clear card titles, bold field labels, compact body text, grouped/two-column information blocks, and no decorative icon entry before the current task title such as `整理最终提案`.
- SOP3 read-only progress/history previews that switch the workspace into the historical generation view without changing persisted project state.
- SOP4 workload estimate, quote/contract, contract review, and delivery checklist gates.
- SOP4 commercial workspace UI keeps the standardized Brief-style visual hierarchy: clearer card titles, bold field labels, compact body text, grouped/two-column information blocks, and reduced explanatory prose across workload estimate, quote, contract, and delivery checklist cards.
- SOP5 plain script, standardized script, storyboard split, production setup, ignored entity handling, setting-image review, storyboard media generation, storyboard batch review link display, and storyboard video handoff.
- SOP5 standardized script validation accepts common film-production time labels such as `破晓`, `拂晓`, `黎明`, `日出`, and `午夜`, including complete `破晓 内/外` scene headings.
- SOP5 production setup setting-image generation busy state is scoped per person/scene card, so generating one card does not disable the other person or scene generation buttons.
- SOP5 `文字分镜拆解` workspace keeps the standardized Brief-style visual hierarchy: clearer card title, bold field labels, compact body text, grouped status metrics, field-style scene/shot rows, and reduced explanatory prose.
- SOP6 storyboard image generation keeps large readable sizing for the main preview, candidate strip, and all-shot navigation instead of forcing the whole workbench into one compressed screen.
- SOP6 enlarged storyboard/setting-image previews render above the left project sidebar and do not get hidden by workspace stacking layers.
- SOP7 AI video generation mirrors the storyboard image workbench: large video preview, version candidate strip, all-shot navigation, and the lower prompt/control console stay in one workspace.
- SOP7 video previews open in a full-screen overlay above the workspace/sidebar, and the all-shot navigation thumbnails recover the source storyboard image from generated videos when needed.
- SOP8/9 A copy / B copy review-cut workspace keeps the standardized Brief-style text hierarchy: clear stage titles, bold field labels, compact structured blocks, timestamp feedback fields, and minimal explanatory copy.
- SOP8/9 upload, client-review-link, advance-to-B-copy, and advance-to-archive business logic stays unchanged while the user-visible typography is protected.
- SOP10 archive workspace keeps the standardized Brief-style structured hierarchy: `完整归档` title, status overview fields, compact two-column archive conditions, clear form field labels, and reduced explanatory copy.
- SOP10 archive save and project-close business logic stays unchanged while the user-visible typography is protected.
- External client review pages, including key unlock, hash-based verification-code prefill, manual unlock click, OK / not OK direct buttons, full Brief/contract/script/story content, and per-shot storyboard decisions.
- Client review launch cards copy a complete review URL that includes the verification code in the hash, so the link can be pasted and reopened after the workspace is refreshed.
- Local development worker behavior, including `npm run dev` launching web and worker together and worker concurrency handling.

## Protected Entrypoint

Run this command before and after any future change touching the protected surfaces:

```bash
npm run test:baseline
```

For TypeScript or shared API/UI edits, also run:

```bash
npm run typecheck
```

The baseline command must exit non-zero when any protected behavior regresses.

## Current Passing Evidence

Verified locally on 2026-07-04:

```text
npm run typecheck
PASS: tsc --noEmit

npm run test:baseline
PASS: 227 tests
```

Re-verified locally on 2026-07-05 after packaging the SOP6 storyboard image workbench baseline:

```text
npx tsx --test src/components/workspace/workspace-shell-sop5-focused-flow.test.mjs
PASS: 19 tests

npm run typecheck
PASS: tsc --noEmit

npm run test:baseline
PASS: 228 tests
```

Re-verified locally on 2026-07-05 after packaging the SOP7 AI video generation workbench baseline:

```text
npx tsx --test src/components/workspace/workspace-shell-sop5-focused-flow.test.mjs
PASS: 21 tests

npm run typecheck
PASS: tsc --noEmit

npm run test:baseline
PASS: 230 tests

npm run build
PASS: next build
```

Re-verified locally on 2026-07-05 after packaging the SOP8/9 A copy / B copy review-cut typography baseline:

```text
npx tsx --test src/components/workspace/workspace-shell-sop5-focused-flow.test.mjs
PASS: 22 tests

npm run typecheck
PASS: tsc --noEmit

npm run test:baseline
PASS: 231 tests

npm run build
PASS: next build
```

Re-verified locally on 2026-07-05 after packaging the SOP10 archive workspace typography baseline:

```text
npx tsx --test src/components/workspace/workspace-shell-sop5-focused-flow.test.mjs
PASS: 23 tests

npm run typecheck
PASS: tsc --noEmit

npm run test:baseline
PASS: 232 tests

npm run build
PASS: next build
```

Re-verified locally on 2026-07-05 after packaging the SOP5 standard-script validation and per-card setting-image generation baseline:

```text
npx tsx --test src/server/use-cases/script-standardization.test.mjs
PASS: 6 tests

npx tsx --test src/components/workspace/workspace-shell-sop5-focused-flow.test.mjs
PASS: 24 tests

npm run typecheck
PASS: tsc --noEmit

npm run test:baseline
PASS: 253 tests
```

## Future-Change Rule

Before changing SOP1 Brief, SOP2 order-risk assessment, external client review links, stage navigation, SOP3 progress/history navigation, or SOP4 commercial workspace UI/flow, keep the current implementation intact unless the new behavior is explicitly part of the user request. Run `npm run test:baseline` and `npm run typecheck` before and after the change. Do not remove or weaken existing tests that protect:

- SOP1 Brief compact workspace, internal-to-external confirmation flow, version-time display, card hierarchy, field emphasis, and removal of redundant instructional microcopy.
- Stage tab compact labels, especially `Brief 需求结构化` without a slash.
- SOP2 visible wording uses `接单风险评估` instead of `风险体检卡` or `技术可行性评估`.
- SOP2 generated assessment keeps the Brief-style table hierarchy and does not reintroduce a completed-state `重新生成` button.
- SOP2 accept/reject decision flow, order-impact issue list, and back-to-Brief rejection path.
- Client review launch links that copy the full URL with `#key=...`.
- External review pages that prefill the verification code from the URL hash while still requiring the user to click into the review.
- SOP3 focused flow and Round 1 / Round 2 sequencing.
- SOP3 visible proposal layout keeps the standardized Brief-style hierarchy and does not reintroduce a left-side icon/entry before the current task title.
- Round 1 direction cards with bundled story outlines.
- Round 1 client review requiring story content and three style images.
- Round 2 deepening requiring full story/script confirmation before storyboard split and image generation.
- SOP3 progress/history buttons opening read-only historical workspace previews instead of mutating current project state.
- SOP4 workload estimate, quote editor, contract editor, and delivery checklist preserving the Brief-style visual hierarchy: strong card titles, bold field labels, compact body text, grouped information blocks, and minimal explanatory prose.
- SOP4 gate behavior: workload estimate before quote, quote confirmation before contract, signed contract before delivery checklist, and confirmed delivery checklist before lock.
- SOP5 storyboard split, production setup gates, storyboard batch review links, and media handoff.
- SOP5 standard-script validation accepting complete scene headings that use common production time labels, especially `破晓 内/外`, while still rejecting headings that lack a real location.
- SOP5 `文字分镜拆解` preserving the Brief-style visual hierarchy: strong title, bold labels, compact body text, grouped scene/shot/status information, and no long instructional copy.
- SOP5 setting-image generation buttons preserving per-card busy state: clicking `生成` on one person or scene must not disable unrelated person or scene cards.
- SOP6 storyboard image generation keeping large readable main-preview, candidate-strip, and all-shot navigation sizing rather than reverting to a compressed one-screen layout.
- SOP6 enlarged image previews staying portal-mounted above the workspace/sidebar layer.
- SOP7 AI video generation preserving the image-workbench layout, full-screen video preview, and all-shot navigation thumbnails that recover source storyboard images from generated videos.
- SOP8/9 A copy / B copy review-cut workspace preserving the Brief-style structured hierarchy: strong `A copy 成片审核` / `B copy 定稿确认` titles, `当前版本` / `审核状态` / `内部说明` fields, timestamp feedback fields, compact `当前阶段` / `下一步` flow cards, and no long explanatory copy.
- SOP8/9 review-cut business logic preserving upload, client review link creation, B copy handoff, archive handoff, and feedback display behavior while only changing user-visible typography.
- SOP10 archive workspace preserving the Brief-style structured hierarchy: strong `完整归档` title, `交付清单` / `归档状态` / `完成时间` overview fields, compact two-column `归档条件`, `交付渠道` / `NAS 归档位置` / `案例展示权` / `售后说明` fields, `完成归档检查`, and no per-checkbox long explanatory copy.
- SOP10 archive business logic preserving save-archive-record, complete-archive-record, permission gating, missing-item validation, and project close behavior while only changing user-visible typography.
- Client review unlock and direct OK / not OK decision UI.

If a future product change intentionally replaces any current behavior, update the corresponding test to assert the new user-visible rule rather than deleting coverage.

Suggested git tag for a clean checkpoint once the worktree is committed:

```bash
git tag baseline-2026-07-05-workspace-archive-tested
```
