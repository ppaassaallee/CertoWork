# Certo Work MCP remoto

Servidor MCP por HTTP streamable (revisión `2025-06-18`) en `POST /mcp`. Lee y escribe work items del workspace que el token autoriza. No reemplaza `/mcp/delivereeos` ni `/api/assistant/mcp`.

El endpoint vive en el worker de Cloudflare que ya publica `certo.work`. Responde cuando el worker tiene `FIREBASE_SERVICE_ACCOUNT`. Sin esa credencial contesta `503 unavailable` y no toca datos. Este cambio no despliega reglas ni índices de Firestore. Las colecciones `mcp_api_tokens` y `mcp_audit_events` no tienen regla de cliente, así que quedan denegadas al navegador. Solo el servidor, con la cuenta de servicio, las escribe.

## Conectar un cliente

1. En Certo Work: **Ajustes → Integraciones → Tokens de API**.
2. Nombre, uno o más workspaces, permiso `read` o `read-write`, vencimiento (30, 90 o 365 días). **Assign** queda apagado: sin eso el token no cambia responsables.
3. Copiar el secreto. Se muestra una vez. En la base solo queda el hash SHA-256 y un prefijo.
4. En el cliente MCP:

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

En local la URL es `http://localhost:3000/mcp`. Cada tool excepto `list_workspaces` exige `workspace_id`. El servidor no lo infiere. Límite: 60 llamadas por minuto por token. Revocar o esperar el vencimiento corta el acceso. Si la persona deja el workspace, el token también deja de entrar.

`GET /mcp` no abre un stream: el servidor es sin estado y responde `405`. `POST` con `Accept: text/event-stream` contesta `event: message`. Con solo `application/json` contesta JSON. `notifications/initialized` contesta `202`.

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
| `invalid_type` / `invalid_parent` | Tipo o padre fuera de Epic → Feature → PBI → Sub Task |
| `unknown_client` / `unknown_delivery` / `unknown_tag` | El valor no existe en el workspace. La API no crea opciones |
| `unknown_assignee` | La persona no es miembro |
| `external_id_taken` / `external_id_deleted` | `external_id` duplicado o atado a un ítem en la papelera |
| `has_children` | `delete_item` con hijos vivos |
| `bulk_too_large` | Más de 100 ítems |
| `not_found` | El ítem no está en ese workspace |

## Tools

`list_workspaces` no recibe workspace. Devuelve solo los que siguen en el token y a los que la persona todavía entra.

```json
{ "name": "list_workspaces", "arguments": {} }
```

`list_items` filtra con AND. `type` (`epic|feature|pbi|subtask`), `parent_id`, `status`, `assignee`, `client`, `delivery`, `tag`, `due_before`, `due_after`, `sin_padre`, `texto`, `cursor`, `limit` (máximo 100). La papelera no sale salvo `status: "deleted"`.

```json
{
  "name": "list_items",
  "arguments": {
    "workspace_id": "ws_123",
    "type": "pbi",
    "sin_padre": false,
    "tag": "Billing",
    "texto": "factura",
    "limit": 50
  }
}
```

`get_item` trae el ítem, el padre, los hijos directos, tags, comentarios y la actividad.

```json
{ "name": "get_item", "arguments": { "workspace_id": "ws_123", "item_id": "task…" } }
```

`get_hierarchy` devuelve el bosque. Los ítems sin padre son raíces. Un padre que ya no está va en `unparented`.

```json
{ "name": "get_hierarchy", "arguments": { "workspace_id": "ws_123" } }
```

`list_fields` lista clientes, deliveries, tags, estados, miembros y tipos válidos.

```json
{ "name": "list_fields", "arguments": { "workspace_id": "ws_123" } }
```

`create_item` exige `workspace_id`, `type` y `title`. Opcionales: `parent_id`, `description`, `client`, `delivery`, `tags`, `due_date`, `priority`, `status`, `external_id`, `assignee`. Si `external_id` ya existe en ese workspace, devuelve el ítem y `"created": false` sin duplicar.

```json
{
  "name": "create_item",
  "arguments": {
    "workspace_id": "ws_123",
    "type": "pbi",
    "title": "Emitir factura",
    "parent_id": "feature…",
    "client": "Acme",
    "delivery": "Studio",
    "tags": ["Billing"],
    "due_date": "2026-10-20",
    "external_id": "crm-441"
  }
}
```

Padres válidos: Feature solo bajo Epic, PBI solo bajo Feature, Sub Task solo bajo PBI. Un Epic no tiene padre. Se puede crear sin padre.

`update_item` pisa solo los campos enviados.

```json
{
  "name": "update_item",
  "arguments": { "workspace_id": "ws_123", "item_id": "task…", "status": "in_progress" }
}
```

`set_parent` usa `parent_id` vacío para soltar el ítem.

```json
{
  "name": "set_parent",
  "arguments": { "workspace_id": "ws_123", "item_id": "task…", "parent_id": "feature…" }
}
```

`change_type` falla si el padre o los hijos quedarían mal colgados.

```json
{
  "name": "change_type",
  "arguments": { "workspace_id": "ws_123", "item_id": "task…", "type": "feature" }
}
```

`move_item_to_workspace` mueve el ítem y sus descendientes. Conserva comentarios e historial. El workspace destino tiene que estar en el token. Client, delivery y tags tienen que existir ahí; si no, no mueve nada.

```json
{
  "name": "move_item_to_workspace",
  "arguments": {
    "workspace_id": "ws_123",
    "item_id": "task…",
    "target_workspace_id": "ws_456"
  }
}
```

`add_comment` agrega el texto con autor `vía API (nombre del token)`.

```json
{
  "name": "add_comment",
  "arguments": { "workspace_id": "ws_123", "item_id": "task…", "text": "Listo para revisión" }
}
```

`bulk_update` acepta hasta 100. Con `dry_run: true` devuelve el diff y no escribe. Si una fila es inválida, no escribe ninguna.

```json
{
  "name": "bulk_update",
  "arguments": {
    "workspace_id": "ws_123",
    "dry_run": true,
    "items": [
      { "item_id": "task…", "status": "done" }
    ]
  }
}
```

`delete_item` solo si no hay hijos vivos. Marca `deleted`, guarda `purgeAfter` a 30 días y deja el ítem recuperable. No borra el documento.

```json
{ "name": "delete_item", "arguments": { "workspace_id": "ws_123", "item_id": "task…" } }
```

## Auditoría

Cada escritura agrega una entrada en `statusHistory` con `via: "api"`, `by: "vía API (nombre)"`, el antes y el después. El historial del ítem muestra ese autor. Además queda una fila en `mcp_audit_events` con token, usuario, fecha y campos. El secreto no se guarda ni se escribe en la auditoría.

Los ítems nuevos salen con `userId` y `createdBy` de la persona del token y `createdAt` como timestamp, para que esa persona pueda seguir editándolos en la app.
