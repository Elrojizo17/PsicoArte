-- FAMILIAS Y ALUMNOS FICTICIOS PARA DEMOSTRACION EN SUPABASE
-- Ejecutar despues de verificar que este conectado al proyecto correcto.
-- Idempotente: usa identificadores DEMO y puede ejecutarse mas de una vez.
-- Cuentas familiares: demo.familia.01 ... demo.familia.10
-- Clave compartida para la demostracion: DemoPsicoArte#2026
-- No asigna grupos administrativos a las cuentas familiares.
--
-- Edades/horarios solicitados:
--   Estimulacion (1.5-4): 11:15-12:00 y 16:30-17:15 (el modelo actual
--   guarda ambos horarios como "Estimulacion Temprana"; "Inicial" es el
--   nombre anterior y no es aceptado por la restriccion vigente de jornada).
--   Iniciacion musical (6-8): 17:15-18:00; viernes 17:00-17:45.
--   Ensamble musical (8+): 18:00-18:45; viernes 17:45-18:30.
--   A los 8 años se incluyen ambos grupos porque los rangos indicados se cruzan.
-- Dias: estimulacion lunes a jueves; musica lunes, martes y jueves; viernes
-- solo las dos jornadas musicales. El miercoles solo tiene estimulacion.
-- Se crean 8 semanas de clases pasadas con estados presente y ausente.

BEGIN;

DO $preflight$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM (VALUES
              ('DEMO-ACU-0001', 'demo.familia.01'),
              ('DEMO-ACU-0002', 'demo.familia.02'),
              ('DEMO-ACU-0003', 'demo.familia.03'),
              ('DEMO-ACU-0004', 'demo.familia.04'),
              ('DEMO-ACU-0005', 'demo.familia.05'),
              ('DEMO-ACU-0006', 'demo.familia.06'),
              ('DEMO-ACU-0007', 'demo.familia.07'),
              ('DEMO-ACU-0008', 'demo.familia.08'),
              ('DEMO-ACU-0009', 'demo.familia.09'),
              ('DEMO-ACU-0010', 'demo.familia.10')
          ) AS seed(documento, username)
          JOIN auth_user u ON u.username = seed.username
          LEFT JOIN acudiente a ON a.numero_documento = seed.documento
         WHERE a.numero_documento IS NULL
            OR a.usuario_id IS DISTINCT FROM u.id
    ) THEN
        RAISE EXCEPTION
            'Una cuenta demo ya existe y no pertenece a su acudiente DEMO. Revise los usuarios antes de importar.';
    END IF;
END
$preflight$;

-- Cuentas de acudiente, no cuentas administrativas. El hash es Django PBKDF2.
INSERT INTO auth_user (
    password, last_login, is_superuser, username, first_name, last_name,
    email, is_staff, is_active, date_joined
)
VALUES
    ('pbkdf2_sha256$1000000$psicoarteDemo2026$clxa09TSSClEMPO8MleoXr4usY6mBOmuPe1vYVMuRCc=', NULL, FALSE, 'demo.familia.01', 'Laura', 'Gomez', 'familia01.demo@example.com', FALSE, TRUE, now()),
    ('pbkdf2_sha256$1000000$psicoarteDemo2026$clxa09TSSClEMPO8MleoXr4usY6mBOmuPe1vYVMuRCc=', NULL, FALSE, 'demo.familia.02', 'Andres', 'Ramirez', 'familia02.demo@example.com', FALSE, TRUE, now()),
    ('pbkdf2_sha256$1000000$psicoarteDemo2026$clxa09TSSClEMPO8MleoXr4usY6mBOmuPe1vYVMuRCc=', NULL, FALSE, 'demo.familia.03', 'Diana', 'Torres', 'familia03.demo@example.com', FALSE, TRUE, now()),
    ('pbkdf2_sha256$1000000$psicoarteDemo2026$clxa09TSSClEMPO8MleoXr4usY6mBOmuPe1vYVMuRCc=', NULL, FALSE, 'demo.familia.04', 'Felipe', 'Vargas', 'familia04.demo@example.com', FALSE, TRUE, now()),
    ('pbkdf2_sha256$1000000$psicoarteDemo2026$clxa09TSSClEMPO8MleoXr4usY6mBOmuPe1vYVMuRCc=', NULL, FALSE, 'demo.familia.05', 'Marcela', 'Rojas', 'familia05.demo@example.com', FALSE, TRUE, now()),
    ('pbkdf2_sha256$1000000$psicoarteDemo2026$clxa09TSSClEMPO8MleoXr4usY6mBOmuPe1vYVMuRCc=', NULL, FALSE, 'demo.familia.06', 'Javier', 'Castro', 'familia06.demo@example.com', FALSE, TRUE, now()),
    ('pbkdf2_sha256$1000000$psicoarteDemo2026$clxa09TSSClEMPO8MleoXr4usY6mBOmuPe1vYVMuRCc=', NULL, FALSE, 'demo.familia.07', 'Paola', 'Herrera', 'familia07.demo@example.com', FALSE, TRUE, now()),
    ('pbkdf2_sha256$1000000$psicoarteDemo2026$clxa09TSSClEMPO8MleoXr4usY6mBOmuPe1vYVMuRCc=', NULL, FALSE, 'demo.familia.08', 'Ricardo', 'Mendoza', 'familia08.demo@example.com', FALSE, TRUE, now()),
    ('pbkdf2_sha256$1000000$psicoarteDemo2026$clxa09TSSClEMPO8MleoXr4usY6mBOmuPe1vYVMuRCc=', NULL, FALSE, 'demo.familia.09', 'Natalia', 'Silva', 'familia09.demo@example.com', FALSE, TRUE, now()),
    ('pbkdf2_sha256$1000000$psicoarteDemo2026$clxa09TSSClEMPO8MleoXr4usY6mBOmuPe1vYVMuRCc=', NULL, FALSE, 'demo.familia.10', 'Sergio', 'Ortiz', 'familia10.demo@example.com', FALSE, TRUE, now())
