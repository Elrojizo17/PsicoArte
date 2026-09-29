from django.core.management.base import BaseCommand

from core.tasks import ejecutar_recordatorios_periodicos


class Command(BaseCommand):
    help = 'Revisa y envía recordatorios de clases cada minuto.'

    def handle(self, *args, **options):
        self.stdout.write('Recordatorios activos; revisión cada 60 segundos. Ctrl+C para detener.')
        try:
            ejecutar_recordatorios_periodicos()
        except KeyboardInterrupt:
            self.stdout.write('\nProceso de recordatorios detenido.')
