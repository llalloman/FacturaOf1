from django.conf import settings
from rest_framework.permissions import BasePermission


class HasAutomationToken(BasePermission):
    message = 'Token interno de automation inválido o no configurado.'

    def has_permission(self, request, view):
        expected = getattr(settings, 'AUTOMATION_API_TOKEN', '')
        if not expected:
            return False

        authorization = request.headers.get('Authorization', '')
        header_token = request.headers.get('X-Automation-Token', '')
        bearer = ''
        if authorization.lower().startswith('bearer '):
            bearer = authorization.split(' ', 1)[1].strip()

        return header_token == expected or bearer == expected
