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
