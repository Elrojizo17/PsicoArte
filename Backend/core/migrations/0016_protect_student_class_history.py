import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0015_plantillaclase_claseprogramada_plantilla_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='alumnoclase',
            name='alumno',
            field=models.ForeignKey(
                db_column='ti',
                on_delete=django.db.models.deletion.PROTECT,
                related_name='inscripciones',
                to='core.alumno',
            ),
        ),
        migrations.AlterField(
            model_name='alumnoclase',
            name='clase',
            field=models.ForeignKey(
                db_column='id_clase',
                on_delete=django.db.models.deletion.PROTECT,
                related_name='inscripciones',
                to='core.claseprogramada',
            ),
        ),
        migrations.AlterField(
            model_name='asistencia',
            name='alumno',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='asistencias',
                to='core.alumno',
            ),
        ),
        migrations.AlterField(
            model_name='asistencia',
            name='clase',
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name='asistencias',
                to='core.claseprogramada',
            ),
        ),
        migrations.AlterField(
            model_name='pago',
            name='alumno',
            field=models.ForeignKey(
                db_column='ti_alumno',
                on_delete=django.db.models.deletion.PROTECT,
                related_name='pagos',
                to='core.alumno',
            ),
        ),
    ]
