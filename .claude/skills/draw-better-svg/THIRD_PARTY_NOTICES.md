# Third-party notices

draw-better-svg is MIT-licensed. Two reference files adapt material from other
projects under their own licenses. No code from these projects is included; the
scripts in `scripts/` are original.

## svg-creator-skill (Apache-2.0)

`references/effects.md` adapts filter, gradient, material, and atmosphere recipes
from `references/advanced-techniques.md` of
[upbrew-tech/svg-creator-skill](https://github.com/upbrew-tech/svg-creator-skill).

Copyright 2025 SVG Creator Skill Contributors. Licensed under the Apache License,
Version 2.0 (the "License"); you may not use this material except in compliance
with the License. You may obtain a copy of the License at
<http://www.apache.org/licenses/LICENSE-2.0>. Unless required by applicable law or
agreed to in writing, it is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied.

Changes: recipes were re-tested in three renderers; the texture, lighting, glass,
wood, stone, and template recipes were rewritten to fix defects found in testing;
parameters were retuned; failing and redundant recipes were removed.

## pixel2motion (MIT)

`references/motion.md` adapts the motion brief, personality presets, timeline
shape, pattern library, and QA approach of
[nolangz/pixel2motion](https://github.com/nolangz/pixel2motion).
`scripts/path_audit.py` follows its idea of auditing joins and segments with a
handle overlay, in an independent implementation.

MIT License

Copyright (c) 2026 Nolan Lai

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## svg-hand-drawn-skill

The construction reveal in `scripts/preview_html.mjs` was inspired by the idea of
[shaom/svg-hand-drawn-skill](https://github.com/shaom/svg-hand-drawn-skill) (draw
strokes, then reveal fills). That repository has no license file; none of its code
or text is used.

## Inigo Quilez: distance functions and rendering techniques

`scripts/lib/sdfkit.mjs` reimplements in JavaScript several formulas published by
Inigo Quilez at <https://iquilezles.org/articles/>: the round cone and rounded box
distance functions and the ellipsoid approximation ("distance functions"), the
quadratic smooth minimum ("smooth minimum"), ambient occlusion along the normal, and
soft shadows ("soft shadows"). The articles' terms apply to that material.

## Drawing method

The joint landmarks, limb rhythm, and head construction in
`references/joints-and-faces.md` describe common figure-drawing practice; the head
follows the construction popularised by Andrew Loomis (*Drawing the Head and Hands*,
1956). No text or images are reproduced.
