# Existing skills, libraries, and primary sources

## Contents

- Existing SVG skills
- A practical library stack
- Choosing instead of accumulating dependencies
- Sources and evidence limits

Research checked 27 September 2026. Repository descriptions establish declared
scope; they do not establish visual quality on every task. The custom skill and
examples are original work, not a copy of any third-party skill.

## Existing SVG skills

| Skill | What the inspected source covers | Fit and limitation |
| --- | --- | --- |
| [linyaosky/svg-skill](https://github.com/linyaosky/svg-skill) | Scenario routing for icons, charts, diagrams, illustration and code integration | Useful general starting point; its core workflow emphasizes construction and structural checks |
| [tryopendata svg-design](https://github.com/tryopendata/skills/blob/main/plugins/opendesign/skills/svg-design/SKILL.md) | Logo/icon techniques, paths, effects, animation, optimization, accessibility references | Broad SVG authoring reference; evaluate stylistic prescriptions for your target |
| [bybit-exchange/svg-diagram](https://github.com/bybit-exchange/svg-diagram/blob/main/SKILL.md) | Technical diagram spacing, text, paint order and connectors | Strong subject fit for diagram conventions; not an organic illustration workflow |
| [supermemoryai svg-animations](https://github.com/supermemoryai/skills/blob/main/svg-animations/SKILL.md) | SVG primitives, paths, masks, CSS/SMIL motion and animation techniques | Useful motion reference; static geometry and composition still need design review |
| [kyungseo svg-infographic](https://github.com/kyungseo/skillstead/blob/main/skills/svg-infographic/SKILL.md) | Structured infographic types, typography, browser rendering and linting | Explicitly excludes character illustration, bespoke logos, and statistical charts |
| [upbrew-tech/svg-creator-skill](https://github.com/upbrew-tech/svg-creator-skill) (Apache-2.0) | Write → render → fix loop; a cookbook of filters, grading, materials, templates, and motion snippets | Every recipe was rendered in three renderers: most work, several fail as published (texture boxes, washed-out lighting, a glass effect that cannot see its backdrop, templates with undefined references). The working and repaired recipes are in [effects.md](effects.md) |
| [nolangz/pixel2motion](https://github.com/nolangz/pixel2motion) (MIT) | Raster logo → minimal smooth SVG → choreographed CSS motion, with overlay/IoU fitting and deterministic frame QA | Its brief, presets, patterns, and QA ideas are adapted in [motion.md](motion.md); its keyframe-easing warning was confirmed, its dash table only partly (a closed path leaks with `1 1`). The Python/Playwright pipeline itself is not bundled |
| [shaom/svg-hand-drawn-skill](https://github.com/shaom/svg-hand-drawn-skill) (no license file) | A player that draws an existing SVG's strokes, then reveals its fills | The idea became the reveal in `preview_html.mjs`, implemented independently; no code was used |

These skills exist, so “there is no SVG skill” would be incorrect. This work adds
an opinionated combination: type classification, geometry-first drawing, small
library recipes, rendered revision, and prompts linked to testable outcomes.
No comparative benchmark was run against those external skills.

For an external agent's CLI, the general-purpose repository documents:

```bash
npx skills add linyaosky/svg-skill
```

Review the repository and its instructions before installing. This command is an
optional external-agent route, separate from the custom skill created here; it
was researched, not executed. Avoid installing overlapping packs blindly.

## A practical library stack

| Library | Useful job | What it does not decide | Primary source |
| --- | --- | --- | --- |
| SVG.js + svgdom | Compose editable SVG documents in browser or Node | Composition, recognition, actual target-font availability | [SVG.js](https://svgjs.dev/), [svgdom](https://github.com/svgdotjs/svgdom) |
| Paper.js | Bézier geometry, booleans, simplification | Whether a contour looks convincing | [About](https://paperjs.org/about/), [Path API](https://paperjs.org/reference/path/) |
| Rough.js | Deterministic sketch paths and hatching | A good underlying silhouette | [Project](https://roughjs.com/), [API](https://github.com/rough-stuff/rough/wiki) |
| Perfect Freehand | Pressure-dependent filled stroke outlines | Anatomy, composition, or input gesture quality | [Repository](https://github.com/steveruizok/perfect-freehand) |
| D3 scales/shapes/geo | Data-driven geometry and geographic projections | Correct source data or an honest chart choice | [Shape](https://d3js.org/d3-shape), [Scale](https://d3js.org/d3-scale), [Geo](https://d3js.org/d3-geo) |
| ELK.js | Graph-node positioning and edge routes | Arbitrary text metrics or perfect semantic readability | [Repository](https://github.com/kieler/elkjs) |
| svgpath | Transform, normalize and round path data | Boolean operations or visual repair | [Repository](https://github.com/fontello/svgpath) |
| svgpathtools | Python path analysis and Bézier operations | End-to-end graphic design | [Repository](https://github.com/mathandy/svgpathtools) |
| sharp/librsvg | Static SVG-to-PNG previews and image comparison | CSS/SMIL timeline or browser interaction | [Constructor](https://sharp.pixelplumbing.com/api-constructor/) |
| resvg-js | Alternative static SVG renderer | Full browser DOM or scripting | [Repository](https://github.com/thx/resvg-js) |
| SVGO | SVG delivery cleanup and optional compression | Aesthetic improvement or complete sanitization | [Preset](https://svgo.dev/docs/preset-default/), [ID cleanup](https://svgo.dev/docs/plugins/cleanupIds/) |
| VTracer | Raster-to-vector tracing of existing images | Recovery of editable semantic objects or perfect fidelity | [Repository](https://github.com/visioncortex/vtracer) |

All listed projects are available as open-source tools; read each project's
license for redistribution and inspect separate font/asset licenses. An open
library does not grant rights to an imported brand, illustration, or typeface.
Optional libraries outside the bundled dependencies were researched, not executed
as part of this example suite.

An SVG path editor can help a person refine handles and inspect a difficult
contour: [Yqnn/svg-path-editor](https://github.com/Yqnn/svg-path-editor). Treat it
as a visual editing aid rather than an automatic drawing-quality library.

## Choosing instead of accumulating dependencies

| Task | Small suitable starting stack |
| --- | --- |
| One simple UI icon | SVG XML plus the existing renderer |
| Reusable illustration generator | SVG.js + svgdom + sharp |
| Geometric logo construction | Paper.js + XML serializer + renderer |
| Hand-drawn-style scene | Clean SVG geometry + Rough.js |
| Pressure ink | Perfect Freehand + SVG serializer |
| Numerical chart | D3 scales/shapes + renderer |
| Diagram with branches | ELK + SVG renderer + actual text measurement |
| Python geometry workflow | svgpathtools + an SVG writer + renderer |

Use libraries at build time where possible. A generated self-contained static SVG
does not need to download the drawing libraries when a viewer opens it. Use a CDN
only for a browser authoring or interactive runtime that needs one, pin the
version, and keep the exported SVG's portability requirements explicit.

## Sources and evidence limits

Additional primary technical references:

- [W3C SVG 2 painting](https://www.w3.org/TR/SVG2/painting.html): fills, strokes, markers, painting behavior.
- [MDN viewBox](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Attribute/viewBox): coordinate mapping.
- [MDN SVG as an image](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image): image-context restrictions.
- [MDN mask](https://developer.mozilla.org/en-US/docs/Web/SVG/Reference/Element/mask): masking attributes and semantics.
- [MDN getBBox](https://developer.mozilla.org/en-US/docs/Web/API/SVGGraphicsElement/getBBox): geometry-bound behavior.
- [Paper project export](https://paperjs.org/reference/project/): document export API.
- [SVGO prefixIds](https://svgo.dev/docs/plugins/prefixIds/): reproducible ID prefixing and collisions.

The design rules, classifications, rubric, and prompting templates are practical
recommendations derived from authoring and review needs. They are not an official
SVG taxonomy, a scientific aesthetic metric, or proof that any model will produce
expert illustration. The concrete evidence is the generated example suite and
the documented structural and rendered checks.
