from rest_framework.permissions import BasePermission


class EsPersonalEmpresa(BasePermission):
    def has_permission(self, request, view):
        return request.user.groups.filter(name__in=['Psicologia', 'Musical']).exists()


class EsPersonalEmpresaOAcudiente(BasePermission):
    def has_permission(self, request, view):
        user = request.user
        return (
            user.groups.filter(name__in=['Psicologia', 'Musical']).exists()
            or hasattr(user, 'acudiente')
        )
