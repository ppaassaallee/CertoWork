# Certo Work MCP remoto

Servidor MCP por HTTP streamable (revisión `2025-06-18`) en `POST /mcp`. Un asistente puede leer y escribir el trabajo de un workspace sin abrir el navegador. No reemplaza `/mcp/delivereeos` ni `/api/assistant/mcp`.

El endpoint vive en el worker de Cloudflare que ya publica `certo.work`. Responde cuando el worker tiene `FIREBASE_SERVICE_ACCOUNT`. Sin esa credencial contesta `503 unavailable` y no toca datos. Este cambio no despliega reglas ni índices de Firestore. Las colecciones `mcp_api_tokens` y `mcp_audit_events` no tienen regla de cliente, así que quedan denegadas al navegador. Solo el servidor, con la cuenta de servicio, las escribe.

## Instrucciones para grokbot

Pegale esto al asistente, con el token real en el lugar del secreto:

```text
Conectate al MCP de Certo Work.

URL: https://certo.work/mcp
Header: Authorization: Bearer cw_mcp_…
Protocolo: MCP streamable HTTP 2025-06-18. POST JSON-RPC. No abras GET /mcp.

Reglas:
- Llamá list_workspaces primero y usá esos ids.
- Toda tool excepto list_workspaces recibe workspace_id explícito. No lo infieras.
- Cada ítem trae workspace_id y workspace_name. Si no coinciden con el workspace pedido, descartalo.
- No inventes client, delivery, tag, project ni product phase. Si el valor no existe, la tool devuelve la lista válida. create_client_option, create_delivery_option y create_tag solo funcionan si el token tiene admin.
- set_assignee solo si el token tiene assign. delete_item, delete_subtask y restore_item solo si tiene delete.
- external_id es la clave de idempotencia dentro del workspace. Si ya existe, create_item devuelve el ítem vivo.
- Feature solo bajo Epic. PBI, story y task solo bajo Feature. Sub Task, Bug e Issue solo bajo un PBI/Task. parent_id null deja el ítem sin padre.
- pbi, story y task comparten la etiqueta PBI/Task. Usá el campo type para distinguirlos.
- Sub Task (add_subtask) es un ítem hijo. Checklist (add_checklist_line) es una línea del mismo ítem.
- Antes de un cambio masivo usá dry_run true. No escribe. Máximo 200 ítems.
- Fechas de respuesta van en ISO 8601 con zona (un día suelto vuelve como YYYY-MM-DDT00:00:00.000Z).
- Para acortar una respuesta pasá fields. workspace_id y workspace_name siempre vuelven.
```

Configuración del cliente:

```json
{
  "mcpServers": {
    "certo": {
      "url": "https://certo.work/mcp",
      "headers": {
        "Authorization": "Bearer cw_mcp_…"
      }
    }
  }
}
```

En local la URL es `http://localhost:3000/mcp`. Sin la credencial de Firebase admin el local responde 503 y no escribe.

## Crear el token

1. En Certo Work: **Ajustes → Integraciones → Tokens de API**.
2. Nombre, uno o más workspaces, vencimiento (30, 90 o 365 días).
3. Lectura, o lectura y escritura. Assign, delete y admin quedan apagados. Hay que marcarlos.
4. Copiar el secreto. Se muestra una vez. En la base solo queda el hash SHA-256 y un prefijo.

Un token `read-write` creado antes de existir el permiso delete sigue pudiendo borrar. Los tokens nuevos de la pantalla no borran hasta marcar delete.

Límite: 60 llamadas por minuto por token. Revocar o esperar el vencimiento corta el acceso. Si la persona deja el workspace, el token también deja de entrar.

`GET /mcp` no abre un stream: el servidor es sin estado y responde `405`. `POST` con `Accept: text/event-stream` contesta `event: message`. Con solo `application/json` contesta JSON. `notifications/initialized` contesta `202`.

Cada escritura queda en el historial del ítem como `vía API (nombre del token)` con el antes y el después. La actividad de la ficha muestra ese texto.

## Errores

Los fallos de tool vuelven dentro de `tools/call` con `isError: true` y un JSON `{ "code", "message" }`. Auth y límite contestan HTTP 401 o 429 con el mismo par de campos.

