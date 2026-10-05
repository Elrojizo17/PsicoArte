-- Datos ficticios para probar PsicoArte en Supabase.
-- Crea dos cuentas demo con perfiles Psicologia y Musical.
-- Es idempotente: usa identificadores/nombres marcados DEMO y evita duplicar relaciones.
-- Revisa que el proyecto Supabase sea el correcto antes de ejecutar.

BEGIN;

-- Cuentas temporales de prueba para los perfiles Psicologia y Musical.
-- Las contraseñas se entregan por separado; el archivo guarda solo hashes Django.
INSERT INTO auth_user (
    password, last_login, is_superuser, username, first_name, last_name,
    email, is_staff, is_active, date_joined
)
VALUES
    ('pbkdf2_sha256$1000000$xAwJG4fccUhxgLri$9HMhFaZsHdmclSeOQAZCFByQ89aWnbqg/rV8wJlebIs=', NULL, FALSE, 'psicoarte.demo.psicologia', 'Demo', 'Psicología',
     'demo.psicologia@example.com', FALSE, TRUE, now()),
    ('pbkdf2_sha256$1000000$w2hafKQ6cO5OBSfI$Csx10DqiAG8qAg8N0yvPtOVZfCnW4/tnnF8AAOJp1iA=', NULL, FALSE, 'psicoarte.demo.musica', 'Demo', 'Música',
     'demo.musica@example.com', FALSE, TRUE, now())
ON CONFLICT (username) DO UPDATE SET
    password = EXCLUDED.password,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    email = EXCLUDED.email,
    is_staff = FALSE,
    is_active = TRUE,
    is_superuser = FALSE;

INSERT INTO auth_group (name)
VALUES ('Psicologia'), ('Musical')
ON CONFLICT (name) DO NOTHING;

INSERT INTO auth_user_groups (user_id, group_id)
SELECT u.id, g.id
  FROM auth_user u
  JOIN auth_group g
    ON (u.username = 'psicoarte.demo.psicologia' AND g.name = 'Psicologia')
    OR (u.username = 'psicoarte.demo.musica' AND g.name = 'Musical')
ON CONFLICT (user_id, group_id) DO NOTHING;

DO $seed$
DECLARE
    v_fecha_clase date := current_date + 1;
    v_dia_demo text;
    v_jornada_id integer;
    v_plantilla_id integer;
    v_clase_id integer;
    v_conversacion_id bigint;
