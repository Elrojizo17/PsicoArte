-- LIMPIEZA DE FAMILIAS Y ALUMNOS
-- Ejecutar manualmente en el SQL Editor de Supabase y solo en el proyecto correcto.
-- Elimina acudientes y alumnos, junto con sus asistencias, pagos, inscripciones,
-- excepciones, asignaciones a plantillas y conversaciones/mensajes relacionados.
-- NO elimina auth_user ni ninguna otra tabla de autenticación, grupos/perfiles,
-- permisos, migraciones, jornadas, plantillas de clase ni clases programadas.
-- Los usuarios Django que estuvieran asociados a acudientes se conservan sin perfil.

BEGIN;

DELETE FROM asistencia
 WHERE alumno_id IN (SELECT ti FROM alumno);

DELETE FROM pago
 WHERE ti_alumno IN (SELECT ti FROM alumno);

DELETE FROM alumno_clase
 WHERE ti IN (SELECT ti FROM alumno);

DELETE FROM plantilla_clase_alumno
 WHERE alumno_id IN (SELECT ti FROM alumno);

DELETE FROM excepcion_clase
 WHERE alumno_id IN (SELECT ti FROM alumno);

DELETE FROM mensaje
 WHERE conversacion_id IN (
     SELECT id
       FROM conversacion
      WHERE acudiente_id IN (SELECT numero_documento FROM acudiente)
 );

DELETE FROM conversacion
 WHERE acudiente_id IN (SELECT numero_documento FROM acudiente);

DELETE FROM alumno;
DELETE FROM acudiente;

COMMIT;

-- Verificación: ambos conteos deben ser cero.
SELECT
    (SELECT count(*) FROM acudiente) AS acudientes_restantes,
    (SELECT count(*) FROM alumno) AS alumnos_restantes;
