from django.contrib.auth.models import User
from pathlib import PurePosixPath
from rest_framework import serializers
from rest_framework.reverse import reverse
from uuid import uuid4

from .models import (
    Alumno,
    AlumnoClase,
    Asistencia,
    Acudiente,
    ClaseProgramada,
    Conversacion,
    ExcepcionClase,
    Jornada,
    Mensaje,
    Pago,
    PlantillaClase,
    PlantillaClaseAlumno,
    PlantillaMensaje,
)


class PlantillaMensajeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlantillaMensaje
        fields = ('tipo', 'texto', 'activo')
        read_only_fields = ('tipo',)


class AcudienteSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Acudiente
        fields = ('numero_documento', 'nombre_1', 'apellido_1', 'tipo_documento')


class AlumnoSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Alumno
        fields = ('ti', 'nombre_1', 'apellido_1')


class PagoSerializer(serializers.ModelSerializer):
    clases_consumidas = serializers.SerializerMethodField()
    clases_cubiertas = serializers.SerializerMethodField()
    clases_disponibles = serializers.SerializerMethodField()
    fecha_cubre_hasta = serializers.SerializerMethodField()

    class Meta:
        model = Pago
        fields = ('id_pago', 'alumno', 'fecha_pago', 'clases_pagadas', 'valor_pagado', 'clases_consumidas', 'clases_cubiertas', 'clases_disponibles', 'fecha_cubre_hasta')
        read_only_fields = ('id_pago',)

    def _detail(self, obj):
        return next((detail for detail in obj.alumno.detalle_pagos() if detail['pago'].id_pago == obj.id_pago), None)

    def get_clases_consumidas(self, obj):
        return [class_date.isoformat() for class_date in (self._detail(obj) or {}).get('clases_consumidas', [])]

    def get_clases_cubiertas(self, obj):
        return [class_date.isoformat() for class_date in (self._detail(obj) or {}).get('clases_cubiertas', [])]

    def get_clases_disponibles(self, obj):
        return (self._detail(obj) or {}).get('clases_disponibles', 0)

    def get_fecha_cubre_hasta(self, obj):
        value = (self._detail(obj) or {}).get('fecha_cubre_hasta')
        return value.isoformat() if value else None

    def validate(self, attrs):
        if attrs.get('clases_pagadas', 0) <= 0:
            raise serializers.ValidationError({'clases_pagadas': 'Debe registrar al menos una clase.'})
        if attrs.get('valor_pagado', 0) < 0:
            raise serializers.ValidationError({'valor_pagado': 'El valor no puede ser negativo.'})
        return attrs


class JornadaSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Jornada
        fields = ('id_jornada', 'dia_semana', 'tipo_jornada', 'hora_inicio', 'hora_final')


class ClaseSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = ClaseProgramada
        fields = ('id_clase', 'fecha', 'jornada')


class AcudienteSerializer(serializers.ModelSerializer):
    alumnos = AlumnoSummarySerializer(many=True, read_only=True)
    username = serializers.CharField(write_only=True, required=False)
    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False)
    usuario_username = serializers.SerializerMethodField()
    numero_documento = serializers.CharField(required=False, allow_blank=True)
    tipo_documento = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = Acudiente
        fields = (
            'numero_documento',
            'nombre_1',
            'nombre_2',
            'apellido_1',
            'apellido_2',
            'tipo_documento',
            'correo',
            'telefono_1',
            'telefono_2',
            'telefono_3',
            'alumnos',
            'username',
            'password',
            'usuario_username',
        )

    def get_usuario_username(self, obj):
        return obj.usuario.username if obj.usuario_id else None

    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')
        linked_user = self.instance.usuario if self.instance and self.instance.usuario_id else None

        if linked_user and username and username != linked_user.username:
            raise serializers.ValidationError({
                'username': 'El usuario asignado no se puede cambiar desde este formulario.'
            })

        if not linked_user and bool(username) != bool(password):
            raise serializers.ValidationError({
                'username': 'Proporciona usuario y contraseña para crear el acceso.'
            })

        if username:
            users = User.objects.filter(username=username)
            if linked_user:
                users = users.exclude(pk=linked_user.pk)
            if users.exists():
                raise serializers.ValidationError({
                    'username': 'Ya existe un usuario con ese nombre'
                })

        return attrs

    def _create_user(self, acudiente, username, password):
        user = User(username=username)
        user.set_password(password)
        user.save()
        acudiente.usuario = user
        acudiente.save(update_fields=['usuario'])

    def create(self, validated_data):
        username = validated_data.pop('username', None)
        password = validated_data.pop('password', None)
        validated_data['numero_documento'] = validated_data.get('numero_documento') or f'ACU-{uuid4().hex[:12]}'
        acudiente = Acudiente.objects.create(**validated_data)
        if username and password:
            self._create_user(acudiente, username, password)
        return acudiente

    def update(self, instance, validated_data):
        username = validated_data.pop('username', None)
        password = validated_data.pop('password', None)
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()

        if instance.usuario_id:
            if password:
                instance.usuario.set_password(password)
                instance.usuario.save(update_fields=['password'])
        elif username and password:
            self._create_user(instance, username, password)
        return instance


