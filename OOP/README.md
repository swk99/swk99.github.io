# OOP Atlas

Independent Korean learning notes at `/OOP/`. Buildless HTML/CSS/JS with inline accessible SVGs; no CDN, runtime dependencies, API keys, or remote execution.

## Content

126 lessons: 10 OOP foundations, 5 SOLID principles, 22 design patterns, 23 code smells, and 66 refactoring techniques. Each lesson includes an original explanation, example scenario, before/after conceptual reading diagrams, and caveats. All 22 patterns and 9 other lessons include independently executable Python examples.

Reference topic indexes: https://refactoring.guru/design-patterns/catalog and https://refactoring.guru/refactoring/catalog . Text, illustrations, and code are independently authored, not translations or reproductions. Premium material is not included. Diagrams explicitly show conceptual reading order, not UML semantics.

## Regenerate from repository root

```
python OOP/build_content.py
python OOP/render.py
node --check OOP/app.js
```

`build_content.py` owns lesson content; `examples.py` owns Python snippets; `render.py` renders static HTML. Progress uses the browser's localStorage under `oop-atlas-progress-v1`; no server-side data collection. Without JavaScript all lessons remain readable. Hash URLs open individual lessons.