ON CONFLICT (username) DO NOTHING;

INSERT INTO acudiente (
    numero_documento, usuario_id, nombre_1, nombre_2, apellido_1, apellido_2,
    tipo_documento, correo, telefono_1, telefono_2, telefono_3
)
SELECT seed.documento, u.id, seed.nombre, '', seed.apellido, '',
       'CC', seed.correo, seed.telefono, '', ''
  FROM (VALUES
      ('DEMO-ACU-0001', 'demo.familia.01', 'Laura', 'Gomez', 'familia01.demo@example.com', '3005550101'),
      ('DEMO-ACU-0002', 'demo.familia.02', 'Andres', 'Ramirez', 'familia02.demo@example.com', '3005550102'),
      ('DEMO-ACU-0003', 'demo.familia.03', 'Diana', 'Torres', 'familia03.demo@example.com', '3005550103'),
      ('DEMO-ACU-0004', 'demo.familia.04', 'Felipe', 'Vargas', 'familia04.demo@example.com', '3005550104'),
      ('DEMO-ACU-0005', 'demo.familia.05', 'Marcela', 'Rojas', 'familia05.demo@example.com', '3005550105'),
      ('DEMO-ACU-0006', 'demo.familia.06', 'Javier', 'Castro', 'familia06.demo@example.com', '3005550106'),
      ('DEMO-ACU-0007', 'demo.familia.07', 'Paola', 'Herrera', 'familia07.demo@example.com', '3005550107'),
      ('DEMO-ACU-0008', 'demo.familia.08', 'Ricardo', 'Mendoza', 'familia08.demo@example.com', '3005550108'),
      ('DEMO-ACU-0009', 'demo.familia.09', 'Natalia', 'Silva', 'familia09.demo@example.com', '3005550109'),
      ('DEMO-ACU-0010', 'demo.familia.10', 'Sergio', 'Ortiz', 'familia10.demo@example.com', '3005550110')
  ) AS seed(documento, username, nombre, apellido, correo, telefono)
  JOIN auth_user u ON u.username = seed.username
ON CONFLICT (numero_documento) DO UPDATE SET
    usuario_id = EXCLUDED.usuario_id,
    nombre_1 = EXCLUDED.nombre_1,
    apellido_1 = EXCLUDED.apellido_1,
    correo = EXCLUDED.correo,
    telefono_1 = EXCLUDED.telefono_1;

