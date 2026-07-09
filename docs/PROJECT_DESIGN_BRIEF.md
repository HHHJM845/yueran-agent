# AIGC Video Workspace Design Brief

> Use this brief as the visual and interaction baseline for sister products that should feel consistent with this project. The target style is an internal production workspace: calm, precise, dense enough for daily operations, and clear under pressure.

## 1. Design Positioning

Build the interface as a professional collaboration cockpit for AIGC production teams, not as a marketing website or a decorative AI demo. The UI should feel like a reliable operating desk: structured, quiet, readable, and action-oriented.

Core keywords:

- Calm operational workspace
- Cool gray editorial dashboard
- Structured SOP flow
- High-signal cards and field blocks
- Single blue action language
- Natural-language feedback for every state

Avoid oversized hero areas, decorative gradients, floating bento marketing sections, neon AI styling, and illustration-first layouts. The product value should come from workflow clarity, not visual spectacle.

## 2. Layout System

Use a two-column workbench as the default shell.

- Left side: project list or object list. It should behave like a persistent navigation rail and show the minimum operational metadata needed for selection.
- Right side: current object workspace. It should show the active stage, current task, key artifacts, and available actions.
- Top of the workspace: sticky module or stage navigation. The navigation must reflect real persisted workflow state, not just a visual stepper.
- Main content: one focused stage at a time. Do not stack many SOP sections on the same screen when the user is working through a linear process.

Recommended dimensions:

- Sidebar expanded width: about `312px`.
- Page padding: `20px-32px`, reduced on mobile.
- Section gap: `24px`.
- Card inner padding: `20px-24px`.
- Compact field block padding: `12px-16px`.
- Desktop grid: prefer CSS Grid with `minmax(0, 1fr)`.
- Mobile: collapse to a single column below `820px`; no horizontal overflow.

The screen should read as a continuous workbench on a cool gray canvas, with cards and panels sitting lightly on top.

## 3. Color Palette

Use a restrained cool-neutral palette with one primary accent.

- **Workspace Gray** `#E5E7E9`: full-page background and shell canvas.
- **Surface White** `#F9FBFC`: cards, sidebars, popovers, project rows, form surfaces.
- **Soft Surface** `oklch(0.972 0.006 240)`: secondary panels, nested task sections, disabled backgrounds.
- **Subtle Surface** `oklch(0.955 0.008 235)`: quiet separators and low-emphasis blocks.
- **Primary Ink** `oklch(0.205 0.018 245)`: primary text.
- **Secondary Ink** `oklch(0.455 0.022 245)`: supporting text and metadata.
- **Tertiary Ink** `oklch(0.66 0.018 245)`: timestamps, placeholder text, low-priority labels.
- **Action Blue** `#207FEC`: primary actions, selected navigation, focus states, active status.
- **Blue Subtle** `color-mix(in oklch, #207FEC 12%, white)`: selected-but-soft backgrounds and informational feedback.
- **Border Soft** `oklch(0.925 0.008 245)`: all structural lines.
- **Danger** `oklch(0.56 0.19 25)`: destructive or hard-blocking states.
- **Warning Background** `oklch(0.965 0.028 24)`: recoverable warning feedback.
- **Success Background** `oklch(0.94 0.045 185)`: completion feedback.

Rules:

- Keep `#207FEC` as the only dominant accent.
- Do not introduce purple-blue neon gradients, rainbow status systems, or saturated decorative palettes.
- Use red, amber, and teal only as semantic state colors, never as brand colors.
- Do not use pure black. Use Primary Ink for depth.

## 4. Typography

Typography should be compact, confident, and readable in Chinese-heavy operational screens.

Recommended font stack:

```css
--font-body: "Alibaba PuHuiTi 3.0", "MiSans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
--font-display: "Alibaba PuHuiTi 3.0", "MiSans", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
--font-number: "DIN Alternate", "Avenir Next", "Alibaba PuHuiTi 3.0", "MiSans", sans-serif;
```

Type scale:

- Display number: `2.75rem / 3.1rem`, weight `700`.
- Page title: `1.875rem / 2.35rem`, weight `700`.
- Section title: `1.25rem / 1.75rem`, weight `650-680`.
- Card title: `1rem / 1.45rem`, weight `650`.
- Body: `0.875rem / 1.4rem`, weight `500`.
- Label: `0.75rem / 1.1rem`, weight `500-680`.

Rules:

- Use `letter-spacing: 0`.
- Do not make headings oversized inside dashboards.
- Use weight, spacing, and color to create hierarchy.
- Keep long explanatory copy out of work surfaces. Prefer structured fields and short natural-language state messages.

## 5. Shape, Borders, and Shadow

The shape language is rounded, calm, and utilitarian. It should not feel toy-like.

Tokens:

```css
--radius-card: 1.75rem;
--radius-card-sm: 1.25rem;
--radius-control: 1rem;
--radius-pill: 999px;
--shadow-card: 0 1px 2px rgb(18 38 48 / 0.04), 0 22px 56px -38px rgb(18 38 48 / 0.28);
--shadow-card-hover: 0 2px 8px rgb(18 38 48 / 0.06), 0 28px 64px -38px rgb(18 38 48 / 0.34);
--shadow-pill: 0 1px 2px rgb(18 38 48 / 0.06);
```

