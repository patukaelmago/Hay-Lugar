# Hay Lugar

Sistema SaaS de reservas. Pulpo Sushi es el primer tenant.

## Entrada inicial

Home responsive con Google Auth, sesión persistente y cierre de sesión. Proyecto Firebase: `hay-lugar-1346d`. El acceso a los datos de cada tenant se valida en el backend; iniciar sesión no concede por sí solo permisos sobre todos los locales.

## Desarrollo

Node 24. Ejecutar `npm ci`, `npm run dev`. Para verificar producción: `npm run build` y `npm start`.

## Publicación

Firebase App Hosting está conectado al repositorio y publica desde `main`, con raíz `/`. La app usa Next.js y genera el home durante la compilación. El HTML de la pantalla y el módulo de autenticación se mantienen en `public/index.html`.

El dominio publicado debe estar autorizado en Firebase Authentication para permitir el acceso con Google. No hay cambios a las reglas de Firestore en esta entrega.

## Verificación

`npm run build` pasa. El flujo OAuth se verifica por separado en el dominio publicado.

## Disponibilidad por tenant

Panel privado `/admin/pulpo` con dos modalidades: cupos por horario o mesas con capacidad y sector. Conserva la configuración de ambas al cambiar de modalidad. Admite horarios semanales, fechas específicas, duración de la reserva y cierres por fecha. El link público de reserva es `/reservar/{tenantId}`.

El servidor valida el token de Google y el correo verificado. `patriciouskaer@gmail.com` tiene acceso como superadmin; los demás administradores deben estar incluidos en `allowedEmails` del documento `tenants/{tenantId}`. La lista no se puede modificar desde el cliente. No hay credenciales de servicio en el repositorio: Firebase Admin usa las credenciales automáticas de App Hosting.

La configuración se guarda en `tenants/{tenantId}/settings/availability`. El endpoint valida los datos y usa transacciones con revisión para evitar sobrescribir cambios de otra sesión. Firestore debe estar creado en `hay-lugar-1346d` y accesible por la cuenta de servicio de App Hosting. Los datos se leen y escriben únicamente desde la API autorizada; no se requieren reglas públicas para este panel.

Verificación: `npm test`, `npm run build`. El guardado con Google se verifica en el dominio publicado, porque requiere las credenciales de servicio de Firebase.


## Reservas públicas

El cliente elige fecha, cantidad de personas, horario y mesa (si corresponde), y deja nombre, teléfono y correo. El endpoint público devuelve solo horarios y mesas disponibles, nunca datos de otros clientes. La confirmación se muestra en pantalla; todavía no se envían correos ni WhatsApp.

Las fechas especiales reemplazan los horarios semanales de ese día; los cierres tienen prioridad. La ocupación usa intervalos de duración con zona horaria argentina y comprueba también los días contiguos. Transacciones de Firestore comprueban disponibilidad al confirmar, y el identificador de solicitud permite reintentar sin duplicar la reserva. Cambiar de modalidad o eliminar mesas con reservas futuras está bloqueado; reducir cupos tampoco puede dejar reservas confirmadas por encima de la capacidad.

Panel de reservas: `/admin/{tenantId}/reservas`, con consulta por fecha y cancelación que libera la ocupación. La configuración de acceso privado sigue siendo superadmin y `allowedEmails` por tenant. Las reservas no crean sesión Google para el cliente. No hay pagos, recordatorios ni lista de espera en esta entrega.

## Clientes

`/admin/{tenantId}/clientes` muestra fichas por correo electrónico, contacto, contadores de reservas, historial y notas internas. Las fichas se crean al confirmar nuevas reservas; las reservas repetidas con el mismo correo comparten ficha. La creación de la reserva y la actualización de la ficha forman una sola transacción, y los reintentos no vuelven a incrementar contadores. Las cancelaciones actualizan los contadores en la misma transacción que libera la ocupación.

Las notas son privadas y solo accesibles mediante la API autenticada del tenant. Una nueva reserva conserva las notas y los datos de contacto originales de la ficha. El guardado de notas tiene revisión para evitar sobreescrituras entre sesiones. La lista carga 50 clientes por página; la búsqueda por nombre, correo o teléfono se aplica a los clientes cargados. El historial muestra confirmadas y canceladas, sin inferir asistencia real. Las reservas anteriores a esta entrega siguen en el panel de reservas, pero no se migran automáticamente a fichas.


## Distribución inicial de Pulpo

Si todavía no hay configuración guardada, el panel precarga 12 mesas y 52 lugares: 1/3/7 con 8; 2/4/9/10/110 con 4; 5/6/8/120 con 2. El nombre o número y la capacidad se editan en el administrador. No se inventan sectores ni horarios. La precarga se confirma con Guardar cambios; no reemplaza configuraciones existentes. Si hay configuración guardada sin mesas, el administrador puede cargar esta distribución mediante el botón del panel, conservando sus horarios y cierres.


## Dashboard por tenant

