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
id: sprint3-9-router-listener-audit
status: active
objective: Auditar router global, listeners, wrappers y parches setInterval antes de tocar comportamiento.
scope:
  - script.js
  - product-actions.js
  - ops-actions.js
  - ops-editable.js
  - manual-price-action.js
  - apply-price-action.js
  - yield-persistence.js
  - index.html
  - tests/sprint3-functional-smoke.test.js
  - GLOBAL_OWNERSHIP_AUDIT.md
  - SPRINT3_9_ROUTER_LISTENER_AUDIT.md
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
  - comportamiento funcional
  - cambios en listeners
  - cambios en showScreen
  - eliminacion de setInterval
  - calculo suggestedPrice
  - microcopy visible
tasks:
  - Mapear listeners click con y sin capture.
  - Mapear setInterval.
  - Mapear wrappers showScreen/render.
  - Mapear stopImmediatePropagation y dependencias por texto visible.
  - Mapear acciones que ya usan data-action.
  - Crear SPRINT3_9_ROUTER_LISTENER_AUDIT.md.
  - Actualizar CEO_TASKS.md.
  - Ejecutar gates.
  - Commit, push y PR.
checks:
  - node tests/cost-engine.test.js
  - node tests/sprint3-functional-smoke.test.js
merge_policy: No hacer merge a main.
notes: Bloque documental. No modificar comportamiento funcional.
```

## Backlog

```yaml
- id: sprint3-8-runtime-validation
  status: pending
  objective: Validar manualmente en navegador real los flujos criticos y preparar retirada controlada de handlers legacy por texto.
```

## Codex report

```yaml
status: done
branch: codex/sprint3-9-router-listener-audit
commits:
  - "docs: audit global router and listener ownership"
files_modified:
  - CEO_TASKS.md
  - SPRINT3_9_ROUTER_LISTENER_AUDIT.md
tests:
  - "main preflight: node tests/cost-engine.test.js -> 46 passed, 0 failed"
  - "main preflight: node tests/sprint3-functional-smoke.test.js -> 12 passed, 0 failed"
  - "node tests/cost-engine.test.js -> 46 passed, 0 failed"
  - "node tests/sprint3-functional-smoke.test.js -> 12 passed, 0 failed"
pr: "pending"
risks:
  - "showScreen tiene wrappers encadenados en product-actions.js y ops-actions.js."
  - "setInterval sigue parcheando KPIs/nav en product-actions.js y ops-actions.js."
  - "listeners capture multiples siguen compitiendo antes del router base."
  - "varias acciones siguen dependiendo de texto visible."
next_step: "Implementar un bloque pequeno de data-action para Guardar plato, Revisar manualmente y Guardar cambios, con fallback y smoke tests."
```
