# Plantillas de clases, asistencias y PWA

## Resumen ejecutivo

Esta PR convierte la programación y el control de clases en un flujo más práctico para el trabajo diario de PsicoArte:

- registra el resultado real de cada clase por alumno;
- calcula el consumo de paquetes de clases a partir de la asistencia;
- permite reutilizar horarios y grupos mediante plantillas recurrentes;
- admite alumnos ocasionales o cambios futuros sin modificar el histórico;
- mejora la toma de asistencia en pantallas táctiles;
- permite instalar el frontend como una aplicación PWA usando el logo oficial de PsicoArte.

La rama no reemplaza las clases históricas ni recalcula el pasado a partir de una lista actual. Cada clase concreta mantiene sus propias inscripciones y asistencias.

## Problema que resuelve

Antes de este cambio, el saldo de un alumno se calculaba principalmente a partir de las clases inscritas y sus fechas. Ese enfoque no distinguía de forma suficiente entre una clase efectivamente consumida, una clase pendiente y una clase que se debía posponer.

Además, para repetir una clase semanal era necesario crear y asignar manualmente cada ocurrencia, aunque normalmente el horario y la mayoría de estudiantes fueran los mismos.

## Decisiones de negocio

### Consumo de clases pagadas

Una clase pasada consume una unidad del paquete únicamente cuando el alumno tiene asistencia con estado:

| Estado | ¿Consume? | Uso |
| --- | --- | --- |
| `programada` | No | La clase todavía está pendiente de registrar |
| `presente` | Sí | El alumno asistió |
| `ausente` | Sí | La clase se realizó, aunque el alumno no asistió |
| `pospuesta` | No | La clase no debe descontarse del paquete |

Reglas complementarias:

- Una clase futura no consume saldo aunque tenga un registro de asistencia.
- Una asistencia solo puede asociar alumnos inscritos en la clase.
- Una `pospuesta` requiere una justificación en `observacion`.
- El saldo se calcula dinámicamente; no se guarda un contador que pueda quedar desactualizado.
- Si se corrige una asistencia o un pago, el resumen se recalcula con la información actual.

## Plantillas recurrentes

### Modelo funcional

Una plantilla representa la configuración reutilizable de una clase:

- nombre y descripción;
- jornada y horario;
- fecha inicial y fecha final opcional;
- frecuencia semanal o quincenal;
- alumnos base;
- estado activo o inactivo.

La plantilla no es una clase histórica. Al generar un rango, se crean registros independientes de `ClaseProgramada`.

### Lista base y excepciones

La lista base contiene los alumnos habituales del horario. Para una fecha específica se pueden registrar excepciones:

- **Agregar alumno:** incluye un alumno ocasional en una sola ocurrencia.
- **Quitar alumno:** excluye temporalmente a un alumno de una sola ocurrencia.

Los cambios de la plantilla afectan futuras generaciones, pero no cambian las clases que ya existen ni sus asistencias.

### Generación de clases

- La frecuencia semanal genera la ocurrencia correspondiente cada semana.
- La frecuencia quincenal genera la ocurrencia cada 14 días.
- Solo se generan fechas que coinciden con el día de la jornada.
- Una clase existente no se duplica si se vuelve a solicitar el mismo rango.
- Los alumnos se copian a la clase concreta al momento de generar el registro.

## Flujo de uso en la interfaz

1. Entrar a **Plantillas de clases** desde el menú principal.
2. Crear una plantilla con nombre, fecha inicial, rango y jornada.
3. Abrir **Gestionar alumnos y fechas**.
4. Añadir los alumnos base habituales.
5. Registrar excepciones cuando un alumno se incorpore o retire solo en una fecha.
6. Seleccionar el rango futuro y pulsar **Generar clases**.
7. Revisar las clases concretas desde **Programar Clases**.
8. Abrir una clase y registrar la asistencia con botones táctiles.

La interfaz utiliza tarjetas, botones con área táctil amplia, formularios de una columna en móvil y distribuciones de dos o tres columnas solo cuando el ancho disponible lo permite.

## API incorporada

### Plantillas

```text
GET    /api/plantillas-clase/
POST   /api/plantillas-clase/
PATCH  /api/plantillas-clase/{id}/
DELETE /api/plantillas-clase/{id}/
```

Ejemplo de creación:

```json
{
	"nombre": "Iniciación Musical - lunes",
	"descripcion": "Grupo base de la tarde",
	"id_jornada": 3,
	"fecha_inicio": "2026-10-05",
	"fecha_fin": "2026-12-21",
	"activo": true,
	"es_recurrente": true,
	"frecuencia": "semanal"
}
```

### Alumnos y excepciones

```text
POST   /api/plantillas-clase/{id}/alumnos/
DELETE /api/plantillas-clase/{id}/alumnos/{ti}/
POST   /api/plantillas-clase/{id}/excepciones/
```

Ejemplo de excepción:

