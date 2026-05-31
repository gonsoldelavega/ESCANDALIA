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
id: sprint3-8-apply-price-legacy-cleanup
status: active
objective: Reducir duplicacion legacy del flujo applyRecommendedPrice despues de introducir propietario unico operativo en apply-price-action.js.
scope:
  - apply-price-action.js
  - script.js
  - product-actions.js
  - yield-persistence.js
  - manual-price-action.js
  - index.html
  - tests/sprint3-functional-smoke.test.js
  - APPLY_PRICE_OWNERSHIP_PLAN.md
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
  - calculo suggestedPrice
  - microcopy visible
  - refactor grande del router global
tasks:
  - Auditar implementaciones legacy de applyRecommendedPrice.
  - Determinar si pueden eliminarse o reducirse sin romper orden de carga.
  - Implementar el minimo seguro.
  - Mantener compatibilidad y fallback por texto si sigue siendo necesario.
  - Ajustar smoke tests si cubren el cambio.
  - Actualizar documentacion del estado del flujo.
  - Ejecutar gates.
  - Commit, push y PR.
checks:
  - node tests/cost-engine.test.js
  - node tests/sprint3-functional-smoke.test.js
  - node --check apply-price-action.js
  - node --check manual-price-action.js
  - node --check script.js
  - node --check product-actions.js
  - node --check yield-persistence.js
merge_policy: No hacer merge a main.
notes: Si eliminar legacy no es seguro, mantener delegadores minimos y documentar por que.
```

## Backlog

```yaml
- id: sprint3-8-runtime-validation
  status: pending
  objective: Validar manualmente en navegador real los flujos criticos y preparar retirada controlada de handlers legacy por texto.
```

## Codex report

```yaml
status: in_progress
branch: codex/sprint3-8-apply-price-legacy-cleanup
commits:
  - "pending: refactor: reduce apply price legacy handlers"
files_modified:
  - CEO_TASKS.md
  - APPLY_PRICE_OWNERSHIP_PLAN.md
  - product-actions.js
  - tests/sprint3-functional-smoke.test.js
  - yield-persistence.js
tests:
  - "main preflight: node tests/cost-engine.test.js -> 46 passed, 0 failed"
  - "main preflight: node tests/sprint3-functional-smoke.test.js -> 11 passed, 0 failed"
  - "node tests/cost-engine.test.js -> 46 passed, 0 failed"
  - "node tests/sprint3-functional-smoke.test.js -> 12 passed, 0 failed"
  - "node --check apply-price-action.js -> passed"
  - "node --check manual-price-action.js -> passed"
  - "node --check script.js -> passed"
  - "node --check product-actions.js -> passed"
  - "node --check yield-persistence.js -> passed"
pr: null
risks:
  - "script.js mantiene fallback base y deteccion por texto porque el router global aun no esta consolidado."
  - "yield-persistence.js conserva el fallback rico para proteger escenarios donde el propietario no cargue."
next_step: "Crear PR y validar en navegador real antes de retirar mas legacy."
```