INSERT INTO alumno (
    ti, nombre_1, nombre_2, apellido_1, apellido_2, identificacion,
    tipo_sangre, eps, numero_documento_acudiente, fecha_nacimiento
)
VALUES
    ('DEMO-ALU-0001', 'Sofia', '', 'Gomez', '', NULL, 'O+', 'EPS Demo', 'DEMO-ACU-0001', (current_date - interval '2 years')::date),
    ('DEMO-ALU-0002', 'Martin', '', 'Ramirez', '', NULL, 'A+', 'EPS Demo', 'DEMO-ACU-0002', (current_date - interval '3 years')::date),
    ('DEMO-ALU-0003', 'Emma', '', 'Torres', '', NULL, 'O+', 'EPS Demo', 'DEMO-ACU-0003', (current_date - interval '4 years')::date),
    ('DEMO-ALU-0004', 'Samuel', '', 'Vargas', '', NULL, 'B+', 'EPS Demo', 'DEMO-ACU-0004', (current_date - interval '18 months')::date),
    ('DEMO-ALU-0005', 'Isabella', '', 'Vargas', '', NULL, 'O-', 'EPS Demo', 'DEMO-ACU-0004', (current_date - interval '3 years')::date),
    ('DEMO-ALU-0006', 'Daniel', '', 'Rojas', '', NULL, 'A+', 'EPS Demo', 'DEMO-ACU-0005', (current_date - interval '6 years')::date),
    ('DEMO-ALU-0007', 'Luciana', '', 'Castro', '', NULL, 'O+', 'EPS Demo', 'DEMO-ACU-0006', (current_date - interval '7 years')::date),
    ('DEMO-ALU-0008', 'Nicolas', '', 'Castro', '', NULL, 'AB+', 'EPS Demo', 'DEMO-ACU-0006', (current_date - interval '6 years')::date),
    ('DEMO-ALU-0009', 'Valeria', '', 'Herrera', '', NULL, 'B+', 'EPS Demo', 'DEMO-ACU-0007', (current_date - interval '8 years')::date),
    ('DEMO-ALU-0010', 'Tomas', '', 'Mendoza', '', NULL, 'O+', 'EPS Demo', 'DEMO-ACU-0008', (current_date - interval '9 years')::date),
    ('DEMO-ALU-0011', 'Gabriela', '', 'Mendoza', '', NULL, 'A-', 'EPS Demo', 'DEMO-ACU-0008', (current_date - interval '11 years')::date),
    ('DEMO-ALU-0012', 'Alejandro', '', 'Silva', '', NULL, 'O+', 'EPS Demo', 'DEMO-ACU-0009', (current_date - interval '10 years')::date),
    ('DEMO-ALU-0013', 'Mariana', '', 'Silva', '', NULL, 'B+', 'EPS Demo', 'DEMO-ACU-0009', (current_date - interval '12 years')::date),
    ('DEMO-ALU-0014', 'Julian', '', 'Ortiz', '', NULL, 'A+', 'EPS Demo', 'DEMO-ACU-0010', (current_date - interval '9 years')::date)
ON CONFLICT (ti) DO UPDATE SET
    nombre_1 = EXCLUDED.nombre_1,
    apellido_1 = EXCLUDED.apellido_1,
    tipo_sangre = EXCLUDED.tipo_sangre,
    eps = EXCLUDED.eps,
    numero_documento_acudiente = EXCLUDED.numero_documento_acudiente,
    fecha_nacimiento = EXCLUDED.fecha_nacimiento;

-- Completa solo jornadas que falten, respetando los valores aceptados por el
-- modelo actual de Django y la restriccion de tipo_jornada en la base.
INSERT INTO jornada (dia_semana, hora_inicio, hora_final, tipo_jornada)
SELECT wanted.dia, wanted.inicio::time, wanted.fin::time, wanted.tipo
  FROM (VALUES
      ('Lunes', '11:15', '12:00', 'Estimulación Temprana'),
      ('Lunes', '16:30', '17:15', 'Estimulación Temprana'),
      ('Lunes', '17:15', '18:00', 'Iniciación Musical'),
      ('Lunes', '18:00', '18:45', 'Ensamble Musical'),
      ('Martes', '11:15', '12:00', 'Estimulación Temprana'),
      ('Martes', '16:30', '17:15', 'Estimulación Temprana'),
      ('Martes', '17:15', '18:00', 'Iniciación Musical'),
      ('Martes', '18:00', '18:45', 'Ensamble Musical'),
      ('Miércoles', '11:15', '12:00', 'Estimulación Temprana'),
      ('Miércoles', '16:30', '17:15', 'Estimulación Temprana'),
      ('Jueves', '11:15', '12:00', 'Estimulación Temprana'),
      ('Jueves', '16:30', '17:15', 'Estimulación Temprana'),
      ('Jueves', '17:15', '18:00', 'Iniciación Musical'),
      ('Jueves', '18:00', '18:45', 'Ensamble Musical'),
      ('Viernes', '17:00', '17:45', 'Iniciación Musical'),
      ('Viernes', '17:45', '18:30', 'Ensamble Musical')
  ) AS wanted(dia, inicio, fin, tipo)
 WHERE NOT EXISTS (
     SELECT 1
       FROM jornada j
      WHERE j.dia_semana = wanted.dia
        AND j.hora_inicio = wanted.inicio::time
        AND j.hora_final = wanted.fin::time
        AND j.tipo_jornada = wanted.tipo
 );

