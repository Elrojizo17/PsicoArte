<div align="center">
  <img src="./Frontend/public/logo.png" alt="Logo de PsicoArte" width="220">

  # PsicoArte

  **Plataforma de gestión para psicología, estimulación temprana y formación musical**

  [![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20Vite-61DAFB?logo=react&logoColor=white)](./Frontend)
  [![Backend](https://img.shields.io/badge/backend-Django-092E20?logo=django&logoColor=white)](./Backend)
  [![Base de datos](https://img.shields.io/badge/database-PostgreSQL-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
  [![Licencia](https://img.shields.io/badge/status-en%20desarrollo-f5d928)](#estado-del-proyecto)
</div>

<br>

PsicoArte centraliza la administración de alumnos, acudientes, jornadas y clases programadas en una interfaz clara, responsiva y orientada a la gestión diaria de la institución.

> **Creado por Del Valle Software.**

## Índice

- [Características](#características)
- [Tecnologías](#tecnologías)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Configuración del backend](#configuración-del-backend)
- [Ejecución](#ejecución)
- [API disponible](#api-disponible)
- [Validaciones](#validaciones)
- [Estado del proyecto](#estado-del-proyecto)
- [Créditos](#créditos)

## Características

### Gestión de personas

- Registro, edición y eliminación de alumnos.
- Registro, edición y eliminación de acudientes.
- Relación entre cada alumno y su acudiente.
- Visualización expandible de los alumnos a cargo de cada acudiente.
- Consulta de información académica, familiar y de contacto.

### Gestión de jornadas

- Configuración de jornadas cognitivas y musicales.
- Definición del día de la semana y el horario.
- Validación para impedir que la hora de finalización sea anterior o igual a la hora de inicio.
- Protección de jornadas que tienen clases programadas.

### Programación de clases

- Calendario semanal de clases.
- Creación, edición y eliminación de clases programadas.
- Selección de alumnos inscritos en cada clase.
- Consulta detallada al hacer clic en una clase del calendario.
- Visualización de jornada, fecha, horario y alumnos inscritos.
- Prevención de inscripciones duplicadas mediante la relación compuesta alumno-clase.

### Experiencia de usuario

- Diseño responsivo para computador, tableta y móvil.
- Identidad visual basada en la paleta institucional de PsicoArte.
- Modales adaptables para formularios extensos.
- Confirmaciones y mensajes de resultado con SweetAlert2.
- Estados visuales de carga, error y listas vacías.
- Navegación lateral con el logo institucional.

## Tecnologías

### Frontend

- React 19
- TypeScript
- Vite
- React Router
- Tailwind CSS
- PrimeReact
- Lucide React
- Axios
- SweetAlert2

### Backend

- Python 3.14 o compatible
- Django 6.1
- Django REST Framework
- django-cors-headers
- python-dotenv
- PostgreSQL mediante psycopg

## Estructura del proyecto

```text
PsicoArte/
├── Backend/
│   ├── config/              # Configuración principal de Django
│   ├── core/                # Modelos, serializadores, vistas y API
│   ├── manage.py
│   ├── requirements.txt     # Dependencias de Python
│   └── .env                 # Configuración local (no publicar)
├── Frontend/
│   ├── public/              # Logo y recursos públicos
│   ├── src/
│   │   ├── components/      # Componentes reutilizables
│   │   ├── pages/           # Páginas de la aplicación
│   │   ├── services/        # API, alertas y servicios
│   │   └── types/           # Tipos de TypeScript
│   ├── package.json
│   └── package-lock.json
└── README.md
```

## Requisitos

Antes de comenzar, instala:

- Python 3.14 o una versión compatible con las dependencias del proyecto.
- Node.js LTS y npm.
- PostgreSQL.
- Git, opcional para clonar y versionar el proyecto.

## Instalación

### 1. Backend

Desde la carpeta `Backend`, crea un entorno virtual e instala las dependencias:

```powershell
cd Backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Si PowerShell impide activar el entorno virtual, puedes ejecutar directamente el intérprete ubicado en `Backend\.venv\Scripts\python.exe`.

### 2. Frontend

Desde la carpeta `Frontend`:

```powershell
cd Frontend
npm ci
```

## Configuración del backend

Crea el archivo `Backend/.env` a partir de la configuración de tu instalación local de PostgreSQL:

```env
DB_NAME=nombre_de_la_base
DB_USER=usuario_de_postgresql
DB_PASSWORD=contraseña_de_postgresql
DB_HOST=127.0.0.1
DB_PORT=5432
```

No subas este archivo a repositorios públicos. El proyecto ya lo excluye mediante `.gitignore`.

Después de configurar la base de datos, ejecuta las migraciones:

```powershell
cd Backend
python manage.py migrate
```

Si la base de datos ya tenía las tablas iniciales creadas antes de instalar el proyecto, revisa el estado de las migraciones antes de aplicar cambios para evitar duplicados.

## Ejecución

Abre dos terminales.

Al iniciar Django con `python manage.py runserver`, los recordatorios automáticos empiezan en un hilo de fondo y se revisan cada minuto. No necesitas otra terminal ni servicios o paquetes adicionales. También puedes ejecutar el proceso por separado con:

```powershell
python manage.py revisar_recordatorios
```

El proceso solo está activo mientras `runserver` (o el comando separado) siga ejecutándose.

### Terminal 1: API de Django

```powershell
cd Backend
.\.venv\Scripts\Activate.ps1
python manage.py runserver 127.0.0.1:8000
```

La API estará disponible en:

```text
http://127.0.0.1:8000/api/
```

### Terminal 2: aplicación web

```powershell
cd Frontend
npm run dev
```

La aplicación estará disponible en:

```text
http://127.0.0.1:5173/
```

Para generar una compilación de producción del frontend:

```powershell
cd Frontend
npm run build
```

## API disponible

| Recurso | Ruta principal | Uso |
|---|---|---|
| Acudientes | `/api/acudientes/` | Gestionar personas responsables |
| Alumnos | `/api/alumnos/` | Gestionar alumnos y sus relaciones |
| Jornadas | `/api/jornadas/` | Configurar horarios institucionales |
| Clases | `/api/clases/` | Programar clases y consultar inscritos |
| Alumno-clase | `/api/alumno-clase/` | Gestionar relaciones de inscripción |

La API utiliza los endpoints estándar de Django REST Framework para listar, crear, actualizar y eliminar recursos, según las reglas de cada entidad.

## Validaciones

Para comprobar el backend:

```powershell
cd Backend
python manage.py check
python manage.py test
```

Para comprobar el frontend:

```powershell
cd Frontend
npm run build
```

## Estado del proyecto

PsicoArte se encuentra en desarrollo activo. Las funcionalidades principales de gestión de alumnos, acudientes, jornadas y clases están implementadas y conectadas a PostgreSQL.

Antes de publicar el sistema en producción se recomienda:

- Desactivar `DEBUG`.
- Configurar una `SECRET_KEY` segura mediante variables de entorno.
- Definir `ALLOWED_HOSTS`.
- Configurar HTTPS y una política de CORS restringida.
- Usar un servidor de aplicaciones y un servicio de archivos estáticos.
- Mantener respaldos de PostgreSQL.

## Créditos

<div align="center">
  <img src="./Frontend/public/logo.png" alt="PsicoArte" width="120">

  **PsicoArte**

  Desarrollado por **Del Valle Software**

  Gestión, acompañamiento y formación para potenciar el desarrollo de cada alumno.
</div>
