from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0007_actualizar_jornadas_musicales'),
    ]

    operations = [
        migrations.AlterField(
            model_name='acudiente',
            name='numero_documento',
            field=models.CharField(blank=True, max_length=30, primary_key=True, serialize=False),
        ),
        migrations.AlterField(
            model_name='acudiente',
            name='tipo_documento',
            field=models.CharField(blank=True, max_length=30),
        ),
        migrations.AlterField(
            model_name='alumno',
            name='ti',
            field=models.CharField(blank=True, max_length=30, primary_key=True, serialize=False),
        ),
    ]