-- Una plantilla demo por cada jornada real; usa fechas de ocho semanas.
INSERT INTO plantilla_clase (
    id_jornada, nombre, descripcion, fecha_inicio, fecha_fin,
    activo, es_recurrente, frecuencia
)
SELECT j.id_jornada,
       'DEMO FAMILIAS - ' || j.dia_semana || ' ' || to_char(j.hora_inicio, 'HH24:MI') || ' - ' || j.tipo_jornada,
       'Grupo ficticio para demostracion; asistencia de ejemplo.',
       current_date - 56, current_date, TRUE, TRUE, 'semanal'
  FROM jornada j
 WHERE (
       (j.dia_semana IN ('Lunes', 'Martes', 'Miércoles', 'Jueves')
        AND j.tipo_jornada = 'Estimulación Temprana'
        AND j.hora_inicio IN (TIME '11:15', TIME '16:30'))
       OR (j.dia_semana IN ('Lunes', 'Martes', 'Jueves')
           AND j.tipo_jornada = 'Iniciación Musical'
           AND j.hora_inicio = TIME '17:15')
       OR (j.dia_semana = 'Viernes'
           AND j.tipo_jornada = 'Iniciación Musical'
           AND j.hora_inicio = TIME '17:00')
       OR (j.dia_semana IN ('Lunes', 'Martes', 'Jueves')
           AND j.tipo_jornada = 'Ensamble Musical'
           AND j.hora_inicio = TIME '18:00')
       OR (j.dia_semana = 'Viernes'
           AND j.tipo_jornada = 'Ensamble Musical'
           AND j.hora_inicio = TIME '17:45')
   )
   AND NOT EXISTS (
       SELECT 1
         FROM plantilla_clase existing
        WHERE existing.id_jornada = j.id_jornada
          AND existing.nombre =
              'DEMO FAMILIAS - ' || j.dia_semana || ' ' ||
              to_char(j.hora_inicio, 'HH24:MI') || ' - ' || j.tipo_jornada
   );

-- Idempotentemente agrega todos los alumnos a los grupos correspondientes
-- a su edad y a las jornadas habilitadas.
INSERT INTO plantilla_clase_alumno (plantilla_id, alumno_id)
SELECT p.id_plantilla, a.ti
  FROM plantilla_clase p
  JOIN jornada j ON j.id_jornada = p.id_jornada
 CROSS JOIN alumno a
 WHERE p.nombre LIKE 'DEMO FAMILIAS - %'
   AND (
       (j.tipo_jornada = 'Estimulación Temprana'
        AND a.fecha_nacimiento > (current_date - interval '5 years')::date
        AND a.fecha_nacimiento <= (current_date - interval '18 months')::date)
       OR (j.tipo_jornada = 'Iniciación Musical'
           AND a.fecha_nacimiento > (current_date - interval '9 years')::date
           AND a.fecha_nacimiento <= (current_date - interval '6 years')::date)
       OR (j.tipo_jornada = 'Ensamble Musical'
           AND a.fecha_nacimiento <= (current_date - interval '8 years')::date)
   )
ON CONFLICT (plantilla_id, alumno_id) DO NOTHING;