class AlumnoSerializer(serializers.ModelSerializer):
    ti = serializers.CharField(required=False, allow_blank=True)
    numero_documento_acudiente = serializers.PrimaryKeyRelatedField(
        source='acudiente',
        queryset=Acudiente.objects.all(),
        write_only=True,
    )
    acudiente_detalle = AcudienteSummarySerializer(source='acudiente', read_only=True)
    clases = serializers.SerializerMethodField()
    pagos = PagoSerializer(many=True, read_only=True)
    resumen_pagos = serializers.SerializerMethodField()

    class Meta:
        model = Alumno
        fields = (
            'ti',
            'nombre_1',
            'nombre_2',
            'apellido_1',
            'apellido_2',
            'identificacion',
            'tipo_sangre',
            'eps',
            'numero_documento_acudiente',
            'acudiente_detalle',
            'fecha_nacimiento',
            'clases',
            'pagos',
            'resumen_pagos',
        )

    def get_clases(self, obj):
        clases = ClaseProgramada.objects.filter(inscripciones__alumno=obj)
        return ClaseSummarySerializer(clases, many=True).data

    def get_resumen_pagos(self, obj):
        return obj.resumen_pagos()

    def validate(self, attrs):
        request = self.context.get('request')
        guardian = getattr(getattr(request, 'user', None), 'acudiente', None)
        if guardian and 'acudiente' in attrs and attrs['acudiente'].numero_documento != self.instance.acudiente_id:
            raise serializers.ValidationError({'numero_documento_acudiente': 'No puedes cambiar el acudiente del alumno.'})
        return attrs

    def create(self, validated_data):
        validated_data['ti'] = validated_data.get('ti') or f'ALU-{uuid4().hex[:12]}'
        return super().create(validated_data)


class JornadaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Jornada
        fields = ('id_jornada', 'hora_inicio', 'hora_final', 'dia_semana', 'tipo_jornada')
        read_only_fields = ('id_jornada',)

    def validate(self, attrs):
        hora_inicio = attrs.get('hora_inicio', getattr(self.instance, 'hora_inicio', None))
        hora_final = attrs.get('hora_final', getattr(self.instance, 'hora_final', None))
        if hora_inicio and hora_final and hora_final <= hora_inicio:
            raise serializers.ValidationError({'hora_final': 'Debe ser posterior a hora_inicio.'})
        return attrs


class ClaseProgramadaSerializer(serializers.ModelSerializer):
    id_jornada = serializers.PrimaryKeyRelatedField(
        source='jornada',
        queryset=Jornada.objects.all(),
        write_only=True,
    )
    jornada_detalle = JornadaSummarySerializer(source='jornada', read_only=True)
    alumnos = serializers.SerializerMethodField()
    id_plantilla = serializers.PrimaryKeyRelatedField(
        source='plantilla',
        queryset=PlantillaClase.objects.all(),
        required=False,
        allow_null=True,
    )

    class Meta:
        model = ClaseProgramada
        fields = ('id_clase', 'id_jornada', 'jornada_detalle', 'fecha', 'alumnos', 'id_plantilla', 'plantilla')
        read_only_fields = ('id_clase', 'alumnos', 'plantilla')

    def get_alumnos(self, obj):
        alumnos = Alumno.objects.filter(inscripciones__clase=obj)
        request = self.context.get('request')
        guardian = getattr(getattr(request, 'user', None), 'acudiente', None)
        if guardian:
            alumnos = alumnos.filter(acudiente=guardian)
        return AlumnoSummarySerializer(alumnos, many=True).data

    def validate(self, attrs):
        fecha = attrs.get('fecha', getattr(self.instance, 'fecha', None))
        jornada = attrs.get('jornada', getattr(self.instance, 'jornada', None))
        if fecha and jornada:
            day_names = (
                'Lunes',
                'Martes',
                'Miércoles',
                'Jueves',
                'Viernes',
                'Sábado',
                'Domingo',
            )
            expected_day = day_names[fecha.weekday()]
            if jornada.dia_semana != expected_day:
                raise serializers.ValidationError({
                    'id_jornada': (
                        f'La jornada seleccionada corresponde a {jornada.dia_semana}, '
                        f'pero la fecha corresponde a {expected_day}.'
                    )
                })
        return attrs


