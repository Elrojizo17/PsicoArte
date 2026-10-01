# Plantillas de clases, asistencias y PWA

## Resumen

Esta rama incorpora el módulo de asistencias, plantillas para clases recurrentes y soporte PWA para PsicoArte. El objetivo es facilitar la operación diaria desde teléfono sin alterar el historial de clases ya realizadas.

## Cambios incluidos

### Asistencias y consumo de clases

- Se añadieron los estados `presente`, `ausente` y `pospuesta`.
- Las asistencias y las inasistencias consumen una clase pagada.
- Las clases programadas y pospuestas no consumen saldo.
- Una clase pospuesta exige una justificación.
- Solo se puede registrar asistencia para alumnos inscritos en la clase.
- El cálculo del saldo continúa siendo derivado y recalculable al editar pagos o asistencias.

### Plantillas de clases recurrentes

- Se añadió el modelo `PlantillaClase` para guardar horario, periodo y frecuencia.
- Cada plantilla puede tener alumnos base.
- Se añadieron excepciones por fecha para agregar o retirar alumnos ocasionalmente.
- Se pueden generar clases semanales o quincenales para un rango de fechas.
- Las clases ya existentes no se duplican.
- Cada clase generada conserva su propia lista de alumnos, por lo que los cambios futuros no modifican el histórico.
- Se agregó la pantalla móvil `/plantillas-clases` para crear, editar y gestionar plantillas.

### Interfaz y PWA

- Se mejoró la toma de asistencia con botones grandes y controles táctiles.
- Se añadió la ruta y navegación de plantillas de clases.
- Se añadió manifest, service worker y soporte de instalación como PWA.
- La PWA usa exactamente el logo oficial `Frontend/public/logo.png` como icono, favicon e icono de instalación.
- Se corrigió el error de TypeScript por `incomingNotice` sin uso en mensajería.

## Migraciones

- `core/migrations/0014_asistencia_pospuesta.py`
- `core/migrations/0015_plantillaclase_claseprogramada_plantilla_and_more.py`

Aplicar con:

```bash
python manage.py migrate
```

## API nueva

```text
GET    /api/plantillas-clase/
POST   /api/plantillas-clase/
PATCH  /api/plantillas-clase/{id}/
DELETE /api/plantillas-clase/{id}/
POST   /api/plantillas-clase/{id}/alumnos/
DELETE /api/plantillas-clase/{id}/alumnos/{ti}/
POST   /api/plantillas-clase/{id}/excepciones/
POST   /api/plantillas-clase/{id}/generar/
```

## Validaciones realizadas

- `python manage.py check`
- Instanciación de `PlantillaClaseSerializer`
- `npm run build`
- `git diff --check`
- Verificación SHA-256 del logo original y del logo incluido en `dist`

## Consideraciones

La suite histórica de Django contiene pruebas que requieren autenticación y algunas fallan con `401` cuando se ejecutan sin preparar un usuario autenticado. Ese comportamiento pertenece a la configuración de esas pruebas existentes y no a la lógica nueva de plantillas o asistencias.

El build frontend puede mostrar una advertencia de tamaño de bundle de Vite, pero termina correctamente.
