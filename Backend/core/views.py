from datetime import timedelta
import mimetypes
from pathlib import Path

from django.http import FileResponse
from django.db import transaction
from django.db.models.deletion import ProtectedError
from django.db.models import Q
from django.contrib.auth import authenticate
from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.authtoken.models import Token
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
import logging
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.throttling import AnonRateThrottle
from rest_framework.response import Response

from .models import (
    JORNADAS_MUSICALES,
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

logger = logging.getLogger(__name__)
from .permissions import EsPersonalEmpresa, EsPersonalEmpresaOAcudiente
from .serializers import (
    AlumnoClaseSerializer,
    AlumnoSerializer,
    AcudienteSerializer,
    ClaseProgramadaSerializer,
    ExcepcionClaseSerializer,
    GenerarClasesSerializer,
    JornadaSerializer,
    PagoSerializer,
    AsistenciaSerializer,
    ConversacionSerializer,
    MensajeSerializer,
    PlantillaClaseAlumnoSerializer,
    PlantillaClaseSerializer,
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
@throttle_classes([AnonRateThrottle])
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

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
        except ProtectedError:
            return Response(
                {'detail': 'No se puede eliminar el alumno porque tiene inscripciones, asistencias o pagos asociados.'},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


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
        try:
            async_to_sync(get_channel_layer().group_send)(
                f'mensajeria_{conversation.id}',
                {'type': 'read_receipt_created'},
            )
        except Exception:
            logger.exception('WebSocket read receipt dispatch failed conversation_id=%s', conversation.id)
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

    @action(detail=True, methods=['get'], url_path='archivo', url_name='archivo')
    def descargar_archivo(self, request, pk=None):
        message = self.get_object()
        if not message.archivo:
            return Response({'detail': 'El mensaje no tiene un archivo adjunto.'}, status=status.HTTP_404_NOT_FOUND)

        filename = Path(message.archivo.name).name
        content_type, _ = mimetypes.guess_type(filename)
        safe_preview_types = {'application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'}
        can_preview = content_type in safe_preview_types
        response = FileResponse(
            message.archivo.open('rb'),
            as_attachment=not can_preview,
            filename=filename,
            content_type=content_type if can_preview else 'application/octet-stream',
        )
        response['X-Content-Type-Options'] = 'nosniff'
        response['Cache-Control'] = 'private, no-store'
        return response

    def perform_create(self, serializer):
        conversation = serializer.validated_data['conversacion']
        if not self.get_queryset().filter(conversacion=conversation).exists() and not self.request.user.groups.filter(name__in=['Psicologia', 'Musical']).exists():
            raise PermissionDenied('No puedes escribir en esta conversación.')
        message = serializer.save(remitente=self.request.user)
        payload = MensajeSerializer(message, context={'request': self.request}).data
        logger.info('Dispatching WebSocket message event conversation_id=%s message_id=%s sender_user_id=%s', conversation.id, message.id, self.request.user.id)
        try:
            async_to_sync(get_channel_layer().group_send)(f'mensajeria_{conversation.id}', {'type': 'message_created', 'message': payload})
        except Exception:
            # The message and attachment are already persisted. Realtime delivery
            # is best effort; clients also refresh the conversation over HTTP.
            logger.exception('WebSocket message dispatch failed conversation_id=%s message_id=%s', conversation.id, message.id)


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

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
        except ProtectedError:
            return Response(
                {'detail': 'No se puede eliminar la clase porque conserva inscripciones o asistencias.'},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

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


class PlantillaClaseViewSet(viewsets.ModelViewSet):
    queryset = PlantillaClase.objects.select_related('jornada').prefetch_related('alumnos__alumno', 'excepciones__alumno').all()
    serializer_class = PlantillaClaseSerializer
    permission_classes = [IsAuthenticated, EsPersonalEmpresa]

    @action(detail=True, methods=['get', 'post'], url_path='alumnos')
    def alumnos(self, request, pk=None):
        plantilla = self.get_object()
        if request.method == 'GET':
            alumnos = plantilla.obtener_alumnos_para_fecha(plantilla.fecha_inicio)
            return Response(AlumnoSerializer(alumnos, many=True).data)

        serializer = PlantillaClaseAlumnoSerializer(data={'ti': request.data.get('ti')})
        serializer.is_valid(raise_exception=True)
        PlantillaClaseAlumno.objects.get_or_create(plantilla=plantilla, alumno=serializer.validated_data['alumno'])
        return Response({'detail': 'Alumno añadido a la plantilla.'}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete'], url_path=r'alumnos/(?P<ti>[^/.]+)')
    def retirar_alumno(self, request, pk=None, ti=None):
        plantilla = self.get_object()
        deleted, _ = PlantillaClaseAlumno.objects.filter(plantilla=plantilla, alumno_id=ti).delete()
        if deleted == 0:
            return Response({'detail': 'El alumno no pertenece a la plantilla.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='excepciones')
    def crear_excepcion(self, request, pk=None):
        plantilla = self.get_object()
        serializer = ExcepcionClaseSerializer(data={**request.data, 'observacion': request.data.get('observacion', '')})
        serializer.is_valid(raise_exception=True)
        serializer.save(plantilla=plantilla)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='generar')
    def generar_clases(self, request, pk=None):
        plantilla = self.get_object()
        if not plantilla.activo:
            return Response(
                {'detail': 'No se pueden generar clases desde una plantilla inactiva.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        range_serializer = GenerarClasesSerializer(data=request.data)
        range_serializer.is_valid(raise_exception=True)
        requested_start = range_serializer.validated_data.get('fecha_inicio', plantilla.fecha_inicio)
        requested_end = range_serializer.validated_data.get(
            'fecha_fin', plantilla.fecha_fin or requested_start
        )
        start = max(requested_start, plantilla.fecha_inicio)
        end = min(requested_end, plantilla.fecha_fin) if plantilla.fecha_fin else requested_end
        if end < start:
            return Response(
                {'detail': 'El rango no contiene fechas dentro del periodo de la plantilla.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if (end - start).days > 5 * 366:
            return Response(
                {'detail': 'El rango de generación no puede superar cinco años.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        base_students = set(
            PlantillaClaseAlumno.objects.filter(plantilla=plantilla).values_list('alumno_id', flat=True)
        )
        exceptions_by_date = {}
        exceptions = ExcepcionClase.objects.filter(
            plantilla=plantilla, fecha__gte=start, fecha__lte=end
        ).values_list('fecha', 'alumno_id', 'accion')
        for exception_date, student_id, exception_action in exceptions:
            exceptions_by_date.setdefault(exception_date, []).append((student_id, exception_action))

        if plantilla.es_recurrente:
            days_to_schedule = (plantilla.fecha_inicio.weekday() - start.weekday()) % 7
            current = start + timedelta(days=days_to_schedule)
            scheduled_dates = []
            while current <= end:
                days_from_anchor = (current - plantilla.fecha_inicio).days
                if plantilla.frecuencia == 'semanal' or days_from_anchor % 14 == 0:
                    scheduled_dates.append(current)
                current += timedelta(days=7)
        else:
            scheduled_dates = [plantilla.fecha_inicio] if start <= plantilla.fecha_inicio <= end else []

        created = []
        with transaction.atomic():
            PlantillaClase.objects.select_for_update().get(pk=plantilla.pk)
            for current in scheduled_dates:
                clase, created_flag = ClaseProgramada.objects.get_or_create(
                    plantilla=plantilla,
                    fecha=current,
                    defaults={'jornada': plantilla.jornada},
                )
                if not created_flag:
                    continue

                created.append(clase.id_clase)
                students_for_date = set(base_students)
                for student_id, exception_action in exceptions_by_date.get(current, []):
                    if exception_action == ExcepcionClase.AGREGAR:
                        students_for_date.add(student_id)
                    elif exception_action == ExcepcionClase.QUITAR:
                        students_for_date.discard(student_id)
                for alumno_id in sorted(students_for_date):
                    AlumnoClase.objects.get_or_create(alumno_id=alumno_id, clase=clase)

        return Response({'generadas': created, 'cantidad': len(created)})


class AlumnoClaseViewSet(viewsets.ModelViewSet):
    queryset = AlumnoClase.objects.select_related('alumno', 'clase').all()
    serializer_class = AlumnoClaseSerializer

    permission_classes = [IsAuthenticated, EsPersonalEmpresa]