Use borders as the main structure. Use shadows only to separate cards, sticky surfaces, popovers, and selected project rows. No heavy elevation, no glowing shadows.

## 6. Component Rules

### Buttons

- Primary button: Action Blue background, white text, subtle pill shadow.
- Secondary button: Surface White background, soft border, Primary Ink text.
- Ghost button: transparent until hover.
- Destructive button: light red background, red text; avoid full red fill unless confirming destructive action.
- All buttons need icon support, loading state, disabled state, and active press feedback.
- Default height: `36px`; large action height: `40px`; compact action height: `32px`.

### Cards

- Use cards for real workflow units: current task, artifact group, review package, upload area, estimate block.
- Do not wrap page sections in nested decorative cards.
- Card background should usually be Surface White.
- Nested task sections should use Soft Surface and smaller radius.
- Card headers should include title, concise description, status pill, and actions when needed.

### Pills and Status

- Pills are compact and functional: stage, priority, review status, model state, upload state.
- Use blue for active/info, teal for success, amber for warning, red for danger.
- Avoid decorative badges that repeat information already visible nearby.

### Forms

- Labels above fields.
- Helper or error text below fields.
- Keep fields grouped by task intent, not by database schema.
- Async form actions must show loading, success, error, empty, and disabled states.
- Do not show raw HTTP, database, SDK, or model errors to end users.

### Tables and Field Blocks

For business review screens, prefer structured field blocks over paragraphs.

Recommended pattern:

- Field label: small, tertiary text.
- Field value: primary or secondary text, medium weight.
- Two-column layout on desktop; single-column on mobile.
- Use compact rows for timestamps, status, scene, shot, owner, deadline.

## 7. Workflow Navigation

Navigation is part of the product contract.

- Module navigation should use compact rounded rectangular buttons.
- Selected module uses Action Blue fill.
- Disabled future stages are visible but muted.
- Hover states lift by `-1px` with border color shifting toward Action Blue.
- Sub-stage menus should appear as small white panels with soft border and shadow.
- Historical stages may be viewable, but viewing history must not imply changing the persisted current stage.

The interface should always make three things clear:

- Where am I in the workflow?
- What is the current task?
- What action can safely move the project forward?

## 8. Content Style

Use concise Chinese operational copy.

Good patterns:

- `正在读取数据库中的项目列表`
- `系统正在恢复你的内部工作台会话。`
- `当前没有待处理事项`
- `资料不足，补充后可重新生成风险体检卡。`
- `已保存工作量估算，下一步确认报价。`

Avoid:

- Long marketing descriptions inside the app.
- English technical stack traces.
- Raw JSON or provider errors.
- Generic AI phrases such as `智能赋能`, `一键生成无限可能`, `颠覆式体验`.
- Repeated instructional text under every checkbox or field.

Every loading, success, empty, error, and blocked state must have a natural-language explanation and a next step.

## 9. Motion and Interaction

Motion should be restrained and tactile.

- Use transitions around `140ms-260ms`.
- Animate `opacity`, `transform`, `border-color`, and `box-shadow`.
- Hover lift: `translateY(-1px)`.
- Active press: `translateY(1px)` or equivalent small tactile feedback.
- Sidebar collapse: `220ms-260ms`.
- Popovers: fade and slide by about `0.35rem`.

Do not use cinematic page choreography, parallax, bouncing indicators, custom cursors, or decorative looping animation in the workbench.

## 10. Responsive Rules

- Below `820px`, collapse the shell to a mobile-friendly single-column workspace.
- Do not allow horizontal scroll.
- Sticky navigation may become horizontally scrollable only if each item remains readable and tap targets stay at least `44px`.
- Cards, field grids, stage panels, and action rows must wrap cleanly.
- Truncate project names and metadata in narrow project lists, but preserve full values in hover cards, detail panels, or accessible titles.

## 11. Design Anti-Patterns

Never introduce:

- Marketing landing-page structure as the first screen.
- Purple or neon AI gradients.
- Decorative bokeh, orbs, glassmorphism, or heavy blur.
- Pure black backgrounds or pure black text.
- Oversized card grids that bury the active task.
- Three equal feature cards as a default layout.
- Long unstructured paragraphs in SOP work areas.
- Generic placeholder brands like `Acme` or `John Doe`.
- Fake precision metrics such as `99.99%` unless backed by real data.
- Silent success, silent failure, or disabled buttons with no explanation.
- Core state stored only in frontend memory.

## 12. Reuse Prompt

When applying this style to another project, use this compact prompt:

```text
Design this as a calm internal operations workspace in the same style as the AIGC video collaboration workbench: cool gray shell (#E5E7E9), near-white cards (#F9FBFC), one primary action blue (#207FEC), soft borders, low shadows, rounded but professional surfaces, compact Chinese-first typography, two-column project-list plus active-workspace layout, sticky workflow navigation, structured field blocks instead of long prose, and natural-language feedback for loading/error/empty/success states. Avoid marketing heroes, neon AI gradients, decorative illustration-first layouts, glassmorphism, and generic oversized card grids.
```
