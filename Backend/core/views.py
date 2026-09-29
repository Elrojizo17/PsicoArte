from django.db.models.deletion import ProtectedError
from django.db.models import Q
from django.contrib.auth import authenticate
from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.authtoken.models import Token
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import JORNADAS_MUSICALES, Alumno, AlumnoClase, Asistencia, Acudiente, ClaseProgramada, Conversacion, Jornada, Mensaje, Pago, PlantillaMensaje
from .permissions import EsPersonalEmpresa, EsPersonalEmpresaOAcudiente
from .serializers import (
    AlumnoClaseSerializer,
    AlumnoSerializer,
    AcudienteSerializer,
    ClaseProgramadaSerializer,
    JornadaSerializer,
    PagoSerializer,
    AsistenciaSerializer,
    ConversacionSerializer,
    MensajeSerializer,
    PlantillaMensajeSerializer,
)


class PlantillaMensajeListUpdateView(viewsets.ModelViewSet):
    queryset = PlantillaMensaje.objects.all()
    serializer_class = PlantillaMensajeSerializer
    permission_classes = [IsAuthenticated, EsPersonalEmpresa]
    lookup_field = 'tipo'
    http_method_names = ['get', 'patch', 'head', 'options']


@api_view(['POST'])
@permission_classes([IsAuthenticated, EsPersonalEmpresa])
def aviso_pagos_view(request):
    from .automation import crear_mensaje_automatico

    plantilla = PlantillaMensaje.objects.get(tipo=PlantillaMensaje.AVISO_PAGO)
    notified = set()
    for alumno in Alumno.objects.select_related('acudiente').all():
        if alumno.resumen_pagos()['estado_pago'] not in ('sin_pago', 'vencido') or alumno.acudiente_id in notified:
            continue
        nombre = ' '.join(filter(None, [alumno.nombre_1, alumno.nombre_2, alumno.apellido_1, alumno.apellido_2]))
        crear_mensaje_automatico(alumno.acudiente, plantilla.texto.format(alumno=nombre, hora='', jornada=''))
        notified.add(alumno.acudiente_id)
    return Response({'enviados': len(notified)})


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
        if self.action in ('list', 'retrieve', 'update', 'partial_update'):
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


class PagoViewSet(viewsets.ModelViewSet):
    queryset = Pago.objects.select_related('alumno', 'alumno__acudiente').all()
    serializer_class = PagoSerializer

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
            return queryset.filter(alumno__acudiente=user.acudiente)
        return queryset.none()


class AsistenciaViewSet(viewsets.ModelViewSet):
    queryset = Asistencia.objects.select_related('alumno', 'clase', 'clase__jornada').all()
    serializer_class = AsistenciaSerializer

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
            return queryset.filter(alumno__acudiente=user.acudiente)
        return queryset.none()


class ConversacionViewSet(viewsets.ModelViewSet):
    queryset = Conversacion.objects.select_related('acudiente').prefetch_related('mensajes').all()
    serializer_class = ConversacionSerializer
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.groups.filter(name__in=['Psicologia', 'Musical']).exists():
            for guardian in Acudiente.objects.all():
                Conversacion.objects.get_or_create(acudiente=guardian)
            return queryset
        if hasattr(user, 'acudiente'):
            conversation, _ = Conversacion.objects.get_or_create(acudiente=user.acudiente)
            return queryset.filter(pk=conversation.pk)
        return queryset.none()

    @action(detail=True, methods=['post'], url_path='marcar-leidos')
    def mark_read(self, request, pk=None):
        conversation = self.get_object()
        messages = conversation.mensajes.all()
        if hasattr(request.user, 'acudiente'):
            messages.exclude(remitente=request.user).update(leido_por_acudiente=True)
        else:
            messages.exclude(remitente=request.user).update(leido_por_personal=True)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MensajeViewSet(viewsets.ModelViewSet):
    queryset = Mensaje.objects.select_related('conversacion__acudiente', 'remitente').all()
    serializer_class = MensajeSerializer
    http_method_names = ['get', 'post', 'head', 'options']

    def get_queryset(self):
        queryset = super().get_queryset()
        conversation_id = self.request.query_params.get('conversacion')
        if conversation_id:
            queryset = queryset.filter(conversacion_id=conversation_id)
        user = self.request.user
        if user.groups.filter(name__in=['Psicologia', 'Musical']).exists():
            return queryset
        if hasattr(user, 'acudiente'):
            return queryset.filter(conversacion__acudiente=user.acudiente)
        return queryset.none()

    def perform_create(self, serializer):
        conversation = serializer.validated_data['conversacion']
        if not self.get_queryset().filter(conversacion=conversation).exists() and not self.request.user.groups.filter(name__in=['Psicologia', 'Musical']).exists():
            raise PermissionDenied('No puedes escribir en esta conversación.')
        message = serializer.save(remitente=self.request.user)
        payload = MensajeSerializer(message, context={'request': self.request}).data
        async_to_sync(get_channel_layer().group_send)(f'mensajeria_{conversation.id}', {'type': 'message_created', 'message': payload})


class JornadaViewSet(viewsets.ModelViewSet):
    queryset = Jornada.objects.filter(
        Q(
            *[
                Q(
                    dia_semana=day,
                    hora_inicio=start,
                    hora_final=end,
                    tipo_jornada=kind,
                )
                for day, start, end, kind in JORNADAS_MUSICALES
            ],
            _connector=Q.OR,
        )
    )
    serializer_class = JornadaSerializer
    permission_classes = [IsAuthenticated, EsPersonalEmpresa]
    http_method_names = ['get', 'head', 'options']


class ClaseProgramadaViewSet(viewsets.ModelViewSet):
    queryset = ClaseProgramada.objects.select_related('jornada').prefetch_related('inscripciones__alumno').all()
    serializer_class = ClaseProgramadaSerializer

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
            return queryset.filter(inscripciones__alumno__acudiente=user.acudiente).distinct()
        return queryset.none()

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
