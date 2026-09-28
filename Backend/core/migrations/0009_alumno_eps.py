from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0008_documentos_opcionales'),
    ]

    operations = [
        migrations.AddField(
            model_name='alumno',
            name='eps',
            field=models.CharField(blank=True, max_length=150),
        ),
    ]