class PlantillaClaseAlumnoSerializer(serializers.ModelSerializer):
    ti = serializers.PrimaryKeyRelatedField(source='alumno', queryset=Alumno.objects.all())

    class Meta:
        model = PlantillaClaseAlumno
        fields = ('ti', 'alumno')
        read_only_fields = ('alumno',)


class ExcepcionClaseSerializer(serializers.ModelSerializer):
    ti = serializers.PrimaryKeyRelatedField(source='alumno', queryset=Alumno.objects.all())

    class Meta:
        model = ExcepcionClase
        fields = ('id', 'fecha', 'ti', 'accion', 'observacion')
        read_only_fields = ('id',)


class PlantillaClaseSerializer(serializers.ModelSerializer):
    id_jornada = serializers.PrimaryKeyRelatedField(
        source='jornada',
        queryset=Jornada.objects.all(),
        write_only=True,
    )
    jornada_detalle = JornadaSummarySerializer(source='jornada', read_only=True)
    alumnos = serializers.SerializerMethodField()

    class Meta:
        model = PlantillaClase
        fields = (
            'id_plantilla',
            'id_jornada',
            'jornada_detalle',
            'nombre',
            'descripcion',
            'fecha_inicio',
            'fecha_fin',
            'activo',
            'es_recurrente',
            'frecuencia',
            'alumnos',
        )
        read_only_fields = ('id_plantilla', 'alumnos', 'jornada_detalle')

    def get_alumnos(self, obj):
        return AlumnoSummarySerializer(obj.obtener_alumnos_para_fecha(obj.fecha_inicio), many=True).data

    def validate(self, attrs):
        jornada = attrs.get('jornada', getattr(self.instance, 'jornada', None))
        fecha_inicio = attrs.get('fecha_inicio', getattr(self.instance, 'fecha_inicio', None))
        fecha_fin = attrs.get('fecha_fin', getattr(self.instance, 'fecha_fin', None))
        if fecha_inicio and fecha_fin and fecha_fin < fecha_inicio:
            raise serializers.ValidationError({'fecha_fin': 'La fecha final no puede ser anterior a la inicial.'})
        if jornada and fecha_inicio:
            day_names = ('Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo')
            expected_day = day_names[fecha_inicio.weekday()]
            if jornada.dia_semana != expected_day:
                raise serializers.ValidationError({
                    'id_jornada': f'La plantilla usa {jornada.dia_semana}, pero la fecha de inicio es {expected_day}.'
                })
        return attrs


class GenerarClasesSerializer(serializers.Serializer):
    fecha_inicio = serializers.DateField(required=False)
    fecha_fin = serializers.DateField(required=False)

    def validate(self, attrs):
        fecha_inicio = attrs.get('fecha_inicio')
        fecha_fin = attrs.get('fecha_fin')
        if fecha_inicio and fecha_fin and fecha_fin < fecha_inicio:
            raise serializers.ValidationError({
                'fecha_fin': 'La fecha final no puede ser anterior a la inicial.'
            })
        return attrs


class AlumnoClaseSerializer(serializers.ModelSerializer):
    ti = serializers.PrimaryKeyRelatedField(source='alumno', queryset=Alumno.objects.all())
    id_clase = serializers.PrimaryKeyRelatedField(source='clase', queryset=ClaseProgramada.objects.all())
    alumno_detalle = AlumnoSummarySerializer(source='alumno', read_only=True)

    class Meta:
        model = AlumnoClase
        fields = ('ti', 'id_clase', 'alumno_detalle')
        read_only_fields = ('alumno_detalle',)