Operación diaria en `/guestcenter/{tenantId}`, separada del Admin y del link público. Tiene fecha, horario, sectores, búsqueda, lista de reservas y plano de mesas. El plano inicial de Pulpo sigue la distribución aportada por el usuario; otros tenants usan su propia configuración. Posición y forma se guardan dentro de cada mesa y se editan únicamente en Admin. Nombre o número aparece dentro de la mesa y capacidad debajo.

La pantalla consulta las reservas del tenant cada 30 segundos y después de cada acción. Los filtros por horario incluyen reservas que se superponen desde días contiguos. En Todo el día el plano indica mesas con reservas del día, no disponibilidad instantánea. Las reservas por cupos sin mesa se muestran en la lista.

Acciones: llegó, finalizar y liberar, no asistió y cancelar (con confirmación). Llegó conserva la ocupación prevista; finalizar o marcar inasistencia libera el inventario mediante transacción. Los estados finales no se pueden reabrir y no asistió se habilita en el backend solo a partir del horario reservado. Las acciones requieren el mismo acceso privado del tenant que el Admin; todavía no se diferencian permisos de configuración y personal de salón. `/admin/{tenantId}/reservas` redirige al Dashboard para conservar enlaces anteriores.

Esta entrega no incluye dashboard de métricas, reservas manuales sin turno ni reubicación de reservas entre mesas. Los accesos privados siguen dependiendo de Google Auth y de Firestore configurado en producción.

## Horarios de operación por tenant

El Admin distingue apertura/cierre del local de los horarios de llegada de las reservas. Cada regla permite nombre, activación, varios rangos (incluido cierre a 24:00), días semanales, inicio/fin de vigencia y fechas puntuales adicionales. Los cierres tienen prioridad sobre las aperturas. Estas reglas filtran los horarios de llegada tanto en la consulta pública como en la transacción de reserva. No modifican las reservas ya confirmadas.

La configuración antigua conserva `operatingHours: null` y sigue funcionando hasta que el administrador configure este módulo. Una lista vacía configurada cierra las nuevas llegadas. No se precargan horarios de Picaña en Pulpo ni en otro tenant.

La equivalencia completa con Woki sigue pendiente: frecuencia de repetición avanzada, sectores con múltiples layouts, turnos vinculados a layouts, combinaciones de mesas, políticas y walk-ins requieren completar la inspección de sus formularios. Esta entrega implementa únicamente los controles verificados; no afirma paridad total.

## Operación compartida por tenant

El Admin (`/admin/{tenantId}/inicio`) muestra métricas de los últimos 30 días y enlaza configuración, clientes, datos del negocio y Dashboard. `/dashboard/{tenantId}` es el acceso de operación; `/guestcenter/{tenantId}` sigue disponible. El ingreso principal conduce a `/negocios`, que lista los tenants asignados a la cuenta. El superadmin puede crear un negocio con identificador único y un correo de Google autorizado; el resto de cuentas solo recibe sus negocios.

La configuración agrega distribuciones del salón con selección de mesas, mesas habilitadas y mínimo/máximo de personas por mesa. Cada horario de llegada puede estar vinculado a una distribución. El editor permite generar un turno semanal con rango de llegadas, intervalo y permanencia; también conserva fechas específicas. El plano puede editarse arrastrando mesas o con el teclado. Los turnos sin distribución conservan el comportamiento anterior: usan todas las mesas habilitadas. No se sobrescriben mesas ni configuraciones ya guardadas en Pulpo.

La reserva pública pide fecha, cantidad, horario y sector opcional; el backend asigna la mesa disponible de menor capacidad suficiente. La transacción protege solapamientos también entre turnos y días contiguos. Los límites públicos incluyen activar/desactivar, anticipación mínima/máxima, máximo de personas y política, cuya aceptación verifica el backend. Los locales por cupos siguen usando la capacidad configurada.

El Dashboard permite cargar reservas manuales para horarios configurados, registrar llegadas sin reserva en el horario actual con permanencia, cambiar de mesa comprobando capacidad y ocupación y manejar la lista de espera por fecha. La lista de espera es privada, no ocupa inventario ni genera notificaciones automáticas; convertirla en reserva requiere cargar la reserva y cerrar la entrada. No se interpretan estados como envío efectivo de mensajes. Las modificaciones de disponibilidad protegen mesas y distribuciones que tienen reservas futuras.

Pendiente de completar la referencia Woki: combinaciones de mesas, recurrencias avanzadas, permisos de personal diferenciados, automatizaciones de contacto y reglas que no fueron observadas. La permanencia planificada sigue siendo el intervalo de inventario; los cambios de duración y mesas combinadas todavía no están incluidos. No se afirma equivalencia completa con Woki.

Verificación de esta entrega: pruebas de distribuciones, asignación automática, mínimos, límites públicos, validación y regresiones; compilación de producción y comprobación de acceso HTTP. El endpoint público existente de Pulpo respondió 200 desde Firestore antes de publicar, conservando su configuración guardada; no se crearon reservas reales durante la comprobación.
