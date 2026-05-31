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
id: ceo-tasks-protocol
status: active
objective: Crear este archivo como canal de coordinacion operativo entre ChatGPT CEO y Codex CTO.
scope:
  - CEO_TASKS.md
out_of_scope:
  - Supabase/RLS
  - SQL
  - .env
  - package.json
  - dependencias
  - framework
  - Carta QR
  - logica de negocio
tasks:
  - Crear CEO_TASKS.md con protocolo de trabajo.
  - Documentar como ChatGPT CEO debe definir el bloque activo.
  - Documentar como Codex CTO debe reportar el resultado.
  - Crear rama, commit, push y PR.
checks:
  - git status --short
merge_policy: No hacer merge a main.
notes: Primera version del canal operativo. No contiene cambios funcionales.
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
branch: codex/ceo-tasks-protocol
commits:
  - "2e09533 docs: add CEO task coordination protocol"
  - "docs: update CEO task report with PR link"
files_modified:
  - CEO_TASKS.md
tests:
  - "git status --short: only CEO_TASKS.md modified before final report commit"
pr: "https://github.com/gonsoldelavega/ESCANDALIA/pull/8"
risks:
  - "Documento operativo nuevo: requiere disciplina de lectura al iniciar cada bloque."
next_step: "ChatGPT CEO puede editar Active block para el siguiente bloque; Codex CTO leera este archivo antes de ejecutar."
```
