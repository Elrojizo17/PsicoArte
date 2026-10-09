from django.core.management.base import BaseCommand

from core.tasks import ejecutar_recordatorios_periodicos, revisar_recordatorios


class Command(BaseCommand):
    help = 'Revisa y envía recordatorios de clases cada minuto.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Muestra los recordatorios elegibles sin crear mensajes ni enviar push.',
        )

    def handle(self, *args, **options):
        if options['dry_run']:
            resultado = revisar_recordatorios(dry_run=True, output=self.stdout)
            self.stdout.write(
                f"Dry-run: {resultado['recordatorios_elegibles']} recordatorios elegibles."
            )
            return
        self.stdout.write('Recordatorios activos; revisión cada 60 segundos. Ctrl+C para detener.')
        try:
            ejecutar_recordatorios_periodicos()
        except KeyboardInterrupt:
            self.stdout.write('\nProceso de recordatorios detenido.')
