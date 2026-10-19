# Requests / Solicitudes

## English

The client portal and Certo Requests share the same ticket Item. A workspace admin opens a project, links a client in **Client portal**, publishes a **Service area**, and invites the client. A client signs in at `/portal`, chooses **Requests**, selects the published area and request type (request, incident or feedback), and sends a title and description. The project team sees the ticket in **Requests** with its project and service area. Client and team public replies share the Item conversation; internal notes never enter the client projection. The client sees the ticket status and public conversation. EN/ES is selectable in Requests and Profile.

The operator may create a ticket directly, link it to a project, and create related work. A Feature requires an Epic parent; a Task requires a PBI parent. Creating related work moves the ticket into progress. A new request and a client reply notify the project owner inside Certo. These notifications do **not** claim email delivery; Brevo remains a separate integration.

### Release checklist

1. Merge only after the app tests/build, Functions build, and lint pass.
2. Deploy Firestore rules from `firestore.rules` (the existing Firestore workflow runs on a merge to `main`).
3. Run the manual **Deploy Client Portal Functions** GitHub Action on `main` to deploy the targeted Functions to `gen-lang-client-0277783597`. The Cloudflare workflow deploys the SPA/Worker only; it does **not** deploy Functions.
4. Sign in with a fresh invited client account, send a request, verify it appears in the project team inbox, reply in both directions, resolve it, and confirm an internal note is invisible to the client.
5. Check the Functions logs and Firestore usage after release. Task changes now project only the changed Item; a full project sync remains on project/client changes.

Do not claim this is live until steps 2–4 pass in production. Existing anonymous `/request/:token` links remain a separate legacy flow and are not replaced by this authenticated portal.

## Español

El portal del cliente y Requests de Certo comparten el mismo Item tipo ticket. Un administrador abre un proyecto, vincula al cliente en **Portal del cliente**, publica un **Área de servicio** y lo invita. El cliente entra a `/portal`, abre **Solicitudes**, elige el área y el tipo (solicitud, incidente o comentario), y envía título y descripción. El equipo ve el ticket en **Solicitudes** con proyecto y área. Las respuestas públicas comparten la conversación del Item; las notas internas no se publican. El cliente ve el estado y la conversación pública. Puede elegir ES/EN en Solicitudes y Perfil.

El operador también puede crear tickets, asociarlos a proyectos y generar trabajo relacionado. Una Feature exige una Épica padre; una Task exige un PBI padre. Al crear trabajo relacionado, el ticket pasa a En progreso. Una nueva solicitud o respuesta del cliente avisa al dueño del proyecto dentro de Certo. Estos avisos **no** garantizan correo; Brevo es una integración separada.

### Lista para publicar

1. Integrar solo después de pasar pruebas, compilación de la app y Functions, y lint.
2. Publicar las reglas de `firestore.rules` (el workflow existente se ejecuta al integrar a `main`).
3. Ejecutar manualmente el workflow **Deploy Client Portal Functions** de GitHub Actions en `main` para publicar las Functions necesarias en `gen-lang-client-0277783597`. El workflow de Cloudflare **no** publica Functions.
4. Probar con una cuenta nueva de cliente invitado: enviar solicitud, verla en la bandeja del proyecto, responder desde ambos lados, resolverla y comprobar que las notas internas no aparecen en el portal.
5. Revisar logs de Functions y uso de Firestore. Los cambios de tareas ahora proyectan solo el Item modificado; la sincronización completa se conserva para cambios de proyecto/cliente.

No afirmar que funciona en producción hasta completar los pasos 2–4. Los enlaces anónimos antiguos `/request/:token` son otro flujo y no se reemplazan aquí.
