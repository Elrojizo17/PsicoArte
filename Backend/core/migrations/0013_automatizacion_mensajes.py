from django.db import migrations, models
import django.db.models.deletion


DEFAULT_TEMPLATES = {
    'recordatorio_clase': 'Hola, te recordamos que {alumno} tiene clase de {jornada} hoy a las {hora}.',
    'recordatorio_recogida': 'Hola, {alumno} termina su clase de {jornada} a las {hora}. Por favor acércate a recogerlo.',
    'aviso_pago': 'Hola, notamos que el pago de clases de {alumno} está pendiente. Por favor ponte al día para que pueda seguir asistiendo.',
}


def create_templates(apps, schema_editor):
    template_model = apps.get_model('core', 'PlantillaMensaje')
    for tipo, texto in DEFAULT_TEMPLATES.items():
        template_model.objects.get_or_create(tipo=tipo, defaults={'texto': texto, 'activo': True})


def remove_templates(apps, schema_editor):
    apps.get_model('core', 'PlantillaMensaje').objects.filter(tipo__in=DEFAULT_TEMPLATES).delete()


class Migration(migrations.Migration):
    dependencies = [('core', '0012_conversacion_mensaje')]

    operations = [
        migrations.CreateModel(
            name='PlantillaMensaje',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tipo', models.CharField(choices=[('recordatorio_clase', 'Recordatorio de clase'), ('recordatorio_recogida', 'Recordatorio de recogida'), ('aviso_pago', 'Aviso de pago')], max_length=30, unique=True)),
                ('texto', models.TextField()),
                ('activo', models.BooleanField(default=True)),
            ],
            options={'db_table': 'plantilla_mensaje', 'ordering': ['tipo']},
        ),
        migrations.CreateModel(
            name='RecordatorioEnviado',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tipo', models.CharField(choices=[('inicio', 'Inicio'), ('recogida', 'Recogida')], max_length=10)),
                ('enviado_en', models.DateTimeField(auto_now_add=True)),
                ('clase', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='recordatorios_enviados', to='core.claseprogramada')),
            ],
            options={'db_table': 'recordatorio_enviado'},
        ),
        migrations.AddConstraint(
            model_name='recordatorioenviado',
            constraint=models.UniqueConstraint(fields=('clase', 'tipo'), name='uq_recordatorio_clase_tipo'),
        ),
        migrations.RunPython(create_templates, remove_templates),
    ]