BEGIN
    v_dia_demo := 'Demo-' || CASE extract(isodow FROM v_fecha_clase)::integer
        WHEN 1 THEN 'Lunes'
        WHEN 2 THEN 'Martes'
        WHEN 3 THEN 'Miercoles'
        WHEN 4 THEN 'Jueves'
        WHEN 5 THEN 'Viernes'
        WHEN 6 THEN 'Sabado'
        ELSE 'Domingo'
    END;

    INSERT INTO acudiente (
        numero_documento, nombre_1, nombre_2, apellido_1, apellido_2,
        tipo_documento, correo, telefono_1, telefono_2, telefono_3
    )
    VALUES (
        'DEMO-ACU-0001', 'Camila', '', 'Prueba', 'PsicoArte',
        'CC', 'acudiente.demo@example.com', '3000000001', '', ''
    )
    ON CONFLICT (numero_documento) DO NOTHING;

    INSERT INTO alumno (
        ti, nombre_1, nombre_2, apellido_1, apellido_2, identificacion,
        tipo_sangre, eps, numero_documento_acudiente, fecha_nacimiento
    )
    VALUES
        (
            'DEMO-ALU-0001', 'Valentina', '', 'Prueba', 'Uno', NULL,
            'O+', 'EPS de prueba', 'DEMO-ACU-0001', DATE '2018-01-15'
        ),
        (
            'DEMO-ALU-0002', 'Mateo', '', 'Prueba', 'Dos', NULL,
            'A+', 'EPS de prueba', 'DEMO-ACU-0001', DATE '2019-06-20'
        )
    ON CONFLICT (ti) DO NOTHING;

    SELECT id_jornada
      INTO v_jornada_id
      FROM jornada
     WHERE dia_semana = v_dia_demo
       AND hora_inicio = TIME '09:00'
       AND hora_final = TIME '09:45'
       AND tipo_jornada = 'Estimulación Temprana'
     ORDER BY id_jornada
     LIMIT 1;

    IF v_jornada_id IS NULL THEN
        INSERT INTO jornada (dia_semana, hora_inicio, hora_final, tipo_jornada)
        VALUES (v_dia_demo, TIME '09:00', TIME '09:45', 'Estimulación Temprana')
        RETURNING id_jornada INTO v_jornada_id;
    END IF;

    SELECT id_plantilla
      INTO v_plantilla_id
      FROM plantilla_clase
     WHERE nombre = 'DEMO - Clase de prueba PsicoArte'
     ORDER BY id_plantilla
     LIMIT 1;

    IF v_plantilla_id IS NULL THEN
        INSERT INTO plantilla_clase (
            id_jornada, nombre, descripcion, fecha_inicio, fecha_fin,
            activo, es_recurrente, frecuencia
        )
        VALUES (
            v_jornada_id,
            'DEMO - Clase de prueba PsicoArte',
            'Registro ficticio para probar PsicoArte.',
            v_fecha_clase,
            v_fecha_clase,
            TRUE,
            FALSE,
            'semanal'
        )
        RETURNING id_plantilla INTO v_plantilla_id;
    END IF;

    INSERT INTO plantilla_clase_alumno (plantilla_id, alumno_id)
    VALUES
        (v_plantilla_id, 'DEMO-ALU-0001'),
        (v_plantilla_id, 'DEMO-ALU-0002')
    ON CONFLICT (plantilla_id, alumno_id) DO NOTHING;

    SELECT id_clase
      INTO v_clase_id
      FROM clase_programada
     WHERE plantilla_id = v_plantilla_id
       AND fecha = v_fecha_clase
     ORDER BY id_clase
     LIMIT 1;

    IF v_clase_id IS NULL THEN
        INSERT INTO clase_programada (id_jornada, fecha, plantilla_id)
        VALUES (v_jornada_id, v_fecha_clase, v_plantilla_id)
        RETURNING id_clase INTO v_clase_id;
    END IF;

    INSERT INTO alumno_clase (ti, id_clase)
    VALUES
        ('DEMO-ALU-0001', v_clase_id),
        ('DEMO-ALU-0002', v_clase_id)
    ON CONFLICT (ti, id_clase) DO NOTHING;

    INSERT INTO pago (ti_alumno, fecha_pago, clases_pagadas, valor_pagado)
    SELECT alumno_id, current_date, 4, 120000.00
      FROM (VALUES ('DEMO-ALU-0001'), ('DEMO-ALU-0002')) AS demo(alumno_id)
     WHERE NOT EXISTS (
         SELECT 1
           FROM pago p
          WHERE p.ti_alumno = demo.alumno_id
            AND p.fecha_pago = current_date
            AND p.clases_pagadas = 4
     );

    INSERT INTO asistencia (alumno_id, clase_id, estado, observacion)
    VALUES
        ('DEMO-ALU-0001', v_clase_id, 'programada', 'Asistencia de prueba.'),
        ('DEMO-ALU-0002', v_clase_id, 'programada', 'Asistencia de prueba.')
    ON CONFLICT (alumno_id, clase_id) DO NOTHING;

    SELECT id
      INTO v_conversacion_id
      FROM conversacion
     WHERE acudiente_id = 'DEMO-ACU-0001'
     LIMIT 1;

    IF v_conversacion_id IS NULL THEN
        INSERT INTO conversacion (acudiente_id, creada_en, activa)
        VALUES ('DEMO-ACU-0001', now(), TRUE)
        RETURNING id INTO v_conversacion_id;
    END IF;

    INSERT INTO mensaje (
        conversacion_id, remitente_id, cuerpo, archivo, creado_en,
        leido_por_acudiente, leido_por_personal, automatico
    )
    SELECT
        v_conversacion_id, NULL,
        'Mensaje DEMO: conversación de prueba de PsicoArte.',
        NULL, now(), FALSE, FALSE, FALSE
    WHERE NOT EXISTS (
        SELECT 1
          FROM mensaje
         WHERE conversacion_id = v_conversacion_id
           AND cuerpo = 'Mensaje DEMO: conversación de prueba de PsicoArte.'
    );
END
$seed$;

COMMIT;

-- Resumen de los registros creados para verificar la importación.
SELECT
    a.ti AS alumno_id,
    concat_ws(' ', a.nombre_1, a.apellido_1) AS alumno,
    ac.numero_documento AS acudiente_id,
    concat_ws(' ', ac.nombre_1, ac.apellido_1) AS acudiente,
    cp.fecha AS fecha_clase,
    j.dia_semana,
    j.hora_inicio,
    j.tipo_jornada
FROM alumno AS a
JOIN acudiente AS ac
    ON ac.numero_documento = a.numero_documento_acudiente
LEFT JOIN alumno_clase AS alc
    ON alc.ti = a.ti
LEFT JOIN clase_programada AS cp
    ON cp.id_clase = alc.id_clase
LEFT JOIN jornada AS j
    ON j.id_jornada = cp.id_jornada
WHERE a.ti LIKE 'DEMO-%'
ORDER BY a.ti, cp.fecha;

SELECT u.username, g.name AS perfil
  FROM auth_user AS u
  JOIN auth_user_groups AS ug ON ug.user_id = u.id
  JOIN auth_group AS g ON g.id = ug.group_id
 WHERE u.username IN ('psicoarte.demo.psicologia', 'psicoarte.demo.musica')
 ORDER BY u.username;

