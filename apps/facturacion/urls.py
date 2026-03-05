from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
import django_filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import Factura, DetalleFactura
from .serializers import FacturaSerializer, DetalleFacturaSerializer


class FacturaFilter(django_filters.FilterSet):
    estado = django_filters.CharFilter(field_name='comprobante__estado', lookup_expr='iexact')
    cliente = django_filters.NumberFilter(field_name='cliente__id')

    class Meta:
        model = Factura
        fields = ['cliente']


class FacturaViewSet(viewsets.ModelViewSet):
    serializer_class = FacturaSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = FacturaFilter
    search_fields = ['comprobante__numero_comprobante', 'cliente__razon_social']
    ordering_fields = ['comprobante__fecha_emision', 'total']
    ordering = ['-comprobante__fecha_emision']

    def _get_empresa(self):
        """Obtiene la empresa del tenant o del usuario autenticado."""
        empresa = getattr(self.request, 'tenant', None)
        if not empresa and self.request.user.is_authenticated:
            empresa = getattr(self.request.user, 'empresa', None)
        return empresa

    def get_queryset(self):
        empresa = self._get_empresa()
        if empresa:
            return Factura.objects.select_related(
                'comprobante', 'cliente'
            ).filter(comprobante__empresa=empresa)
        return Factura.objects.none()

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=['post'])
    def enviar_sri(self, request, pk=None):
        factura = self.get_object()
        return Response({'mensaje': 'Envío al SRI pendiente de implementación'})

    @action(detail=True, methods=['post'])
    def anular(self, request, pk=None):
        factura = self.get_object()
        factura.comprobante.estado = 'ANULADO'
        factura.comprobante.save()
        return Response({'mensaje': 'Factura anulada'})


router = DefaultRouter()
router.register(r'facturas', FacturaViewSet, basename='factura')

urlpatterns = [
    path('', include(router.urls)),
]
