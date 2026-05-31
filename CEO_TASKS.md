# CEO Tasks

Fuente de verdad operativa entre ChatGPT CEO y Codex CTO.

Este archivo sustituye a los prompts largos pegados en el chat. ChatGPT CEO define aqui el bloque activo, Codex CTO lo lee antes de trabajar, ejecuta el bloque completo y deja el resultado en `Codex report`.

## Protocolo de trabajo

1. Antes de empezar cualquier bloque, Codex debe leer este archivo.
2. Codex debe ejecutar completo el bloque marcado como `active`.
3. Codex no debe pedir confirmaciones rutinarias.
4. Codex no debe hacer merge a `main` salvo instruccion explicita en el bloque activo.
5. Codex no debe tocar Supabase/RLS, SQL, `.env`, `package.json`, dependencias, framework ni Carta QR salvo instruccion explicita en el bloque activo.
6. Si aparece un error real que bloquee el trabajo, Codex debe detenerse, explicar la causa y actualizar `Codex report`.
7. Al terminar, Codex debe actualizar `Codex report` con rama, commits, archivos, tests, PR, riesgos y siguiente paso.

## Como usar este archivo

ChatGPT CEO debe editar el bloque `Active block` con:

- `id`: identificador corto del bloque.
- `status`: `active`, `done` o `blocked`.
- `objective`: objetivo concreto.
- `scope`: archivos o areas permitidas.
- `out_of_scope`: limites explicitos.
- `tasks`: lista ejecutable.
- `checks`: comandos o validaciones esperadas.
- `merge_policy`: si se permite o no merge a `main`.
- `notes`: contexto adicional.

Codex CTO debe:

- crear una rama `codex/<id-o-resumen>`;
- implementar solo lo indicado;
- ejecutar los checks razonables;
- crear commit;
- push;
- abrir PR draft salvo que el bloque diga otra cosa;
- actualizar `Codex report`.

## Active block

```yaml
id: sprint4-1-actionable-escandallos
status: done
objective: Convertir Escandallos en un bloque accionable con resumen, filtros de margen y prioridad de revision.
scope:
  - product-actions.js
  - styles.css
  - tests/sprint3-functional-smoke.test.js
  - CEO_TASKS.md
out_of_scope:
  - Supabase/RLS
  - SQL
  - .env
  - package.json
  - dependencias
  - framework
  - Carta QR
  - Stripe
  - showScreen salvo minimo imprescindible
  - setInterval
  - listeners globales
  - refactor grande del router global
  - calculo suggestedPrice
  - funciones core del cost-engine
tasks:
  - Anadir resumen superior de platos a revisar, margen saludable y margen medio estimado.
  - Anadir filtros Todos, Margen bajo, Margen medio y Margen bueno.
  - Mantener orden por prioridad de revision.
  - Mantener CTAs seguros a detalle y revisar precio.
  - Validar visualmente en 430px y 375px si es posible.
  - Ampliar smoke tests.
  - Actualizar CEO_TASKS.md.
  - Ejecutar gates.
  - Commit, push y PR.
checks:
  - node tests/cost-engine.test.js
  - node tests/sprint3-functional-smoke.test.js
  - node --check product-actions.js
merge_policy: No hacer merge a main.
notes: Linea tecnica pausada. Prioridad producto visible sin tocar Supabase, SQL, dependencias ni router global.
```

## Backlog

```yaml
- id: sprint4-escandallos-overview
  status: next
  objective: Disenar e implementar la vista overview de escandallos sin continuar la linea de micro-refactors tecnicos.
- id: sprint3-8-runtime-validation
  status: pending
  objective: Validar manualmente en navegador real los flujos criticos y preparar retirada controlada de handlers legacy por texto.
```

## Codex report

```yaml
status: done
branch: codex/sprint4-1-actionable-escandallos
commits:
  - "feat: make escandallos overview actionable"
files_modified:
  - CEO_TASKS.md
  - product-actions.js
  - styles.css
  - tests/sprint3-functional-smoke.test.js
tests:
  - "node tests/cost-engine.test.js -> 46 passed, 0 failed"
  - "node tests/sprint3-functional-smoke.test.js -> 17 passed, 0 failed"
  - "node --check product-actions.js -> passed"
pr: pending
risks:
  - "No se toca router global ni navegacion inferior."
  - "Filtro implementado en el listener existente de product-actions.js."
  - "Validacion visual 430px correcta; captura 375px con Edge headless recorta por ancho minimo del motor y debe revisarse tambien en preview movil real."
next_step: "Abrir PR y validar la preview de Vercel en movil real antes de merge."
```

## Technical line status

La linea de micro-refactors tecnicos de Sprint 3 queda pausada tras Sprint 3.10. El siguiente bloque recomendado es Sprint 4 — Escandallos overview. No iniciar mas limpieza de router/listeners hasta nueva instruccion explicita.
