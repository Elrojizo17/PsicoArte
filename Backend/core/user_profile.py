def get_user_profile(user):
    """Return the application's role and display name for an authenticated user."""
    grupo = user.groups.filter(name__in=['Psicologia', 'Musical']).order_by('id').values_list('name', flat=True).first()
    if grupo:
        tipo = 'empresa'
    elif hasattr(user, 'acudiente'):
        tipo = 'acudiente'
    else:
        return None

    nombre = user.get_full_name().strip() or user.username
    if tipo == 'acudiente':
        acudiente = user.acudiente
        nombre = f'{acudiente.nombre_1} {acudiente.nombre_2} {acudiente.apellido_1} {acudiente.apellido_2}'.strip()
        nombre = ' '.join(nombre.split())
    return {'tipo': tipo, 'grupo': grupo, 'nombre': nombre}