| Código | Cuándo |
| --- | --- |
| `unauthorized` / `invalid_token` / `token_revoked` / `token_expired` | Falta el bearer, no existe, está revocado o venció |
| `rate_limited` | Más de 60 llamadas en un minuto |
| `workspace_required` | Falta `workspace_id` |
| `workspace_forbidden` | El workspace no está en el token |
| `workspace_access_revoked` | La persona ya no es owner ni miembro active/accepted |
| `read_only` | El token es de lectura |
| `assign_forbidden` | Se intentó asignar sin el permiso assign |
| `delete_forbidden` | Se intentó borrar o restaurar sin el permiso delete |
| `admin_required` | Se intentó crear un client, delivery o tag sin admin |
| `invalid_type` / `invalid_parent` | Tipo o padre fuera de la jerarquía |
| `unknown_client` / `unknown_delivery` / `unknown_tag` / `unknown_project` / `unknown_phase` | El valor no existe. El mensaje lista los válidos |
| `unknown_assignee` | La persona no es miembro |
| `external_id_taken` / `external_id_deleted` | `external_id` duplicado o atado a un ítem en la papelera |
| `has_children` | `delete_item` con hijos vivos y sin `cascade: true` |
| `not_deleted` | `restore_item` sobre un ítem que no está en la papelera |
| `bulk_too_large` | Más de 200 ítems |
| `not_found` | El ítem o el proyecto no está en ese workspace |

## Lectura

`list_workspaces` no recibe workspace.

```json
{ "name": "list_workspaces", "arguments": {} }
```

`list_items` no depende de "asignado a mí". Filtros en AND: `type` (`epic|feature|pbi|story|task|subtask|bug|issue`), `parent_id`, `sin_padre`, `project_id`, `status` (incluye `done` y `cancelled`), `assignee`, `client`, `delivery`, `tag` o `tags`, `priority`, `due_before`, `due_after`, `vencidos`, `texto`, `incluir_completados`, `fields`, `cursor`, `limit` (máximo 100). Done y Cancelled quedan afuera salvo `incluir_completados: true` o un `status` explícito. La papelera no sale salvo `status: "deleted"`.

```json
{
  "name": "list_items",
  "arguments": {
    "workspace_id": "ws_123",
    "type": "pbi",
    "vencidos": true,
    "incluir_completados": false,
    "limit": 50
  }
}
```

`get_item` trae tipo exacto, `type_label` (`pbi`, `story` y `task` dicen `PBI/Task`), padre, cadena, hijos, sub tasks, checklist, comentarios, adjuntos e historial.

```json
{ "name": "get_item", "arguments": { "workspace_id": "ws_123", "item_id": "task…", "fields": ["title", "type", "type_label", "due_date"] } }
```

`get_hierarchy` devuelve el árbol con conteos `children`, `subtasks`, `open` y `done`.

```json
{ "name": "get_hierarchy", "arguments": { "workspace_id": "ws_123" } }
```

`list_fields` lista clients, deliveries, projects, tags, estados, prioridades (`1`, `2`, `3`, `N/A`), tipos, product phases (`Explore`, `Shape`, `Build`, `Beta`, `Launch`, `Grow`) y miembros.

```json
{ "name": "list_fields", "arguments": { "workspace_id": "ws_123" } }
```

`search` busca en título, descripción, external id, comentarios y tags. Solo en ese workspace.

```json
{ "name": "search", "arguments": { "workspace_id": "ws_123", "query": "factura" } }
```

`list_projects` y `get_project`:

```json
{ "name": "list_projects", "arguments": { "workspace_id": "ws_123" } }
```

```json
{ "name": "get_project", "arguments": { "workspace_id": "ws_123", "project_id": "proj_1" } }
```

`list_members` está disponible para cualquier token.

```json
{ "name": "list_members", "arguments": { "workspace_id": "ws_123" } }
```

`list_comments`:

```json
{ "name": "list_comments", "arguments": { "workspace_id": "ws_123", "item_id": "task…" } }
```

## Escritura

`create_item`. Si `external_id` ya existe y el ítem está vivo, devuelve ese ítem con `created: false`.

```json
{
  "name": "create_item",
  "arguments": {
    "workspace_id": "ws_123",
    "type": "pbi",
    "title": "Factura de octubre",
    "parent_id": "feature…",
    "description": "Cerrar el mes",
    "client": "Acme",
    "delivery": "Studio",
    "project_id": "proj_1",
    "tags": ["Billing"],
    "due_date": "2026-10-20",
    "priority": "1",
    "status": "todo",
    "product_phase": "Build",
    "external_id": "crm-1044"
  }
}
```

`update_item` parchea título, descripción, fechas, prioridad, estado, client, delivery, project, tags y product phase. Lo que no mandás queda igual.

```json
{ "name": "update_item", "arguments": { "workspace_id": "ws_123", "item_id": "task…", "status": "in_progress" } }
```

`change_type` cambia el tipo y conserva el resto.