class AsistenciaSerializer(serializers.ModelSerializer):
    alumno_nombre = serializers.SerializerMethodField()
    fecha = serializers.DateField(source='clase.fecha', read_only=True)
    jornada = JornadaSummarySerializer(source='clase.jornada', read_only=True)

    class Meta:
        model = Asistencia
        fields = ('id_asistencia', 'alumno', 'alumno_nombre', 'clase', 'fecha', 'jornada', 'estado', 'observacion')
        read_only_fields = ('id_asistencia', 'alumno_nombre', 'fecha', 'jornada')

    def get_alumno_nombre(self, obj):
        return f'{obj.alumno.nombre_1} {obj.alumno.apellido_1}'

    def validate(self, attrs):
        alumno = attrs.get('alumno', getattr(self.instance, 'alumno', None))
        clase = attrs.get('clase', getattr(self.instance, 'clase', None))
        estado = attrs.get('estado', getattr(self.instance, 'estado', Asistencia.PROGRAMADA))
        observacion = attrs.get('observacion', getattr(self.instance, 'observacion', ''))
        if alumno and clase and not AlumnoClase.objects.filter(alumno=alumno, clase=clase).exists():
            raise serializers.ValidationError('El alumno no está inscrito en esta clase.')
        if estado == Asistencia.POSPUESTA and not observacion.strip():
            raise serializers.ValidationError({'observacion': 'La clase pospuesta requiere una justificación.'})
        return attrs


class MensajeSerializer(serializers.ModelSerializer):
    remitente_nombre = serializers.SerializerMethodField()
    remitente_id = serializers.IntegerField(read_only=True)
    es_propio = serializers.SerializerMethodField()
    archivo_url = serializers.SerializerMethodField()
    archivo = serializers.SerializerMethodField()
    archivo_upload = serializers.FileField(source='archivo', write_only=True, required=False, allow_null=True)

    class Meta:
        model = Mensaje
        fields = ('id', 'conversacion', 'remitente_id', 'remitente_nombre', 'es_propio', 'cuerpo', 'archivo', 'archivo_url', 'archivo_upload', 'creado_en', 'automatico', 'leido_por_acudiente', 'leido_por_personal')
        read_only_fields = ('id', 'remitente_nombre', 'archivo_url', 'creado_en', 'automatico', 'leido_por_acudiente', 'leido_por_personal')

    def get_remitente_nombre(self, obj):
        if obj.automatico or obj.remitente_id is None:
            return 'PsicoArte'
        return obj.remitente.get_full_name().strip() or obj.remitente.username

    def get_es_propio(self, obj):
        request = self.context.get('request')
        return bool(request and obj.remitente_id == request.user.id)

    def get_archivo_url(self, obj):
        if not obj.archivo:
            return None
        request = self.context.get('request')
        path = reverse('mensaje-archivo', kwargs={'pk': obj.pk}, request=request)
        return path

    def get_archivo(self, obj):
        return PurePosixPath(obj.archivo.name).name if obj.archivo else None

    def validate(self, attrs):
        if not attrs.get('cuerpo') and not attrs.get('archivo'):
            raise serializers.ValidationError('Escribe un mensaje o adjunta un archivo.')
        return attrs


class ConversacionSerializer(serializers.ModelSerializer):
    acudiente_nombre = serializers.SerializerMethodField()
    ultimo_mensaje = serializers.SerializerMethodField()
    no_leidos = serializers.SerializerMethodField()

    class Meta:
        model = Conversacion
        fields = ('id', 'acudiente', 'acudiente_nombre', 'creada_en', 'activa', 'ultimo_mensaje', 'no_leidos')
        read_only_fields = fields

    def get_acudiente_nombre(self, obj):
        return f'{obj.acudiente.nombre_1} {obj.acudiente.apellido_1}'

    def get_ultimo_mensaje(self, obj):
        message = obj.mensajes.order_by('-creado_en', '-id').first()
        return MensajeSerializer(message, context=self.context).data if message else None

    def get_no_leidos(self, obj):
        user = self.context['request'].user
        if hasattr(user, 'acudiente'):
            return obj.mensajes.filter(leido_por_acudiente=False).exclude(remitente=user).count()
        return obj.mensajes.filter(leido_por_personal=False).exclude(remitente=user).count()
