from rest_framework.routers import DefaultRouter

from .views import (
    AlumnoClaseViewSet,
    AlumnoViewSet,
    AcudienteViewSet,
    ClaseProgramadaViewSet,
    JornadaViewSet,
)

router = DefaultRouter()
router.register('acudientes', AcudienteViewSet, basename='acudiente')
router.register('alumnos', AlumnoViewSet, basename='alumno')
router.register('jornadas', JornadaViewSet, basename='jornada')
router.register('clases', ClaseProgramadaViewSet, basename='clase')
router.register('alumno-clase', AlumnoClaseViewSet, basename='alumno-clase')

urlpatterns = router.urls
