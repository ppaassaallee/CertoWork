# Optimización de costos de Certo Work

La prioridad es reducir operaciones repetidas sin volver a ocultar proyectos, perder tareas o impedir guardar documentos. El ahorro seguro empieza en Firestore y en el trabajo periódico; no exige migrar de base de datos ni recortar funciones. La facturación real por servicio determinará si una migración posterior compensa su costo y riesgo.

## Arquitectura y responsabilidad de costos

| Componente | Implementación | Qué consume presupuesto |
| --- | --- | --- |
| Web y API de producción | React y Vite; assets y `worker/index.js` en Cloudflare | Solicitudes, CPU y observabilidad del Worker; no son cargos GCP |
| Datos interactivos | SDK Firebase en navegador; `src/data/startWorkspaceData.ts` y suscripciones por superficie | Lecturas iniciales, cambios entregados por listeners, escrituras, evaluaciones de reglas, índices y transferencia |
| Operaciones de backend | `worker/firestoreAdmin.js`, REST con cuenta de servicio | Operaciones Firestore y CPU/solicitudes del Worker |
| Automatizaciones | Cron Worker cada 15 minutos; rutinas adicionales en `functions/src` | Consultas y escrituras periódicas; Functions, Scheduler y servicios asociados si están desplegados |
| Archivos | Firebase Storage y metadatos Firestore; integraciones Drive y OneDrive | Almacenamiento, operaciones y transferencia; metadatos y permisos |
| Identidad | Firebase Auth | Depende de proveedores y uso; no sustituirlo para ahorrar sin una razón medida |
| IA | Worker configurado con OpenAI; Express conserva rutas Gemini opcionales | Tokens, voz y llamadas de herramientas; OpenAI es una factura separada |
| Correo y calendario | Brevo y conectores OAuth/webhooks | Correo, mantenimiento de suscripciones y operaciones de sincronización |

La configuración apunta al proyecto `gen-lang-client-0277783597` y a la base nombrada `ai-studio-0db18e51-58a2-4763-a4d7-3fced116347d`. Varias Functions usan `getFirestore()` sin identificador, que selecciona la base predeterminada. Antes de consolidarlas hay que verificar qué base y qué funciones utiliza producción; cambiar esa selección directamente puede hacer desaparecer datos de la aplicación.

## Costo y cuota son problemas distintos

La captura de Firestore muestra el aviso de cuota compartida de AI Studio, aproximadamente 50K lecturas, 55K lecturas en tiempo real y 1.2K escrituras en 24 horas. No se suman esas métricas como si fueran una factura de 105K lecturas: hay que respetar la definición de cada métrica.

