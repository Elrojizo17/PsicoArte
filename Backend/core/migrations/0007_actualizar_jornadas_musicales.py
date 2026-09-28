from django.db import migrations, models


def update_jornadas(apps, schema_editor):
    Jornada = apps.get_model('core', 'Jornada')
    Jornada.objects.using(schema_editor.connection.alias).filter(
        tipo_jornada='Estimulación Inicial',
    ).update(tipo_jornada='Estimulación Temprana')


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0006_jornadas_musicales_fijas'),
    ]

    operations = [
        migrations.RunSQL(
            sql=(
                'ALTER TABLE "jornada" DROP CONSTRAINT IF EXISTS "chk_tipo_jornada"; '
                'ALTER TABLE "jornada" ADD CONSTRAINT "chk_tipo_jornada" CHECK '
                '("tipo_jornada" IN ('
                "'Estimulación Inicial', 'Estimulación Temprana', "
                "'Iniciación Musical', 'Ensamble Musical'));"
            ),
            reverse_sql=(
                'ALTER TABLE "jornada" DROP CONSTRAINT IF EXISTS "chk_tipo_jornada"; '
                'ALTER TABLE "jornada" ADD CONSTRAINT "chk_tipo_jornada" CHECK '
                '("tipo_jornada" IN ('
                "'Estimulación Inicial', 'Iniciación Musical', 'Ensamble Musical'));"
            ),
        ),
        migrations.RunPython(update_jornadas, migrations.RunPython.noop),
        migrations.RunSQL(
            sql=(
                'ALTER TABLE "jornada" DROP CONSTRAINT IF EXISTS "chk_tipo_jornada"; '
                'ALTER TABLE "jornada" ADD CONSTRAINT "chk_tipo_jornada" CHECK '
                '("tipo_jornada" IN ('
                "'Estimulación Temprana', 'Iniciación Musical', 'Ensamble Musical'));"
            ),
            reverse_sql=(
                'ALTER TABLE "jornada" DROP CONSTRAINT IF EXISTS "chk_tipo_jornada"; '
                'ALTER TABLE "jornada" ADD CONSTRAINT "chk_tipo_jornada" CHECK '
                '("tipo_jornada" IN ('
                "'Estimulación Inicial', 'Estimulación Temprana', "
                "'Iniciación Musical', 'Ensamble Musical'));"
            ),
        ),
        migrations.AlterField(
            model_name='jornada',
            name='tipo_jornada',
            field=models.CharField(
                choices=[
                    ('Estimulación Temprana', 'Estimulación Temprana'),
                    ('Iniciación Musical', 'Iniciación Musical'),
                    ('Ensamble Musical', 'Ensamble Musical'),
                ],
                max_length=30,
            ),
        ),
    ]