-- Clases fechadas para las ocho semanas recientes, una por jornada/fecha.
INSERT INTO clase_programada (id_jornada, fecha, plantilla_id)
SELECT p.id_jornada, dates.class_date::date, p.id_plantilla
  FROM plantilla_clase p
  JOIN jornada j ON j.id_jornada = p.id_jornada
 CROSS JOIN generate_series(
       current_date - 55,
       current_date,
       interval '1 day'
  ) AS dates(class_date)
 WHERE p.nombre LIKE 'DEMO FAMILIAS - %'
   AND dates.class_date::date >= p.fecha_inicio
   AND CASE j.dia_semana
       WHEN 'Lunes' THEN extract(isodow FROM dates.class_date) = 1
       WHEN 'Martes' THEN extract(isodow FROM dates.class_date) = 2
       WHEN 'Miércoles' THEN extract(isodow FROM dates.class_date) = 3
       WHEN 'Jueves' THEN extract(isodow FROM dates.class_date) = 4
       WHEN 'Viernes' THEN extract(isodow FROM dates.class_date) = 5
       ELSE FALSE
   END
   AND NOT EXISTS (
       SELECT 1
         FROM clase_programada cp
        WHERE cp.plantilla_id = p.id_plantilla
          AND cp.fecha = dates.class_date::date
   );

INSERT INTO alumno_clase (ti, id_clase)
SELECT pca.alumno_id, cp.id_clase
  FROM plantilla_clase_alumno pca
  JOIN plantilla_clase p ON p.id_plantilla = pca.plantilla_id
  JOIN clase_programada cp ON cp.plantilla_id = p.id_plantilla
 WHERE p.nombre LIKE 'DEMO FAMILIAS - %'
ON CONFLICT (ti, id_clase) DO NOTHING;

-- En cada alumno: seis presentes y dos ausencias en ocho sesiones.
INSERT INTO asistencia (alumno_id, clase_id, estado, observacion)
SELECT attendance.alumno_id,
       attendance.clase_id,
       CASE WHEN attendance.session_number % 4 = 0 THEN 'ausente' ELSE 'presente' END,
       CASE WHEN attendance.session_number % 4 = 0
            THEN 'Inasistencia de ejemplo (demo).'
            ELSE 'Asistencia de ejemplo (demo).'
       END
  FROM (
      SELECT ac.ti AS alumno_id,
             cp.id_clase AS clase_id,
             row_number() OVER (
                 PARTITION BY ac.ti, p.id_plantilla
                 ORDER BY cp.fecha
             ) AS session_number
        FROM alumno_clase ac
        JOIN clase_programada cp ON cp.id_clase = ac.id_clase
        JOIN plantilla_clase p ON p.id_plantilla = cp.plantilla_id
       WHERE p.nombre LIKE 'DEMO FAMILIAS - %'
  ) AS attendance
ON CONFLICT (alumno_id, clase_id) DO UPDATE SET
    estado = EXCLUDED.estado,
    observacion = EXCLUDED.observacion;

-- Datos de pago ficticios para que el portal familiar tenga contexto adicional.
INSERT INTO pago (ti_alumno, fecha_pago, clases_pagadas, valor_pagado)
SELECT a.ti, current_date - 28, 8, 240000.00
  FROM alumno a
 WHERE a.ti LIKE 'DEMO-ALU-%'
   AND NOT EXISTS (
       SELECT 1
         FROM pago p
        WHERE p.ti_alumno = a.ti
          AND p.fecha_pago = current_date - 28
          AND p.clases_pagadas = 8
   );

COMMIT;

-- Resumen para comprobar acudientes, estudiantes, edad y estados de asistencia.
SELECT
    u.username,
    a.numero_documento AS acudiente_id,
    concat_ws(' ', a.nombre_1, a.apellido_1) AS acudiente,
    s.ti AS alumno_id,
    concat_ws(' ', s.nombre_1, s.apellido_1) AS alumno,
    extract(year FROM age(current_date, s.fecha_nacimiento))::integer AS edad,
    count(*) FILTER (WHERE ast.estado = 'presente') AS asistencias,
    count(*) FILTER (WHERE ast.estado = 'ausente') AS inasistencias
FROM acudiente a
JOIN auth_user u ON u.id = a.usuario_id
JOIN alumno s ON s.numero_documento_acudiente = a.numero_documento
LEFT JOIN asistencia ast ON ast.alumno_id = s.ti
WHERE a.numero_documento LIKE 'DEMO-ACU-%'
GROUP BY u.username, a.numero_documento, a.nombre_1, a.apellido_1,
         s.ti, s.nombre_1, s.apellido_1, s.fecha_nacimiento
ORDER BY a.numero_documento, s.ti;
