from django.db.models.deletion import ProtectedError
from django.contrib.auth import authenticate
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import Alumno, AlumnoClase, Acudiente, ClaseProgramada, Jornada
from .permissions import EsPersonalEmpresa, EsPersonalEmpresaOAcudiente
from .serializers import (
    AlumnoClaseSerializer,
    AlumnoSerializer,
    AcudienteSerializer,
    ClaseProgramadaSerializer,
    JornadaSerializer,
)


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    user = authenticate(
        request, username=request.data.get('username'), password=request.data.get('password')
    )
    if user is None:
        return Response({'detail': 'Credenciales inválidas'}, status=status.HTTP_401_UNAUTHORIZED)

    grupo = user.groups.filter(name__in=['Psicologia', 'Musical']).order_by('id').values_list('name', flat=True).first()
    if grupo:
        tipo = 'empresa'
    elif hasattr(user, 'acudiente'):
        tipo = 'acudiente'
    else:
        return Response({'detail': 'Credenciales inválidas'}, status=status.HTTP_401_UNAUTHORIZED)

    nombre = user.get_full_name().strip() or user.username
    if tipo == 'acudiente':
        acudiente = user.acudiente
        nombre = f'{acudiente.nombre_1} {acudiente.nombre_2} {acudiente.apellido_1} {acudiente.apellido_2}'.strip()
        nombre = ' '.join(nombre.split())
    token, _ = Token.objects.get_or_create(user=user)
    response_data = {'token': token.key, 'tipo': tipo, 'nombre': nombre}
    if tipo == 'empresa':
        response_data['grupo'] = grupo
    return Response(response_data)


class AcudienteViewSet(viewsets.ModelViewSet):
    queryset = Acudiente.objects.prefetch_related('alumnos').all()
    serializer_class = AcudienteSerializer

    permission_classes = [IsAuthenticated, EsPersonalEmpresa]

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

    def get_permissions(self):
        permissions = [IsAuthenticated()]
        if self.action in ('list', 'retrieve'):
            permissions.append(EsPersonalEmpresaOAcudiente())
        else:
            permissions.append(EsPersonalEmpresa())
        return permissions

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.groups.filter(name__in=['Psicologia', 'Musical']).exists():
            return queryset
        if hasattr(user, 'acudiente'):
            return queryset.filter(acudiente=user.acudiente)
        return queryset.none()


class JornadaViewSet(viewsets.ModelViewSet):
    queryset = Jornada.objects.all()
    serializer_class = JornadaSerializer

    permission_classes = [IsAuthenticated, EsPersonalEmpresa]

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

    permission_classes = [IsAuthenticated, EsPersonalEmpresa]

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

    permission_classes = [IsAuthenticated, EsPersonalEmpresa]