```json
{
	"fecha": "2026-10-19",
	"ti": "ALU-001",
	"accion": "agregar",
	"observacion": "Clase de recuperación"
}
```

### Generación

```text
POST /api/plantillas-clase/{id}/generar/
```

```json
{
	"fecha_inicio": "2026-10-05",
	"fecha_fin": "2026-12-21"
}
```

La respuesta informa los identificadores de las clases nuevas y la cantidad generada.

## Cambios de backend

- `Alumno.detalle_pagos()` ahora consulta los estados de asistencia consumibles.
- `Asistencia` incorpora el estado `pospuesta`.
- `AsistenciaSerializer` valida inscripción y justificación.
- `PlantillaClase` guarda la configuración recurrente.
- `PlantillaClaseAlumno` relaciona alumnos base con plantillas.
- `ExcepcionClase` guarda cambios por fecha.
- `ClaseProgramada.plantilla` permite rastrear el origen de una ocurrencia sin hacerla dependiente de la plantilla.
- Se agregaron endpoints protegidos para personal de la empresa.

## Cambios de frontend

- Nueva ruta protegida `/plantillas-clases`.
- Nueva pantalla `PlantillasClasesPage`.
- Gestión de creación, edición y eliminación de plantillas.
- Gestión de alumnos base desde la misma vista.
- Gestión de excepciones puntuales.
- Generación de rangos futuros desde móvil o escritorio.
- Botones de asistencia para `Pendiente`, `Asistió`, `Inasist.` y `Pospuesta`.
- Conservación de la vista familiar para mostrar el estado `pospuesta`.
- Corrección del error de TypeScript por `incomingNotice` declarado pero no utilizado en mensajería.

## PWA e instalación móvil

Se incorporó:

- `manifest.webmanifest` con nombre, colores, idioma y modo standalone;
- `service worker` para cachear el shell de la aplicación y recursos GET del mismo origen;
- registro del service worker únicamente en producción;
- meta etiquetas para Android e iOS;
- favicon, `apple-touch-icon` e icono de instalación apuntando al mismo archivo oficial.

El icono utilizado es exactamente `Frontend/public/logo.png`. No se genera una variante, no se redibuja y no se sustituye por un SVG. El archivo original y el archivo empaquetado en `dist` fueron comparados mediante SHA-256 y resultaron idénticos.

## Migraciones

- `Backend/core/migrations/0014_asistencia_pospuesta.py`
- `Backend/core/migrations/0015_plantillaclase_claseprogramada_plantilla_and_more.py`

Aplicar con:

```bash
cd Backend
python manage.py migrate
```

## Validaciones realizadas

### Backend

- `python manage.py check` ✅
- Instanciación de `PlantillaClaseSerializer` ✅
- Aplicación de migraciones ✅
- Compilación de sintaxis Python ✅
- Prueba específica de consumo de `presente`, `ausente` y `pospuesta` ✅

### Frontend

- `npm run build` ✅
- TypeScript sin errores ✅
- Build de Vite completado ✅
- Logo original y logo en `dist` con el mismo SHA-256 ✅

### Calidad del cambio

- `git diff --check` ✅
- Rama publicada como `asistencias` y basada en `main` ✅

## Pruebas manuales recomendadas

- Crear una plantilla semanal y generar cuatro semanas.
- Volver a generar el mismo rango y confirmar que no duplica clases.
- Añadir un alumno base y generar un rango posterior.
- Agregar un alumno ocasional para una sola fecha.
- Retirar un alumno para una sola fecha.
- Confirmar que esas excepciones no alteran una clase histórica.
- Registrar `presente` y confirmar que descuenta una clase.
- Registrar `ausente` y confirmar que descuenta una clase.
- Registrar `pospuesta` con justificación y confirmar que no descuenta.
- Intentar guardar `pospuesta` sin justificación y confirmar el rechazo.
- Abrir la aplicación desde un teléfono y verificar la instalación como PWA.

## Consideraciones y pendientes

- La suite histórica de Django contiene pruebas que requieren autenticación; al ejecutarse sin preparar un usuario autenticado, seis pruebas existentes responden `401`. La prueba nueva de consumo sí pasa.
- El build de Vite muestra una advertencia de tamaño de bundle superior a 500 kB, pero termina correctamente.
- El service worker cachea recursos de la aplicación, pero las operaciones de API siguen requiriendo conexión y autenticación.
- La migración debe ejecutarse en cada ambiente antes de utilizar las nuevas rutas.

## Checklist de revisión

- [ ] Revisar modelos y migraciones.
- [ ] Probar creación y edición de una plantilla.
- [ ] Probar alumnos base y excepciones.
- [ ] Probar generación semanal y quincenal.
- [ ] Confirmar que no se modifica el histórico.
- [ ] Probar consumo de saldo por asistencia.
- [ ] Probar instalación PWA en teléfono.
- [ ] Confirmar que el logo instalado es el oficial.