```json
{ "name": "change_type", "arguments": { "workspace_id": "ws_123", "item_id": "task…", "type": "task" } }
```

`set_parent`. `parent_id` vacío o null lo desprende.

```json
{ "name": "set_parent", "arguments": { "workspace_id": "ws_123", "item_id": "task…", "parent_id": "feature…" } }
```

`move_item_to_workspace` mueve el ítem con hijos, comentarios e historial. `target_parent_id` es opcional y tiene que existir ya en el destino.

```json
{
  "name": "move_item_to_workspace",
  "arguments": {
    "workspace_id": "ws_123",
    "item_id": "task…",
    "target_workspace_id": "ws_456",
    "target_parent_id": "epic…"
  }
}
```

`duplicate_item` copia el ítem y el checklist. No copia hijos, comentarios, historial ni `external_id`.

```json
{ "name": "duplicate_item", "arguments": { "workspace_id": "ws_123", "item_id": "task…", "target_workspace_id": "ws_456" } }
```

`delete_item` es papelera 30 días. Con hijos falla, salvo `cascade: true`. `restore_item` lo devuelve.

```json
{ "name": "delete_item", "arguments": { "workspace_id": "ws_123", "item_id": "task…", "cascade": false } }
```

```json
{ "name": "restore_item", "arguments": { "workspace_id": "ws_123", "item_id": "task…" } }
```

## Sub tasks, checklist y comentarios

```json
{ "name": "add_subtask", "arguments": { "workspace_id": "ws_123", "parent_id": "pbi…", "title": "Enviar" } }
```

```json
{ "name": "update_subtask", "arguments": { "workspace_id": "ws_123", "item_id": "sub…", "status": "done" } }
```

```json
{ "name": "delete_subtask", "arguments": { "workspace_id": "ws_123", "item_id": "sub…" } }
```

```json
{ "name": "add_checklist_line", "arguments": { "workspace_id": "ws_123", "item_id": "task…", "text": "Revisar PDF" } }
```

```json
{ "name": "toggle_checklist_line", "arguments": { "workspace_id": "ws_123", "item_id": "task…", "line_id": "chk…" } }
```

```json
{ "name": "delete_checklist_line", "arguments": { "workspace_id": "ws_123", "item_id": "task…", "line_id": "chk…" } }
```

```json
{ "name": "add_comment", "arguments": { "workspace_id": "ws_123", "item_id": "task…", "text": "Quedó con el cliente." } }
```

## Personas

```json
{ "name": "set_assignee", "arguments": { "workspace_id": "ws_123", "item_id": "task…", "assignee": "Ada" } }
```

`assignee` vacío limpia el responsable. Sin el permiso assign la tool responde `assign_forbidden`.

## Masivo

`dry_run: true` devuelve el diff por ítem (`ok` o `code` + `message`) y no escribe. Si una fila es inválida, tampoco se escribe el resto.

```json
{
  "name": "bulk_update",
  "arguments": {
    "workspace_id": "ws_123",
    "dry_run": true,
    "items": [{ "item_id": "task…", "status": "todo" }]
  }
}
```

```json
{
  "name": "bulk_set_parent",
  "arguments": {
    "workspace_id": "ws_123",
    "dry_run": true,
    "items": [{ "item_id": "task…", "parent_id": "feature…" }]
  }
}
```

```json
{
  "name": "bulk_move_to_workspace",
  "arguments": {
    "workspace_id": "ws_123",
    "target_workspace_id": "ws_456",
    "item_ids": ["task…"],
    "dry_run": true
  }
}
```

## Catálogos y vistas

Sin admin, estas tres responden `admin_required`.

```json
{ "name": "create_client_option", "arguments": { "workspace_id": "ws_123", "name": "Acme" } }
```

```json
{ "name": "create_delivery_option", "arguments": { "workspace_id": "ws_123", "name": "Studio" } }
```

```json
{ "name": "create_tag", "arguments": { "workspace_id": "ws_123", "name": "Billing" } }
```

`list_views` y `create_view`. `preset` puede ser `hoy`, `solo_yo`, `esperando_a_terceros`, `sin_dueno_ni_fecha` o `vencidos`. También podés mandar `filters` y `sort` propios. La vista queda personal, en My Work, del dueño del token.

```json
{ "name": "create_view", "arguments": { "workspace_id": "ws_123", "preset": "vencidos" } }
```

## Límites

`list_items` lee hasta 2000 ítems del workspace y pagina de a 100. Un workspace más grande necesita otro corte. La papelera se puede recuperar durante 30 días; después el dato sigue guardado hasta que alguien lo purgue aparte. Esta API no lo borra físicamente.
