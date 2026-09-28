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
)

from django.urls import path

router = DefaultRouter()
router.register('acudientes', AcudienteViewSet, basename='acudiente')
router.register('alumnos', AlumnoViewSet, basename='alumno')
router.register('jornadas', JornadaViewSet, basename='jornada')
router.register('clases', ClaseProgramadaViewSet, basename='clase')
router.register('alumno-clase', AlumnoClaseViewSet, basename='alumno-clase')
router.register('pagos', PagoViewSet, basename='pago')
router.register('asistencias', AsistenciaViewSet, basename='asistencia')
router.register('mensajeria/conversaciones', ConversacionViewSet, basename='conversacion')
router.register('mensajeria/mensajes', MensajeViewSet, basename='mensaje')

urlpatterns = [path('login/', login_view, name='login')] + router.urls
