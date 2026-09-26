from django.db import migrations


MODELS = ('alumno', 'acudiente', 'jornada', 'claseprogramada', 'alumnoclase')
PERMISSIONS = ('add', 'change', 'view')


def create_groups(apps, schema_editor):
    Group = apps.get_model('auth', 'Group')
    Permission = apps.get_model('auth', 'Permission')
    ContentType = apps.get_model('contenttypes', 'ContentType')
    db = schema_editor.connection.alias
    for name in ('Psicologia', 'Musical'):
        group, _ = Group.objects.using(db).get_or_create(name=name)
        for model_name in MODELS:
            content_type, _ = ContentType.objects.using(db).get_or_create(
                app_label='core', model=model_name
            )
            for action in PERMISSIONS:
                codename = f'{action}_{model_name}'
                permission, _ = Permission.objects.using(db).get_or_create(
                    content_type=content_type,
                    codename=codename,
                    defaults={'name': f'Can {action} {model_name}'},
                )
                group.permissions.add(permission)


def remove_groups(apps, schema_editor):
    apps.get_model('auth', 'Group').objects.using(schema_editor.connection.alias).filter(
        name__in=('Psicologia', 'Musical')
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ('core', '0004_acudiente_usuario'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [migrations.RunPython(create_groups, remove_groups)]
