# Hay Lugar

Sistema SaaS de reservas. Primer restaurante: Pulpo Sushi.

## Alcance inicial acordado

- Página principal para presentar Hay Lugar.
- Enlace de reservas independiente por restaurante.
- Capacidad máxima configurable por restaurante y turno.
- Uno o varios turnos configurables.
- Reservas según cantidad de personas y cupo disponible.
- Administrador para registrar también reservas telefónicas y organizar las mesas según los grupos.
- Distribución flexible del salón, con opciones para dividir, unir o reemplazar mesas.
- Datos y permisos separados por restaurante.

## Backend previsto

Firebase Authentication para acceso y Firestore para datos. Las reservas deberán validar y descontar cupos de forma atómica para evitar sobreventas cuando dos clientes reserven al mismo tiempo. La confirmación automática o manual queda por definir.

## Pendiente de confirmar con Pulpo

Capacidad real, horarios, cantidad de turnos, reglas de distribución de mesas y política de confirmación/cancelación.

## Estado

Repositorio inicializado. Todavía no hay una aplicación implementada ni conexión a Firebase. El dominio ya está comprado; su conexión se realizará en un paso posterior.
