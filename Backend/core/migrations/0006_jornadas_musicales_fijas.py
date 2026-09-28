from datetime import time

from django.db import migrations
from django.db import models


JORNADAS = (
    ('Lunes', time(11, 15), time(12, 0), 'Estimulación Inicial'),
    ('Lunes', time(16, 30), time(17, 15), 'Estimulación Inicial'),
    ('Lunes', time(17, 15), time(18, 0), 'Iniciación Musical'),
    ('Lunes', time(18, 0), time(18, 45), 'Ensamble Musical'),
    ('Martes', time(11, 15), time(12, 0), 'Estimulación Inicial'),
    ('Martes', time(16, 30), time(17, 15), 'Estimulación Inicial'),
    ('Martes', time(17, 15), time(18, 0), 'Iniciación Musical'),
    ('Martes', time(18, 0), time(18, 45), 'Ensamble Musical'),
    ('Miércoles', time(11, 15), time(12, 0), 'Estimulación Inicial'),
    ('Miércoles', time(16, 30), time(17, 15), 'Estimulación Inicial'),
    ('Jueves', time(11, 15), time(12, 0), 'Estimulación Inicial'),
    ('Jueves', time(16, 30), time(17, 15), 'Estimulación Inicial'),
    ('Jueves', time(17, 15), time(18, 0), 'Iniciación Musical'),
    ('Jueves', time(18, 0), time(18, 45), 'Ensamble Musical'),
    ('Viernes', time(17, 0), time(17, 45), 'Iniciación Musical'),
    ('Viernes', time(17, 45), time(18, 30), 'Ensamble Musical'),
)


def seed_jornadas(apps, schema_editor):
    Jornada = apps.get_model('core', 'Jornada')
    db = schema_editor.connection.alias
    for dia_semana, hora_inicio, hora_final, tipo_jornada in JORNADAS:
        Jornada.objects.using(db).get_or_create(
            dia_semana=dia_semana,
            hora_inicio=hora_inicio,
            hora_final=hora_final,
            tipo_jornada=tipo_jornada,
        )


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0005_grupos_empresa'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                'ALTER TABLE "jornada" DROP CONSTRAINT IF EXISTS "chk_tipo_jornada"; '
                'UPDATE "jornada" SET "tipo_jornada" = \'Estimulación Inicial\' '
                'WHERE "tipo_jornada" = \'Desarrollo Cognitivo\'; '
                'UPDATE "jornada" SET "tipo_jornada" = \'Ensamble Musical\' '
                'WHERE "tipo_jornada" = \'Musical\'; '
                'ALTER TABLE "jornada" ADD CONSTRAINT "chk_tipo_jornada" CHECK '
                '("tipo_jornada" IN ('
                "'Estimulación Inicial', 'Iniciación Musical', 'Ensamble Musical'));"
            ),
            reverse_sql=(
                'ALTER TABLE "jornada" DROP CONSTRAINT IF EXISTS "chk_tipo_jornada"; '
                'ALTER TABLE "jornada" ADD CONSTRAINT "chk_tipo_jornada" CHECK '
                '("tipo_jornada" IN ('
                "'Desarrollo Cognitivo', 'Musical'));"
            ),
        ),
        migrations.AlterField(
            model_name='jornada',
            name='tipo_jornada',
            field=models.CharField(
                choices=[
                    ('Estimulación Inicial', 'Estimulación Inicial'),
                    ('Iniciación Musical', 'Iniciación Musical'),
                    ('Ensamble Musical', 'Ensamble Musical'),
                ],
                max_length=30,
            ),
        ),
        migrations.RunPython(seed_jornadas, migrations.RunPython.noop),
    ]
