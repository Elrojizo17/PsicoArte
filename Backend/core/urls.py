from rest_framework.routers import DefaultRouter

from .views import (
    AlumnoClaseViewSet,
    AlumnoViewSet,
    AcudienteViewSet,
    ClaseProgramadaViewSet,
    JornadaViewSet,
    login_view,
    PagoViewSet,
    AsistenciaViewSet,
    ConversacionViewSet,
    MensajeViewSet,
    PlantillaClaseViewSet,
    PlantillaMensajeListUpdateView,
    aviso_pagos_view,
    mensaje_masivo_view,
)
from .push_views import PushPublicKeyView, PushSubscriptionView
from .session_views import (
    DeviceSessionDetailView,
    DeviceSessionsView,
    LogoutView,
    WebSocketTicketView,
)

from django.urls import path

router = DefaultRouter()
router.register('acudientes', AcudienteViewSet, basename='acudiente')
router.register('alumnos', AlumnoViewSet, basename='alumno')
router.register('jornadas', JornadaViewSet, basename='jornada')
router.register('clases', ClaseProgramadaViewSet, basename='clase')
router.register('plantillas-clase', PlantillaClaseViewSet, basename='plantilla-clase')
router.register('alumno-clase', AlumnoClaseViewSet, basename='alumno-clase')
router.register('pagos', PagoViewSet, basename='pago')
router.register('asistencias', AsistenciaViewSet, basename='asistencia')
router.register('mensajeria/conversaciones', ConversacionViewSet, basename='conversacion')
router.register('mensajeria/mensajes', MensajeViewSet, basename='mensaje')
router.register('automatizacion/plantillas', PlantillaMensajeListUpdateView, basename='plantilla-mensaje')

urlpatterns = [
    path('login/', login_view, name='login'),
    path('automatizacion/aviso-pagos/', aviso_pagos_view, name='aviso-pagos'),
    path('mensajeria/mensajes-masivos/', mensaje_masivo_view, name='mensaje-masivo'),
    path('push/public-key/', PushPublicKeyView.as_view(), name='push-public-key'),
    path('push/subscriptions/', PushSubscriptionView.as_view(), name='push-subscriptions'),
    path('push/unsubscribe/', PushSubscriptionView.as_view(), name='push-unsubscribe'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('devices/', DeviceSessionsView.as_view(), name='device-sessions'),
    path('devices/<int:session_id>/', DeviceSessionDetailView.as_view(), name='device-session-detail'),
    path('messaging/ws-ticket/', WebSocketTicketView.as_view(), name='websocket-ticket'),
] + router.urls
