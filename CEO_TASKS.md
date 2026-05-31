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
id: sprint3-10-data-action-contracts
status: done
objective: Anadir contratos data-action de bajo riesgo para acciones core que dependian de texto visible.
scope:
  - index.html
  - script.js
  - product-actions.js
  - tests/sprint3-functional-smoke.test.js
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
  - cambios en showScreen
  - eliminacion de setInterval
  - eliminacion de stopImmediatePropagation
  - refactor grande del router global
  - calculo suggestedPrice
  - microcopy visible
tasks:
  - Anadir data-action a Guardar plato.
  - Anadir data-action a Revisar manualmente.
  - Anadir data-action a Guardar cambios.
  - Actualizar handlers para priorizar data-action y mantener fallback por texto.
  - Ampliar smoke tests.
  - Actualizar documentacion del estado.
  - Actualizar CEO_TASKS.md.
  - Ejecutar gates.
  - Commit, push y PR.
checks:
  - node tests/cost-engine.test.js
  - node tests/sprint3-functional-smoke.test.js
  - node --check script.js
  - node --check product-actions.js
merge_policy: No hacer merge a main.
notes: Cambio funcional acotado a contratos data-action con fallback legacy. No cambiar UX ni microcopy.
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
branch: codex/sprint3-10-data-action-contracts
commits:
  - "refactor: add data-action contracts for core buttons"
files_modified:
  - CEO_TASKS.md
  - SPRINT3_9_ROUTER_LISTENER_AUDIT.md
  - index.html
  - script.js
  - product-actions.js
  - tests/sprint3-functional-smoke.test.js
tests:
  - "node tests/cost-engine.test.js -> 46 passed, 0 failed"
  - "node tests/sprint3-functional-smoke.test.js -> 14 passed, 0 failed"
  - "node --check script.js -> passed"
  - "node --check product-actions.js -> passed"
pr: "https://github.com/gonsoldelavega/ESCANDALIA/pull/11"
risks:
  - "Fallback por texto se conserva durante la transicion."
  - "showScreen no se ha tocado."
  - "setInterval sigue parcheando KPIs/nav en product-actions.js y ops-actions.js."
  - "listeners capture multiples siguen compitiendo antes del router base."
next_step: "Validar preview y despues preparar retirada controlada de fallbacks por texto solo cuando el router este consolidado."
```

## Technical line status

La linea de micro-refactors tecnicos de Sprint 3 queda pausada tras Sprint 3.10. El siguiente bloque recomendado es Sprint 4 — Escandallos overview. No iniciar mas limpieza de router/listeners hasta nueva instruccion explicita.
