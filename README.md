# Hay Lugar

Sistema SaaS de reservas. Pulpo Sushi es el primer tenant.

## Entrada inicial

Home responsive con Google Auth, sesión persistente y cierre de sesión. Proyecto Firebase: `hay-lugar-1346d`. El panel de administración, los roles y la lógica de reservas todavía están pendientes; iniciar sesión no concede acceso a datos de Firestore.

## Desarrollo

Node 24. Ejecutar `npm ci`, `npm run dev`. Para verificar producción: `npm run build` y `npm start`.

## Publicación

Firebase App Hosting está conectado al repositorio y publica desde `main`, con raíz `/`. La app usa Next.js y genera el home durante la compilación. El HTML de la pantalla y el módulo de autenticación se mantienen en `public/index.html`.

El dominio publicado debe estar autorizado en Firebase Authentication para permitir el acceso con Google. No hay cambios a las reglas de Firestore en esta entrega.

## Verificación

`npm run build` pasa. El flujo OAuth se verifica por separado en el dominio publicado.

## Disponibilidad por tenant

Panel privado `/admin/pulpo` con dos modalidades: cupos por horario o mesas con capacidad y sector. Conserva la configuración de ambas al cambiar de modalidad. Admite horarios semanales, fechas específicas, duración de la reserva y cierres por fecha. No habilita todavía la toma pública de reservas.

El servidor valida el token de Google y el correo verificado. `patriciouskaer@gmail.com` tiene acceso como superadmin; los demás administradores deben estar incluidos en `allowedEmails` del documento `tenants/{tenantId}`. La lista no se puede modificar desde el cliente. No hay credenciales de servicio en el repositorio: Firebase Admin usa las credenciales automáticas de App Hosting.

La configuración se guarda en `tenants/{tenantId}/settings/availability`. El endpoint valida los datos y usa transacciones con revisión para evitar sobrescribir cambios de otra sesión. Firestore debe estar creado en `hay-lugar-1346d` y accesible por la cuenta de servicio de App Hosting. Los datos se leen y escriben únicamente desde la API autorizada; no se requieren reglas públicas para este panel.

Verificación: `npm test`, `npm run build`. El guardado con Google se verifica en el dominio publicado, porque requiere las credenciales de servicio de Firebase.
