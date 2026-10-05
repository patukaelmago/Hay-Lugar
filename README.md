# Hay Lugar

Entrada inicial con Firebase Authentication y Google. Pulpo Sushi es un tenant de Hay Lugar.

## Desarrollo

Servir `public/` con un servidor HTTP. El dominio de desarrollo debe estar autorizado en Firebase Authentication. La página utiliza módulos del SDK oficial de Firebase 12.19.0 y no requiere compilación.

## Publicación

Con Firebase CLI autenticada: `firebase deploy --only hosting --project hay-lugar-1346d`.

## Estado

- Home responsive con acceso Google, persistencia de sesión y cierre de sesión.
- Proyecto Firebase: hay-lugar-1346d.
- Los roles y permisos de los tenants todavía no están implementados. Iniciar sesión no concede acceso a datos.
- Las reglas actuales de Firestore deniegan las lecturas y escrituras desde clientes.
- Esta entrega no publica el sitio ni implementa el panel de reservas.

## Verificación

JavaScript validado con `node --check`. El flujo OAuth completo se debe verificar en el dominio publicado y autorizado.
