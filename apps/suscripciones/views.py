from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .models import PlanSuscripcion, Suscripcion
from .serializers import PlanSuscripcionSerializer, SuscripcionSerializer


class PlanSuscripcionViewSet(viewsets.ReadOnlyModelViewSet):
    """Lista pública de planes activos (solo lectura)."""
    serializer_class = PlanSuscripcionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return PlanSuscripcion.objects.filter(activo=True).order_by('precio')


class SuscripcionViewSet(viewsets.ReadOnlyModelViewSet):
    """Suscripciones de la empresa del usuario autenticado."""
    serializer_class = SuscripcionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_superuser or getattr(user, 'rol', None) == 'SUPER_ADMIN':
            return Suscripcion.objects.select_related('plan', 'empresa').all()
        empresa = getattr(user, 'empresa', None)
        if empresa:
            return Suscripcion.objects.select_related('plan', 'empresa').filter(empresa=empresa)
        return Suscripcion.objects.none()

    @action(detail=False, methods=['get'])
    def activa(self, request):
        """Devuelve la suscripción activa/vigente de la empresa actual."""
        empresa = getattr(request.user, 'empresa', None)
        if not empresa:
            return Response({'detail': 'No tienes empresa asignada.'}, status=status.HTTP_404_NOT_FOUND)
        suscripcion = (
            Suscripcion.objects
            .select_related('plan', 'empresa')
            .filter(empresa=empresa)
            .exclude(estado='CANCELADA')
            .order_by('-fecha_inicio')
            .first()
        )
        if not suscripcion:
            return Response({'detail': 'No hay suscripción activa.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(SuscripcionSerializer(suscripcion).data)

    @action(detail=True, methods=['post'])
    def renovar(self, request, pk=None):
        """Renueva manualmente la suscripción por otro periodo."""
        suscripcion = self.get_object()
        try:
            suscripcion.renovar()
            return Response(SuscripcionSerializer(suscripcion).data)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def cancelar(self, request, pk=None):
        """Cancela la suscripción."""
        suscripcion = self.get_object()
        suscripcion.cancelar()
        return Response(SuscripcionSerializer(suscripcion).data)
