from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Alumno, AlumnoClase, Acudiente, ClaseProgramada, Jornada


class AcudienteSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Acudiente
        fields = ('numero_documento', 'nombre_1', 'apellido_1', 'tipo_documento')


class AlumnoSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = Alumno
        fields = ('ti', 'nombre_1', 'apellido_1')


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
    numero_documento_acudiente = serializers.PrimaryKeyRelatedField(
        source='acudiente',
        queryset=Acudiente.objects.all(),
        write_only=True,
    )
    acudiente_detalle = AcudienteSummarySerializer(source='acudiente', read_only=True)
    clases = serializers.SerializerMethodField()

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
            'numero_documento_acudiente',
            'acudiente_detalle',
            'fecha_nacimiento',
            'clases',
        )

    def get_clases(self, obj):
        clases = ClaseProgramada.objects.filter(inscripciones__alumno=obj)
        return ClaseSummarySerializer(clases, many=True).data


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

    class Meta:
        model = ClaseProgramada
        fields = ('id_clase', 'id_jornada', 'jornada_detalle', 'fecha', 'alumnos')
        read_only_fields = ('id_clase', 'alumnos')

    def get_alumnos(self, obj):
        alumnos = Alumno.objects.filter(inscripciones__clase=obj)
        return AlumnoSummarySerializer(alumnos, many=True).data


class AlumnoClaseSerializer(serializers.ModelSerializer):
    ti = serializers.PrimaryKeyRelatedField(source='alumno', queryset=Alumno.objects.all())
    id_clase = serializers.PrimaryKeyRelatedField(source='clase', queryset=ClaseProgramada.objects.all())
    alumno_detalle = AlumnoSummarySerializer(source='alumno', read_only=True)

    class Meta:
        model = AlumnoClase
        fields = ('ti', 'id_clase', 'alumno_detalle')
        read_only_fields = ('alumno_detalle',)
