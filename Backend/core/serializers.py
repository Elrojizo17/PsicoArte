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

    class Meta:
        model = Acudiente
        fields = (
            'numero_documento',
            'nombre_1',
            'nombre_2',
            'apellido_1',
            'apellido_2',
            'tipo_documento',
            'telefono_1',
            'telefono_2',
            'telefono_3',
            'alumnos',
        )


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