Blaze a nivel de proyecto no elimina por sí solo la cuota compartida de una base AI Studio. El botón **Upgrade database** cambia esa base a pago por uso y puede aumentar los cargos. Es una decisión de disponibilidad y facturación, no una optimización gratuita. No se ha cambiado el plan ni confirmado que el usuario haya hecho esa actualización. [Documentación de Firebase](https://firebase.google.com/docs/ai-assistance/ai-studio-integration).

Los $26.23 mostrados para el proyecto y los $118.26 mostrados para la cuenta tienen alcances distintos. El presupuesto de la captura se llama `$150`, pero su importe configurado es $200 y no muestra un límite de gasto activo. No hay base suficiente para afirmar que Firestore constituye casi toda la factura ni para prometer reducirla a la mitad.

## Cambios implementados

| Cambio | Antes | Ahora | Resultado esperado |
| --- | --- | --- | --- |
| Navegación entre superficies | Un cambio de combinación reiniciaba todos los paquetes diferidos | Se conservan los paquetes que siguen siendo necesarios | Menos consultas iniciales y reconexiones; mismo alcance autorizado |
| Tareas de un proyecto | Dependencia del objeto completo de navegación | Dependencia de workspace, proyecto y reintento | Cambiar pestaña o selección no reinicia esa consulta |
| Registros de tablas | Dependencia de objetos de metadatos | Identidad estable de IDs de tablas visibles | Renombrar o actualizar metadatos no fuerza releer registros |
| Presencia de usuarios | Latido cada 45 segundos; listener activo en pestaña oculta | Cada 90 segundos; TTL de 240 segundos; listener pausado cuando está oculta | 50% menos escrituras periódicas de ese latido en una sesión visible estable; no 50% de toda Firestore |
| Reportes de administradores | Consulta propia más consulta completa del workspace | Solo consulta del workspace para administradores; consulta propia para otros usuarios | Evita leer dos veces el subconjunto propio sin ampliar permisos |
| Fechas de tablas | Barrido de hasta 80 tablas, luego registros repetidos por cada condición | Solo tablas referenciadas por rutinas; una lectura de registros por tabla y ejecución | Elimina tablas ajenas y lecturas duplicadas entre condiciones |
| Autenticación REST de servicio | Firmar JWT y obtener token por cada operación | Token reutilizado hasta su vencimiento menos 60 segundos, por credencial | Menos llamadas OAuth y CPU; no reduce las operaciones Firestore que sí son necesarias |
| Mantenimiento de canales Calendar | Revisar cuentas y calendarios cada 15 minutos | Cada hora, conservando anticipación de renovación de 24 horas | 75% menos ejecuciones de ese mantenimiento; rutinas y outbox siguen cada 15 minutos |
| Reescritura con IA | Solicitudes simultáneas idénticas podían facturarse varias veces | Una solicitud mientras está en curso por identidad verificada, workspace y contenido | Elimina duplicados simultáneos dentro del mismo proceso Worker, sin reutilizar respuestas posteriores |
| Medición IA | Tokens de entrada y salida | Incluye tokens de entrada cacheados reportados por OpenAI | Permite separar consumo cacheado del no cacheado |

Los caches nuevos son acotados y locales al proceso Worker: no constituyen almacenamiento persistente ni un límite global de gasto. Los errores liberan las entradas para permitir reintentar. No se cachean documentos entre usuarios. No se deshabilitan reglas, recordatorios, notificaciones, rutinas ni integraciones.

La política existente ya contiene límites de salida de 550 tokens, 900 para extracción de proyectos, una ronda de Odysseus, contexto acotado, notas con autosave de 2.5 segundos y cron de 15 minutos. Esos controles no son ahorros nuevos de esta intervención. Los modelos no se sustituyeron sin evaluación de calidad. Reducir solicitudes y tokens antes de degradar modelos sigue la [guía de optimización de OpenAI](https://developers.openai.com/api/docs/guides/cost-optimization).

## Optimización siguiente por prioridad

### 1 Medir y eliminar infraestructura sin tráfico

En Billing → Reports, seleccionar únicamente el proyecto, últimos 30 días, agrupar primero por servicio y después por SKU. Exportar el CSV. Separar Firestore, Storage, Functions, Cloud Run, Scheduler, Artifact Registry, Logging y cualquier Gemini o Vertex AI. Revisar también la factura OpenAI por proyecto y modelo.

Inventariar recursos desplegados, regiones, revisiones con tráfico, mínimos de instancias, tareas programadas y funciones invocadas. El repo no demuestra que un recurso esté activo o sin uso. No existe un inventario GCP autenticado en esta revisión. Las funciones de facturación, portal y tablas sí tienen consumidores en el código: no se pueden borrar en bloque.

Si hay un Express antiguo sin tráfico, retirarlo después de comprobar rutas, dominios y dependencias. En servicios compatibles, evaluar escala a cero y mínimos de instancias en cero según latencia requerida. Limpiar imágenes antiguas de Artifact Registry con una política que conserve revisiones desplegadas y rollback. Cada retirada necesita comprobar el recurso exacto y su recuperación.

### 2 Reducir el volumen base de Firestore

La siguiente ganancia grande exige paginación real de tareas y tablas, no añadir `limit()` a la consulta actual: eso ocultaría registros sin ofrecer cómo recuperarlos. Implementar cursores, carga progresiva y una ruta separada para exportar, seleccionar todo y acciones masivas. Mantener en tiempo real solo la ventana activa y los contadores que realmente lo necesitan.

Usar listeners de detalle para conversaciones seleccionadas y consultas con proyección de alcance por workspace y entidad. Conservar las consultas compatibles con permisos de viewers; sustituirlas por una consulta amplia puede producir permission denied. La presencia puede migrarse a un canal efímero si su costo medido justifica operar otro servicio; no se añade otra base solo para ahorrar centavos.

Firestore factura lecturas por los resultados iniciales, cambios y determinadas reconexiones; las consultas vacías y lecturas necesarias para reglas también pueden facturarse. Por eso un listener menos no equivale a un porcentaje fijo de ahorro. [Reglas de facturación](https://firebase.google.com/docs/firestore/pricing).

### 3 Automatizaciones por vencimiento en lugar de barridos

Las Functions `dailyPlanRoutinesTick`, `dailyBriefRoutineTick`, `dateReachedScan` y `signalRoutinesTick` requieren inventario de despliegue y consumidores antes de consolidarse con el Worker. El tick de planes lee todos los ajustes y filtra después; debe consultar solo usuarios habilitados y, posteriormente, una cola indexada por `nextRunAt`.

El barrido de fechas mantiene el límite existente de 200 registros por tabla y el de rutinas existentes. Para tablas grandes, implementar paginación persistente y presupuesto por ejecución; no confundir el ahorro aplicado con haber resuelto esa cobertura. Probar idempotencia y reintentos antes de aumentar o reducir cadencias.

### 4 Índices y almacenamiento

Auditar campos consultados y ordenados antes de excluir de índices textos extensos, cuerpos de mensajes, contenido de notas y respuestas IA. Una exclusión errónea rompe filtros. Medir bytes de índices antes y después.

Revisar uploads huérfanos, retención de versiones, archivos temporales y descarga repetida. Proponer expiración solo para temporales con propietario y fecha de caducidad verificables. No borrar adjuntos de proyectos ni cambiar su clase de almacenamiento sin medir frecuencia de acceso, recuperación y transferencia.

### 5 Control de IA y observabilidad

El Worker está configurado con OpenAI; Gemini sigue disponible en rutas Express opcionales. Revisar servicios realmente desplegados, métricas de llamadas y claves antes de desactivar Gemini. No inferir consumo cero a partir de la configuración del Worker.

Medir tokens y costo por función y usuario. Evaluar modelos con un conjunto de casos reales antes de cambiar el modelo por defecto. Usar Batch o Flex únicamente para trabajo diferible compatible, no para interacciones que necesitan respuesta inmediata. Mantener respuestas deterministas para operaciones sin necesidad de IA.

El rate limiter actual usa KV si hay un binding o memoria local en otro caso; no es una cuota monetaria global estricta. Un límite duro requiere contabilización atómica y política explícita sobre qué funciones se bloquean. No usar desactivar la facturación de todo el proyecto como protección automática.

Conservar logs de errores, seguridad y medición de uso. Medir volumen y retención antes de muestrear logs de éxito. Alertas de presupuesto no son lo mismo que spend caps; los caps disponibles tienen restricciones por servicio y pueden pausar producción. [Presupuestos](https://docs.cloud.google.com/billing/docs/how-to/budgets), [spend caps](https://docs.cloud.google.com/billing/docs/how-to/budgets-spend-caps).

## Cómo demostrar el ahorro

1. Comparar siete días antes y después con número de usuarios activos y horas de uso similares. Separar reconexiones por incidencias de actividad normal.
2. Medir lecturas y escrituras por usuario activo y por operación: abrir workspace, cambiar cinco proyectos, editar una nota y completar una tarea.
3. Para presencia estable: antes, `3600 / 45 = 80` latidos por hora; ahora, `3600 / 90 = 40`. Arranque y visibilidad añaden escrituras aparte.
4. Para mantenimiento Calendar: antes, 96 comprobaciones diarias; ahora, 24. Las lecturas de sincronizaciones reales y webhooks no desaparecen.
5. Calcular Firestore con SKU y región reales, incluyendo operaciones, índices, almacenamiento y transferencia. Calcular IA con entrada no cacheada, entrada cacheada y salida según modelo.
6. Aceptar cambios solo si cargar proyectos, filtrar, completar, adjuntar, invitar y ejecutar rutinas conservan resultados y permisos. No aceptar ahorro obtenido mediante errores de cuota o datos incompletos.

El objetivo de reducir 50% del costo total se mantiene como meta de medición, no como resultado acreditado. La primera entrega reduce desperdicio conocido; el siguiente recorte de infraestructura depende del desglose de facturación y del inventario de recursos activos.

## Verificación y reversión

Las pruebas nuevas cubren conservación y cierre de listeners, separación de identidades, expiración y fallo de tokens, límites de memoria, deduplicación HTTP de IA, mantenimiento horario y alcance de tablas. Las llamadas OAuth, Firestore y OpenAI de estas pruebas están simuladas: no consumen presupuesto ni modifican datos reales.

Validación local: 857 pruebas aprobadas, TypeScript, lint sin errores, presupuesto de deuda y compilación aprobados. Los controles de rendimiento pasan con advertencias existentes sobre componentes grandes y suscripciones aún fuera de la capa de datos. La compilación también conserva advertencias de chunks grandes; queda trabajo de división de código para latencia y transferencia.

Revertir el commit de optimización restaura cadencias y comportamiento previo sin migración de datos. Si falla un flujo concreto después de desplegar, revertir primero el cambio asociado; no abrir reglas ni aumentar consultas globales como solución general.
