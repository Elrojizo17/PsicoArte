from django.db.models.deletion import ProtectedError
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Alumno, AlumnoClase, Acudiente, ClaseProgramada, Jornada
from .serializers import (
    AlumnoClaseSerializer,
    AlumnoSerializer,
    AcudienteSerializer,
    ClaseProgramadaSerializer,
    JornadaSerializer,
)


class AcudienteViewSet(viewsets.ModelViewSet):
    queryset = Acudiente.objects.prefetch_related('alumnos').all()
    serializer_class = AcudienteSerializer

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
        except ProtectedError:
            return Response(
                {'detail': 'No se puede eliminar un acudiente con alumnos relacionados.'},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class AlumnoViewSet(viewsets.ModelViewSet):
    queryset = Alumno.objects.select_related('acudiente').prefetch_related('inscripciones__clase').all()
    serializer_class = AlumnoSerializer


class JornadaViewSet(viewsets.ModelViewSet):
    queryset = Jornada.objects.all()
    serializer_class = JornadaSerializer

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
        except ProtectedError:
            return Response(
                {'detail': 'No se puede eliminar una jornada con clases programadas.'},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class ClaseProgramadaViewSet(viewsets.ModelViewSet):
    queryset = ClaseProgramada.objects.select_related('jornada').prefetch_related('inscripciones__alumno').all()
    serializer_class = ClaseProgramadaSerializer

    @action(detail=True, methods=['get', 'post'], url_path='alumnos')
    def alumnos(self, request, pk=None):
        clase = self.get_object()
        if request.method == 'GET':
            alumnos = Alumno.objects.filter(inscripciones__clase=clase)
            return Response(AlumnoSerializer(alumnos, many=True).data)

        serializer = AlumnoClaseSerializer(
            data={'ti': request.data.get('ti'), 'id_clase': clase.pk},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path=r'alumnos/(?P<ti>[^/.]+)')
    def retirar_alumno(self, request, pk=None, ti=None):
        clase = self.get_object()
        relacion = AlumnoClase.objects.filter(clase=clase, alumno_id=ti).first()
        if relacion is None:
            return Response(
                {'detail': 'El alumno no está asociado a esta clase.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        relacion.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AlumnoClaseViewSet(viewsets.ModelViewSet):
    queryset = AlumnoClase.objects.select_related('alumno', 'clase').all()
    serializer_class = AlumnoClaseSerializer
