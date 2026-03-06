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
        """Genera XML, firma y envía la factura al SRI."""
        factura = self.get_object()
        from apps.facturacion.services.factura_service import procesar_factura_sri
        result = procesar_factura_sri(factura)
        http_status = status.HTTP_200_OK if result.get('success') else status.HTTP_422_UNPROCESSABLE_ENTITY
        return Response(result, status=http_status)

    @action(detail=True, methods=['get'])
    def xml(self, request, pk=None):
        """Retorna el XML generado/firmado de la factura."""
        factura = self.get_object()
        comp = factura.comprobante
        xml = comp.xml_firmado or comp.xml_generado
        if not xml:
            return Response({'error': 'No hay XML generado aún'}, status=status.HTTP_404_NOT_FOUND)
        from django.http import HttpResponse
        return HttpResponse(xml, content_type='application/xml')

    @action(detail=True, methods=['post'])
    def anular(self, request, pk=None):
        factura = self.get_object()
        factura.comprobante.estado = 'ANULADO'
        factura.comprobante.save()
        return Response({'mensaje': 'Factura anulada'})

    @action(detail=True, methods=['post'])
    def reprocesar(self, request, pk=None):
        """Consulta nuevamente la autorización del SRI para comprobantes en estado ENVIADO."""
        factura = self.get_object()
        comp = factura.comprobante
        if comp.estado != 'ENVIADO':
            return Response(
                {'error': f'Solo se reprocesa desde estado ENVIADO. Estado actual: {comp.estado}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from apps.facturacion.services.sri_service import SRIService
        sri = SRIService(comp.empresa)
        try:
            auth = sri.autorizar_comprobante_sri(comp.clave_acceso)
            if hasattr(auth, 'autorizaciones') and auth.autorizaciones:
                aut = auth.autorizaciones.autorizacion[0]
                if aut.estado == 'AUTORIZADO':
                    comp.estado = 'AUTORIZADO'
                    comp.numero_autorizacion = getattr(aut, 'numeroAutorizacion', '')
                    comp.fecha_autorizacion  = getattr(aut, 'fechaAutorizacion', None)
                    comp.save()
                    return Response({
                        'estado': comp.estado,
                        'numero_autorizacion': comp.numero_autorizacion,
                    })
                else:
                    comp.estado = 'NO_AUTORIZADO'
                    comp.save()
                    return Response({'estado': comp.estado}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
            return Response({'estado': comp.estado, 'mensaje': 'Sin respuesta del SRI — sigue en ENVIADO'})
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['get'])
    def ride(self, request, pk=None):
        """Genera y retorna el RIDE (PDF) de la factura autorizada."""
        factura = self.get_object()
        comp = factura.comprobante
        if comp.estado != 'AUTORIZADO':
            return Response(
                {'error': 'Solo se genera el RIDE de facturas autorizadas'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from apps.facturacion.services.ride_service import generar_ride_pdf
        from django.http import HttpResponse
        pdf_bytes = generar_ride_pdf(factura)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = (
            f'inline; filename="RIDE-{comp.numero_comprobante}.pdf"'
        )
        return response


router = DefaultRouter()
router.register(r'facturas', FacturaViewSet, basename='factura')

urlpatterns = [
    path('', include(router.urls)),
]
